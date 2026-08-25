import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export interface Graph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export const EMPTY_GRAPH: Graph = { nodes: [], edges: [] };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asNode(n: unknown): WorkflowNode | null {
  if (!isObj(n) || typeof n.id !== "string" || typeof n.type !== "string") return null;
  const position = isObj(n.position) ? { x: Number(n.position.x) || 0, y: Number(n.position.y) || 0 } : { x: 0, y: 0 };
  const data = isObj(n.data) ? (n.data as WorkflowNode["data"]) : { label: "", config: {} };
  return {
    id: n.id,
    type: n.type,
    position,
    data: {
      label: typeof data.label === "string" ? data.label : "",
      config: isObj(data.config) ? (data.config as Record<string, unknown>) : {},
      ...(data.status != null ? { status: data.status } : {}),
      ...(data.durationMs != null ? { durationMs: data.durationMs } : {}),
      ...(data.tokensUsed != null ? { tokensUsed: data.tokensUsed } : {}),
      ...(data.cost != null ? { cost: data.cost } : {}),
      ...(data.logs != null ? { logs: data.logs as string[] } : {}),
      ...(data.retries != null ? { retries: data.retries } : {}),
      ...(data.breakpoint != null ? { breakpoint: data.breakpoint } : {}),
      ...(data.sticky != null ? { sticky: data.sticky } : {}),
      ...(data.comment != null ? { comment: data.comment } : {}),
      ...(data.group != null ? { group: data.group } : {}),
    },
  };
}

function asEdge(e: unknown): WorkflowEdge | null {
  if (!isObj(e) || typeof e.id !== "string" || typeof e.source !== "string" || typeof e.target !== "string") return null;
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.animated != null ? { animated: Boolean(e.animated) } : {}),
    ...(typeof e.label === "string" ? { label: e.label } : {}),
  };
}

/** Coerce arbitrary input into a safe Graph for storage/render. */
export function normalizeGraph(input: unknown): Graph {
  if (!isObj(input)) return { ...EMPTY_GRAPH };
  const nodes = Array.isArray(input.nodes) ? input.nodes.map(asNode).filter((n): n is WorkflowNode => n !== null) : [];
  const edges = Array.isArray(input.edges) ? input.edges.map(asEdge).filter((e): e is WorkflowEdge => e !== null) : [];
  const vp = isObj(input.viewport) ? { x: Number(input.viewport.x) || 0, y: Number(input.viewport.y) || 0, zoom: Number(input.viewport.zoom) || 1 } : undefined;
  return { nodes, edges, ...(vp ? { viewport: vp } : {}) };
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  status: string;
  category: string;
  tags: string[];
  version: number;
  schedule: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
  edgeCount: number;
  health: number;
}

/** The slim workflow projection for list views — drops the heavy graph JSON. */
export function workflowSummary(
  w: { id: string; name: string; description: string; status: string; category: string; tags: string[]; version: number; schedule: string | null; lastRunAt: Date | null; createdAt: Date; updatedAt: Date; graph: unknown },
): WorkflowSummary {
  const g = normalizeGraph(w.graph);
  const nodeCount = g.nodes.filter((n) => n.type !== "sticky" && n.type !== "comment" && n.type !== "group").length;
  return {
    id: w.id,
    name: w.name,
    description: w.description,
    status: w.status,
    category: w.category,
    tags: w.tags,
    version: w.version,
    schedule: w.schedule,
    lastRunAt: w.lastRunAt ? w.lastRunAt.toISOString() : null,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
    nodeCount,
    edgeCount: g.edges.length,
    health: workflowHealth(g, w.status),
  };
}

/** Rough 0–100 health from graph shape + status. */
export function workflowHealth(graph: Graph, status: string): number {
  if (status === "error") return 41;
  if (status === "paused") return 87;
  if (graph.nodes.length === 0) return 100;
  const integrationNodes = graph.nodes.filter((n) => n.type.includes(".")).length;
  const hasErrorPath = graph.nodes.some((n) => n.type === "util.condition");
  const base = status === "active" ? 96 : 100;
  const penalty = Math.min(20, Math.max(0, integrationNodes - 6));
  return Math.max(40, base - penalty + (hasErrorPath ? 2 : 0));
}