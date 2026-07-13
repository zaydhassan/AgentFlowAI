// =============================================================================
// MCP transport registry
// =============================================================================
// Additive transport layer. Each transport (stdio / http / sse) is a small
// adapter implementing McpTransportAdapter and registered here at module load.
// Adding a future transport (websocket, in-process, etc.) = one new file under
// lib/mcp/transports/ + one registerTransport() call — the SDK client, the
// connection manager, discovery, the gateway, and the agent runtime never
// change. This is the "future transports without modifying the runtime" seam.
//
// Server-only.

import "server-only";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { McpAuthScheme, McpCredentials, StoredMcpServer } from "../types";

export interface McpTransportBuildContext {
  server: StoredMcpServer;
  signal: AbortSignal;
}

export interface McpTransportAdapter {
  id: string;
  build(ctx: McpTransportBuildContext): Transport;
}

// ─────────────────────────── registry ───────────────────────────────────────

const REGISTRY = new Map<string, McpTransportAdapter>();

export function registerTransport(adapter: McpTransportAdapter): void {
  REGISTRY.set(adapter.id, adapter);
}

export function getTransport(id: string): McpTransportAdapter | undefined {
  return REGISTRY.get(id);
}

export function registeredTransports(): string[] {
  return [...REGISTRY.keys()];
}

export function buildTransport(ctx: McpTransportBuildContext): Transport {
  const adapter = REGISTRY.get(ctx.server.transport);
  if (!adapter) {
    throw new Error(
      `Unsupported MCP transport "${ctx.server.transport}". Registered: ${registeredTransports().join(", ") || "(none)"}`,
    );
  }
  return adapter.build(ctx);
}

// ─────────────────────────── auth header builder ────────────────────────────
// Shared by http + sse adapters. Translates the stored authScheme + decrypted
// McpCredentials into the HTTP headers attached to every request. stdio does
// not use HTTP and ignores this.

export function buildAuthHeaders(
  scheme: McpAuthScheme | null,
  creds: McpCredentials | null,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!scheme || scheme === "none" || !creds) {
    // Still apply any arbitrary extra headers the user provided.
    if (creds?.headers) Object.assign(headers, creds.headers);
    return headers;
  }
  if (scheme === "bearer" && creds.token) {
    headers["Authorization"] = `Bearer ${creds.token}`;
  } else if (scheme === "basic" && creds.username != null && creds.password != null) {
    const encoded = Buffer.from(`${creds.username}:${creds.password}`).toString("base64");
    headers["Authorization"] = `Basic ${encoded}`;
  } else if (scheme === "header" && creds.headerName && creds.headerValue) {
    headers[creds.headerName] = creds.headerValue;
  }
  if (creds.headers) Object.assign(headers, creds.headers);
  return headers;
}

// Register the built-in transports. Importing this module wires them up.
import "./stdio";
import "./http";
import "./sse";