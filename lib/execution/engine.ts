import "server-only";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";
import { getNodeDef } from "@/lib/nodes";
import { resolveAction, runAction, type ActionResult } from "./actions/registry";
import { runMultiAgent, type MultiAgentActionResult } from "./actions/multiagent";
import { getMemoryEngine, embeddingConfigured, type MemoryHit, type MemoryScope } from "@/lib/memory";
import { completeText } from "@/lib/ai/provider";

/**
 * Per-node retry cap for transient failures. Multi-agent runs, integration
 * actions (e.g. Gmail), and the generic node runner all retry up to this many
 * extra attempts before surfacing the failure. Tunable — the docs
 * (app/docs/execution) describe a richer per-node `retry` policy schema as the
 * intended future shape; this is the enforced default today.
 */
export const MAX_NODE_RETRIES = 2;

// Re-exported graph shape (mirrors lib/workflow/graph.ts without a cross-import).
export interface EngineGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export type NodeRunStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "retrying"
  | "skipped"
  | "paused";

export type ExecutionEventType =
  | "started"
  | "node:start"
  | "node:log"
  | "node:reasoning"
  | "node:success"
  | "node:fail"
  | "node:retry"
  | "node:paused"
  | "complete";

export interface ExecutionEvent {
  type: ExecutionEventType;
  at: number; // ms since run start
  nodeId?: string;
  nodeName?: string;
  status?: NodeRunStatus;
  log?: string;
  reasoning?: string;
  attempt?: number;
  durationMs?: number;
  tokensUsed?: number;
  cost?: number;
  retries?: number;
  error?: string;
  // ── AI Workflow Debugger inspection payload (all optional). Carried on
  //  node:success / node:fail so the run route can persist it to ExecutionStep
  //  and the debugger can inspect node I/O, prompts, memories, and tool calls.
  //  Existing consumers ignore unknown fields, so this is fully additive.
  nodeType?: string;
  config?: unknown; // the node's resolved config (tool/action args / prompt template)
  input?: unknown; // upstream outputs consumed by this node (node "input")
  output?: unknown; // this node's structured output (forwarded to downstream)
  prompt?: { system: string; user: string }; // augmented prompt (AI nodes)
  memories?: { score: number; id: string; content: string; scope?: string }[]; // retrieved memories (memory-enabled AI)
  // final summary, only on "complete"
  totals?: {
    durationMs: number;
    totalTokens: number;
    totalCost: number;
    retried: number;
    status: "succeeded" | "failed" | "cancelled";
    error?: string;
  };
}

export interface RunControls {
  breakpoints: Set<string>;
  // Returns "resume" to continue past the breakpoint, "stop" to abort.
  awaitResume: (nodeId: string) => Promise<"resume" | "stop">;
  stopped: () => boolean;
  /** Step mode: when true, the loop pauses before EVERY node (step-by-step).
   *  Set live by the run registry's stepRun(); cleared by resumeRun(). Optional
   *  so existing callers that don't pass it are unaffected. */
  stepMode?: () => boolean;
  /** Authenticated user id — required for real integration-action nodes
   *  (they resolve a connected account owned by this user). Optional so the
   *  engine stays usable for anonymous simulations; a gmail.* node without a
   *  userId fails with a clear "no user context" error instead of crashing. */
  userId?: string;
  /** Workflow id — scopes workflow/agent memory writes + retrieval metadata. */
  workflowId?: string;
  /** Primary org id — scopes "workspace" memory (null when the user has no org). */
  orgId?: string | null;
}

export interface NodeResult {
  nodeId: string;
  nodeName: string;
  status: "succeeded" | "failed";
  durationMs: number;
  tokensUsed: number;
  cost: number;
  retries: number;
  logs: string[];
  reasoning: string[] | null;
  error?: string;
}

export function topoOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const n of nodes) {
    adj.set(n.id, []);
    indeg.set(n.id, 0);
  }
  for (const e of edges) {
    if (!adj.has(e.source) || !indeg.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  const queue: string[] = [];
  for (const [id, d] of indeg) if (d === 0) queue.push(id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      indeg.set(next, (indeg.get(next) ?? 0) - 1);
      if (indeg.get(next) === 0) queue.push(next);
    }
  }
  for (const n of nodes) if (!order.includes(n.id)) order.push(n.id);
  return order.map((id) => nodes.find((n) => n.id === id)!).filter(Boolean);
}

