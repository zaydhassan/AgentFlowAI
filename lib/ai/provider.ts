// Pluggable AI provider. When an LLM key is configured (OPENAI_API_KEY or
// ANTHROPIC_API_KEY), streams from the real model over fetch + SSE. Otherwise
// delegates to the enhanced deterministic engine. Mirrors the Stripe
// "configured vs dev-fallback" pattern: the UX is the same either way.
//
// No SDK dependency — we call the OpenAI / Anthropic REST APIs directly with
// fetch, which keeps this module dependency-free and hermetic to install.

import "server-only";
import { getNodeDef } from "@/lib/nodes";
import type { WorkflowNode, WorkflowEdge, CopilotSuggestion } from "@/lib/types";
import {
  GENERATE_SYSTEM,
  COPILOT_SYSTEM,
  EXPLAIN_SYSTEM,
  ANALYZE_SYSTEM,
  RECOMMEND_SYSTEM,
  NODE_LIBRARY_DIGEST,
  serializeGraph,
} from "./prompts";
import {
  deterministicGenerate,
  deterministicCopilot,
  deterministicComplete,
  deterministicExplain,
  deterministicAnalyze,
  deterministicRecommend,
  tokenize,
  type NLPlan,
} from "./deterministic";

export type { NLPlan };
export type GenChunk = { type: "text"; text: string } | { type: "plan"; plan: NLPlan };

type ChatRole = "system" | "user" | "assistant";
interface ChatMessage {
  role: ChatRole;
  content: string;
}

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const AI_MODEL = process.env.AI_MODEL;

export const aiConfigured = Boolean(OPENAI_KEY || ANTHROPIC_KEY);

export function aiProvider(): "openai" | "anthropic" | "deterministic" {
  if (ANTHROPIC_KEY) return "anthropic";
  if (OPENAI_KEY) return "openai";
  return "deterministic";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────────── real LLM streaming ───────────────────────────

async function* streamOpenAI(messages: ChatMessage[], model: string, signal?: AbortSignal): AsyncGenerator<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model, stream: true, messages, temperature: 0.4 }),
  });
  if (!res.ok || !res.body) throw new Error(`OpenAI error ${res.status}: ${await safeText(res)}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) yield delta;
      } catch {
        // partial JSON across chunks — ignore, will complete next line
      }
    }
  }
}

async function* streamAnthropic(messages: ChatMessage[], system: string, model: string, signal?: AbortSignal): AsyncGenerator<string> {
  // Anthropic takes system separately; strip it from messages.
  const userMsgs = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, system, stream: true, max_tokens: 1024, messages: userMsgs, temperature: 0.4 }),
  });
  if (!res.ok || !res.body) throw new Error(`Anthropic error ${res.status}: ${await safeText(res)}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      try {
        const json = JSON.parse(t.slice(5).trim());
        if (json?.type === "content_block_delta" && json.delta?.text) yield json.delta.text as string;
      } catch {
        /* partial */
      }
    }
  }
}

async function* streamLLM(system: string, user: string, signal?: AbortSignal): AsyncGenerator<string> {
  const provider = aiProvider();
  const model = AI_MODEL ?? (provider === "anthropic" ? "claude-haiku-4-5" : "gpt-4.1-mini");
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  if (provider === "anthropic") {
    yield* streamAnthropic(messages, system, model, signal);
  } else {
    yield* streamOpenAI(messages, model, signal);
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return res.statusText;
  }
}

// ─────────────────────────── public API ───────────────────────────────────

/**
 * One-shot completion for AI nodes during workflow execution (used by the
 * memory-aware execution branch). Streams internally, returns the full text.
 * Uses the real LLM when configured, else the deterministic fallback — both are
 * real product paths (never a mock). Tokens are estimated from character count
 * (~4 chars/token) since streaming responses don't return usage.
 */
export async function completeText(
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<{ text: string; tokensUsed: number }> {
  if (!aiConfigured) {
    const { text } = deterministicComplete(system, user);
    return { text, tokensUsed: Math.ceil((system.length + user.length + text.length) / 4) };
  }
  try {
    const text = await collect(streamLLM(system, user, signal));
    return { text, tokensUsed: Math.ceil((system.length + user.length + text.length) / 4) };
  } catch (err) {
    console.error("[ai] completeText failed, falling back", err);
    const { text } = deterministicComplete(system, user);
    return { text, tokensUsed: Math.ceil((system.length + user.length + text.length) / 4) };
  }
}

/** Streaming chat for the Copilot panel. Yields token strings. */
export async function* copilotChat(question: string, graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }, signal?: AbortSignal): AsyncGenerator<string> {
  const ctx = serializeGraph(graph.nodes, graph.edges);
  const user = `Workflow:\n${ctx}\n\nLibrary:\n${NODE_LIBRARY_DIGEST}\n\nQuestion: ${question}`;
  if (!aiConfigured) {
    for (const tok of tokenize(deterministicCopilot(question))) {
      yield tok;
      await sleep(18);
    }
    return;
  }
  try {
    yield* streamLLM(COPILOT_SYSTEM, user, signal);
  } catch (err) {
    console.error("[ai] copilot stream failed, falling back", err);
    for (const tok of tokenize(deterministicCopilot(question))) yield tok;
  }
}

/** Stream a plain-English explanation of the workflow. */
export async function* explainWorkflow(graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }, signal?: AbortSignal): AsyncGenerator<string> {
  const ctx = serializeGraph(graph.nodes, graph.edges);
  if (!aiConfigured) {
    for (const tok of tokenize(deterministicExplain(graph.nodes, graph.edges))) {
      yield tok;
      await sleep(16);
    }
    return;
  }
  try {
    yield* streamLLM(EXPLAIN_SYSTEM, `Explain this workflow:\n${ctx}`, signal);
  } catch (err) {
    console.error("[ai] explain stream failed, falling back", err);
    for (const tok of tokenize(deterministicExplain(graph.nodes, graph.edges))) yield tok;
  }
}

