import "server-only";
import { getConnection, McpNotFoundError, McpServerDisabledError } from "./connection-manager";
import { resolveTool, ToolNotFoundError } from "./tool-registry";
import { listWorkspaceTools } from "./tool-registry";
import { audit } from "./audit";
import { PermissionError } from "@/lib/agents/memory";
import { isAllowed } from "./permissions";
import type {
  AgentToolGateway,
  InvokeOptions,
  McpCallResult,
  McpToolDescriptor,
  ToolInvokeRef,
} from "./types";
import type { AgentId, ToolPermission } from "@/lib/agents/types";

export { PermissionError };
export { McpNotFoundError, McpServerDisabledError, ToolNotFoundError };

export interface ToolGatewayOptions {
  agent: AgentId;
  userId: string;
  orgId: string | null;
  workflowId: string | null;
  nodeId: string | null;
  runId: string | null;
  /** The run's abort signal — composed with per-call opts.signal. */
  signal: AbortSignal;
  /** Emit a structured trace + stream event (reuses the existing TraceKind union). */
  trace: (kind: "agent:log" | "agent:reasoning", detail: string, extra?: Record<string, unknown>) => void;
  /** Emit a reasoning step. */
  reason: (step: string) => void;
  tools: ToolPermission[];
}

function composeSignals(runSignal: AbortSignal, opts?: InvokeOptions): AbortSignal | undefined {
  const signals = [runSignal, opts?.signal].filter(Boolean) as AbortSignal[];
  if (signals.length === 0) return undefined;
  if (signals.length === 1) return signals[0];
  // AbortSignal.any is available in Node 20+ (the runtime we target).
  return (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any(signals);
}

export class AgentToolGatewayImpl implements AgentToolGateway {
  constructor(private readonly opts: ToolGatewayOptions) {}

  can(tool: string): boolean {
    return this.opts.tools.some((t) => t.tool === tool);
  }

  ensure(tool: string): void {
    if (!this.can(tool)) throw new PermissionError(String(this.opts.agent), tool);
  }

  /**
   * All allow-filtered workspace tools, optionally narrowed by the agent's
   * declared mcp.invoke scope (a serverId or a name pattern). When the agent
   * has no mcp.invoke permission, ensure() throws before we hit the registry.
   */
  async list(): Promise<McpToolDescriptor[]> {
    this.ensure("mcp.invoke");
    let tools = await listWorkspaceTools(this.opts.userId, this.opts.orgId);
    const perm = this.opts.tools.find((t) => t.tool === "mcp.invoke");
    if (perm?.scope) {
      const scope = perm.scope;
      tools = tools.filter(
        (t) => t.serverId === scope || isAllowed(t.name, [scope], []),
      );
    }
    return tools;
  }

  async invoke(
    ref: ToolInvokeRef,
    args: Record<string, unknown> = {},
    callOpts: InvokeOptions = {},
  ): Promise<McpCallResult> {
    this.ensure("mcp.invoke");
    const refLabel = "tool" in ref ? ref.tool : `${ref.serverId}::${ref.toolName}`;
    const signal = composeSignals(this.opts.signal, callOpts);
    const start = Date.now();

    // Resolve (ownership + allow/deny checked) → connection → call.
    const { serverId, toolName, descriptor } = await resolveTool(ref, this.opts.userId, this.opts.orgId);
    this.opts.trace("agent:log", `MCP invoke ${refLabel}`, { detail: descriptor.description ?? "" });
    const conn = await getConnection(serverId, this.opts.userId);

    const serverName = conn.server.name;
    const orgId = this.opts.orgId;
    const userId = this.opts.userId;
    const commonAudit = {
      serverId,
      ownerId: userId,
      orgId,
      toolName,
      arguments: args,
      workflowId: callOpts.workflowId ?? this.opts.workflowId,
      nodeId: callOpts.nodeId ?? this.opts.nodeId,
      agentId: String(this.opts.agent),
      runId: callOpts.runId ?? this.opts.runId,
    };

    try {
      const result = await conn.client.callTool(toolName, args, {
        signal,
        onProgress: callOpts.onProgress
          ? (p) => {
              callOpts.onProgress!(p);
              this.opts.trace("agent:log", `MCP progress ${toolName}: ${p.message ?? ""}`.trim());
            }
          : undefined,
      });
      const durationMs = Date.now() - start;

      if (result.isError) {
        // Tool-level error: do NOT throw. Record as failed, mirror to memory,
        // and return the result so the agent can read isError + the text.
        const inv = await audit.recordInvocation({
          ...commonAudit,
          status: "failed",
          durationMs,
          retries: 0,
          error: result.text.slice(0, 2000) || "tool returned isError",
          tokensEstimate: result.tokensEstimate,
          streamed: Boolean(callOpts.onProgress),
        });
        await audit.rememberToolEvent({
          userId,
          orgId,
          scope: callOpts.memoryScope,
          invocationId: inv.id,
          serverId,
          serverName,
          toolName,
          callArguments: args,
          result,
          status: "failed",
          error: result.text || "tool returned isError",
          workflowId: callOpts.workflowId ?? this.opts.workflowId,
          agentId: String(this.opts.agent),
        });
        this.opts.trace("agent:log", `MCP ${toolName} returned an error`);
        return result;
      }

      const inv = await audit.recordInvocation({
        ...commonAudit,
        status: "succeeded",
        durationMs,
        retries: 0,
        tokensEstimate: result.tokensEstimate,
        streamed: Boolean(callOpts.onProgress),
      });
      await audit.rememberToolEvent({
        userId,
        orgId,
        scope: callOpts.memoryScope,
        invocationId: inv.id,
        serverId,
        serverName,
        toolName,
        callArguments: args,
        result,
        status: "succeeded",
        workflowId: callOpts.workflowId ?? this.opts.workflowId,
        agentId: String(this.opts.agent),
      });
      this.opts.reason(`Used MCP tool ${toolName} on ${serverName}`);
      return result;
    } catch (err) {
      // Transport / cancellation / not-found / permission error: record + rethrow.
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      try {
        const inv = await audit.recordInvocation({
          ...commonAudit,
          status: "failed",
          durationMs,
          retries: 0,
          error: message.slice(0, 2000),
          tokensEstimate: 0,
          streamed: Boolean(callOpts.onProgress),
        });
        await audit.rememberToolEvent({
          userId,
          orgId,
          scope: callOpts.memoryScope,
          invocationId: inv.id,
          serverId,
          serverName,
          toolName,
          callArguments: args,
          result: null,
          status: "failed",
          error: message,
          workflowId: callOpts.workflowId ?? this.opts.workflowId,
          agentId: String(this.opts.agent),
        });
      } catch {
        /* audit is best-effort on the error path */
      }
      throw err;
    }
  }
}