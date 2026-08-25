import "server-only";
import { startAgentRun, type AgentEvent } from "@/lib/agents";
import type { MemoryScope } from "@/lib/memory/types";
import {
  clampInt,
  AGENT_ITERATIONS_MIN,
  AGENT_ITERATIONS_MAX,
  AGENT_ITERATIONS_DEFAULT,
  AGENT_TIMEOUT_MIN_MS,
  AGENT_TIMEOUT_MAX_MS,
  AGENT_TIMEOUT_DEFAULT_MS,
} from "@/lib/execution/limits";

export interface MultiAgentLogEvent {
  type: "log";
  log: string;
}

export interface MultiAgentActionResult {
  status: "succeeded" | "failed";
  output?: unknown;
  error?: string;
  tokensUsed?: number;
  cost?: number;
  retryable?: boolean;
}

export interface RunMultiAgentArgs {
  userId: string;
  orgId?: string | null;
  workflowId?: string | null;
  nodeId?: string | null;
  config: Record<string, unknown>;
  inputs: unknown[];
  stopped: () => boolean;
}

const TOKEN_RATE = 0.002 / 1000;

export async function* runMultiAgent(
  args: RunMultiAgentArgs,
): AsyncGenerator<MultiAgentLogEvent, MultiAgentActionResult, unknown> {
  const cfg = args.config ?? {};
  const objective = resolveObjective(cfg, args.inputs);
  if (!objective) {
    return {
      status: "failed",
      error: "Multi-Agent node has no objective (set one in the node config or connect an upstream node).",
      retryable: false,
    };
  }

  const memoryScope = (typeof cfg.memoryScope === "string" ? cfg.memoryScope : "long_term") as MemoryScope;
  const maxIterations = clampInt(cfg.maxIterations, AGENT_ITERATIONS_MIN, AGENT_ITERATIONS_MAX, AGENT_ITERATIONS_DEFAULT);
  const timeoutMs = clampInt(cfg.timeoutMs, AGENT_TIMEOUT_MIN_MS, AGENT_TIMEOUT_MAX_MS, AGENT_TIMEOUT_DEFAULT_MS);
  const requireApprovalConfigured = cfg.requireApproval === true;
  const guidance = typeof cfg.guidance === "string" ? cfg.guidance : undefined;

  const runId = `ma_${args.nodeId ?? "node"}_${Date.now().toString(36)}`;

  if (requireApprovalConfigured) {
    yield { type: "log", log: "ℹ️ human-approval checkpoint is available via the standalone /api/agents/run API; running to completion in-workflow." };
  }
  yield { type: "log", log: `🧠 launching multi-agent runtime (run ${runId}) — objective: ${truncate(objective, 120)}` };

  let finalAnswer = "";
  let tokensUsed = 0;
  let cost = 0;
  let status: "succeeded" | "failed" = "failed";
  let error: string | undefined;
  let plan: unknown = undefined;
  let review: unknown = undefined;

  try {
    for await (const ev of startAgentRun({
      runId,
      objective,
      input: args.inputs.length ? args.inputs[0] : undefined,
      userId: args.userId,
      orgId: args.orgId ?? null,
      workflowId: args.workflowId ?? null,
      nodeId: args.nodeId ?? null,
      memoryScope,
      maxIterations,
      timeoutMs,
      requireApproval: false, // in-workflow runs complete; use the SSE API for checkpoints
      guidance,
      stopped: args.stopped,
    })) {
      const log = formatEvent(ev);
      if (log) yield { type: "log", log };

      if (ev.type === "plan" && ev.plan) plan = ev.plan;
      if (ev.type === "review" && ev.review) review = ev.review;
      if (ev.type === "complete" && ev.totals) {
        tokensUsed = ev.totals.totalTokens;
        cost = ev.totals.totalCost;
        if (ev.totals.status === "succeeded") {
          status = "succeeded";
          finalAnswer = ev.finalAnswer ?? "";
        } else {
          status = "failed";
          error = ev.totals.error ?? ev.error ?? "multi-agent run did not succeed";
        }
      }
      if (ev.type === "error") {
        status = "failed";
        error = ev.error ?? "multi-agent run error";
      }
      if (args.stopped()) break;
    }
  } catch (err) {
    status = "failed";
    error = err instanceof Error ? err.message : "multi-agent runtime crashed";
    yield { type: "log", log: `✗ ${error}` };
  }

  if (status === "succeeded") {
    yield { type: "log", log: `✓ multi-agent run complete — ${tokensUsed} tokens, ${finalAnswer ? truncate(finalAnswer, 100) : "(no output)"}` };
    return {
      status: "succeeded",
      tokensUsed,
      cost: cost || tokensUsed * TOKEN_RATE,
      output: { text: finalAnswer, finalAnswer, plan, review, runId },
    };
  }

  yield { type: "log", log: `✗ multi-agent run failed: ${error ?? "unknown error"}` };
  return { status: "failed", error: error ?? "multi-agent run failed", tokensUsed, cost, retryable: true };
}

function resolveObjective(cfg: Record<string, unknown>, inputs: unknown[]): string {
  const obj = typeof cfg.objective === "string" ? cfg.objective.trim() : "";
  if (obj) return obj;
  if (inputs.length === 0) return "";
  const first = inputs[0];
  if (typeof first === "string") return first.trim();
  try {
    return JSON.stringify(first);
  } catch {
    return String(first);
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function formatEvent(ev: AgentEvent): string | undefined {
  const agent = ev.agent ? `[${ev.agent}]` : "";
  switch (ev.type) {
    case "run:start":
      return `▶ run started${ev.nodeName ? ` (node ${ev.nodeName})` : ""}`;
    case "agent:start":
      return `${agent} start`;
    case "agent:reasoning":
      return `${agent} reasoning: ${ev.reasoning ?? ""}`;
    case "agent:log":
      return `${agent} ${ev.log ?? ""}`;
    case "agent:memory":
      return `${agent} memory: ${ev.log ?? ""}`;
    case "agent:retry":
      return `${agent} retry attempt ${ev.attempt ?? "?"}`;
    case "agent:success":
      return `${agent} ✓ (${ev.durationMs ?? 0}ms, ${ev.tokensUsed ?? 0} tok)`;
    case "agent:fail":
      return `${agent} ✗ ${ev.error ?? "failed"}`;
    case "plan":
      return `${agent} plan: ${ev.plan?.subtasks.length ?? 0} subtasks — ${ev.plan?.rationale ?? ""}`;
    case "review":
      return `${agent} review: ${ev.review?.approved ? "approved" : "revisions requested"} (confidence ${ev.review?.confidence ?? 0})`;
    case "approval":
      return `${agent} approval: ${ev.reasoning ?? ""}`;
    case "complete":
      return undefined; // summarized by the caller
    case "error":
      return `✗ error: ${ev.error ?? ""}`;
    default:
      return undefined;
  }
}