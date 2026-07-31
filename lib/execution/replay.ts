// Single-node re-execution for the AI Workflow Debugger.
//
// "Replay failed node" / "retry individual node" re-runs ONE node in isolation,
// streaming the same ExecutionEvent shape the run engine produces, but seeded
// with the node's *recorded* inputs (from its persisted ExecutionStep `input`)
// so a replay is deterministic w.r.t. upstream state. It reuses the real action
// executors (lib/integrations runAction, lib/agents runMultiAgent, lib/ai
// completeText, lib/memory getMemoryEngine) and the engine's exported helpers
// (upstreamOutputs / synthOutput / nodeLogs / nodeReasoning). The hot
// runWorkflow loop is untouched — this is an additive, parallel executor.
//
// It deliberately does NOT re-simulate flakiness/timing: a replay is meant to
// inspect a node's real I/O, so the simulated branch streams its logs and
// succeeds. Real branches (memory AI, multi-agent, MCP/integration) perform
// the live call again.
//
// `Date.now()` is fine — server module.

import "server-only";
import type { WorkflowNode } from "@/lib/types";
import { getNodeDef } from "@/lib/nodes";
import {
  upstreamOutputs,
  synthOutput,
  nodeLogs,
  nodeReasoning,
  type ExecutionEvent,
  type RunControls,
} from "./engine";
import { resolveAction, runAction } from "./actions/registry";
import { runMultiAgent } from "./actions/multiagent";
import { getMemoryEngine, embeddingConfigured, type MemoryHit, type MemoryScope } from "@/lib/memory";
import { completeText } from "@/lib/ai/provider";

const TOKEN_RATE = 0.002 / 1000;
const MEMORY_TOP_K = Number(process.env.MEMORY_TOP_K ?? 5) || 5;
const MEMORY_THRESHOLD = Number(process.env.MEMORY_SIMILARITY_THRESHOLD ?? 0.75) || 0.75;

function isMemoryAINode(node: WorkflowNode): boolean {
  const def = getNodeDef(node.type);
  if (node.type === "ai.multiAgent") return false;
  return def?.category === "ai" && node.data.config?.useMemory === true;
}

function safeStringify(x: unknown): string {
  if (x == null) return "(null)";
  if (typeof x === "string") return x;
  try { return JSON.stringify(x); } catch { return String(x); }
}

function buildMemoryUserPrompt(node: WorkflowNode, inputs: unknown[]): string {
  const cfg = node.data.config ?? {};
  const task =
    typeof cfg.template === "string" && cfg.template.trim() ? cfg.template :
    typeof cfg.goal === "string" && cfg.goal.trim() ? cfg.goal :
    typeof cfg.system === "string" && cfg.system.trim() ? cfg.system :
    (node.data.label || node.type);
  const inputText = inputs.length
    ? inputs.map((x, i) => `[input ${i + 1}]\n${safeStringify(x)}`).join("\n\n")
    : "(no upstream input)";
  return `Task:\n${task}\n\nInput:\n${inputText}`;
}

function sleep(ms: number, stopped: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const end = Date.now() + ms;
    const check = () => { if (stopped() || Date.now() >= end) return resolve(); setTimeout(check, 40); };
    setTimeout(check, 40);
  });
}

function mem(h: MemoryHit) {
  return { score: h.score, id: h.memory.id, content: h.memory.content, scope: h.memory.scope };
}

/**
 * Re-execute a single node in isolation, streaming ExecutionEvents.
 *
 * @param node      the workflow node definition (from the current graph)
 * @param inputs    the recorded upstream outputs to feed the node (from the
 *                  persisted step `input`, or `upstreamOutputs(...)` for a
 *                  live-run retry)
 * @param controls  the same RunControls seam as runWorkflow (stopped + auth)
 */
