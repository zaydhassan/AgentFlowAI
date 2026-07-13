// ============================================================
// Executor Agent
// ============================================================
// Terminal node. Synthesizes the reviewed agent results into the final answer
// returned to the operator (and emitted as the Multi-Agent node's output when
// invoked from the workflow execution engine).

import "server-only";
import type { AgentDefinition, AgentState } from "../types";
import { systemPromptFor } from "../prompts";

export const executorAgent: AgentDefinition = {
  id: "executor",
  label: "Executor",
  description: "Synthesizes reviewed results into the final answer.",
  tools: [{ tool: "llm" }],
  async run(ctx, state): Promise<Partial<AgentState>> {
    ctx.trace("agent:start", "Synthesizing final answer");
    ctx.reason("Synthesize final answer from reviewed results");

    const system = systemPromptFor("executor", { objective: state.objective, guidance: ctx.guidance });
    const user = buildExecutorUserPrompt(state);
    const { text, tokensUsed } = await ctx.llm.complete(system, user);

    ctx.trace("agent:success", "Final answer ready", { durationMs: 0, tokensUsed });
    return { finalAnswer: text };
  },
};

function buildExecutorUserPrompt(state: AgentState): string {
  const review = state.review
    ? `Review verdict: ${state.review.approved ? "approved" : "revisions requested"} (confidence ${state.review.confidence.toFixed(2)})` +
      (state.review.corrections.length ? `\nCorrections:\n- ${state.review.corrections.join("\n- ")}` : "")
    : "Review verdict: n/a";
  const resultsDigest = Object.values(state.results)
    .map((r) => `[${r.subtaskId ?? r.agent}] (${r.agent})\n${r.output}`)
    .join("\n\n");
  const memoryBrief = state.context ? `\nMemory brief:\n${state.context}\n` : "";
  return `Objective:\n${state.objective}${memoryBrief}\n\n${review}\n\nAgent results:\n${resultsDigest || "(no results)"}\n\nWrite the final answer for the operator.`;
}