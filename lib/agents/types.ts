// ============================================================
// Multi-Agent Runtime — core types
// ============================================================
// Pure types only (no runtime, no server-only) so they can be imported from
// client + server. The runtime itself (lib/agents/runtime.ts) is server-only.
//
// Design: the runtime is a thin LangGraph orchestration layer over a plugin
// registry of AgentDefinitions. Adding a new agent = registerAgent(...) with a
// new AgentDefinition; the runtime rebuilds the graph from the registry without
// any code change. See lib/agents/registry.ts + lib/agents/graph-builder.ts.

// The AgentToolGateway interface lives in lib/mcp/types (pure, no server-only)
// so this pure types file can reference it without a runtime/server cycle. The
// concrete class is constructed inside the server-only runtime (lib/agents/
// runtime.ts) and passed in as ctx.tools.
import type { AgentToolGateway } from "@/lib/mcp/types";

// The six initial agents. The AgentId union is kept open-ended via string so
// additional agents can register without editing this file (modularity).
export type InitialAgentId =
  | "planner"
  | "research"
  | "memory"
  | "reasoning"
  | "reviewer"
  | "executor";

export type AgentId = InitialAgentId | (string & {});

// ─────────────────────────── subtasks ──────────────────────────────────────

/** Which worker agent a subtask is routed to. */
export type WorkerAgent = "research" | "memory" | "reasoning";

export interface Subtask {
  id: string;
  /** The worker agent that should handle this subtask. */
  assignee: WorkerAgent;
  title: string;
  detail: string;
  /** Inputs copied from the run's upstream workflow node, if any. */
  input?: unknown;
}

// ─────────────────────────── agent results ──────────────────────────────────

export interface AgentResult {
  subtaskId?: string;
  agent: AgentId;
  status: "succeeded" | "failed";
  output: string;
  tokensUsed: number;
  durationMs: number;
  error?: string;
}

export interface ReviewOutcome {
  approved: boolean;
  /** Reviewer's critique / requested changes; fed back to the Planner. */
  corrections: string[];
  /** Confidence 0..1 from the reviewer. */
  confidence: number;
}

// ─────────────────────────── execution plan ─────────────────────────────────

export interface ExecutionPlan {
  subtasks: Subtask[];
  /** Human-readable rationale the Planner emits for observability. */
  rationale: string;
}

// ─────────────────────────── tool permissions ───────────────────────────────

// The initial, known tool ids. Kept as its own union so the closed set is
// documented, while ToolId below stays open-ended for MCP + future tools.
export type InitialToolId =
  | "llm"
  | "memory.recall"
  | "memory.remember"
  | "memory.manage"
  | "web.search"
  | "executor.run"
  | "mcp.invoke"; // MCP tool invocation — gated by the AgentToolGateway.

// Open-ended: registered agents (and MCP) can declare tools beyond the initial
// set without editing this union. The `(string & {})` trick keeps autocomplete
// on the known ids while allowing arbitrary strings.
export type ToolId = InitialToolId | (string & {});

/**
 * An agent declares the tools it is permitted to use. The runtime's tool
 * gateway throws `PermissionError` if an agent attempts an undeclared tool —
 * this is the "validate tool permissions" security control.
 */
export interface ToolPermission {
  tool: ToolId;
  /** Optional scope restriction, e.g. memory.recall limited to a MemoryScope. */
  scope?: string;
  /**
   * Optional MCP scope narrowing for `mcp.invoke`: restricts the agent to a
   * specific server id and/or tool name. When omitted, the agent may invoke any
   * allow-listed tool across its workspace's MCP servers.
   */
  mcp?: { serverId?: string; toolName?: string };
}

// ─────────────────────────── observability / tracing ────────────────────────

export type TraceKind =
  | "agent:start"
  | "agent:log"
  | "agent:reasoning"
  | "agent:memory"
  | "agent:retry"
  | "agent:success"
  | "agent:fail"
  | "plan"
  | "review"
  | "approval";

