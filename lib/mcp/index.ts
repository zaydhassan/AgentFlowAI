import "server-only";
import { repository } from "./repository";
import { connectionManager, healthCheck, closeConnection } from "./connection-manager";
import { discover } from "./discovery";
import { toolRegistry } from "./tool-registry";
import { audit } from "./audit";
import { resolveOrgId } from "@/lib/memory";
import type {
  CreateMcpServerInput,
  McpCallResult,
  McpHealth,
  McpInvocationRow,
  McpObservabilitySummary,
  McpServer,
  McpToolSummary,
  UpdateMcpServerInput,
  ListInvocationsFilters,
  McpProgress,
} from "./types";

// Re-export the client-safe types + enums.
export type {
  McpServer,
  McpHealth,
  McpCapabilityRow,
  McpToolSummary,
  McpInvocationRow,
  McpObservabilitySummary,
  McpCredentials,
  McpTransportId,
  McpAuthScheme,
  McpServerStatus,
  McpCacheKind,
  McpCapabilityKind,
  McpInvocationStatus,
  StoredMcpServer,
  CreateMcpServerInput,
  UpdateMcpServerInput,
  ListInvocationsFilters,
  AgentToolGateway,
  McpToolDescriptor,
  McpCallResult,
  McpResourceResult,
  InvokeOptions,
  ToolInvokeRef,
  McpProgress,
} from "./types";
export { MCP_TRANSPORTS, MCP_AUTH_SCHEMES } from "./types";
export { isAllowed, matchesPattern, filterAllowed } from "./permissions";
export { connectionManager } from "./connection-manager";
export { discover } from "./discovery";
export { toolRegistry } from "./tool-registry";
export { audit } from "./audit";

export async function listServers(userId: string, orgId?: string | null): Promise<McpServer[]> {
  return repository.listServers(userId, orgId ?? (await resolveOrgId(userId)));
}

export async function getServer(userId: string, id: string): Promise<McpServer | null> {
  return repository.getServerClientOwned(userId, id);
}

export async function createServer(
  userId: string,
  input: Omit<CreateMcpServerInput, "ownerId" | "orgId"> & { orgId?: string | null },
): Promise<McpServer> {
  const orgId = input.orgId !== undefined ? input.orgId : await resolveOrgId(userId);
  return repository.createServer({ ...input, ownerId: userId, orgId: orgId ?? null });
}

export async function updateServer(userId: string, id: string, patch: UpdateMcpServerInput): Promise<McpServer> {
  const updated = await repository.updateServer(userId, id, patch);
  // Drop any pooled connection so the next call re-establishes with new config.
  if (updated) await closeConnection(id);
  return updated;
}

export async function deleteServer(userId: string, id: string): Promise<void> {
  await closeConnection(id);
  await repository.deleteServer(userId, id);
}

/** Health-check a server: (re)connect, ping, record health + status. */
export async function testServer(userId: string, id: string): Promise<McpHealth> {
  return healthCheck(id, userId);
}

/** Discover + cache tools/resources/prompts/capabilities from the live server. */
export async function discoverServer(userId: string, id: string) {
  return discover(id, userId);
}

export async function listWorkspaceTools(userId: string, orgId?: string | null): Promise<McpToolSummary[]> {
  return repository.listWorkspaceTools(userId, orgId ?? (await resolveOrgId(userId)));
}

export async function listWorkspaceResources(userId: string, orgId?: string | null): Promise<McpToolSummary[]> {
  return repository.listWorkspaceResources(userId, orgId ?? (await resolveOrgId(userId)));
}

export async function listInvocations(
  userId: string,
  filters: ListInvocationsFilters = {},
): Promise<McpInvocationRow[]> {
  return repository.listInvocations(userId, filters);
}

export async function observabilitySummary(
  userId: string,
  orgId?: string | null,
): Promise<McpObservabilitySummary> {
  return repository.observabilitySummary(userId, orgId ?? (await resolveOrgId(userId)));
}
// Short alias for the API route + browser client (`observability()`).
export { observabilitySummary as observability };

// Used by POST /api/mcp/invoke (SSE). Streams progress notifications as they
// arrive, then a terminal result/error event. The SDK's onProgress callback
// can't yield into the generator directly, so progress is bridged through a
// queue drained while the call is in flight. Per-call timeout honours the
// caller's signal (composed with a 30s default).