/** NL → streaming plan + graph. Yields text chunks then a final plan. */
export async function* generateWorkflow(prompt: string, signal?: AbortSignal): AsyncGenerator<GenChunk> {
  if (!aiConfigured) {
    const { text, plan } = deterministicGenerate(prompt);
    for (const tok of tokenize(text)) {
      yield { type: "text", text: tok };
      await sleep(22);
    }
    yield { type: "plan", plan };
    return;
  }

  let full = "";
  try {
    for await (const tok of streamLLM(GENERATE_SYSTEM, `${prompt}\n\n${NODE_LIBRARY_DIGEST}`, signal)) {
      full += tok;
      yield { type: "text", text: tok };
    }
  } catch (err) {
    console.error("[ai] generate stream failed, falling back", err);
    const { text, plan } = deterministicGenerate(prompt);
    yield { type: "text", text };
    yield { type: "plan", plan };
    return;
  }

  const plan = parseGeneratePlan(full, prompt);
  yield { type: "plan", plan };
}

/** Structured analysis (error detection / cost / optimization / self-heal). */
export async function analyzeWorkflow(
  graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] },
  failedNode?: WorkflowNode,
  signal?: AbortSignal,
): Promise<{ suggestions: CopilotSuggestion[] }> {
  const ctx = serializeGraph(graph.nodes, graph.edges);
  const failed = failedNode ? `\nA node just failed: "${failedNode.data.label}" (${failedNode.type}). Last log: ${failedNode.data.logs?.slice(-1)[0] ?? "n/a"}.` : "";
  if (!aiConfigured) {
    return { suggestions: deterministicAnalyze(graph.nodes, graph.edges, failedNode) };
  }
  try {
    const raw = await collect(streamLLM(ANALYZE_SYSTEM, `${ctx}${failed}`, signal));
    const json = extractJson(raw);
    const suggestions = (json?.suggestions as CopilotSuggestion[] | undefined) ?? [];
    if (suggestions.length === 0) return { suggestions: deterministicAnalyze(graph.nodes, graph.edges, failedNode) };
    return { suggestions: suggestions.slice(0, 8).map((s, i) => ({ ...s, id: s.id ?? `ai-${i}` })) };
  } catch (err) {
    console.error("[ai] analyze failed, falling back", err);
    return { suggestions: deterministicAnalyze(graph.nodes, graph.edges, failedNode) };
  }
}

/** Next-node recommendations. */
export async function recommendNodes(
  selectedType: string | null,
  graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] },
  signal?: AbortSignal,
): Promise<{ nodes: { type: string; reason: string }[] }> {
  const ctx = serializeGraph(graph.nodes, graph.edges);
  const sel = selectedType ? `\nThe user just selected a "${selectedType}" node. Recommend what to add after it.` : "";
  if (!aiConfigured) {
    return { nodes: deterministicRecommend(selectedType, graph.nodes) };
  }
  try {
    const raw = await collect(streamLLM(RECOMMEND_SYSTEM, `${ctx}${sel}\n\n${NODE_LIBRARY_DIGEST}`, signal));
    const json = extractJson(raw);
    const nodes = (json?.nodes as { type: string; reason: string }[] | undefined) ?? [];
    // validate types exist in the library
    const valid = nodes.filter((n) => Boolean(getNodeDef(n.type)));
    if (valid.length === 0) return { nodes: deterministicRecommend(selectedType, graph.nodes) };
    return { nodes: valid.slice(0, 5) };
  } catch (err) {
    console.error("[ai] recommend failed, falling back", err);
    return { nodes: deterministicRecommend(selectedType, graph.nodes) };
  }
}

// ─────────────────────────── helpers ──────────────────────────────────────

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  let out = "";
  for await (const t of gen) out += t;
  return out;
}

function extractJson(text: string): Record<string, unknown> | null {
  // Try fenced ```json block first, then first {...} balanced span.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  if (start === -1) return null;
  // find matching brace
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        const slice = candidate.slice(start, i + 1);
        try {
          return JSON.parse(slice);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function parseGeneratePlan(text: string, prompt: string): NLPlan {
  const json = extractJson(text);
  const rawNodes = (json?.nodes as { type: string; label?: string }[] | undefined) ?? [];
  const rawEdges = (json?.edges as { source: number; target: number }[] | undefined) ?? [];

  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  const plan: string[] = [];

  rawNodes.forEach((raw, i) => {
    const def = getNodeDef(raw.type);
    if (!def) return; // skip unknown types
    const id = `g${i + 1}`;
    const col = i % 3;
    const row = Math.floor(i / 3);
    nodes.push({
      id,
      type: raw.type,
      position: { x: 40 + col * 280, y: 40 + row * 180 },
      data: { label: raw.label?.trim() || def.label, config: def.defaultConfig ?? {} },
    });
    plan.push(`Step ${i}: ${def.label}`);
  });

  const idByIndex = rawNodes.map((r, i) => (getNodeDef(r.type) ? `g${i + 1}` : null));
  for (const e of rawEdges) {
    const source = idByIndex[e.source];
    const target = idByIndex[e.target];
    if (source && target) edges.push({ id: `e-${source}-${target}`, source, target, animated: true });
  }

  if (nodes.length === 0) {
    // the model didn't produce usable nodes — fall back to deterministic.
    return deterministicGenerate(prompt).plan;
  }

  const reasoning = text.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim().slice(0, 400) || "Generated from your request.";
  return { plan, nodes, edges, reasoning };
}