export interface TraceEvent {
  /** ms since run start. */
  at: number;
  agent: AgentId;
  kind: TraceKind;
  /** Free-form payload (log line, reasoning step, memory op summary, etc). */
  detail: string;
  /** Subtask id when the event is scoped to a subtask. */
  subtaskId?: string;
  /** Measured latency for this step, when applicable. */
  durationMs?: number;
  tokensUsed?: number;
  attempt?: number;
  error?: string;
}

export interface AgentTimelineEntry {
  agent: AgentId;
  subtaskId?: string;
  startedAt: number;
  durationMs: number;
  tokensUsed: number;
  cost: number;
  retries: number;
  status: "running" | "succeeded" | "failed";
  error?: string;
}

export interface ExecutionGraphSnapshot {
  nodes: { id: AgentId; label: string }[];
  edges: { source: AgentId | "START"; target: AgentId | "END" }[];
}

export interface RunTrace {
  runId: string;
  objective: string;
  status: "running" | "succeeded" | "failed" | "cancelled" | "awaiting_approval";
  startedAt: number;
  durationMs: number;
  iterations: number;
  totalTokens: number;
  totalCost: number;
  retries: number;
  failures: number;
  timeline: AgentTimelineEntry[];
  reasoningPath: { agent: AgentId; step: string; at: number }[];
  graph: ExecutionGraphSnapshot;
  events: TraceEvent[];
  finalAnswer?: string;
  error?: string;
}

// ─────────────────────────── streaming events ───────────────────────────────
// Emitted by the runtime as an async generator (SSE on the API side). Mirrors
// the execution engine's ExecutionEvent contract shape.

export type AgentEventType =
  | "run:start"
  | "agent:start"
  | "agent:log"
  | "agent:reasoning"
  | "agent:memory"
  | "agent:retry"
  | "agent:success"
  | "agent:fail"
  | "plan"
  | "review"
  | "approval-requested"
  | "approval"
  | "complete"
  | "error";

export interface AgentEvent {
  type: AgentEventType;
  at: number;
  runId?: string;
  agent?: AgentId;
  subtaskId?: string;
  nodeName?: string;
  log?: string;
  reasoning?: string;
  attempt?: number;
  durationMs?: number;
  tokensUsed?: number;
  cost?: number;
  error?: string;
  plan?: ExecutionPlan;
  review?: ReviewOutcome;
  iteration?: number;
  finalAnswer?: string;
  approvalToken?: string;
  totals?: {
    durationMs: number;
    totalTokens: number;
    totalCost: number;
    retries: number;
    failures: number;
    iterations: number;
    status: "succeeded" | "failed" | "cancelled";
    error?: string;
  };
}

// ─────────────────────────── run options ────────────────────────────────────

export interface AgentRunOptions {
  runId: string;
  objective: string;
  /** Upstream workflow node input (the Multi-Agent node's inputs). */
  input?: unknown;
  userId: string;
  /** Primary org id — scopes "workspace" memory (null when no org). */
  orgId?: string | null;
  /** Workflow id — scopes workflow/agent memory writes. */
  workflowId?: string | null;
  /** The Multi-Agent node id — used as agentId for memory writes. */
  nodeId?: string | null;
  /** Memory scope the agents write/read under (default "long_term"). */
  memoryScope?: import("@/lib/memory/types").MemoryScope;
  /** Max planner↔reviewer revision loops (default 2). */
  maxIterations?: number;
  /** Hard wall-clock timeout for the whole run, ms (default 120_000). */
  timeoutMs?: number;
  /** Pause for human approval before the reviewer (default false). */
  requireApproval?: boolean;
  /** Cooperative cancellation flag, polled between agents. */
  stopped?: () => boolean;
  /** Extra system-prompt instructions prepended to every agent. */
  guidance?: string;
}

export interface AgentRunResult {
  runId: string;
  status: "succeeded" | "failed" | "cancelled" | "awaiting_approval";
  finalAnswer: string;
  plan?: ExecutionPlan;
  review?: ReviewOutcome;
  trace: RunTrace;
  totalTokens: number;
  totalCost: number;
  durationMs: number;
  error?: string;
}