// Deterministic pseudo-random from a string (stable per node across runs).
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function nodeDurationMs(node: WorkflowNode): number {
  const h = hash(node.id + node.type);
  const def = getNodeDef(node.type);
  if (def?.category === "ai") return 1800 + (h % 4000);
  if (def?.category === "memory") return 200 + (h % 500);
  if (def?.category === "rag") return 900 + (h % 1800);
  if (def?.category === "database") return 120 + (h % 400);
  if (def?.category === "files") return 600 + (h % 1200);
  if (node.type.startsWith("trigger")) return 40 + (h % 120);
  if (def?.category === "communication") return 400 + (h % 900);
  if (def?.category === "integrations") return 350 + (h % 700);
  return 80 + (h % 300);
}

export function nodeTokens(node: WorkflowNode): number {
  const def = getNodeDef(node.type);
  if (def?.category !== "ai") return 0;
  return 800 + (hash(node.id) % 4000);
}

// ~6–22% of non-trigger nodes fail on first attempt; retries usually succeed.
export function nodeFailsOn(node: WorkflowNode, attempt: number): boolean {
  if (node.type.startsWith("trigger")) return false;
  const def = getNodeDef(node.type);
  if (!def) return false;
  const flaky = node.type === "dev.rest" || node.type === "store.supabase" || node.type === "comm.slack";
  const base = flaky ? 0.22 : 0.06;
  const h = hash(node.id + attempt);
  const r = (h % 1000) / 1000;
  if (attempt === 0) return r < base;
  return r < base * 0.25;
}

export function nodeLogs(node: WorkflowNode): string[] {
  const def = getNodeDef(node.type);
  const label = node.data.label || def?.label || node.type;
  switch (def?.category) {
    case "ai":
      return [`Calling ${label}`, "Streaming response", "Parsed structured output", "Completed"];
    case "memory":
      return ["Querying memory", "Scored relevance", "Injected context", "Done"];
    case "rag":
      return ["Embedding query", "Searching index", "Top-K retrieved", "Done"];
    case "database":
      return [`Connecting to ${label}`, "Query executed", "1 row(s) affected", "Done"];
    case "communication":
      return [`Authenticating with ${label}`, "Message prepared", "Delivered"];
    case "files":
      return ["Loading document", "Extracting content", "Structured fields ready"];
    case "developer":
      return [`HTTP ${node.data.config.method ?? "GET"} request`, "Response 200", "Body parsed"];
    case "cloud":
      return [`Uploading to ${label}`, "Transfer complete"];
    case "integrations":
      return [`Connecting to ${label}`, "Request sent", "Response received"];
    case "logic":
      return [`Evaluating ${label}`, "Branch resolved"];
    case "utilities":
      return [`Evaluating ${label}`, "Branch resolved"];
    default:
      return [`${label} fired`, "Completed"];
  }
}

export function nodeReasoning(node: WorkflowNode): string[] | null {
  const def = getNodeDef(node.type);
  if (def?.category !== "ai") return null;
  if (node.type === "ai.router") return ["Estimate task complexity", "Compare model cost/quality", "Selected model for this run"];
  if (node.type === "ai.agent") return ["Plan subtasks", "Use search tool", "Synthesize findings"];
  if (node.type === "ai.memory") return ["Query long-term memory", "Score relevance", "Inject context"];
  return ["Parse input", "Generate", "Validate output"];
}

// Real integration actions read their upstream nodes' outputs and emit a
// structured output for downstream nodes. Simulated nodes synthesize a
// representative output so a downstream real node (e.g. gmail.label.add after a
// simulated trigger) still has something to consume.

export function upstreamOutputs(
  graph: EngineGraph,
  node: WorkflowNode,
  nodeOutputs: Map<string, unknown>,
): unknown[] {
  const out: unknown[] = [];
  for (const e of graph.edges) {
    if (e.target === node.id && nodeOutputs.has(e.source)) out.push(nodeOutputs.get(e.source));
  }
  return out;
}

export function synthOutput(node: WorkflowNode): unknown {
  const def = getNodeDef(node.type);
  const label = node.data.label || def?.label || node.type;
  if (def?.category === "communication" || def?.category === "integrations" || node.type.startsWith("trigger")) {
    return { items: [{ id: "sim_1", subject: `${label} result`, simulated: true }], count: 1 };
  }
  return { value: label, simulated: true };
}

