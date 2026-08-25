import "server-only";
import { repository } from "./repository";
import { isAllowed } from "./permissions";
import { getConnection } from "./connection-manager";
import type { McpToolDescriptor, McpToolSummary, ToolInvokeRef } from "./types";

export class ToolNotFoundError extends Error {
  constructor(public readonly ref: string) {
    super(`MCP tool not found or not allowed: ${ref}`);
    this.name = "ToolNotFoundError";
  }
}

/** All allowed tools across the workspace, as the agent-facing descriptor list. */
export async function listWorkspaceTools(
  ownerId: string,
  orgId: string | null,
): Promise<McpToolDescriptor[]> {
  const tools = await repository.listWorkspaceTools(ownerId, orgId);
  return tools.map(toDescriptor);
}

/** All allowed resources across the workspace (for the inspector + readResource). */
export async function listWorkspaceResources(
  ownerId: string,
  orgId: string | null,
): Promise<McpToolSummary[]> {
  return repository.listWorkspaceResources(ownerId, orgId);
}

/** Fetch a single tool's descriptor by composite id, allow-checked. */
export async function getToolDescriptor(
  ownerId: string,
  orgId: string | null,
  compositeId: string,
): Promise<McpToolDescriptor | null> {
  const tools = await listWorkspaceTools(ownerId, orgId);
  return tools.find((t) => t.id === compositeId) ?? null;
}

/**
 * Resolve a tool reference (composite id or explicit serverId+toolName) to the
 * concrete invocation target, re-checking the allow/deny policy against the
 * live server config. Throws ToolNotFoundError if missing or denied.
 *
 * Note: the allow/deny re-check here reads the server row via the connection
 * manager's ownership path, so a workspace-isolated caller can only ever
 * resolve tools on servers it owns.
 */
export async function resolveTool(
  ref: ToolInvokeRef,
  ownerId: string,
  orgId: string | null,
): Promise<{ serverId: string; toolName: string; descriptor: McpToolDescriptor }> {
  let serverId: string;
  let toolName: string;
  if ("tool" in ref) {
    const [sid, ...rest] = ref.tool.split("::");
    serverId = sid;
    toolName = rest.join("::");
  } else {
    serverId = ref.serverId;
    toolName = ref.toolName;
  }
  if (!serverId || !toolName) {
    throw new ToolNotFoundError("tool" in ref ? ref.tool : `${serverId}::${toolName}`);
  }
  // Ownership-checked connect (also re-loads the server's allow/deny lists).
  const conn = await getConnection(serverId, ownerId);
  if (!isAllowed(toolName, conn.server.allowList, conn.server.denyList)) {
    throw new ToolNotFoundError(`${serverId}::${toolName}`);
  }
  // Best-effort descriptor from the cache; fall back to a minimal one.
  const descriptor = (await getToolDescriptor(ownerId, orgId, `${serverId}::${toolName}`)) ?? {
    id: `${serverId}::${toolName}`,
    serverId,
    serverName: conn.server.name,
    name: toolName,
    title: null,
    description: null,
    inputSchema: null,
    annotations: null,
  };
  return { serverId, toolName, descriptor };
}

function toDescriptor(t: McpToolSummary): McpToolDescriptor {
  return {
    id: t.id,
    serverId: t.serverId,
    serverName: t.serverName,
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: t.annotations,
  };
}

export const toolRegistry = {
  listWorkspaceTools,
  listWorkspaceResources,
  getToolDescriptor,
  resolveTool,
};