export async function* runSingleNode(
  node: WorkflowNode,
  inputs: unknown[],
  controls: RunControls,
): AsyncGenerator<ExecutionEvent, void, unknown> {
  const t0 = Date.now();
  const at = () => Date.now() - t0;
  const nodeStart = Date.now();
  const cfg = node.data.config ?? {};

  yield { type: "node:start", at: at(), nodeId: node.id, nodeName: node.data.label, status: "running", attempt: 0, nodeType: node.type };

  // ── memory-aware AI ──
  if (isMemoryAINode(node)) {
    if (!controls.userId) {
      const err = "No user context — sign in to run memory-enabled AI nodes.";
      yield { type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: err, attempt: 0, error: err, durationMs: Date.now() - nodeStart, tokensUsed: 0, cost: 0, retries: 0, nodeType: node.type, config: cfg, input: inputs };
      return;
    }
    const scope = (typeof cfg.memoryScope === "string" ? cfg.memoryScope : "long_term") as MemoryScope;
    const userPrompt = buildMemoryUserPrompt(node, inputs);
    let hits: MemoryHit[] = [];
    if (embeddingConfigured()) {
      try {
        const result = await getMemoryEngine().recall({
          userId: controls.userId, orgId: controls.orgId ?? null, scope,
          query: userPrompt, workflowId: controls.workflowId ?? null, agentId: node.id,
          topK: MEMORY_TOP_K, threshold: MEMORY_THRESHOLD,
        });
        hits = result.hits;
        yield { type: "node:log", at: at(), nodeId: node.id, log: `🧠 memory · retrieved ${hits.length} · scope=${scope}`, status: "running", attempt: 0 };
      } catch (err) {
        yield { type: "node:log", at: at(), nodeId: node.id, log: `🧠 memory · recall error: ${err instanceof Error ? err.message : "failed"}`, status: "running", attempt: 0 };
      }
      if (controls.stopped()) return;
    }
    const baseSystem = typeof cfg.system === "string" && cfg.system.trim() ? cfg.system : `You are an AI agent ("${node.data.label || node.type}") in an AgentFlow workflow.`;
    const memoryBlock = hits.length ? `\n\nRelevant memories (most relevant first, score in brackets):\n${hits.map((h, i) => `(${i + 1}) [${h.score.toFixed(2)}] ${h.memory.content}`).join("\n")}` : "";
    const augmentedSystem = baseSystem + memoryBlock;
    const { text: response, tokensUsed } = await completeText(augmentedSystem, userPrompt);
    if (controls.stopped()) return;
    const elapsed = Date.now() - nodeStart;
    yield {
      type: "node:success", at: at(), nodeId: node.id, status: "succeeded", log: "Completed", attempt: 0,
      durationMs: elapsed, tokensUsed, cost: tokensUsed * TOKEN_RATE, retries: 0,
      nodeType: node.type, config: cfg, input: inputs, output: { text: response, memories: hits },
      prompt: { system: augmentedSystem, user: userPrompt }, memories: hits.map(mem),
    };
    return;
  }

  // ── multi-agent runtime ──
  if (node.type === "ai.multiAgent") {
    if (!controls.userId) {
      const err = "No user context — sign in to run the Multi-Agent runtime.";
      yield { type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: err, attempt: 0, error: err, durationMs: Date.now() - nodeStart, tokensUsed: 0, cost: 0, retries: 0, nodeType: node.type, config: cfg, input: inputs };
      return;
    }
    const gen = runMultiAgent({
      userId: controls.userId, orgId: controls.orgId ?? null, workflowId: controls.workflowId ?? null,
      nodeId: node.id, config: cfg, inputs, stopped: () => controls.stopped(),
    });
    let result;
    try {
      while (true) {
        if (controls.stopped()) return;
        const { value, done } = await gen.next();
        if (done) { result = value; break; }
        if (value && value.type === "log") yield { type: "node:log", at: at(), nodeId: node.id, log: value.log, status: "running", attempt: 0 };
      }
    } catch (err) {
      const e = err instanceof Error ? err.message : "multi-agent error";
      yield { type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: e, attempt: 0, error: e, durationMs: Date.now() - nodeStart, tokensUsed: 0, cost: 0, retries: 0, nodeType: node.type, config: cfg, input: inputs };
      return;
    }
    if (result?.status !== "succeeded") {
      const e = result?.error ?? "Multi-agent run failed";
      yield { type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: e, attempt: 0, error: e, durationMs: Date.now() - nodeStart, tokensUsed: result?.tokensUsed ?? 0, cost: result?.cost ?? 0, retries: 0, nodeType: node.type, config: cfg, input: inputs, output: result?.output };
      return;
    }
    yield {
      type: "node:success", at: at(), nodeId: node.id, status: "succeeded", log: "Completed", attempt: 0,
      durationMs: Date.now() - nodeStart, tokensUsed: result.tokensUsed ?? 0, cost: result.cost ?? 0, retries: 0,
      nodeType: node.type, config: cfg, input: inputs, output: result.output,
    };
    return;
  }

  // ── real integration / MCP action ──
  const actionMeta = resolveAction(node.type);
  if (actionMeta) {
    if (!controls.userId) {
      const err = "No user context — sign in to run this node.";
      yield { type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: err, attempt: 0, error: err, durationMs: Date.now() - nodeStart, tokensUsed: 0, cost: 0, retries: 0, nodeType: node.type, config: cfg, input: inputs };
      return;
    }
    const gen = runAction({ userId: controls.userId, nodeType: node.type, config: cfg, inputs, stopped: () => controls.stopped() });
    let result;
    try {
      while (true) {
        if (controls.stopped()) return;
        const { value, done } = await gen.next();
        if (done) { result = value; break; }
        if (value && value.type === "log") yield { type: "node:log", at: at(), nodeId: node.id, log: value.log, status: "running", attempt: 0 };
      }
    } catch (err) {
      const e = err instanceof Error ? err.message : "action error";
      yield { type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: e, attempt: 0, error: e, durationMs: Date.now() - nodeStart, tokensUsed: 0, cost: 0, retries: 0, nodeType: node.type, config: cfg, input: inputs };
      return;
    }
    if (result?.status !== "succeeded") {
      const e = result?.error ?? "Action failed";
      yield { type: "node:fail", at: at(), nodeId: node.id, status: "failed", log: e, attempt: 0, error: e, durationMs: Date.now() - nodeStart, tokensUsed: result?.tokensUsed ?? 0, cost: result?.cost ?? 0, retries: 0, nodeType: node.type, config: cfg, input: inputs, output: result?.output };
      return;
    }
    yield {
      type: "node:success", at: at(), nodeId: node.id, status: "succeeded", log: "Completed", attempt: 0,
      durationMs: Date.now() - nodeStart, tokensUsed: result.tokensUsed ?? 0, cost: result.cost ?? 0, retries: 0,
      nodeType: node.type, config: cfg, input: inputs, output: result.output,
    };
    return;
  }

  // ── simulated node: stream its logs and emit the synthesized I/O ──
  const logs = nodeLogs(node);
  for (const log of logs) {
    await sleep(120, controls.stopped);
    if (controls.stopped()) return;
    yield { type: "node:log", at: at(), nodeId: node.id, log, status: "running", attempt: 0 };
  }
  const reasoning = nodeReasoning(node);
  if (reasoning) for (const r of reasoning) yield { type: "node:reasoning", at: at(), nodeId: node.id, reasoning: r, status: "running", attempt: 0 };
  yield {
    type: "node:success", at: at(), nodeId: node.id, status: "succeeded", log: "Completed", attempt: 0,
    durationMs: Date.now() - nodeStart, tokensUsed: 0, cost: 0, retries: 0,
    nodeType: node.type, config: cfg, input: inputs, output: synthOutput(node),
  };
}

export { upstreamOutputs };