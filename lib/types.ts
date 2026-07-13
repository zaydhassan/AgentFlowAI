// ============================================================
// AgentFlow AI — Shared domain types
// ============================================================

// The 12 brief categories. Node `type` strings keep their original prefixes
// (e.g. "trigger.*", "store.*"); `category` only drives palette grouping.
export type NodeCategory =
  | "ai"
  | "communication"
  | "database"
  | "logic"
  | "files"
  | "cloud"
  | "integrations"
  | "developer"
  | "utilities"
  | "scheduling"
  | "memory"
  | "rag"
  | "gmail"
  | "mcp";

export type NodeStatus = "idle" | "running" | "succeeded" | "failed" | "retrying" | "skipped";

// Inspector form field descriptor. Drives the generated config UI per node.
export type ConfigFieldType =
  | "text"
  | "number"
  | "select"
  | "boolean"
  | "code"
  | "secret"
  | "textarea"
  | "account" // connected-integration-account dropdown (fetches /api/integrations/accounts?provider=<provider>)
  | "mcp.tool" // discovered MCP tool dropdown (fetches /api/mcp/tools); value "<serverId>::<toolName>"
  | "mcp.resource"; // discovered MCP resource dropdown (fetches /api/mcp/resources); value "<serverId>::<uri>"

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  default?: unknown;
  options?: { label: string; value: string }[];
  required?: boolean;
  placeholder?: string;
  help?: string;
  /** For "account" fields — which integration provider to list accounts for. */
  provider?: string;
}

export interface NodeDef {
  type: string;
  label: string;
  category: NodeCategory;
  description: string;
  icon: string; // lucide icon name
  color: string; // hex accent
  inputs: number;
  outputs: number;
  defaultConfig?: Record<string, unknown>;
  configSchema?: ConfigField[];
  metrics?: { tokens?: boolean; cost?: boolean };
}

export interface WorkflowNode {
  id: string;
  type: string; // node def type, or "sticky" | "comment" | "group" for canvas nodes
  position: { x: number; y: number };
  data: {
    label: string;
    config: Record<string, unknown>;
    status?: NodeStatus;
    durationMs?: number;
    tokensUsed?: number;
    cost?: number;
    logs?: string[];
    retries?: number;
    breakpoint?: boolean;
    // canvas-node payloads (only set for sticky/comment/group types)
    sticky?: { content: string; color: string };
    comment?: { content: string };
    group?: { label: string; color: string };
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  label?: string;
}

export type WorkflowStatus = "active" | "draft" | "paused" | "error";

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  category: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
  lastRun: string; // ISO
  schedule?: string;
  health: number; // 0-100
  tags: string[];
  version: number;
  createdBy: string;
}

export type ExecutionStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "queued"
  | "retrying"
  | "cancelled";

export interface ExecutionStep {
  id: string;
  nodeId: string;
  nodeName: string;
  status: NodeStatus;
  startedAt: string;
  durationMs: number;
  tokensUsed?: number;
  cost?: number;
  logs: string[];
  retries: number;
  reasoning?: string[];
}

export interface Execution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  startedAt: string;
  durationMs: number;
  steps: ExecutionStep[];
  totalTokens: number;
  totalCost: number;
  trigger: string;
  retried: number;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  nodeCount: number;
  installs: number;
  rating: number;
  author: string;
  tags: string[];
  featured?: boolean;
}

export interface CopilotSuggestion {
  id: string;
  kind: "missing-node" | "architecture" | "cost" | "performance" | "security" | "self-heal";
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  action?: string;
}

export interface AgentRun {
  id: string;
  agent: "planner" | "research" | "memory" | "router";
  status: "running" | "done" | "failed";
  task: string;
  steps: { label: string; detail: string; status: "done" | "active" | "pending" }[];
  startedAt: string;
  durationMs: number;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  ip: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Editor" | "Viewer";
  avatar: string;
  lastActive: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: string;
  read: boolean;
}