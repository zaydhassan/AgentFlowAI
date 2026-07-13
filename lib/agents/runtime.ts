// ============================================================
// Multi-Agent Runtime — the orchestration engine
// ============================================================
// Wires the registered agents into a LangGraph StateGraph (via graph-builder)
// and runs it, streaming AgentEvents for observability:
//   • agent timeline, latency, token usage  — TraceCollector.timeline
//   • reasoning path                          — TraceCollector.reasoningPath
//   • execution graph                         — TraceCollector.snapshot.graph
//   • retries, failures                       — per-agent + run totals
//
// Supported (per the brief):
//   • Conditional routing    — reviewer → executor | planner
//   • Parallel execution     — planner fans out to research/memory/reasoning
//   • Retries                — per-node wrapper (2 retries, backoff)
//   • Human approval checkpoints — interruptBefore:["reviewer"] + resume
//   • Loop prevention        — iterations counter + recursionLimit
//   • Timeouts               — wall-clock + per-LLM AbortSignal
//
// Workspace isolation + tool permissions are enforced at the gateway layer
// (lib/agents/memory.ts); the runtime constructs a per-agent memory gateway
// bound to that agent's declared tools and the run's workspace scope.
//
// Server-only. In-memory run registry (single-process dev server) mirrors the
// execution engine's pattern.

import "server-only";
import { MemorySaver } from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { buildGraph, EXECUTION_GRAPH_SNAPSHOT, AGGREGATOR_NODE, type NodeFn } from "./graph-builder";
import type { GraphState } from "./state";
import { allAgents } from "./registry";
import { ensureAgentsRegistered } from "./agents";
import { TraceCollector } from "./tracing";
import { AgentMemoryGateway, PermissionError } from "./memory";
import { AgentToolGatewayImpl } from "@/lib/mcp/gateway";
import { agentComplete, agentCompleteJson } from "./llm";
import type {
  AgentDefinition,
  AgentEvent,
  AgentRunContext,
  AgentRunOptions,
  AgentRunResult,
  AgentState,
  AgentTimelineEntry,
  ExecutionPlan,
  TraceEvent,
  TraceKind,
} from "./types";
import type { MemoryScope } from "@/lib/memory/types";

// ─────────────────────────── async event queue ──────────────────────────────
// The tracer pushes AgentEvents here (via its sink); the generator drains until
// null. driveGraph closes the queue after pushing the terminal event, which is
// how the generator knows the run ended.

class AsyncQueue<T> {
  private buf: T[] = [];
  private waiter: ((v: T | null) => void) | null = null;
  private closed = false;
  push(v: T): void {
    if (this.closed) return;
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w(v);
    } else {
      this.buf.push(v);
    }
  }
  next(): Promise<T | null> {
    if (this.buf.length) return Promise.resolve(this.buf.shift()!);
    if (this.closed) return Promise.resolve(null);
    return new Promise((resolve) => {
      this.waiter = resolve;
    });
  }
  close(): void {
    this.closed = true;
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w(null);
    }
  }
}

// ─────────────────────────── run registry ───────────────────────────────────

interface CompiledGraph {
  stream: (input: unknown, config: unknown) => Promise<AsyncIterable<unknown>>;
  getState: (config: unknown) => Promise<{ next?: string[]; values?: GraphState }>;
}

interface RunHandle {
  runId: string;
  threadId: string;
  compiled: CompiledGraph;
  tracer: TraceCollector;
  ctxSeed: RuntimeContextSeed;
  opts: AgentRunOptions;
  stopFlag: boolean;
  abort: AbortController;
  approval: { approved: boolean; feedback?: string } | null;
  status: "running" | "awaiting_approval" | "done";
}

const runs = new Map<string, RunHandle>();

export function getAgentRun(runId: string): RunHandle | undefined {
  return runs.get(runId);
}

export function stopAgentRun(runId: string): boolean {
  const h = runs.get(runId);
  if (!h) return false;
  h.stopFlag = true;
  h.abort.abort();
  return true;
}

function unregisterRun(runId: string): void {
  runs.delete(runId);
}

// ─────────────────────────── context seed ───────────────────────────────────

interface RuntimeContextSeed {
  runId: string;
  objective: string;
  userId: string;
  orgId: string | null;
  workflowId: string | null;
  nodeId: string | null;
  memoryScope: MemoryScope;
  maxIterations: number;
  requireApproval: boolean;
  guidance?: string;
  tracer: TraceCollector;
  abort: AbortController;
  stopped: () => boolean;
}

