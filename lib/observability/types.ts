export interface ObservabilityKpis {
  p50LatencyMs: number | null;
  p99LatencyMs: number | null;
  cost30d: number; // sum totalCost over 30d finished
  tokens30d: number; // sum totalTokens over 30d finished
  successRate: number | null; // 0–100, null when no finished runs
  avgRetries: number | null; // 30d finished, mean retried
  runningNow: number; // status='running'
  activeWorkflows: number; // workflow.status='active'
  executions30d: number; // finished count over 30d
}

export interface DailyTrendPoint {
  date: string; // "MMM d" — matches the chart axis format
  executions: number;
  success: number;
  failures: number; // failed + cancelled
  cost: number;
  tokens: number;
}

export interface AiNodeSlice {
  name: string; // nodeType with "ai." prefix stripped
  nodeType: string;
  value: number; // step count
  tokens: number;
  color: string;
}

export interface InFlightRun {
  executionId: string; // SSE target id
  workflowId: string; // needed for the SSE URL
  workflowName: string;
  startedAt: string; // ISO
  trigger: string;
}

export interface RecentExecutionRow {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number;
  totalTokens: number;
  totalCost: number;
  retried: number;
  error: string | null;
  stepCount: number;
}

export interface PromptVersionRow {
  id: string;
  workflowId: string;
  workflowName: string;
  version: number;
  message: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface AuditLogRow {
  id: string;
  actor: string | null; // user.name, or null → render as "system"
  action: string;
  target: string | null; // best-effort from metadata
  createdAt: string;
}

export interface ObservabilitySummary {
  hasData: boolean; // any execution exists for this owner
  kpis: ObservabilityKpis;
  trend: DailyTrendPoint[]; // 14 points, oldest→newest (zero-filled)
  aiNodeDistribution: AiNodeSlice[];
  inFlight: InFlightRun[]; // SSE targets (executionId + workflowId)
  recent: RecentExecutionRow[];
  promptVersions: PromptVersionRow[];
  auditLogs: AuditLogRow[];
  mcp?: import("@/lib/mcp/types").McpObservabilitySummary; // optional fold-in
}