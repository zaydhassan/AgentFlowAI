// ============================================================
// Reasoning Agent
// ============================================================
// Handles subtasks assigned to "reasoning". Performs step-by-step logical
// inference, analysis, and deduction, and returns a conclusion per subtask.
// Unlike research (which gathers), reasoning derives.

import "server-only";
import type { AgentDefinition, AgentResult, AgentState, Subtask } from "../types";
import { systemPromptFor } from "../prompts";

export const reasoningAgent: AgentDefinition = {
  id: "reasoning",
  label: "Reasoning",
  description: "Performs step-by-step inference and analysis for assigned reasoning subtasks.",
  tools: [
    { tool: "llm" },
    { tool: "memory.recall" },
  ],
  async run(ctx, state): Promise<Partial<AgentState>> {
    const mine = state.subtasks.filter((s) => s.assignee === "reasoning");
    ctx.trace("agent:start", `Reasoning over ${mine.length} subtask${mine.length === 1 ? "" : "s"}`);

    if (mine.length === 0) {
      ctx.trace("agent:success", "No reasoning subtasks assigned", { durationMs: 0, tokensUsed: 0 });
      return { results: {} };
    }

    const results: Record<string, AgentResult> = {};
    let tokens = 0;
    const start = Date.now();

    for (const subtask of mine) {
      ctx.reason(`Reason [${subtask.id}]: ${subtask.title}`);
      const system = systemPromptFor("reasoning", { objective: state.objective, guidance: ctx.guidance });
      const user = buildReasoningUserPrompt(state, subtask);
      const { text, tokensUsed } = await ctx.llm.complete(system, user);
      tokens += tokensUsed;

      ctx.trace("agent:log", `[${subtask.id}] conclusion ready`, { subtaskId: subtask.id });
      results[subtask.id] = {
        subtaskId: subtask.id,
        agent: "reasoning",
        status: "succeeded",
        output: text,
        tokensUsed,
        durationMs: 0,
      };
    }

    const durationMs = Date.now() - start;
    ctx.trace("agent:success", `Reasoned over ${mine.length} subtask${mine.length === 1 ? "" : "s"}`, {
      durationMs,
      tokensUsed: tokens,
    });

    return { results };
  },
};

function buildReasoningUserPrompt(state: AgentState, subtask: Subtask): string {
  const ctxPart = state.context ? `\nContext / memory brief:\n${state.context}\n` : "";
  const priorResults = Object.values(state.results)
    .map((r) => `[${r.subtaskId ?? r.agent}] ${r.output}`)
    .join("\n");
  const priorPart = priorResults ? `\nPrior agent findings:\n${priorResults}\n` : "";
  return `Subtask [${subtask.id}] — ${subtask.title}\nDetail: ${subtask.detail}${ctxPart}${priorPart}\n\nReason step by step and conclude.`;
}