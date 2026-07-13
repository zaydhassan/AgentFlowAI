// ============================================================
// Memory Agent
// ============================================================
// The dedicated memory specialist. Retrieves a broad set of relevant long-term
// memories for the objective and synthesizes them into a context brief the
// other agents consume. Distinct from the planner's single recall: this agent
// does a wider retrieval and organizes the results.
//
// Memory touches go exclusively through the memory gateway (workspace-isolated,
// permission-checked). It never reads another workspace's memory.

import "server-only";
import type { AgentDefinition, AgentResult, AgentState } from "../types";
import { systemPromptFor } from "../prompts";

export const memoryAgent: AgentDefinition = {
  id: "memory",
  label: "Memory",
  description: "Retrieves and organizes relevant long-term memories into a context brief.",
  tools: [
    { tool: "llm" },
    { tool: "memory.recall" },
  ],
  async run(ctx, state): Promise<Partial<AgentState>> {
    ctx.trace("agent:start", "Retrieving memories");
    ctx.reason("Retrieve relevant long-term memories");

    let hits = [] as Awaited<ReturnType<typeof ctx.memory.recall>>;
    try {
      hits = await ctx.memory.recall(state.objective, { topK: 8 });
      ctx.trace("agent:memory", `retrieved ${hits.length} memories`, { tokensUsed: 0 });
    } catch (err) {
      ctx.trace("agent:memory", `recall error: ${message(err)}`, { tokensUsed: 0 });
    }

    if (hits.length === 0) {
      ctx.trace("agent:success", "No relevant memories found", { durationMs: 0, tokensUsed: 0 });
      return {
        memories: [],
        context: "",
        results: { memory: makeResult("(no prior memories)", 0) },
      };
    }

    // Synthesize the recalled memories into a brief.
    const system = systemPromptFor("memory", { objective: state.objective, guidance: ctx.guidance });
    const memoryBlock = hits
      .map((h, i) => `(${i + 1}) [${h.score.toFixed(2)}] ${h.memory.content}`)
      .join("\n");
    const user = `Objective:\n${state.objective}\n\nRecalled memories:\n${memoryBlock}\n\nWrite the memory brief.`;
    const { text, tokensUsed } = await ctx.llm.complete(system, user);

    ctx.trace("agent:success", `Memory brief ready (${hits.length} sources)`, {
      durationMs: 0,
      tokensUsed,
    });

    return {
      memories: hits,
      context: text,
      results: { memory: makeResult(text, tokensUsed) },
    };
  },
};

function makeResult(output: string, tokensUsed: number): AgentResult {
  return {
    agent: "memory",
    status: "succeeded",
    output,
    tokensUsed,
    durationMs: 0,
  };
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}