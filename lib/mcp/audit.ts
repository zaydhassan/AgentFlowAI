import "server-only";
import { repository } from "./repository";
import { getMemoryEngine, memoryConfigured } from "@/lib/memory";
import type {
  McpCallResult,
  McpInvocationRow,
  McpInvocationStatus,
  RecordInvocationInput,
} from "./types";
import type { MemoryScope as EngineMemoryScope } from "@/lib/memory";

function toEngineScope(scope: EngineMemoryScope | undefined): EngineMemoryScope {
  // MemoryScope (mcp) = "agent" | "workflow"; both are valid engine scopes.
  return (scope ?? "agent") as EngineMemoryScope;
}

/** Record the McpInvocation row. Always called. */
export async function recordInvocation(input: RecordInvocationInput): Promise<McpInvocationRow> {
  return repository.recordInvocation(input);
}

/**
 * Mirror a tool call into the Memory Engine. Callers pass the resolved result
 * (or the error) so we can store tool_output vs tool_failure. `invocationId`
 * ties the memory entry back to the audit row. Best-effort: never throws.
 */
export async function rememberToolEvent(args: {
  userId: string;
  orgId: string | null;
  scope?: EngineMemoryScope;
  invocationId: string;
  serverId: string;
  serverName: string;
  toolName: string;
  callArguments: Record<string, unknown> | null;
  result?: McpCallResult | null;
  status: McpInvocationStatus;
  error?: string | null;
  workflowId?: string | null;
  agentId?: string | null;
}): Promise<void> {
  if (!memoryConfigured()) return; // engine no-ops anyway; skip the work
  try {
    const kind: "tool_call" | "tool_output" | "tool_failure" =
      status === "succeeded"
        ? "tool_output"
        : status === "failed"
          ? "tool_failure"
          : "tool_call";
    const content =
      kind === "tool_failure"
        ? `MCP tool "${args.toolName}" on server "${args.serverName}" failed: ${args.error ?? "unknown error"}`
        : `MCP tool "${args.toolName}" on server "${args.serverName}" returned: ${args.result?.text ?? "(no text content)"}`;
    await getMemoryEngine().remember({
      userId: args.userId,
      orgId: args.orgId,
      scope: toEngineScope(args.scope),
      content,
      importance: kind === "tool_failure" ? 0.8 : 0.5,
      workflowId: args.workflowId ?? null,
      agentId: args.agentId ?? null,
      metadata: {
        kind,
        mcpServerId: args.serverId,
        mcpServerName: args.serverName,
        toolName: args.toolName,
        invocationId: args.invocationId,
        status: args.status,
        arguments: args.callArguments,
        isError: args.result?.isError ?? false,
        tokensEstimate: args.result?.tokensEstimate ?? 0,
      },
    });
  } catch {
    /* memory is best-effort; never fail a tool call on it */
  }
}

export const audit = { recordInvocation, rememberToolEvent };