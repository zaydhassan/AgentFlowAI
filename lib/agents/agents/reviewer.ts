// ============================================================
// Reviewer Agent
// ============================================================
// Evaluates the aggregated worker results against the objective and decides
// approve / request-revisions. When human approval is enabled, the runtime
// pauses (interruptBefore) before this node; on resume the operator's decision
// arrives in ctx.approval. A human rejection short-circuits the LLM review and
// routes back to the planner with the operator's feedback as a correction.
//
// Per the brief: "Reviewer stores corrections." Corrections are written to
// long-term memory (kind "correction") so future runs in the workspace learn.

import "server-only";
import type { AgentDefinition, AgentState, ReviewOutcome } from "../types";
import { systemPromptFor } from "../prompts";

export const reviewerAgent: AgentDefinition = {
  id: "reviewer",
  label: "Reviewer",
  description: "Reviews aggregated results; approves or requests revisions.",
  tools: [
    { tool: "llm" },
    { tool: "memory.remember" },
  ],
  async run(ctx, state): Promise<Partial<AgentState>> {
    ctx.trace("agent:start", "Reviewing results");
    ctx.reason("Evaluate results against objective");

    // Human-in-the-loop short-circuit.
    if (ctx.approval && ctx.approval.approved === false) {
      const feedback = ctx.approval.feedback?.trim() || "Operator requested revisions.";
      const review: ReviewOutcome = { approved: false, confidence: 0, corrections: [feedback] };
      ctx.trace("approval", `rejected by operator: ${feedback}`);
      ctx.trace("review", JSON.stringify(review));
      await storeCorrection(ctx, state, review);
      ctx.trace("agent:success", "Review: rejected by operator", { durationMs: 0, tokensUsed: 0 });
      return { review };
    }

    const system = systemPromptFor("reviewer", { objective: state.objective, guidance: ctx.guidance });
    const user = buildReviewerUserPrompt(state);
    const { value, fellBack } = await ctx.llm.completeJson<{
      approved?: boolean;
      confidence?: number;
      corrections?: string[];
    }>(system, user);

    const review: ReviewOutcome = {
      approved: value.approved === true,
      confidence: clamp(Number(value.confidence ?? 0.5), 0, 1),
      corrections: Array.isArray(value.corrections)
        ? value.corrections.filter((c) => typeof c === "string" && c.trim()).map((c) => c.trim())
        : [],
    };

    if (fellBack) {
      // Conservative fallback: don't approve an unparseable review.
      review.approved = false;
      review.corrections = review.corrections.length ? review.corrections : ["Reviewer output unparseable; please re-evaluate."];
      ctx.trace("agent:log", "reviewer returned non-JSON; requesting revision");
    }

    // If the operator explicitly approved the checkpoint, accept even a low-confidence review.
    if (ctx.approval?.approved === true && !review.approved) {
      review.approved = true;
      ctx.trace("approval", "operator override: approving despite reviewer reservations");
    }

    ctx.trace("review", JSON.stringify(review));
    if (!review.approved) await storeCorrection(ctx, state, review);

    ctx.trace("agent:success", review.approved ? "Review: approved" : "Review: revisions requested", {
      durationMs: 0,
      tokensUsed: 0,
    });
    return { review };
  },
};

async function storeCorrection(
  ctx: Parameters<AgentDefinition["run"]>[0],
  state: AgentState,
  review: ReviewOutcome,
): Promise<void> {
  try {
    const content = `Corrections for objective "${state.objective}":\n- ${review.corrections.join("\n- ")}`;
    await ctx.memory.remember(content, { importance: 0.8, kind: "correction" });
    ctx.trace("agent:memory", "stored corrections", { tokensUsed: 0 });
  } catch {
    /* best-effort */
  }
}

function buildReviewerUserPrompt(state: AgentState): string {
  const resultsDigest = Object.values(state.results)
    .map((r) => `[${r.subtaskId ?? r.agent}] (${r.agent})\n${r.output}`)
    .join("\n\n");
  const memoryBrief = state.context ? `\nMemory brief:\n${state.context}\n` : "";
  return `Objective:\n${state.objective}${memoryBrief}\n\nAggregated agent results:\n${resultsDigest || "(no results)"}\n\nReturn your review as JSON.`;
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}