export interface ExecutionTotals {
  durationMs: number;
  totalTokens: number;
  totalCost: number;
  retried: number;
  status: "succeeded" | "failed" | "cancelled";
  error?: string;
}

// A retrieved-memory hit attached to AI steps that pulled context from the
// memory engine. Re-declared client-safe (see lib/execution/engine.ts).
export interface MemoryHit {
  score: number;
  id: string;
  content: string;
  scope?: string;
}

// One persisted ExecutionStep row, including the full AI Workflow Debugger
// inspection payload (nodeType/config/input/output/prompt/memories), all nullable
// because older rows predate the debugger columns.
export interface ExecutionStepRow {
  id: string;
  nodeId: string;
  nodeName: string;
  status: string;
  startedAt: string; // ISO
  durationMs: number;
  tokensUsed?: number | null;
  cost?: number | null;
  retries: number;
  logs: string[];
  reasoning: string[] | null;
  nodeType?: string | null;
  config?: unknown;
  input?: unknown;
  output?: unknown;
  prompt?: { system: string; user: string } | null;
  memories?: MemoryHit[] | null;
  error?: string | null;
}

// One row in the /executions list.
export interface ExecutionRow {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  trigger: string;
  startedAt: string; // ISO
  finishedAt: string | null; // ISO
  durationMs: number;
  totalTokens: number;
  totalCost: number;
  retried: number;
  error: string | null;
  stepCount: number;
}

// GET /api/executions/[id] → ExecutionDetail.
export interface ExecutionDetail extends ExecutionRow {
  steps: ExecutionStepRow[];
}

// GET /api/executions → { runs, counts }. `counts` is the status breakdown
// used for the list-page chips (running / succeeded / failed / total).
export interface ExecutionCounts {
  running: number;
  succeeded: number;
  failed: number;
  total: number;
}

export interface ExecutionsList {
  runs: ExecutionRow[];
  counts: ExecutionCounts;
}

// Unlike the persisted ExecutionStepRow, a live step accumulates logs/reasoning
// as arrays as events arrive, and carries the inspection payload when the node
// succeeds/fails (so the Inspect panel can show it mid-run before persistence).

export interface LiveStep {
  nodeId: string;
  nodeName: string;
  status: "running" | "succeeded" | "failed" | "retrying";
  logs: string[];
  reasoning: string[];
  durationMs?: number;
  tokensUsed?: number;
  cost?: number;
  retries?: number;
  error?: string;
  nodeType?: string;
  config?: unknown;
  input?: unknown;
  output?: unknown;
  prompt?: { system: string; user: string };
  memories?: MemoryHit[];
}

export interface LiveRunState {
  steps: LiveStep[];
  status: "running" | "succeeded" | "failed";
  totals?: ExecutionTotals;
  lastEventAt: number;
}