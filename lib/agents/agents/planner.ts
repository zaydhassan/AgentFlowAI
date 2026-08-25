import "server-only";
import type {
  AgentDefinition,
  AgentRunContext,
  AgentState,
  ExecutionPlan,
  Subtask,
  WorkerAgent,
} from "../types";
import type { McpToolDescriptor } from "@/lib/mcp/types";
import { systemPromptFor } from "../prompts";

const VALID_ASSIGNEES: WorkerAgent[] = ["research", "memory", "reasoning"];

export const plannerAgent: AgentDefinition = {
  id: "planner",
  label: "Planner",
  description: "Decomposes the objective into subtasks and assigns them to worker agents.",
  tools: [
    { tool: "llm" },
    { tool: "memory.recall" },
    { tool: "mcp.invoke" },
  ],
  async run(ctx, state): Promise<Partial<AgentState>> {
    ctx.trace("agent:start", "Planning", { detail: "Planning" });
    ctx.reason("Retrieve workspace context from memory");

    let context = state.context ?? "";
    try {
      const hits = await ctx.memory.recall(state.objective, { topK: 5 });
      if (hits.length) {
        context = hits
          .map((h, i) => `(${i + 1}) [${h.score.toFixed(2)}] ${h.memory.content}`)
          .join("\n");
        ctx.trace("agent:memory", `recalled ${hits.length} memories for context`, { tokensUsed: 0 });
      } else {
        ctx.trace("agent:memory", "no prior memories recalled", { tokensUsed: 0 });
      }
    } catch (err) {
      ctx.trace("agent:memory", `recall error: ${message(err)}`, { tokensUsed: 0 });
    }

    // 1b. MCP tool use (additive, backward-compatible). The planner inspects the
    // workspace's available MCP tools, asks the model to pick the best one for
    // the objective (and produce arguments), invokes it through ctx.tools, and
    // folds the returned data into the planning context. When the agent has no
    // mcp.invoke permission, or no MCP servers are connected/discovered, this
    // is a complete no-op and planning proceeds exactly as before. Any failure
    // here is non-fatal — the planner still produces a plan.
    if (ctx.tools && ctx.tools.can("mcp.invoke")) {
      try {
        const tools = await ctx.tools.list();
        if (tools.length) {
          ctx.trace("agent:log", `MCP ${tools.length} tool(s) available; selecting one`);
          const pick = await selectMcpTool(ctx, state.objective, context, tools);
          if (pick) {
            const result = await ctx.tools.invoke(
              { tool: pick.toolId },
              pick.arguments,
              { workflowId: ctx.workflowId, nodeId: ctx.nodeId, runId: ctx.runId },
            );
            if (result.text) {
              context = `${context ? context + "\n\n" : ""}MCP tool ${pick.toolName} output:\n${result.text}`;
              ctx.trace("agent:log", `MCP ${pick.toolName} output folded into context`);
            }
            ctx.reason(`Invoked MCP tool ${pick.toolName}`);
          } else {
            ctx.trace("agent:log", "MCP: no tool suited the objective; skipping");
          }
        }
      } catch (err) {
        ctx.trace("agent:log", `MCP tool use skipped: ${message(err)}`);
      }
    }

    ctx.reason("Decompose objective into subtasks");
    const system = systemPromptFor("planner", { objective: state.objective, guidance: ctx.guidance });
    const user = buildPlannerUserPrompt(state, context);
    const { value, fellBack } = await ctx.llm.completeJson<{
      rationale?: string;
      subtasks?: Array<{ id?: string; assignee?: string; title?: string; detail?: string }>;
    }>(system, user);

    const subtasks = normalizeSubtasks(value.subtasks);
    const rationale = typeof value.rationale === "string" && value.rationale.trim()
      ? value.rationale.trim()
      : `Plan with ${subtasks.length} subtask${subtasks.length === 1 ? "" : "s"}.`;

    if (fellBack) {
      ctx.trace("agent:log", "planner returned non-JSON output; using fallback decomposition");
    }

    const plan: ExecutionPlan = { subtasks, rationale };
    ctx.trace("plan", JSON.stringify(plan));
    ctx.trace("agent:success", "Plan ready", { durationMs: 0, tokensUsed: 0 });

    // iterations += 1 (adder reducer) on every planner pass — drives loop prevention.
    return {
      plan,
      subtasks,
      context,
      iterations: 1,
      reasoningTrail: [`Plan: ${rationale}`],
    };
  },
};