function buildAgentContext(
  seed: RuntimeContextSeed,
  def: AgentDefinition,
  approval: RunHandle["approval"],
): AgentRunContext {
  // Shared trace/reason closures — used by both the memory gateway and the MCP
  // tool gateway so tool invocations surface on the same trace/reasoning path.
  const trace = (kind: TraceKind, detail: string, extra?: Partial<TraceEvent>) => {
    seed.tracer.trace(def.id, kind, detail, { ...extra });
  };
  const reason = (step: string) => {
    seed.tracer.trace(def.id, "agent:reasoning", step);
  };
  return {
    runId: seed.runId,
    agent: def.id,
    userId: seed.userId,
    orgId: seed.orgId,
    workflowId: seed.workflowId,
    nodeId: seed.nodeId,
    memoryScope: seed.memoryScope,
    maxIterations: seed.maxIterations,
    requireApproval: seed.requireApproval,
    guidance: seed.guidance,
    stopped: seed.stopped,
    approval,
    llm: {
      complete: (system, user) => agentComplete(system, user, seed.abort.signal),
      completeJson: (system, user) => agentCompleteJson(system, user, seed.abort.signal),
    },
    memory: new AgentMemoryGateway({
      agent: def.id,
      userId: seed.userId,
      orgId: seed.orgId,
      workflowId: seed.workflowId,
      nodeId: seed.nodeId,
      defaultScope: seed.memoryScope,
      tools: def.tools,
    }),
    // Additive: the MCP tool gateway. Only agents that declare `mcp.invoke`
    // will pass ctx.tools.ensure(); for every other agent it is an unused,
    // no-op-capable surface. Workspace-isolated + audited by construction.
    tools: new AgentToolGatewayImpl({
      agent: def.id,
      userId: seed.userId,
      orgId: seed.orgId,
      workflowId: seed.workflowId,
      nodeId: seed.nodeId,
      runId: seed.runId,
      signal: seed.abort.signal,
      trace: trace as (kind: "agent:log" | "agent:reasoning", detail: string, extra?: Record<string, unknown>) => void,
      reason,
      tools: def.tools,
    }),
    trace,
    reason,
  };
}

// ─────────────────────────── node wrapper ───────────────────────────────────

function wrapAgent(def: AgentDefinition, seed: RuntimeContextSeed, handle: RunHandle): NodeFn {
  return async (state: GraphState, config?: unknown): Promise<Partial<GraphState>> => {
    if (seed.stopped()) throw new CancelledError();
    const cfg = config as { configurable?: { approval?: RunHandle["approval"] } } | undefined;
    const approval = cfg?.configurable?.approval ?? handle.approval;
    const ctx = buildAgentContext(seed, def, approval);

    const maxAttempts = 3;
    let attempt = 0;
    for (;;) {
      try {
        return await def.run(ctx, state as AgentState);
      } catch (err) {
        if (err instanceof CancelledError) throw err;
        const retryable = !(err instanceof PermissionError) && attempt < maxAttempts - 1;
        if (retryable) {
          attempt++;
          seed.tracer.trace(def.id, "agent:retry", `retrying (attempt ${attempt + 1}/${maxAttempts})`, { attempt });
          await sleep(200 * attempt);
          if (seed.stopped()) throw new CancelledError();
          continue;
        }
        seed.tracer.trace(def.id, "agent:fail", message(err), { attempt, error: message(err) });
        return { errors: [`${def.id}: ${message(err)}`] };
      }
    }
  };
}

function aggregatorNode(seed: RuntimeContextSeed): NodeFn {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const count = Object.keys(state.results ?? {}).length;
    seed.tracer.trace("aggregator", "agent:log", `aggregated ${count} result(s)`);
    return {};
  };
}

// ─────────────────────────── public API ─────────────────────────────────────