const TOKEN_RATE = 0.002 / 1000; // $0.002 per 1k tokens — illustrative

// Map a simulated node duration to a real wall-clock delay that's watchable
// but not tedious: scale down, then clamp.
function realDelay(dur: number): number {
  return Math.max(120, Math.min(1400, Math.round(dur * 0.4)));
}

function sleep(ms: number, stopped: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const end = Date.now() + ms;
    const check = () => {
      if (stopped() || Date.now() >= end) return resolve();
      setTimeout(check, 40);
    };
    setTimeout(check, 40);
  });
}

// AI nodes that opt into long-term memory (config.useMemory === true) take a
// real path: retrieve relevant memories → inject into the prompt → generate a
// real response (real LLM via lib/ai, or the shipped deterministic fallback
// when no key) → store the exchange as a new memory. When embeddings are
// unconfigured, memory no-ops (logs "memory disabled — embeddings not
// configured") but the node still generates a real response — it never fakes
// embeddings. Mirrors the gmail real-action branch shape: single source of
// truth for streaming events + nodeOutputs.

function isMemoryAINode(node: WorkflowNode): boolean {
  const def = getNodeDef(node.type);
  // ai.multiAgent manages its own memory via the runtime's memory gateway
  // (config.memoryScope), so it never takes the single-LLM memory-AI branch.
  if (node.type === "ai.multiAgent") return false;
  return def?.category === "ai" && node.data.config?.useMemory === true;
}

