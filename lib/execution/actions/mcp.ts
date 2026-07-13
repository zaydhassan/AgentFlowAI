// =============================================================================
// MCP execution action — drains the engine's real-action seam for mcp.* nodes
// =============================================================================
// The engine already drains runAction() generically (lib/execution/engine.ts,
// unchanged). registry.ts routes `mcp.tool` / `mcp.resource` here. This module
// resolves the selected tool/resource (allow-list + ownership checked), obtains
// a pooled connection, calls the SDK client, and records the invocation via the
// audit module (McpInvocation row + Memory Engine mirror). It yields `node:log`
// events the engine streams to the execution dock, and returns an ActionResult
// the engine uses for success/failure + retry classification.
//
// Non-retryable (retryable:false): no tool/resource selected, malformed
// selector, ownership/not-found, disabled server, allow-list violation,
// invalid arguments JSON, tool-level isError. Retryable (retryable:true):
// transport/connect/timeout errors — the engine's retry wrapper may re-attempt.
//
// Server-only.

import "server-only";
import { resolveOrgId } from "@/lib/memory";
import {
  getConnection,
  McpNotFoundError,
  McpServerDisabledError,
} from "@/lib/mcp/connection-manager";
import { resolveTool, ToolNotFoundError } from "@/lib/mcp/tool-registry";
import { audit } from "@/lib/mcp/audit";
import { isAllowed } from "@/lib/mcp/permissions";
import type { ActionLogEvent, ActionResult } from "@/lib/integrations/types";

const log = (l: string): ActionLogEvent => ({ type: "log", log: l });

function nonRetryable(error: string): ActionResult {
  return { status: "failed", error, retryable: false };
}