export function startAgentRun(opts: AgentRunOptions): AsyncGenerator<AgentEvent> {
  return (async function* (): AsyncGenerator<AgentEvent> {
    ensureAgentsRegistered();
    const runId = opts.runId;
    const startedAt = Date.now();
    const abort = new AbortController();
    const checkpointer = new MemorySaver();
    const threadId = runId;
    const maxIterations = opts.maxIterations ?? 2;
    const requireApproval = opts.requireApproval ?? false;

    const queue = new AsyncQueue<AgentEvent>();

    const tracer = new TraceCollector({
      runId,
      objective: opts.objective,
      startedAt,
      graph: EXECUTION_GRAPH_SNAPSHOT,
      sink: (ev) => queue.push(ev),
    });

    const seed: RuntimeContextSeed = {
      runId,
      objective: opts.objective,
      userId: opts.userId,
      orgId: opts.orgId ?? null,
      workflowId: opts.workflowId ?? null,
      nodeId: opts.nodeId ?? null,
      memoryScope: opts.memoryScope ?? "long_term",
      maxIterations,
      requireApproval,
      guidance: opts.guidance,
      tracer,
      abort,
      stopped: () => (opts.stopped ? opts.stopped() : false) || (runs.get(runId)?.stopFlag ?? false),
    };

    const handle: RunHandle = {
      runId,
      threadId,
      compiled: null as unknown as CompiledGraph,
      tracer,
      ctxSeed: seed,
      opts,
      stopFlag: false,
      abort,
      approval: null,
      status: "running",
    };
    runs.set(runId, handle);

    const nodes: Record<string, NodeFn> = {};
    for (const def of allAgents()) nodes[def.id] = wrapAgent(def, seed, handle);
    nodes[AGGREGATOR_NODE] = aggregatorNode(seed);

    const built = buildGraph({ nodes, maxIterations, requireApproval, checkpointer });
    handle.compiled = built.compiled as unknown as CompiledGraph;

    tracer.emit({ type: "run:start", at: 0, runId, nodeName: opts.nodeId ?? undefined });

    // Drive the graph; on completion push the terminal event + close the queue.
    void driveGraph(handle, {
      objective: opts.objective,
      input: opts.input,
      timeoutMs: opts.timeoutMs ?? 120_000,
    }).then((terminal) => {
      if (terminal) queue.push(terminal);
      queue.close();
    });

    try {
      while (true) {
        const ev = await queue.next();
        if (ev === null) break;
        yield ev;
      }
    } finally {
      queue.close();
    }

    if (handle.status !== "awaiting_approval") unregisterRun(runId);
  })();
}

export function resumeAgentRun(
  runId: string,
  decision: { approved: boolean; feedback?: string },
): AsyncGenerator<AgentEvent> {
  return (async function* (): AsyncGenerator<AgentEvent> {
    const handle = runs.get(runId);
    if (!handle) {
      yield { type: "error", at: 0, runId, error: "Run not found or already completed." };
      return;
    }
    handle.approval = decision;
    handle.status = "running";
    handle.stopFlag = false;
    handle.abort = new AbortController();
    handle.ctxSeed.abort = handle.abort;

    handle.tracer.emit({
      type: "approval",
      at: handle.tracer.at(),
      runId,
      reasoning: decision.approved ? "approved by operator" : "rejected by operator",
    });

    const queue = new AsyncQueue<AgentEvent>();
    handle.tracer.setSink((ev) => queue.push(ev));

    void driveGraph(handle, {
      objective: handle.opts.objective,
      input: null,
      timeoutMs: handle.opts.timeoutMs ?? 120_000,
      approval: decision,
    }).then((terminal) => {
      if (terminal) queue.push(terminal);
      queue.close();
    });

    try {
      while (true) {
        const ev = await queue.next();
        if (ev === null) break;
        yield ev;
      }
    } finally {
      queue.close();
    }
    unregisterRun(runId);
  })();
}

// ─────────────────────────── graph driver ───────────────────────────────────