function safeStringify(x: unknown): string {
  if (x == null) return "(null)";
  if (typeof x === "string") return x;
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

function buildMemoryUserPrompt(node: WorkflowNode, inputs: unknown[]): string {
  const cfg = node.data.config ?? {};
  const task =
    typeof cfg.template === "string" && cfg.template.trim() ? cfg.template :
    typeof cfg.goal === "string" && cfg.goal.trim() ? cfg.goal :
    typeof cfg.system === "string" && cfg.system.trim() ? cfg.system :
    (node.data.label || node.type);
  const inputText = inputs.length
    ? inputs.map((x, i) => `[input ${i + 1}]\n${safeStringify(x)}`).join("\n\n")
    : "(no upstream input)";
  return `Task:\n${task}\n\nInput:\n${inputText}`;
}

const MEMORY_TOP_K = Number(process.env.MEMORY_TOP_K ?? 5) || 5;
const MEMORY_THRESHOLD = Number(process.env.MEMORY_SIMILARITY_THRESHOLD ?? 0.75) || 0.75;

export async function* runWorkflow(
  graph: EngineGraph,
  controls: RunControls,
): AsyncGenerator<ExecutionEvent, NodeResult[], unknown> {
  const t0 = Date.now();
  const at = () => Date.now() - t0;
  const results: NodeResult[] = [];
  // nodeId → last output. Feeds real integration actions from upstream nodes
  // and is populated by both real and simulated nodes on success.
  const nodeOutputs = new Map<string, unknown>();
  let totalTokens = 0;
  let totalCost = 0;
  let retried = 0;
  let runStatus: "succeeded" | "failed" | "cancelled" = "succeeded";
  let runError: string | undefined;

  yield { type: "started", at: 0 };

  const order = topoOrder(graph.nodes, graph.edges);

  for (const node of order) {
    if (controls.stopped()) {
      runStatus = "cancelled";
      break;
    }

    // Breakpoint or step mode: pause before the node and wait for resume/stop.
    // Step mode pauses before every node (step-by-step debugging); explicit
    // breakpoints pause only at marked nodes. Both reuse the same pause/resume
    // seam so the run route + debugger controls are unified.
    if (controls.breakpoints.has(node.id) || controls.stepMode?.()) {
      yield { type: "node:paused", at: at(), nodeId: node.id, nodeName: node.data.label, status: "paused" };
      const decision = await controls.awaitResume(node.id);
      if (decision === "stop" || controls.stopped()) {
        runStatus = "cancelled";
        break;
      }
    }

    yield { type: "node:start", at: at(), nodeId: node.id, nodeName: node.data.label, status: "running", attempt: 0 };

    const nodeStart = Date.now();

    // AI nodes with useMemory=true take this real path; every other node falls
    // through to the integration-action / simulation paths below, unchanged.
    if (isMemoryAINode(node)) {
      const stepLogs: string[] = [];

      if (!controls.userId) {
        const realError = "No user context — sign in to run memory-enabled AI nodes.";
        const elapsed0 = Date.now() - nodeStart;
        yield { type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: realError, attempt: 0, error: realError, durationMs: elapsed0, tokensUsed: 0, cost: 0, retries: 0, nodeType: node.type };
        runStatus = "failed";
        runError = runError ?? `Node "${node.data.label || node.type}" failed`;
        results.push({ nodeId: node.id, nodeName: node.data.label || node.type, status: "failed", durationMs: elapsed0, tokensUsed: 0, cost: 0, retries: 0, logs: [realError], reasoning: null, error: realError });
        await sleep(80, controls.stopped);
        if (controls.stopped()) { runStatus = "cancelled"; break; }
        continue;
      }

      const cfg = node.data.config ?? {};
      const scope = (typeof cfg.memoryScope === "string" ? cfg.memoryScope : "long_term") as MemoryScope;
      const importance = Number(cfg.memoryImportance ?? 0.6) || 0.6;
      const inputs = upstreamOutputs(graph, node, nodeOutputs);
      const userPrompt = buildMemoryUserPrompt(node, inputs);

      let hits: MemoryHit[] = [];
      if (!embeddingConfigured()) {
        const disabled = "🧠 memory disabled — embeddings not configured (set OPENAI_API_KEY)";
        stepLogs.push(disabled);
        yield { type: "node:log", at: at(), nodeId: node.id, log: disabled, status: "running", attempt: 0 };
      } else {
        try {
          const result = await getMemoryEngine().recall({
            userId: controls.userId,
            orgId: controls.orgId ?? null,
            scope,
            query: userPrompt,
            workflowId: controls.workflowId ?? null,
            agentId: node.id,
            topK: MEMORY_TOP_K,
            threshold: MEMORY_THRESHOLD,
          });
          hits = result.hits;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "memory recall failed";
          stepLogs.push(`🧠 memory · recall error: ${msg}`);
          yield { type: "node:log", at: at(), nodeId: node.id, log: `🧠 memory · recall error: ${msg}`, status: "running", attempt: 0 };
        }
        if (controls.stopped()) { runStatus = "cancelled"; break; }
        const scores = hits.map((h) => h.score.toFixed(2)).join(", ");
        const summary = `🧠 memory · retrieved ${hits.length}${scores ? ` (${scores})` : ""} · scope=${scope}`;
        stepLogs.push(summary);
        yield { type: "node:log", at: at(), nodeId: node.id, log: summary, status: "running", attempt: 0 };
        for (const h of hits) {
          const preview = h.memory.content.replace(/\s+/g, " ").slice(0, 120);
          const line = `   · [${h.score.toFixed(2)}] ${preview}`;
          stepLogs.push(line);
          yield { type: "node:log", at: at(), nodeId: node.id, log: line, status: "running", attempt: 0 };
        }
      }

      const baseSystem =
        typeof cfg.system === "string" && cfg.system.trim() ? cfg.system :
        `You are an AI agent ("${node.data.label || node.type}") in an AgentFlow workflow.`;
      const memoryBlock = hits.length
        ? `\n\nRelevant memories (most relevant first, score in brackets):\n${hits
            .map((h, i) => `(${i + 1}) [${h.score.toFixed(2)}] ${h.memory.content}`)
            .join("\n")}`
        : "";
      const augmentedSystem = baseSystem + memoryBlock;

      try {
        const { text: response, tokensUsed } = await completeText(augmentedSystem, userPrompt);
        const cost = tokensUsed * TOKEN_RATE;
        if (controls.stopped()) { runStatus = "cancelled"; break; }

        // Store the exchange as a new memory (best-effort — never blocks the run).
        if (embeddingConfigured()) {
          try {
            const res = await getMemoryEngine().remember({
              userId: controls.userId,
              orgId: controls.orgId ?? null,
              scope,
              content: `Q: ${userPrompt}\n---\nA: ${response}`,
              importance,
              workflowId: controls.workflowId ?? null,
              agentId: node.id,
              metadata: { nodeType: node.type, workflowId: controls.workflowId ?? null },
            });
            const wrote = `✓ memory · wrote 1 (scope=${scope}, importance=${importance})${res.deduplicated ? " · dedup" : ""}`;
            stepLogs.push(wrote);
            yield { type: "node:log", at: at(), nodeId: node.id, log: wrote, status: "running", attempt: 0 };
          } catch (err) {
            const msg = err instanceof Error ? err.message : "memory write failed";
            stepLogs.push(`✓ memory · write error: ${msg}`);
            yield { type: "node:log", at: at(), nodeId: node.id, log: `✓ memory · write error: ${msg}`, status: "running", attempt: 0 };
          }
        }

        const elapsed = Date.now() - nodeStart;
        nodeOutputs.set(node.id, { text: response, memories: hits });
        totalTokens += tokensUsed;
        totalCost += cost;
        yield {
          type: "node:success", at: at(), nodeId: node.id, status: "succeeded", log: "Completed", attempt: 0,
          durationMs: elapsed, tokensUsed, cost, retries: 0,
          nodeType: node.type,
          config: cfg,
          input: inputs,
          output: { text: response, memories: hits },
          prompt: { system: augmentedSystem, user: userPrompt },
          memories: hits.map((h) => ({ score: h.score, id: h.memory.id, content: h.memory.content, scope: h.memory.scope })),
        };
        results.push({
          nodeId: node.id,
          nodeName: node.data.label || node.type,
          status: "succeeded",
          durationMs: elapsed,
          tokensUsed,
          cost,
          retries: 0,
          logs: stepLogs,
          reasoning: null,
        });
        await sleep(80, controls.stopped);
        if (controls.stopped()) { runStatus = "cancelled"; break; }
        continue;
      } catch (err) {
        // A key is configured but the model call failed (bad key, quota,
        // network). Surface it as a real node failure instead of letting the
        // throw escape the run generator — completeText no longer masks this
        // with deterministic output, so we record it like any other node fail.
        const msg = err instanceof Error ? err.message : "AI node failed";
        const elapsed = Date.now() - nodeStart;
        stepLogs.push(`✗ AI · ${msg}`);
        yield {
          type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: msg, attempt: 0, error: msg,
          durationMs: elapsed, tokensUsed: 0, cost: 0, retries: 0, nodeType: node.type, config: cfg, input: inputs,
          prompt: { system: augmentedSystem, user: userPrompt },
        };
        runStatus = "failed";
        runError = runError ?? `Node "${node.data.label || node.type}" failed: ${msg}`;
        results.push({
          nodeId: node.id,
          nodeName: node.data.label || node.type,
          status: "failed",
          durationMs: elapsed,
          tokensUsed: 0,
          cost: 0,
          retries: 0,
          logs: stepLogs,
          reasoning: null,
          error: msg,
        });
        await sleep(80, controls.stopped);
        if (controls.stopped()) { runStatus = "cancelled"; break; }
        continue;
      }
    }

    // ai.multiAgent nodes run the real multi-agent runtime (lib/agents) and
    // stream per-agent logs as node:log events. Drained with the same retry
    // shape as integration actions. Independent of the OAuth action registry.
    if (node.type === "ai.multiAgent") {
      const stepLogs: string[] = [];
      const inputs = upstreamOutputs(graph, node, nodeOutputs);
      let attempt = 0;
      let maStatus: "succeeded" | "failed" = "failed";
      let maError: string | undefined;
      let maOutput: unknown;
      let maTokens = 0;
      let maCost = 0;

      if (!controls.userId) {
        maError = "No user context — sign in to run the Multi-Agent runtime.";
        yield { type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: maError, attempt: 0, error: maError, durationMs: 0, retries: 0 };
      } else {
        while (attempt <= MAX_NODE_RETRIES) {
          if (controls.stopped()) { runStatus = "cancelled"; break; }
          const gen = runMultiAgent({
            userId: controls.userId,
            orgId: controls.orgId ?? null,
            workflowId: controls.workflowId ?? null,
            nodeId: node.id,
            config: node.data.config ?? {},
            inputs,
            stopped: () => controls.stopped(),
          });
          let result: MultiAgentActionResult | undefined;
          try {
            while (true) {
              if (controls.stopped()) { runStatus = "cancelled"; break; }
              const { value, done } = await gen.next();
              if (done) { result = value; break; }
              if (value && value.type === "log") {
                stepLogs.push(value.log);
                yield { type: "node:log", at: at(), nodeId: node.id, log: value.log, status: "running", attempt };
              }
            }
          } catch (err) {
            result = { status: "failed", error: err instanceof Error ? err.message : "multi-agent error", retryable: true };
          }
          if (controls.stopped()) break;

          const elapsed = Date.now() - nodeStart;
          const failed = result?.status !== "succeeded";
          maTokens = result?.tokensUsed ?? 0;
          maCost = result?.cost ?? 0;

          if (failed && attempt < MAX_NODE_RETRIES && result?.retryable !== false) {
            maError = result?.error ?? "Multi-agent run failed";
            yield { type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: maError, attempt, error: maError, durationMs: elapsed, tokensUsed: maTokens, cost: maCost, retries: attempt };
            yield { type: "node:retry", at: at(), nodeId: node.id, status: "retrying", log: "Retrying multi-agent run…", attempt: attempt + 1 };
            attempt++;
            retried++;
            continue;
          }
          if (failed) {
            maStatus = "failed";
            maError = result?.error ?? "Multi-agent run failed";
            yield { type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: maError, attempt, error: maError, durationMs: elapsed, tokensUsed: maTokens, cost: maCost, retries: attempt };
            break;
          }
          maStatus = "succeeded";
          maOutput = result?.output;
          totalTokens += maTokens;
          totalCost += maCost;
          yield { type: "node:success", at: at(), nodeId: node.id, status: "succeeded", log: "Completed", attempt, durationMs: elapsed, tokensUsed: maTokens, cost: maCost, retries: attempt, nodeType: node.type, config: node.data.config ?? {}, input: inputs, output: maOutput };
          break;
        }
      }

      const durationMs = Date.now() - nodeStart;
      if (maStatus === "succeeded") {
        nodeOutputs.set(node.id, maOutput);
      } else if (runStatus !== "cancelled") {
        runStatus = "failed";
        runError = runError ?? `Node "${node.data.label || node.type}" failed`;
      }
      results.push({
        nodeId: node.id,
        nodeName: node.data.label || node.type,
        status: maStatus,
        durationMs,
        tokensUsed: maTokens,
        cost: maCost,
        retries: attempt,
        logs: stepLogs,
        reasoning: null,
        ...(maError ? { error: maError } : {}),
      });
      if (runStatus === "cancelled") break;
      await sleep(80, controls.stopped);
      continue;
    }

    // gmail.* (and future provider) nodes take this path; every other node
    // falls through to the simulation below, unchanged.
    const actionMeta = resolveAction(node.type);
    if (actionMeta) {
      const stepLogs: string[] = [];
      const inputs = upstreamOutputs(graph, node, nodeOutputs);
      let attempt = 0;
      let realStatus: "succeeded" | "failed" = "failed";
      let realError: string | undefined;
      let realOutput: unknown;

      if (!controls.userId) {
        // No authenticated user → can't resolve a connected account.
        realError = "No user context — sign in to run Gmail nodes.";
        yield { type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: realError, attempt: 0, error: realError, durationMs: 0, retries: 0, nodeType: node.type, config: node.data.config ?? {} };
      } else {
        while (attempt <= MAX_NODE_RETRIES) {
          if (controls.stopped()) { runStatus = "cancelled"; break; }
          const gen = runAction({
            userId: controls.userId,
            nodeType: node.type,
            config: node.data.config ?? {},
            inputs,
            stopped: () => controls.stopped(),
          });
          let result: ActionResult | undefined;
          try {
            while (true) {
              if (controls.stopped()) { runStatus = "cancelled"; break; }
              const { value, done } = await gen.next();
              if (done) { result = value; break; }
              if (value && value.type === "log") {
                stepLogs.push(value.log);
                yield { type: "node:log", at: at(), nodeId: node.id, log: value.log, status: "running", attempt };
              }
            }
          } catch (err) {
            result = { status: "failed", error: err instanceof Error ? err.message : "action error", retryable: true };
          }
          if (controls.stopped()) break;

          const elapsed = Date.now() - nodeStart;
          const failed = result?.status !== "succeeded";
          const tokensUsed = result?.tokensUsed ?? 0;
          const cost = result?.cost ?? 0;

          if (failed && attempt < MAX_NODE_RETRIES && result?.retryable !== false) {
            realError = result?.error ?? "Action failed";
            yield { type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: realError, attempt, error: realError, durationMs: elapsed, tokensUsed, cost, retries: attempt };
            yield { type: "node:retry", at: at(), nodeId: node.id, status: "retrying", log: "Retrying…", attempt: attempt + 1 };
            attempt++;
            retried++;
            continue;
          }
          if (failed) {
            realStatus = "failed";
            realError = result?.error ?? "Action failed";
            yield { type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: realError, attempt, error: realError, durationMs: elapsed, tokensUsed, cost, retries: attempt };
            break;
          }
          realStatus = "succeeded";
          realOutput = result?.output;
          yield { type: "node:success", at: at(), nodeId: node.id, status: "succeeded", log: "Completed", attempt, durationMs: elapsed, tokensUsed, cost, retries: attempt, nodeType: node.type, config: node.data.config ?? {}, input: inputs, output: realOutput };
          break;
        }
      }

      const durationMs = Date.now() - nodeStart;
      if (realStatus === "succeeded") {
        nodeOutputs.set(node.id, realOutput);
      } else if (runStatus !== "cancelled") {
        runStatus = "failed";
        runError = runError ?? `Node "${node.data.label || node.type}" failed`;
      }
      results.push({
        nodeId: node.id,
        nodeName: node.data.label || node.type,
        status: realStatus,
        durationMs,
        tokensUsed: 0,
        cost: 0,
        retries: attempt,
        logs: stepLogs,
        reasoning: null,
        ...(realError ? { error: realError } : {}),
      });
      if (runStatus === "cancelled") break;
      await sleep(80, controls.stopped);
      continue;
    }

    const logs = nodeLogs(node);
    const reasoning = nodeReasoning(node);
    const targetDur = nodeDurationMs(node);
    const real = realDelay(targetDur);
    const stepLogs: string[] = [];
    const stepReasoning: string[] = [];
    let attempt = 0;
    let nodeStatus: "succeeded" | "failed" = "failed";
    let nodeError: string | undefined;

    while (attempt <= MAX_NODE_RETRIES) {
      const attemptStart = Date.now();
      const attemptLogs = attempt === 0 ? logs : ["Self-healing: retrying…", ...logs.slice(1)];

      const slices = Math.max(1, attemptLogs.length);
      for (let i = 0; i < attemptLogs.length; i++) {
        const until = attemptStart + Math.round((real / slices) * (i + 0.6));
        const wait = Math.max(0, until - Date.now());
        if (wait > 0) await sleep(wait, controls.stopped);
        if (controls.stopped()) {
          runStatus = "cancelled";
          break;
        }
        const log = attemptLogs[i];
        stepLogs.push(log);
        yield { type: "node:log", at: at(), nodeId: node.id, log, status: "running", attempt };
      }
      if (runStatus === "cancelled") break;

      if (reasoning && attempt === 0) {
        for (let i = 0; i < reasoning.length; i++) {
          await sleep(Math.round(real / 8), controls.stopped);
          if (controls.stopped()) {
            runStatus = "cancelled";
            break;
          }
          const r = reasoning[i];
          stepReasoning.push(r);
          yield { type: "node:reasoning", at: at(), nodeId: node.id, reasoning: r, status: "running", attempt };
        }
        if (runStatus === "cancelled") break;
      }

      const remain = attemptStart + real - Date.now();
      if (remain > 0) await sleep(remain, controls.stopped);
      if (controls.stopped()) {
        runStatus = "cancelled";
        break;
      }

      const failed = nodeFailsOn(node, attempt);
      const elapsedSoFar = Date.now() - nodeStart;
      const tokensUsed = nodeTokens(node);
      const cost = tokensUsed * TOKEN_RATE;
      if (failed && attempt < MAX_NODE_RETRIES) {
        nodeError = `${logs[logs.length - 1]} — error`;
        stepLogs.push(nodeError);
        yield { type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: nodeError, attempt, error: nodeError, durationMs: elapsedSoFar, tokensUsed, cost, retries: attempt };
        yield { type: "node:retry", at: at(), nodeId: node.id, status: "retrying", log: "Self-healing: retrying…", attempt: attempt + 1 };
        attempt++;
        retried++;
        continue;
      }
      if (failed && attempt >= 2) {
        nodeStatus = "failed";
        nodeError = "Retry failed";
        stepLogs.push(nodeError);
        yield { type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: nodeError, attempt, error: nodeError, durationMs: elapsedSoFar, tokensUsed, cost, retries: attempt, nodeType: node.type, config: node.data.config ?? {}, input: upstreamOutputs(graph, node, nodeOutputs), output: synthOutput(node) };
        break;
      }
      nodeStatus = "succeeded";
      yield {
        type: "node:success", at: at(), nodeId: node.id, status: "succeeded", log: "Completed", attempt,
        durationMs: elapsedSoFar, tokensUsed, cost, retries: attempt,
        nodeType: node.type,
        config: node.data.config ?? {},
        input: upstreamOutputs(graph, node, nodeOutputs),
        output: synthOutput(node),
      };
      break;
    }

    const durationMs = Date.now() - nodeStart;
    const tokensUsed = nodeTokens(node);
    const cost = tokensUsed * TOKEN_RATE;

    if (nodeStatus === "succeeded") {
      totalTokens += tokensUsed;
      totalCost += cost;
      nodeOutputs.set(node.id, synthOutput(node));
    } else if (runStatus !== "cancelled") {
      runStatus = "failed";
      runError = runError ?? `Node "${node.data.label || node.type}" failed`;
    }

    results.push({
      nodeId: node.id,
      nodeName: node.data.label || node.type,
      status: nodeStatus,
      durationMs,
      tokensUsed,
      cost,
      retries: attempt,
      logs: stepLogs,
      reasoning: stepReasoning.length ? stepReasoning : null,
      ...(nodeError ? { error: nodeError } : {}),
    });

    if (runStatus === "cancelled") break;
    await sleep(80, controls.stopped);
  }

  if (runStatus === "succeeded" && results.some((r) => r.status === "failed")) {
    runStatus = "failed";
  }

  yield {
    type: "complete",
    at: at(),
    totals: {
      durationMs: at(),
      totalTokens,
      totalCost,
      retried,
      status: runStatus,
      ...(runError ? { error: runError } : {}),
    },
  };

  return results;
}

// In-memory handles for live runs so control POSTs (resume/stop) can reach an
// active generator. Single-process dev server only — fine for this product.

interface RunHandle {
  resume: ((nodeId: string) => Promise<"resume" | "stop">) | null;
  resolvePause: ((decision: "resume" | "stop") => void) | null;
  stopFlag: boolean;
  /** Step mode: when true the loop pauses before every node (step-by-step).
   *  Set by stepRun(), cleared by resumeRun(). Read live by controls.stepMode. */
  stepMode: boolean;
}

const runs = new Map<string, RunHandle>();

export function registerRun(executionId: string): RunHandle {
  const handle: RunHandle = { resume: null, resolvePause: null, stopFlag: false, stepMode: false };
  handle.resume = (nodeId: string) =>
    new Promise<"resume" | "stop">((resolve) => {
      handle.resolvePause = resolve;
      // If already stopped before the pause is reached, resolve stop.
      if (handle.stopFlag) resolve("stop");
      void nodeId;
    });
  runs.set(executionId, handle);
  return handle;
}

export function getRun(executionId: string): RunHandle | undefined {
  return runs.get(executionId);
}

export function resumeRun(executionId: string): boolean {
  const h = runs.get(executionId);
  if (!h || !h.resolvePause) return false;
  // Clearing step mode means "continue to the next breakpoint / end".
  h.stepMode = false;
  h.resolvePause("resume");
  h.resolvePause = null;
  return true;
}

/** Pause-before-next-node: arm step mode while a node is mid-execution. The
 *  engine checks stepMode before each node, so the run halts at the next node
 *  and emits node:paused. Unlike stepRun/resumeRun this does NOT resolve a
 *  pending pause — it's used while the run is actively executing. */
export function pauseRun(executionId: string): boolean {
  const h = runs.get(executionId);
  if (!h) return false;
  h.stepMode = true;
  return true;
}

/** Step-by-step: keep step mode on (pause before the next node) and resume
 *  past the current pause so the engine executes exactly one more node. */
export function stepRun(executionId: string): boolean {
  const h = runs.get(executionId);
  if (!h || !h.resolvePause) return false;
  h.stepMode = true;
  h.resolvePause("resume");
  h.resolvePause = null;
  return true;
}

export function stopRun(executionId: string): boolean {
  const h = runs.get(executionId);
  if (!h) return false;
  h.stopFlag = true;
  if (h.resolvePause) {
    h.resolvePause("stop");
    h.resolvePause = null;
  }
  return true;
}

export function unregisterRun(executionId: string): void {
  runs.delete(executionId);
}