export async function* runMcpAction(args: {
  userId: string;
  nodeType: string;
  config: Record<string, unknown>;
  inputs: unknown[];
  stopped: () => boolean;
}): AsyncGenerator<ActionLogEvent, ActionResult, unknown> {
  const isResource = args.nodeType === "mcp.resource";
  const selectorKey = isResource ? "resource" : "tool";

  // 1. Resolve the selector + arguments from node config.
  const selector = args.config[selectorKey];
  if (typeof selector !== "string" || !selector) {
    return nonRetryable(`No ${selectorKey} selected`);
  }
  const [serverId, ...rest] = selector.split("::");
  const namePart = rest.join("::"); // tool name (mcp.tool) or resource uri (mcp.resource)
  if (!serverId || !namePart) {
    return nonRetryable(`Malformed ${selectorKey} selector "${selector}"`);
  }

  let callArgs: Record<string, unknown> = {};
  const argsRaw = args.config["arguments"];
  if (typeof argsRaw === "string" && argsRaw.trim()) {
    try {
      callArgs = JSON.parse(argsRaw);
      if (!callArgs || typeof callArgs !== "object" || Array.isArray(callArgs)) {
        return nonRetryable("arguments JSON must be an object");
      }
    } catch {
      return nonRetryable("Invalid arguments JSON");
    }
  } else if (argsRaw && typeof argsRaw === "object" && !Array.isArray(argsRaw)) {
    callArgs = argsRaw as Record<string, unknown>;
  } else if (Object.keys(callArgs).length === 0 && args.inputs?.[0] && typeof args.inputs[0] === "object" && !Array.isArray(args.inputs[0])) {
    // Fall back to upstream node input when no arguments configured.
    callArgs = args.inputs[0] as Record<string, unknown>;
  }

  const timeoutMs =
    typeof args.config["timeoutMs"] === "number" && args.config["timeoutMs"] > 0
      ? (args.config["timeoutMs"] as number)
      : 30_000;

  const orgId = await resolveOrgId(args.userId).catch(() => null);
  const start = Date.now();

  // 2. Connect (ownership-checked). Disabled/missing servers are non-retryable.
  let conn;
  try {
    if (args.stopped()) return nonRetryable("cancelled");
    conn = await getConnection(serverId, args.userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const retryable = !(err instanceof McpNotFoundError || err instanceof McpServerDisabledError);
    await recordFailure(audit, { serverId, ownerId: args.userId, orgId, toolName: namePart, callArgs, msg, start });
    return { status: "failed", error: msg, retryable };
  }

  // 3. Allow-list enforcement (security boundary).
  if (!isAllowed(namePart, conn.server.allowList, conn.server.denyList)) {
    const msg = `${selectorKey} "${namePart}" is not on the allow-list for server "${conn.server.name}"`;
    await recordFailure(audit, { serverId, ownerId: args.userId, orgId, toolName: namePart, callArgs, msg, start });
    return nonRetryable(msg);
  }

  try {
    if (isResource) {
      yield log(`MCP read_resource ${selector} on "${conn.server.name}"`);
      if (args.stopped()) return nonRetryable("cancelled");
      const res = await conn.client.readResource(namePart);
      const durationMs = Date.now() - start;
      const inv = await audit.recordInvocation({
        serverId,
        ownerId: args.userId,
        orgId,
        toolName: namePart,
        arguments: callArgs,
        status: "succeeded",
        durationMs,
        retries: 0,
        tokensEstimate: res.tokensEstimate,
        streamed: false,
      });
      await audit.rememberToolEvent({
        userId: args.userId,
        orgId,
        scope: "workflow",
        invocationId: inv.id,
        serverId,
        serverName: conn.server.name,
        toolName: namePart,
        callArguments: callArgs,
        result: { text: res.text, content: [], structuredContent: null, isError: false, tokensEstimate: res.tokensEstimate },
        status: "succeeded",
        agentId: "engine",
      });
      yield log(`MCP resource read (${res.tokensEstimate} tokens)`);
      return {
        status: "succeeded",
        output: { uri: res.uri, text: res.text, blob: res.blob, mimeType: res.mimeType },
        tokensUsed: res.tokensEstimate,
      };
    }

    // mcp.tool
    yield log(`MCP invoke ${selector} on "${conn.server.name}"`);
    // resolveTool re-checks allow-list + ownership and gives us the descriptor.
    const { toolName, descriptor } = await resolveTool({ tool: selector }, args.userId, orgId);
    if (descriptor.description) yield log(`tool: ${descriptor.description.slice(0, 160)}`);
    if (args.stopped()) return nonRetryable("cancelled");

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(new Error("MCP tool timeout")), timeoutMs);
    let result;
    try {
      result = await conn.client.callTool(toolName, callArgs, {
        signal: ac.signal,
        timeout: timeoutMs,
        maxTotalTimeout: timeoutMs,
      });
    } finally {
      clearTimeout(timer);
    }
    const durationMs = Date.now() - start;

    const inv = await audit.recordInvocation({
      serverId,
      ownerId: args.userId,
      orgId,
      toolName,
      arguments: callArgs,
      status: result.isError ? "failed" : "succeeded",
      durationMs,
      retries: 0,
      error: result.isError ? result.text.slice(0, 2000) || "tool returned isError" : null,
      tokensEstimate: result.tokensEstimate,
      streamed: false,
    });
    await audit.rememberToolEvent({
      userId: args.userId,
      orgId,
      scope: "workflow",
      invocationId: inv.id,
      serverId,
      serverName: conn.server.name,
      toolName,
      callArguments: callArgs,
      result,
      status: result.isError ? "failed" : "succeeded",
      error: result.isError ? result.text : null,
      agentId: "engine",
    });

    if (result.isError) {
      yield log(`MCP ${toolName} returned an error`);
      return {
        status: "failed",
        error: result.text || "tool returned isError",
        output: { isError: true, text: result.text, structuredContent: result.structuredContent },
        tokensUsed: result.tokensEstimate,
        retryable: false, // tool-level errors aren't fixed by retrying
      };
    }
    yield log(`MCP ${toolName} ok (${result.tokensEstimate} tokens)`);
    return {
      status: "succeeded",
      output: result.structuredContent ?? result.text,
      tokensUsed: result.tokensEstimate,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const retryable = !(err instanceof ToolNotFoundError);
    await recordFailure(audit, { serverId, ownerId: args.userId, orgId, toolName: namePart, callArgs, msg, start, serverName: conn.server.name });
    return { status: "failed", error: msg, retryable };
  }
}

// ─────────────────────────── audit helper ───────────────────────────────────

async function recordFailure(
  auditMod: typeof audit,
  a: {
    serverId: string;
    ownerId: string;
    orgId: string | null;
    toolName: string;
    callArgs: Record<string, unknown>;
    msg: string;
    start: number;
    serverName?: string;
  },
): Promise<void> {
  try {
    const inv = await auditMod.recordInvocation({
      serverId: a.serverId,
      ownerId: a.ownerId,
      orgId: a.orgId,
      toolName: a.toolName,
      arguments: a.callArgs,
      status: "failed",
      durationMs: Date.now() - a.start,
      retries: 0,
      error: a.msg.slice(0, 2000),
      tokensEstimate: 0,
      streamed: false,
    });
    await auditMod.rememberToolEvent({
      userId: a.ownerId,
      orgId: a.orgId,
      scope: "workflow",
      invocationId: inv.id,
      serverId: a.serverId,
      serverName: a.serverName ?? "(unknown)",
      toolName: a.toolName,
      callArguments: a.callArgs,
      result: null,
      status: "failed",
      error: a.msg,
      agentId: "engine",
    });
  } catch {
    /* audit is best-effort on the error path */
  }
}