// ─────────────────────────── agent definition ────────────────────────────────

/**
 * A pluggable agent. The runtime builds the LangGraph StateGraph by iterating
 * registered AgentDefinitions — adding a new agent never touches the runtime.
 *
 * `node` is the LangGraph node function: it receives the run context (which
 * carries tools, memory, tracer, emitter) and the current state, and returns a
 * partial state update. Agents MUST use ctx.tools / ctx.memory rather than
 * calling the LLM or MemoryEngine directly — that is how tool permissions and
 * workspace isolation are enforced.
 */
export interface AgentDefinition {
  id: AgentId;
  label: string;
  description: string;
  /** Tools this agent is permitted to use; enforced by the tool gateway. */
  tools: ToolPermission[];
  /**
   * The LangGraph node handler. Returns a partial AgentState update. Wrapped
   * by the runtime with retries, tracing, timeout, and cancellation.
   */
  run: (ctx: AgentRunContext, state: AgentState) => Promise<Partial<AgentState>>;
}

// ─────────────────────────── run context ────────────────────────────────────
// Passed into every agent invocation. Carries the scoped tool gateways and
// observability hooks. Defined here as an interface (the concrete impl lives in
// runtime.ts); agents import only the type.

export interface AgentMemoryGateway {
  recall(query: string, opts?: { topK?: number; scope?: import("@/lib/memory/types").MemoryScope }): Promise<import("@/lib/memory/types").MemoryHit[]>;
  remember(
    content: string,
    opts?: {
      importance?: number;
      kind?: string;
      metadata?: Record<string, unknown>;
      scope?: import("@/lib/memory/types").MemoryScope;
    },
  ): Promise<{ id: string | null; deduplicated: boolean; disabled: boolean }>;
}

export interface AgentLlmGateway {
  /** One-shot completion. Returns text + estimated tokens. */
  complete(system: string, user: string): Promise<{ text: string; tokensUsed: number }>;
  /** Completion parsed as JSON. `fellBack` is true when output was unparseable. */
  completeJson<T = Record<string, unknown>>(
    system: string,
    user: string,
  ): Promise<{ value: T; tokensUsed: number; fellBack: boolean }>;
}

export interface AgentRunContext {
  runId: string;
  agent: AgentId;
  userId: string;
  orgId: string | null;
  workflowId: string | null;
  nodeId: string | null;
  memoryScope: import("@/lib/memory/types").MemoryScope;
  maxIterations: number;
  requireApproval: boolean;
  guidance?: string;
  stopped: () => boolean;
  llm: AgentLlmGateway;
  memory: AgentMemoryGateway;
  /**
   * MCP tool gateway — the ONLY way agents discover and invoke MCP tools.
   * Additive: undefined for runs/agents that don't use MCP (e.g. legacy agent
   * definitions built before this field existed). Agents check `ctx.tools?.can
   * ("mcp.invoke")` before use; when absent or not permitted it is a no-op.
   */
  tools?: AgentToolGateway;
  /** Emit a structured trace + stream event. */
  trace(kind: TraceKind, detail: string, extra?: Partial<TraceEvent>): void;
  /** Emit a reasoning step (also surfaced on the reasoning path). */
  reason(step: string): void;
  /** Human approval decision injected on resume (present only after a checkpoint). */
  approval?: { approved: boolean; feedback?: string } | null;
}

// ─────────────────────────── state shape ─────────────────────────────────────
// The LangGraph Annotation is constructed in state.ts. This interface is the
// plain object view agents read/write. Keep fields additive only.

export interface AgentState {
  objective: string;
  context: string;
  plan: ExecutionPlan | null;
  subtasks: Subtask[];
  results: Record<string, AgentResult>;
  memories: import("@/lib/memory/types").MemoryHit[];
  reasoningTrail: string[];
  review: ReviewOutcome | null;
  finalAnswer: string;
  iterations: number;
  trace: TraceEvent[];
  errors: string[];
}