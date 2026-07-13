// System prompts + graph→context serializer for the AI layer. Shared by the
// real LLM path and the deterministic fallback so both reason over the same
// description of the user's workflow.

import "server-only";
import { getNodeDef } from "@/lib/nodes";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

// A compact, LLM-friendly description of the current canvas.
export function serializeGraph(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  if (nodes.length === 0) return "(empty canvas)";
  const lines: string[] = [];
  lines.push(`Nodes (${nodes.length}):`);
  for (const n of nodes) {
    const def = getNodeDef(n.type);
    const cat = def?.category ?? "canvas";
    const cfg = Object.keys(n.data.config ?? {});
    lines.push(`  - ${n.id} [${n.type}] (${cat}) "${n.data.label}"${cfg.length ? ` config={${cfg.join(",")}}` : ""}`);
  }
  if (edges.length) {
    lines.push(`Edges (${edges.length}):`);
    for (const e of edges) lines.push(`  - ${e.source} -> ${e.target}${e.label ? ` (${e.label})` : ""}`);
  }
  return lines.join("\n");
}

export const GENERATE_SYSTEM = `You are AgentFlow's workflow architect. Given a natural-language request, design a production automation as a directed graph of nodes.

First, in 2-4 short sentences, explain your plan and reasoning in plain English (this streams to the user live — no markdown headings, no bullets, just flowing prose).

Then output a single fenced \`\`\`json block with this exact shape:
\`\`\`json
{
  "nodes": [{ "type": "node.type", "label": "Human label" }],
  "edges": [{ "source": 0, "target": 1 }]
}
\`\`\`
- "source"/"target" are zero-based indices into the nodes array (the first node is the trigger).
- Use only node types from the provided library. Sequence nodes in dependency order.
- Keep it minimal: the fewest nodes that satisfy the request.`;

export const COPILOT_SYSTEM = `You are AgentFlow's AI Copilot — a concise, senior automation engineer advising on a user's visual workflow. Be specific, practical, and short (2-4 sentences). Reference concrete node types and trade-offs. Never invent node types outside the provided library. When the user asks to change something, describe exactly what to add/connect.`;

export const EXPLAIN_SYSTEM = `You are AgentFlow's explainer. Describe the given workflow in clear, plain English as if onboarding a new teammate: what it does end-to-end, the key steps in order, and any notable branching or failure handling. 3-5 sentences, no markdown.`;

export const ANALYZE_SYSTEM = `You are AgentFlow's reliability & cost reviewer. Inspect the workflow and return ONLY valid JSON (no prose, no fences) of this shape:
{ "suggestions": [ { "kind": "missing-node"|"architecture"|"cost"|"performance"|"security"|"self-heal", "title": "...", "description": "...", "severity": "info"|"warning"|"critical", "action": "short CTA" } ] }
Find 3-6 high-signal improvements: missing error handling, retryable failure paths, cost (model routing), latency (parallelization), security (inline secrets). If a failed node is provided, prioritize self-heal suggestions for it.`;

export const RECOMMEND_SYSTEM = `You are AgentFlow's node recommender. Given the current workflow and (optionally) a selected node, suggest the 3-5 most useful next nodes to add. Return ONLY valid JSON (no prose, no fences):
{ "nodes": [ { "type": "valid.node.type", "reason": "one line why" } ] }
Use only node types from the provided library.`;

export const NODE_LIBRARY_DIGEST = `Available node types (use ONLY these): ai.openai, ai.claude, ai.gemini, ai.router, ai.agent, ai.multiAgent, ai.memory, gmail.trigger.newEmail, gmail.send, gmail.reply, gmail.forward, gmail.search, gmail.read, gmail.draft, gmail.label.add, gmail.label.remove, gmail.archive, gmail.markRead, gmail.delete, comm.slack, comm.discord, comm.telegram, comm.whatsapp, comm.outlook, store.postgres, store.mysql, store.mongo, store.redis, store.supabase, store.firebase, store.dynamo, doc.pdf, doc.docx, doc.excel, doc.csv, doc.ocr, doc.image, dev.rest, dev.graphql, dev.python, dev.javascript, dev.shell, cloud.s3, cloud.azure, cloud.gcp, util.delay, util.condition, util.switch, util.transform, util.loop, util.merge, util.code, trigger.webhook, trigger.schedule, trigger.event, trigger.interval, memory.store, memory.recall, memory.scope, rag.embed, rag.index, rag.retrieve, integrations.stripe, integrations.github, integrations.notion, integrations.hubspot, integrations.linear, integrations.salesforce, mcp.tool, mcp.resource.`;