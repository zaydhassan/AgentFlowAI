"use client";

// Client-safe MCP helpers. Browser fetch wrappers for /api/mcp/** — typed, no
// secrets, no SDK. The settings page + inspector use these. Mirrors
// lib/integrations/client.ts.

import type {
  McpServer,
  McpHealth,
  McpToolSummary,
  McpInvocationRow,
  McpObservabilitySummary,
  McpTransportId,
  McpAuthScheme,
  McpCredentials,
  McpCallResult,
  McpProgress,
} from "./types";

export type {
  McpServer,
  McpHealth,
  McpToolSummary,
  McpInvocationRow,
  McpObservabilitySummary,
  McpTransportId,
  McpAuthScheme,
  McpCredentials,
  McpCallResult,
  McpProgress,
};

export interface McpServerInput {
  name: string;
  transport: McpTransportId;
  endpoint?: string | null;
  command?: string | null;
  args?: string[];
  env?: Record<string, string> | null;
  authScheme?: McpAuthScheme | null;
  credentials?: McpCredentials | null;
  allowList?: string[];
  denyList?: string[];
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Request failed (${res.status}).`);
  }
  return (await res.json()) as T;
}

export async function listServers(): Promise<McpServer[]> {
  const data = await jsonOrThrow<{ servers: McpServer[] }>(await fetch("/api/mcp/servers", { cache: "no-store" }));
  return data.servers;
}

export async function createServer(input: McpServerInput): Promise<McpServer> {
  return jsonOrThrow<McpServer>(
    await fetch("/api/mcp/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function updateServer(id: string, patch: Partial<McpServerInput>): Promise<McpServer> {
  return jsonOrThrow<McpServer>(
    await fetch(`/api/mcp/servers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}

export async function deleteServer(id: string): Promise<void> {
  const res = await fetch(`/api/mcp/servers/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Could not delete server (${res.status}).`);
}

export async function testServer(id: string): Promise<McpHealth> {
  return jsonOrThrow<McpHealth>(await fetch(`/api/mcp/servers/${id}/test`, { method: "POST" }));
}

export async function discoverServer(id: string): Promise<{ tools: number; resources: number; prompts: number }> {
  return jsonOrThrow(await fetch(`/api/mcp/servers/${id}/discover`, { method: "POST" }));
}

export async function listTools(): Promise<McpToolSummary[]> {
  const data = await jsonOrThrow<{ items: McpToolSummary[] }>(await fetch("/api/mcp/tools", { cache: "no-store" }));
  return data.items;
}

export async function listResources(): Promise<McpToolSummary[]> {
  const data = await jsonOrThrow<{ items: McpToolSummary[] }>(await fetch("/api/mcp/resources", { cache: "no-store" }));
  return data.items;
}

export async function listInvocations(serverId?: string): Promise<McpInvocationRow[]> {
  const qs = serverId ? `?serverId=${encodeURIComponent(serverId)}` : "";
  const data = await jsonOrThrow<{ invocations: McpInvocationRow[] }>(
    await fetch(`/api/mcp/invocations${qs}`, { cache: "no-store" }),
  );
  return data.invocations;
}

export async function observability(): Promise<McpObservabilitySummary> {
  return jsonOrThrow<McpObservabilitySummary>(await fetch("/api/mcp/observability", { cache: "no-store" }));
}

/**
 * Invoke an MCP tool over SSE. Calls onProgress for each progress event and
 * resolves with the final McpCallResult (or rejects on a transport error).
 */
export async function invokeTool(
  args: { serverId: string; toolName: string; arguments?: Record<string, unknown>; timeoutMs?: number; workflowId?: string | null; nodeId?: string | null },
  opts?: { onProgress?: (p: McpProgress) => void; signal?: AbortSignal },
): Promise<McpCallResult> {
  const res = await fetch("/api/mcp/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: opts?.signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Invoke failed (${res.status}).`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: McpCallResult | null = null;
  let streamError: string | null = null;

  // Parse the SSE frames emitted by sseStream (`data: <json>\n\n` + `event:` lines).
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      const payload = JSON.parse(dataLine.slice(6)) as
        | { type: "progress"; progress?: number; total?: number; message?: string }
        | { type: "result"; result: McpCallResult }
        | { type: "error"; error: string }
        | { type: "done" };
      if (payload.type === "progress") {
        opts?.onProgress?.({ progress: payload.progress, total: payload.total, message: payload.message });
      } else if (payload.type === "result") {
        result = payload.result;
      } else if (payload.type === "error") {
        streamError = payload.error;
      }
    }
  }
  if (streamError) throw new Error(streamError);
  if (!result) throw new Error("Invoke ended without a result.");
  return result;
}