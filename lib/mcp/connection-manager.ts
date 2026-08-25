import "server-only";
import { repository } from "./repository";
import { McpSdkClient } from "./sdk-client";
import type { McpHealth, StoredMcpServer } from "./types";

export interface McpConnection {
  serverId: string;
  /** Snapshot of the server config at connect time (decrypted, in-memory). */
  server: StoredMcpServer;
  client: McpSdkClient;
  closed: boolean;
  connectedAt: Date;
  lastPingOk: boolean;
}

export class McpNotFoundError extends Error {
  constructor(public readonly serverId: string) {
    super(`MCP server not found or not owned by user: ${serverId}`);
    this.name = "McpNotFoundError";
  }
}

export class McpServerDisabledError extends Error {
  constructor(public readonly serverId: string) {
    super(`MCP server is disabled: ${serverId}`);
    this.name = "McpServerDisabledError";
  }
}

const POOL = new Map<string, McpConnection>();

type ReconnectHandler = (serverId: string, userId: string, client: McpSdkClient) => void | Promise<void>;
let reconnectHandler: ReconnectHandler | null = null;

/** discovery.ts calls this once at load to receive reconnect notifications. */
export function setOnReconnect(handler: ReconnectHandler): void {
  reconnectHandler = handler;
}

async function safeClose(conn: McpConnection): Promise<void> {
  conn.closed = true;
  try {
    await conn.client.close();
  } catch {
    /* best-effort */
  }
}

/**
 * Get or (re)establish a connection. Ownership is re-checked against the DB on
 * every call — the pool is a cache, not an authority. Returns a live connection
 * or throws McpNotFoundError / McpServerDisabledError (both non-retryable).
 */
export async function getConnection(serverId: string, userId: string): Promise<McpConnection> {
  const existing = POOL.get(serverId);
  if (existing && !existing.closed) return existing;

  // Re-fetch the authoritative, decrypted config (ownership-checked).
  const stored = await repository.getServerOwned(userId, serverId);
  if (!stored) throw new McpNotFoundError(serverId);
  if (stored.status === "disabled") throw new McpServerDisabledError(serverId);

  const wasReconnect = existing !== undefined;
  if (existing) {
    await safeClose(existing);
    POOL.delete(serverId);
  }

  const ac = new AbortController();
  // Handshake timeout guard — 30s for stdio spawn / HTTP initialize.
  const timer = setTimeout(() => ac.abort(new Error("MCP connect timeout")), 30_000);
  try {
    const client = await McpSdkClient.connect({ server: stored, signal: ac.signal });
    const conn: McpConnection = {
      serverId,
      server: stored,
      client,
      closed: false,
      connectedAt: new Date(),
      lastPingOk: true,
    };
    // Detect remote-initiated closes so the next getConnection reconnects.
    client.onclose = () => {
      const c = POOL.get(serverId);
      if (c) c.closed = true;
    };
    client.onerror = () => {
      const c = POOL.get(serverId);
      if (c) c.closed = true;
    };
    POOL.set(serverId, conn);
    await repository.setStatus(userId, serverId, "connected");
    // Refresh-on-reconnect: re-sync metadata after a transport came back.
    if (wasReconnect && reconnectHandler) {
      try {
        await reconnectHandler(serverId, userId, client);
      } catch {
        /* refresh is best-effort; the connection itself is usable */
      }
    }
    return conn;
  } finally {
    clearTimeout(timer);
  }
}

/** Lightweight liveness probe; updates health + status, marks closed on failure. */
export async function healthCheck(serverId: string, userId: string): Promise<McpHealth> {
  const start = Date.now();
  const existing = POOL.get(serverId);
  if (!existing || existing.closed) {
    // Try to (re)establish; if that fails, report the error.
    try {
      await getConnection(serverId, userId);
    } catch (err) {
      const health: McpHealth = {
        ok: false,
        lastCheckedAt: new Date().toISOString(),
        latencyMs: null,
        error: err instanceof Error ? err.message : String(err),
      };
      await repository.setHealth(userId, serverId, health, "error");
      return health;
    }
  }
  const conn = POOL.get(serverId)!;
  try {
    await conn.client.ping();
    conn.lastPingOk = true;
    const health: McpHealth = {
      ok: true,
      lastCheckedAt: new Date().toISOString(),
      latencyMs: Date.now() - start,
      error: null,
    };
    await repository.setHealth(userId, serverId, health, "connected");
    return health;
  } catch (err) {
    conn.lastPingOk = false;
    conn.closed = true;
    const health: McpHealth = {
      ok: false,
      lastCheckedAt: new Date().toISOString(),
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
    await repository.setHealth(userId, serverId, health, "error");
    return health;
  }
}

/** Drop + close one connection (e.g. on server delete). */
export async function closeConnection(serverId: string): Promise<void> {
  const conn = POOL.get(serverId);
  if (!conn) return;
  await safeClose(conn);
  POOL.delete(serverId);
}

/** Drop + close every connection (e.g. on graceful shutdown). */
export async function closeAll(): Promise<void> {
  const conns = [...POOL.values()];
  POOL.clear();
  await Promise.all(conns.map(safeClose));
}

export function poolStats(): { connected: number; serverIds: string[] } {
  const live = [...POOL.values()].filter((c) => !c.closed);
  return { connected: live.length, serverIds: live.map((c) => c.serverId) };
}

/** Test-only / shutdown helper exposed for the API surface. */
export const connectionManager = {
  getConnection,
  healthCheck,
  closeConnection,
  closeAll,
  poolStats,
  setOnReconnect,
};