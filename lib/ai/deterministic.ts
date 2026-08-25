import "server-only";
import { generateWorkflowFromPrompt, mockCopilotReply, selfHealSuggestions } from "@/lib/mock/ai";
import { getNodeDef, NODE_LIBRARY } from "@/lib/nodes";
import type { CopilotSuggestion, WorkflowNode, WorkflowEdge, NodeDef } from "@/lib/types";
import type { NLPlan } from "@/lib/mock/ai";
import { serializeGraph } from "./prompts";

export type { NLPlan };

export function deterministicGenerate(prompt: string): { text: string; plan: NLPlan } {
  const plan = generateWorkflowFromPrompt(prompt);
  const text = `${plan.reasoning} I'll start with ${plan.nodes[0]?.data.label ?? "a trigger"} and chain ${plan.nodes.length - 1} action${plan.nodes.length - 1 === 1 ? "" : "s"} in dependency order.`;
  return { text, plan };
}

export function deterministicCopilot(question: string): string {
  return mockCopilotReply(question);
}

/**
 * Deterministic fallback for AI-node generation during workflow execution (used
 * by lib/ai/provider.completeText when no LLM key is configured). Real and
 * reproducible — derived from the user prompt — but explicitly labelled as the
 * offline fallback so it is never mistaken for model output. Not a mock: the
 * memory engine still stores the real input + this response.
 */
export function deterministicComplete(system: string, user: string): { text: string } {
  const task = user.trim().slice(0, 240);
  const sysHint = system.trim() ? ` (role: ${system.trim().slice(0, 80)})` : "";
  const text =
    `[deterministic fallback — set OPENAI_API_KEY or ANTHROPIC_API_KEY for real model output]\n` +
    `Processed the upstream input${sysHint}.\n\nSummary: ${task || "(empty input)"}`;
  return { text };
}

export function deterministicExplain(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  if (nodes.length === 0) return "This workflow is empty — drag a trigger node onto the canvas to get started.";
  const order = topologicalSummary(nodes, edges);
  const trigger = order[0];
  const aiCount = nodes.filter((n) => getNodeDef(n.type)?.category === "ai").length;
  const hasErrorHandling = nodes.some((n) => n.type === "util.condition" || n.type === "util.switch");
  const parts: string[] = [];
  parts.push(`This workflow starts at ${trigger?.data.label ?? "a trigger"} and flows through ${nodes.length} step${nodes.length === 1 ? "" : "s"}: ${order.map((n) => n.data.label).join(" → ")}.`);
  if (aiCount) parts.push(`It uses ${aiCount} AI step${aiCount === 1 ? "" : "s"} for generation or understanding.`);
  parts.push(hasErrorHandling
    ? "Branching logic handles edge cases and routes failures, so the run degrades gracefully."
    : "There's no explicit error handling yet — adding a condition node after risky steps would make it more robust.");
  return parts.join(" ");
}

export function deterministicAnalyze(nodes: WorkflowNode[], edges: WorkflowEdge[], failedNode?: WorkflowNode): CopilotSuggestion[] {
  if (failedNode) return selfHealSuggestions(failedNode.data.logs?.slice(-1)[0] ?? "node failed");

  const suggestions: CopilotSuggestion[] = [];
  const aiNodes = nodes.filter((n) => getNodeDef(n.type)?.category === "ai");
  const hasErrorHandling = nodes.some((n) => n.type === "util.condition" || n.type === "util.switch");
  const hasRetry = nodes.some((n) => getNodeDef(n.type)?.category === "communication" || n.type.startsWith("dev.") || n.type.startsWith("store."));
  const hasMemory = nodes.some((n) => getNodeDef(n.type)?.category === "memory");

  if (aiNodes.length >= 2 && !nodes.some((n) => n.type === "ai.router")) {
    suggestions.push({
      id: "a-router",
      kind: "cost",
      title: "Add an AI Router",
      description: `You have ${aiNodes.length} AI steps but no router. Routing low-complexity inputs to a smaller model typically cuts inference cost ~60% with no quality loss on routine calls.`,
      severity: "warning",
      action: "Insert AI Router",
    });
  }
  if (!hasErrorHandling && nodes.length >= 3) {
    suggestions.push({
      id: "a-errors",
      kind: "architecture",
      title: "Add error handling",
      description: "No condition/switch node guards risky steps. A self-healing branch after external calls prevents silent failures and enables retries.",
      severity: "warning",
      action: "Add condition",
    });
  }
  if (hasRetry && !nodes.some((n) => n.type === "memory.recall")) {
    suggestions.push({
      id: "a-memory",
      kind: "performance",
      title: "Cache with Memory Recall",
      description: "Repeated external lookups can be memoized. A Memory node before re-calls reduces latency and API volume.",
      severity: "info",
      action: "Add memory recall",
    });
  }
  if (!hasMemory && aiNodes.length) {
    suggestions.push({
      id: "a-context",
      kind: "missing-node",
      title: "Persist context across runs",
      description: "AI steps have no long-term memory. Adding a Memory Store/Recall pair lets the workflow learn preferences across executions.",
      severity: "info",
      action: "Add memory",
    });
  }
  void edges;
  if (suggestions.length === 0) {
    suggestions.push({
      id: "a-ok",
      kind: "architecture",
      title: "Workflow looks healthy",
      description: "No high-priority issues detected. Consider versioning this workflow before your next structural change.",
      severity: "info",
      action: "Save version",
    });
  }
  return suggestions.slice(0, 6);
}

export function deterministicRecommend(selectedType: string | null, nodes: WorkflowNode[]): { type: string; reason: string }[] {
  const present = new Set(nodes.map((n) => n.type));
  const out: { type: string; reason: string }[] = [];

  const addIf = (type: string, reason: string) => {
    if (!present.has(type)) {
      const def = getNodeDef(type);
      if (def) out.push({ type, reason });
    }
  };

  if (selectedType) {
    const def = getNodeDef(selectedType);
    const cat = def?.category;
    if (cat === "ai") addIf("memory.recall", "Ground the model's response in stored context.");
    if (cat === "communication" || cat === "integrations") addIf("util.condition", "Branch on the response status before continuing.");
    if (cat === "files") addIf("ai.claude", "Extract structured fields from the document with an LLM.");
    if (cat === "database") addIf("util.transform", "Shape the query result into the next step's expected schema.");
  }
  addIf("util.condition", "Route failures vs. successes.");
  addIf("memory.store", "Persist a value for later runs.");
  addIf("ai.router", "Pick the best model per step.");

  if (out.length === 0) {
    out.push({ type: "trigger.schedule", reason: "Run this on a schedule instead of manually." });
  }
  return out.slice(0, 5);
}

function topologicalSummary(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
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

export function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

export { serializeGraph, NODE_LIBRARY };
export type { NodeDef };