function buildPlannerUserPrompt(state: AgentState, context: string): string {
  const inputPart = state.context && state.context.trim()
    ? `\nUpstream input:\n${state.context}\n`
    : "";
  const memoryPart = context ? `\nRelevant workspace memory:\n${context}\n` : "";
  return `Objective:\n${state.objective}${inputPart}${memoryPart}\n\nReturn the plan as JSON.`;
}

function normalizeSubtasks(
  raw: Array<{ id?: string; assignee?: string; title?: string; detail?: string }> | undefined,
): Subtask[] {
  if (!Array.isArray(raw)) return fallbackSubtasks();
  const seen = new Set<string>();
  const out: Subtask[] = [];
  raw.forEach((r, i) => {
    const assignee = VALID_ASSIGNEES.includes(r.assignee as WorkerAgent)
      ? (r.assignee as WorkerAgent)
      : pickAssignee(i);
    let id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : `t${i + 1}`;
    if (seen.has(id)) id = `${id}-${i}`;
    seen.add(id);
    out.push({
      id,
      assignee,
      title: typeof r.title === "string" && r.title.trim() ? r.title.trim() : `Subtask ${i + 1}`,
      detail: typeof r.detail === "string" && r.detail.trim() ? r.detail.trim() : "(no detail provided)",
    });
  });
  return out.length ? out : fallbackSubtasks();
}

// Deterministic fallback plan when the model emits nothing usable — keeps the
// run progressing (never deadlocks on a malformed LLM response).
function fallbackSubtasks(): Subtask[] {
  return [
    { id: "t1", assignee: "research", title: "Gather information", detail: "Collect facts and context relevant to the objective." },
    { id: "t2", assignee: "reasoning", title: "Analyze", detail: "Reason over the objective and produce a conclusion." },
  ];
}

function pickAssignee(i: number): WorkerAgent {
  return VALID_ASSIGNEES[i % (VALID_ASSIGNEES.length - 1)] ?? "reasoning";
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function selectMcpTool(
  ctx: AgentRunContext,
  objective: string,
  context: string,
  tools: McpToolDescriptor[],
): Promise<{ toolId: string; toolName: string; arguments: Record<string, unknown> } | null> {
  const catalog = tools.map((t) => ({
    id: t.id,
    name: t.name,
    server: t.serverName,
    description: t.description ?? "(no description)",
    inputSchema: t.inputSchema ?? {},
  }));
  const system =
    "You select an MCP tool to help with the objective. Given the objective, " +
    "the current context, and a catalog of available tools (each with an input " +
    'schema), choose the single best tool and produce valid arguments. If no ' +
    'tool is appropriate, return {"skip": true}. Respond as JSON only: ' +
    '{"toolId":"<id>","arguments":{...}} or {"skip":true}.';
  const user =
    `Objective:\n${objective}\n\nCurrent context:\n${context || "(none)"}\n\n` +
    `Tool catalog:\n${JSON.stringify(catalog)}\n\nPick one tool (or skip).`;
  const { value } = await ctx.llm.completeJson<{
    toolId?: string;
    arguments?: Record<string, unknown>;
    skip?: boolean;
  }>(system, user);
  if (value.skip) return null;
  if (typeof value.toolId !== "string") return null;
  const tool = tools.find((t) => t.id === value.toolId);
  if (!tool) return null;
  const args =
    value.arguments && typeof value.arguments === "object" && !Array.isArray(value.arguments)
      ? (value.arguments as Record<string, unknown>)
      : {};
  return { toolId: tool.id, toolName: tool.name, arguments: args };
}