export type McpInvokeEvent =
  | { type: "log"; log: string }
  | { type: "progress"; progress?: number; total?: number; message?: string }
  | { type: "result"; result: McpCallResult; serverId: string; toolName: string }
  | { type: "error"; error: string; retryable: boolean };

export interface InvokeStreamArgs {
  serverId: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  timeoutMs?: number;
  workflowId?: string | null;
  nodeId?: string | null;
}

export async function* invokeToolStream(
  userId: string,
  args: InvokeStreamArgs,
  signal?: AbortSignal,
): AsyncGenerator<McpInvokeEvent, void, unknown> {
  const orgId = await resolveOrgId(userId).catch(() => null);
  const timeoutMs = args.timeoutMs && args.timeoutMs > 0 ? args.timeoutMs : 30_000;
  const start = Date.now();

  let serverName = "(unknown)";
  try {
    yield { type: "log", log: `MCP invoke ${args.serverId}::${args.toolName}` };
    const { toolName, descriptor } = await toolRegistry.resolveTool(
      { serverId: args.serverId, toolName: args.toolName },
      userId,
      orgId,
    );
    if (descriptor.description) yield { type: "log", log: descriptor.description.slice(0, 200) };
    const conn = await connectionManager.getConnection(args.serverId, userId);
    serverName = conn.server.name;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(new Error("MCP tool timeout")), timeoutMs);
    const onAbort = () => ac.abort();
    signal?.addEventListener("abort", onAbort);

    // Bridge progress callbacks → generator yields.
    const progressQueue: McpProgress[] = [];
    let settled = false;
    let resultValue: McpCallResult | null = null;
    let resultError: Error | null = null;
    const callPromise = conn.client
      .callTool(toolName, args.arguments ?? {}, {
        signal: ac.signal,
        timeout: timeoutMs,
        maxTotalTimeout: timeoutMs,
        onProgress: (p) => progressQueue.push(p),
      })
      .then((r) => {
        resultValue = r;
      })
      .catch((e) => {
        resultError = e instanceof Error ? e : new Error(String(e));
      })
      .finally(() => {
        settled = true;
      });

    while (!settled) {
      await Promise.race([callPromise, new Promise<void>((r) => setTimeout(r, 50))]);
      while (progressQueue.length) {
        const p = progressQueue.shift()!;
        yield { type: "progress", progress: p.progress, total: p.total, message: p.message };
      }
    }
    while (progressQueue.length) {
      const p = progressQueue.shift()!;
      yield { type: "progress", progress: p.progress, total: p.total, message: p.message };
    }
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);

    if (resultError) throw resultError;
    const result = resultValue!;

    const inv = await audit.recordInvocation({
      serverId: args.serverId,
      ownerId: userId,
      orgId,
      toolName,
      arguments: args.arguments ?? null,
      status: result.isError ? "failed" : "succeeded",
      durationMs: Date.now() - start,
      retries: 0,
      error: result.isError ? result.text.slice(0, 2000) || "tool returned isError" : null,
      tokensEstimate: result.tokensEstimate,
      streamed: true,
      workflowId: args.workflowId ?? null,
      nodeId: args.nodeId ?? null,
      agentId: "api",
      runId: null,
    });
    await audit.rememberToolEvent({
      userId,
      orgId,
      scope: "workflow",
      invocationId: inv.id,
      serverId: args.serverId,
      serverName,
      toolName,
      callArguments: args.arguments ?? null,
      result,
      status: result.isError ? "failed" : "succeeded",
      error: result.isError ? result.text : null,
      workflowId: args.workflowId ?? null,
      agentId: "api",
    });

    yield { type: "result", result, serverId: args.serverId, toolName };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const retryable = !/not found|not owned|disabled|allow-list|malformed/i.test(msg);
    try {
      await audit.recordInvocation({
        serverId: args.serverId,
        ownerId: userId,
        orgId,
        toolName: args.toolName,
        arguments: args.arguments ?? null,
        status: "failed",
        durationMs: Date.now() - start,
        retries: 0,
        error: msg.slice(0, 2000),
        tokensEstimate: 0,
        streamed: true,
        workflowId: args.workflowId ?? null,
        nodeId: args.nodeId ?? null,
        agentId: "api",
        runId: null,
      });
    } catch {
      /* best-effort */
    }
    yield { type: "error", error: msg, retryable };
  }
}