async function driveGraph(
  handle: RunHandle,
  args: { objective: string; input: unknown; timeoutMs: number; approval?: RunHandle["approval"] },
): Promise<AgentEvent | null> {
  const { tracer, ctxSeed } = handle;
  const config: LangGraphRunnableConfig = {
    configurable: { thread_id: handle.threadId, approval: args.approval ?? null },
    recursionLimit: Math.max(12, ctxSeed.maxIterations * 6 + 8),
  };

  const input =
    args.input === null
      ? null
      : ({
          objective: args.objective,
          context: stringifyInput(args.input),
          subtasks: [],
          results: {},
          memories: [],
          reasoningTrail: [],
          trace: [],
          errors: [],
        } as Partial<GraphState>);

  let timedOut = false;
  let streamErr: string | undefined;

  try {
    const stream = await handle.compiled.stream(input, config);
    const drain = (async () => {
      for await (const _chunk of stream) {
        if (handle.stopFlag) break;
        void _chunk; // state diffs ignored — the tracer is the event source
      }
    })();

    const timeout = new Promise<{ timedOut: true }>((resolve) =>
      setTimeout(() => resolve({ timedOut: true }), args.timeoutMs),
    );

    const raced = await Promise.race([drain.then(() => ({ timedOut: false })), timeout]);
    if ((raced as { timedOut: boolean }).timedOut) {
      timedOut = true;
      handle.abort.abort();
    }
  } catch (err) {
    streamErr = message(err);
  }

  if (handle.stopFlag) {
    tracer.setStatus("cancelled");
    return completeEvent(handle, "cancelled");
  }
  if (timedOut) {
    tracer.setError("run timed out");
    tracer.setStatus("failed");
    return completeEvent(handle, "failed", "run timed out");
  }
  if (streamErr) {
    tracer.setError(streamErr);
    tracer.setStatus("failed");
    return completeEvent(handle, "failed", streamErr);
  }

  // Distinguish "paused at approval" from "done".
  const snap = await safeGetState(handle.compiled, config);
  const nextNodes = snap?.next ?? [];
  const pausedAtReview = nextNodes.includes("reviewer");

  if (pausedAtReview && ctxSeed.requireApproval) {
    handle.status = "awaiting_approval";
    tracer.setStatus("awaiting_approval");
    return {
      type: "approval-requested",
      at: tracer.at(),
      runId: handle.runId,
      iteration: tracer.snapshot().iterations,
      plan: extractPlanFromState(snap),
      approvalToken: handle.runId,
    };
  }

  const finalAnswer = snap?.values?.finalAnswer ?? "";
  tracer.setFinalAnswer(finalAnswer);
  tracer.setStatus("succeeded");
  return completeEvent(handle, "succeeded", undefined, finalAnswer);
}

function completeEvent(
  handle: RunHandle,
  status: "succeeded" | "failed" | "cancelled",
  error?: string,
  finalAnswer?: string,
): AgentEvent {
  const snap = handle.tracer.snapshot();
  const totals: AgentEvent["totals"] = {
    durationMs: snap.durationMs,
    totalTokens: snap.totalTokens,
    totalCost: snap.totalCost,
    retries: snap.retries,
    failures: snap.failures,
    iterations: snap.iterations,
    status,
    ...(error ? { error } : {}),
  };
  return {
    type: "complete",
    at: handle.tracer.at(),
    runId: handle.runId,
    totals,
    ...(finalAnswer ? { finalAnswer } : {}),
    ...(error ? { error } : {}),
  };
}

async function safeGetState(
  compiled: CompiledGraph,
  config: LangGraphRunnableConfig,
): Promise<{ next?: string[]; values?: GraphState } | null> {
  try {
    return await compiled.getState(config);
  } catch {
    return null;
  }
}

function extractPlanFromState(snap: { values?: GraphState } | null): ExecutionPlan | undefined {
  return snap?.values?.plan ?? undefined;
}

// ─────────────────────────── helpers ────────────────────────────────────────

class CancelledError extends Error {
  constructor() {
    super("run cancelled");
    this.name = "CancelledError";
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function stringifyInput(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────────── result assembly ────────────────────────────────

export async function runAgentsToCompletion(opts: AgentRunOptions): Promise<AgentRunResult> {
  let result: AgentRunResult | null = null;
  for await (const ev of startAgentRun(opts)) {
    if (ev.type === "complete" && ev.totals) {
      result = {
        runId: opts.runId,
        status: ev.totals.status,
        finalAnswer: ev.finalAnswer ?? "",
        trace: getAgentRun(opts.runId)?.tracer.snapshot() ?? nullTrace(),
        totalTokens: ev.totals.totalTokens,
        totalCost: ev.totals.totalCost,
        durationMs: ev.totals.durationMs,
        ...(ev.error ? { error: ev.error } : {}),
      };
    } else if (ev.type === "approval-requested") {
      result = {
        runId: opts.runId,
        status: "awaiting_approval",
        finalAnswer: "",
        trace: getAgentRun(opts.runId)?.tracer.snapshot() ?? nullTrace(),
        totalTokens: 0,
        totalCost: 0,
        durationMs: ev.at,
      };
    }
  }
  return (
    result ?? {
      runId: opts.runId,
      status: "failed",
      finalAnswer: "",
      trace: nullTrace(),
      totalTokens: 0,
      totalCost: 0,
      durationMs: 0,
      error: "no completion event",
    }
  );
}

function nullTrace(): ReturnType<TraceCollector["snapshot"]> {
  return null as unknown as ReturnType<TraceCollector["snapshot"]>;
}

export function timelineFor(runId: string): AgentTimelineEntry[] {
  return runs.get(runId)?.tracer.snapshot().timeline ?? [];
}

export type { AgentDefinition };