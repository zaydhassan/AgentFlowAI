// ============================================================
// AgentFlow AI — Shared domain types
// ============================================================

export type NodeCategory =
  | "trigger"
  | "communication"
  | "ai"
  | "storage"
  | "documents"
  | "developer"
  | "cloud"
  | "utilities";

export type NodeStatus = "idle" | "running" | "succeeded" | "failed" | "retrying" | "skipped";

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
}

export interface WorkflowNode {
  id: string;
  type: string; // node def type
  position: { x: number; y: number };
  data: {
    label: string;
    config: Record<string, unknown>;
    status?: NodeStatus;
    durationMs?: number;
    logs?: string[];
    retries?: number;
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