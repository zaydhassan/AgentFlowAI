import type { WorkflowNode, WorkflowEdge } from "../types";
import { getNodeDef } from "../nodes";

// ============================================================
// Mock execution engine — deterministic-ish simulation used by
// the live builder + execution timeline. No network.
// ============================================================

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
  // append any leftover (cycles / disconnected)
  for (const n of nodes) if (!order.includes(n.id)) order.push(n.id);
  return order.map((id) => nodes.find((n) => n.id === id)!).filter(Boolean);
}

// Deterministic pseudo-random from a string.
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
  if (def?.category === "storage") return 120 + (h % 400);
  if (def?.category === "documents") return 600 + (h % 1200);
  if (node.type.startsWith("trigger")) return 40 + (h % 120);
  if (def?.category === "communication") return 400 + (h % 900);
  return 80 + (h % 300);
}

export function nodeTokens(node: WorkflowNode): number {
  const def = getNodeDef(node.type);
  if (def?.category !== "ai") return 0;
  return 800 + (hash(node.id) % 4000);
}

// ~7% of non-trigger nodes fail on first attempt; self-heal retries usually succeed.
export function nodeFailsOn(node: WorkflowNode, attempt: number): boolean {
  if (node.type.startsWith("trigger")) return false;
  const def = getNodeDef(node.type);
  if (!def) return false;
  // CRM sync & leadgen are scripted to be flaky for realism
  const flaky = node.type === "dev.rest" || node.type === "store.supabase" || node.type === "comm.slack";
  const base = flaky ? 0.22 : 0.06;
  const h = hash(node.id + attempt);
  const r = (h % 1000) / 1000;
  if (attempt === 0) return r < base;
  // retries mostly succeed
  return r < base * 0.25;
}

export function nodeLogs(node: WorkflowNode): string[] {
  const def = getNodeDef(node.type);
  const label = node.data.label;
  switch (def?.category) {
    case "ai":
      return [`Calling ${label}`, "Streaming response", "Parsed structured output", "Completed"];
    case "storage":
      return [`Connecting to ${label}`, "Query executed", "1 row(s) affected", "Done"];
    case "communication":
      return [`Authenticating with ${label}`, "Message prepared", "Delivered"];
    case "documents":
      return [`Loading document`, "Extracting content", "Structured fields ready"];
    case "developer":
      return [`HTTP ${node.data.config.method ?? "GET"} request`, "Response 200", "Body parsed"];
    case "cloud":
      return [`Uploading to ${label}`, "Transfer complete"];
    case "utilities":
      return [`Evaluating ${label}`, "Branch resolved"];
    default:
      return [`${label} fired`, "Completed"];
  }
}

export function nodeReasoning(node: WorkflowNode): string[] | undefined {
  const def = getNodeDef(node.type);
  if (def?.category !== "ai") return undefined;
  if (node.type === "ai.router")
    return ["Estimate task complexity", "Compare model cost/quality", "Selected model for this run"];
  if (node.type === "ai.agent")
    return ["Plan subtasks", "Use search tool", "Synthesize findings"];
  if (node.type === "ai.memory")
    return ["Query long-term memory", "Score relevance", "Inject context"];
  return ["Parse input", "Generate", "Validate output"];
}

export interface ExecutionEvent {
  nodeId: string;
  status: "running" | "succeeded" | "failed" | "retrying";
  log?: string;
  reasoning?: string;
  attempt?: number;
}

// Build a full timed event schedule for a workflow run.
export function scheduleExecution(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const order = topoOrder(nodes, edges);
  const events: { at: number; event: ExecutionEvent }[] = [];
  let t = 0;
  for (const node of order) {
    const dur = nodeDurationMs(node);
    const willFail = nodeFailsOn(node, 0);
    events.push({ at: t, event: { nodeId: node.id, status: "running", attempt: 0 } });
    const logs = nodeLogs(node);
    logs.forEach((log, i) => {
      events.push({ at: t + Math.round((dur / logs.length) * (i + 0.6)), event: { nodeId: node.id, status: "running", log } });
    });
    if (nodeReasoning(node)) {
      nodeReasoning(node)!.forEach((r, i) => {
        events.push({ at: t + Math.round((dur / 4) * (i + 1)), event: { nodeId: node.id, status: "running", reasoning: r } });
      });
    }
    if (willFail) {
      // fail then retry
      events.push({ at: t + dur, event: { nodeId: node.id, status: "failed", log: logs[logs.length - 1] + " — error", attempt: 0 } });
      events.push({ at: t + dur + 600, event: { nodeId: node.id, status: "retrying", log: "Self-healing: retrying…", attempt: 1 } });
      const retryDur = Math.round(dur * 0.9);
      events.push({ at: t + dur + 600, event: { nodeId: node.id, status: "running", attempt: 1 } });
      nodeFailsOn(node, 1)
        ? events.push({ at: t + dur + 600 + retryDur, event: { nodeId: node.id, status: "failed", log: "Retry failed", attempt: 1 } })
        : events.push({ at: t + dur + 600 + retryDur, event: { nodeId: node.id, status: "succeeded", log: "Retry succeeded", attempt: 1 } });
      t = t + dur + 600 + retryDur;
    } else {
      events.push({ at: t + dur, event: { nodeId: node.id, status: "succeeded", log: "Completed" } });
      t = t + dur;
    }
    t += 120; // gap
  }
  return { order, events, totalMs: t };
}