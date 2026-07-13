// ============================================================
// Research Agent
// ============================================================
// Handles subtasks assigned to "research". Gathers/summarizes information from
// the workspace context and recalled memories, and stores each finding to
// long-term memory via the memory gateway.
//
// Per the brief: "Research stores findings." Every finding is written with
// metadata { kind: "finding" } and the run's workspace scope.

import "server-only";
import type { AgentDefinition, AgentResult, AgentState, Subtask } from "../types";
import { systemPromptFor } from "../prompts";

export const researchAgent: AgentDefinition = {
  id: "research",
  label: "Research",
  description: "Gathers and summarizes information for assigned research subtasks.",
  tools: [
    { tool: "llm" },
    { tool: "memory.recall" },
    { tool: "memory.remember" },
  ],
  async run(ctx, state): Promise<Partial<AgentState>> {
    const mine = state.subtasks.filter((s) => s.assignee === "research");
    ctx.trace("agent:start", `Researching ${mine.length} subtask${mine.length === 1 ? "" : "s"}`);

    if (mine.length === 0) {
      ctx.trace("agent:success", "No research subtasks assigned", { durationMs: 0, tokensUsed: 0 });
      return { results: {} };
    }

    const results: Record<string, AgentResult> = {};
    let tokens = 0;
    const start = Date.now();

    for (const subtask of mine) {
      ctx.reason(`Research [${subtask.id}]: ${subtask.title}`);

      // Recall any memories specific to this subtask.
      let subHits = "";
      try {
        const hits = await ctx.memory.recall(`${subtask.title} — ${subtask.detail}`, { topK: 3 });
        if (hits.length) {
          subHits = hits.map((h) => `- ${h.memory.content}`).join("\n");
          ctx.trace("agent:memory", `[${subtask.id}] recalled ${hits.length} memories`, { subtaskId: subtask.id });
        }
      } catch {
        /* gateway already logged */
      }

      const system = systemPromptFor("research", { objective: state.objective, guidance: ctx.guidance });
      const user = buildResearchUserPrompt(state, subtask, subHits);
      const { text, tokensUsed } = await ctx.llm.complete(system, user);
      tokens += tokensUsed;

      // Store the finding (workspace-isolated, dedup'd by the engine).
      try {
        const res = await ctx.memory.remember(`[${subtask.id}] ${subtask.title}\n${text}`, {
          importance: 0.7,
          kind: "finding",
          metadata: { subtaskId: subtask.id },
        });
        ctx.trace("agent:memory", `[${subtask.id}] stored finding${res.deduplicated ? " (dedup)" : ""}`, {
          subtaskId: subtask.id,
        });
      } catch {
        /* best-effort */
      }

      ctx.trace("agent:log", `[${subtask.id}] finding ready`, { subtaskId: subtask.id });
      results[subtask.id] = {
        subtaskId: subtask.id,
        agent: "research",
        status: "succeeded",
        output: text,
        tokensUsed,
        durationMs: 0,
      };
    }

    const durationMs = Date.now() - start;
    ctx.trace("agent:success", `Researched ${mine.length} subtask${mine.length === 1 ? "" : "s"}`, {
      durationMs,
      tokensUsed: tokens,
    });

    return { results };
  },
};

function buildResearchUserPrompt(state: AgentState, subtask: Subtask, subHits: string): string {
  const ctxPart = state.context ? `\nWorkspace context:\n${state.context}\n` : "";
  const memPart = subHits ? `\nRelevant memories:\n${subHits}\n` : "";
  return `Subtask [${subtask.id}] — ${subtask.title}\nDetail: ${subtask.detail}${ctxPart}${memPart}\n\nProduce a concise finding.`;
}