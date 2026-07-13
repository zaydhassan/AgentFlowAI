// =============================================================================
// MCP repository — the ONLY place credentials/env are encrypted/decrypted
// =============================================================================
// Prisma layer for McpServer / McpCapability / McpToolCache / McpInvocation.
// Reuses the canonical AES-256-GCM crypto from lib/integrations/crypto.ts (no
// new key/env var). Credentials + the stdio env blob are encrypted before write
// and decrypted on read into the server-only StoredMcpServer (in-memory only,
// never serialized to a response) — exactly the rule lib/integrations/repository
// follows for OAuth tokens.
//
// Server-only.

import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { encryptToken, decryptToken } from "@/lib/integrations/crypto";
import { isAllowed } from "./permissions";
import type {
  McpServer,
  McpHealth,
  McpCapabilityRow,
  McpCapabilityKind,
  McpCacheKind,
  McpInvocationRow,
  McpInvocationStatus,
  McpObservabilitySummary,
  McpToolSummary,
  McpCredentials,
  StoredMcpServer,
  CreateMcpServerInput,
  UpdateMcpServerInput,
  RecordInvocationInput,
  ListInvocationsFilters,
  McpTransportId,
  McpAuthScheme,
  McpServerStatus,
} from "./types";

// The payload shape of a McpServer query with capabilities included — using
// Prisma's GetPayload keeps it in sync with the generated types.
type ServerRow = Prisma.McpServerGetPayload<{ include: { capabilities: true } }>;

// ─────────────────────────── helpers ────────────────────────────────────────

/**
 * Prisma nullable-Json fields require the `Prisma.JsonNull` sentinel to store a
 * SQL NULL — a JS `null` is not assignable. This helper is the single place
 * that rule is applied, so every Json write goes through it.
 */
function jsonOrNull(
  v: Record<string, unknown> | null | undefined,
): Prisma.JsonObject | Prisma.NullableJsonNullValueInput {
  return v ? (v as Prisma.JsonObject) : Prisma.JsonNull;
}

function parseJsonRecord(raw: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function encryptCredentials(creds: McpCredentials | null | undefined): string | null {
  if (!creds) return null;
  const json = JSON.stringify(creds);
  if (json === "{}") return null;
  return encryptToken(json);
}

function decryptCredentials(ciphertext: string | null): McpCredentials | null {
  if (!ciphertext) return null;
  try {
    const json = decryptToken(ciphertext);
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as McpCredentials;
    }
    return null;
  } catch {
    return null;
  }
}

function encryptEnv(env: Record<string, string> | null | undefined): string | null {
  if (!env || Object.keys(env).length === 0) return null;
  return encryptToken(JSON.stringify(env));
}

function decryptEnv(ciphertext: string | null): Record<string, string> | null {
  if (!ciphertext) return null;
  try {
    const parsed = JSON.parse(decryptToken(ciphertext)) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    }
    return null;
  } catch {
    return null;
  }
}

function parseHealth(raw: Prisma.JsonValue | null | undefined): McpHealth | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const h = raw as Record<string, unknown>;
  return {
    ok: h.ok === true,
    lastCheckedAt: typeof h.lastCheckedAt === "string" ? h.lastCheckedAt : new Date(0).toISOString(),
    latencyMs: typeof h.latencyMs === "number" ? h.latencyMs : null,
    error: typeof h.error === "string" ? h.error : null,
  };
}

function capsOf(row: { capabilities: { kind: string; supported: boolean }[] }): McpCapabilityRow[] {
  return row.capabilities.map((c) => ({ kind: c.kind as McpCapabilityKind, supported: c.supported }));
}

// ─────────────────────────── mappers ────────────────────────────────────────

/** Decrypt credentials + env into the server-only in-memory shape. */
function toStored(row: NonNullable<ServerRow>): StoredMcpServer {
  return {
    id: row.id,
    ownerId: row.ownerId,
    orgId: row.orgId,
    name: row.name,
    transport: row.transport as McpTransportId,
    endpoint: row.endpoint,
    command: row.command,
    args: row.args,
    env: decryptEnv(row.envEncrypted),
    authScheme: row.authScheme as McpAuthScheme | null,
    credentials: decryptCredentials(row.credentials),
    status: row.status as McpServerStatus,
    health: parseHealth(row.health),
    allowList: row.allowList,
    denyList: row.denyList,
    lastSessionId: row.lastSessionId,
    lastDiscoveredAt: row.lastDiscoveredAt,
    metadata: parseJsonRecord(row.metadata),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Client-safe shape — no credentials, no env, ISO dates, with capabilities. */
function toClient(row: NonNullable<ServerRow>): McpServer {
  return {
    id: row.id,
    ownerId: row.ownerId,
    orgId: row.orgId,
    name: row.name,
    transport: row.transport as McpTransportId,
    endpoint: row.endpoint,
    command: row.command,
    args: row.args,
    authScheme: row.authScheme as McpAuthScheme | null,
    status: row.status as McpServerStatus,
    health: parseHealth(row.health),
    allowList: row.allowList,
    denyList: row.denyList,
    lastSessionId: row.lastSessionId,
    lastDiscoveredAt: row.lastDiscoveredAt ? row.lastDiscoveredAt.toISOString() : null,
    capabilities: capsOf(row),
    metadata: parseJsonRecord(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─────────────────────────── public API ─────────────────────────────────────

export const repository = {
  // ───────────── servers ─────────────

  /** List a workspace's servers in the client-safe shape (with capabilities). */
  async listServers(ownerId: string, orgId?: string | null): Promise<McpServer[]> {
    const where: Prisma.McpServerWhereInput = orgId
      ? { OR: [{ ownerId }, { orgId }] }
      : { ownerId };
    const rows = await prisma.mcpServer.findMany({
      where,
      include: { capabilities: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => toClient(r as NonNullable<ServerRow>));
  },

  /** Ownership-checked decrypt: the only way the connection manager gets creds. */
  async getServerOwned(ownerId: string, id: string): Promise<StoredMcpServer | null> {
    const row = await prisma.mcpServer.findUnique({
      where: { id },
      include: { capabilities: true },
    });
    if (!row || row.ownerId !== ownerId) return null;
    return toStored(row as NonNullable<ServerRow>);
  },

  /** Client-safe single server (ownership-checked). */
  async getServerClientOwned(ownerId: string, id: string): Promise<McpServer | null> {
    const row = await prisma.mcpServer.findUnique({
      where: { id },
      include: { capabilities: true },
    });
    if (!row || row.ownerId !== ownerId) return null;
    return toClient(row as NonNullable<ServerRow>);
  },

  /** Create a server, encrypting credentials + env. Returns the client-safe shape. */
  async createServer(input: CreateMcpServerInput): Promise<McpServer> {
    const row = await prisma.mcpServer.create({
      data: {
        ownerId: input.ownerId,
        orgId: input.orgId ?? null,
        name: input.name,
        transport: input.transport,
        endpoint: input.endpoint ?? null,
        command: input.command ?? null,
        args: input.args ?? [],
        envEncrypted: encryptEnv(input.env ?? null),
        authScheme: input.authScheme ?? null,
        credentials: encryptCredentials(input.credentials ?? null),
        allowList: input.allowList ?? [],
        denyList: input.denyList ?? [],
        status: "disconnected",
        metadata: jsonOrNull(input.metadata),
      },
      include: { capabilities: true },
    });
    return toClient(row as NonNullable<ServerRow>);
  },

  /** Update a server (ownership-checked). Re-encrypts credentials/env when provided. */
  async updateServer(ownerId: string, id: string, patch: UpdateMcpServerInput): Promise<McpServer> {
    const existing = await prisma.mcpServer.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== ownerId) return null as unknown as McpServer;
    const data: Prisma.McpServerUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.orgId !== undefined) data.orgId = patch.orgId;
    if (patch.transport !== undefined) data.transport = patch.transport;
    if (patch.endpoint !== undefined) data.endpoint = patch.endpoint ?? null;
    if (patch.command !== undefined) data.command = patch.command ?? null;
    if (patch.args !== undefined) data.args = patch.args;
    if (patch.env !== undefined) data.envEncrypted = encryptEnv(patch.env ?? null);
    if (patch.authScheme !== undefined) data.authScheme = patch.authScheme ?? null;
    if (patch.credentials !== undefined) data.credentials = encryptCredentials(patch.credentials ?? null);
    if (patch.allowList !== undefined) data.allowList = patch.allowList;
    if (patch.denyList !== undefined) data.denyList = patch.denyList;
    if (patch.metadata !== undefined) data.metadata = jsonOrNull(patch.metadata);
    const row = await prisma.mcpServer.update({ where: { id }, data, include: { capabilities: true } });
    return toClient(row as NonNullable<ServerRow>);
  },

  async deleteServer(ownerId: string, id: string): Promise<void> {
    const existing = await prisma.mcpServer.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== ownerId) return;
    await prisma.mcpServer.delete({ where: { id } });
  },

  async setStatus(ownerId: string, id: string, status: McpServerStatus): Promise<void> {
    const existing = await prisma.mcpServer.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== ownerId) return;
    await prisma.mcpServer.update({ where: { id }, data: { status } });
  },

  async setHealth(
    ownerId: string,
    id: string,
    health: McpHealth,
    status?: McpServerStatus,
  ): Promise<void> {
    const existing = await prisma.mcpServer.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== ownerId) return;
    await prisma.mcpServer.update({
      where: { id },
      data: {
        health: health as unknown as Prisma.JsonObject,
        ...(status ? { status } : {}),
      },
    });
  },

  async setSessionId(ownerId: string, id: string, sessionId: string | null): Promise<void> {
    const existing = await prisma.mcpServer.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== ownerId) return;
    await prisma.mcpServer.update({ where: { id }, data: { lastSessionId: sessionId } });
  },

  async setLastDiscoveredAt(ownerId: string, id: string, when: Date): Promise<void> {
    const existing = await prisma.mcpServer.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== ownerId) return;
    await prisma.mcpServer.update({ where: { id }, data: { lastDiscoveredAt: when } });
  },

  // ───────────── discovery cache ─────────────

  /** Replace a server's capability rows (called on (re)connect). */
  async upsertCapabilities(
    serverId: string,
    caps: Array<{ kind: McpCapabilityKind; supported: boolean; metadata?: Record<string, unknown> | null }>,
  ): Promise<void> {
    await prisma.$transaction(
      caps.map((c) =>
        prisma.mcpCapability.upsert({
          where: { serverId_kind: { serverId, kind: c.kind } },
          create: {
            serverId,
            kind: c.kind,
            supported: c.supported,
            metadata: jsonOrNull(c.metadata),
          },
          update: { supported: c.supported, metadata: jsonOrNull(c.metadata) },
        }),
      ),
    );
  },

  /**
   * Refresh a server's cached tools/resources/prompts: stamp existing rows'
   * lastSeenAt, insert new ones, and delete stale ones not seen this round.
   * Called by the discovery engine on (re)connect + on POST /discover.
   */
  async upsertToolCache(
    serverId: string,
    items: Array<{
      kind: McpCacheKind;
      name: string;
      title?: string | null;
      description?: string | null;
      inputSchema?: Record<string, unknown> | null;
      annotations?: Record<string, unknown> | null;
      uri?: string | null;
      mimeType?: string | null;
    }>,
  ): Promise<void> {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        await tx.mcpToolCache.upsert({
          where: { serverId_kind_name: { serverId, kind: it.kind, name: it.name } },
          create: {
            serverId,
            kind: it.kind,
            name: it.name,
            title: it.title ?? null,
            description: it.description ?? null,
            inputSchema: jsonOrNull(it.inputSchema),
            annotations: jsonOrNull(it.annotations),
            uri: it.uri ?? null,
            mimeType: it.mimeType ?? null,
            lastSeenAt: now,
          },
          update: {
            title: it.title ?? null,
            description: it.description ?? null,
            inputSchema: jsonOrNull(it.inputSchema),
            annotations: jsonOrNull(it.annotations),
            uri: it.uri ?? null,
            mimeType: it.mimeType ?? null,
            lastSeenAt: now,
          },
        });
      }
      // Delete stale rows (not seen this round) for this server.
      const names = items.map((i) => i.name);
      await tx.mcpToolCache.deleteMany({
        where: { serverId, NOT: { name: { in: names } } },
      });
    });
  },

  async clearToolCache(serverId: string): Promise<void> {
    await prisma.mcpToolCache.deleteMany({ where: { serverId } });
  },

  /**
   * Aggregate cached items across a workspace's servers, joined with each
   * server's allow/deny lists so the tool-registry can filter. One query.
   */
  async listWorkspaceCache(
    ownerId: string,
    orgId: string | null,
    kind: McpCacheKind,
  ): Promise<
    Array<{
      serverId: string;
      serverName: string;
      allowList: string[];
      denyList: string[];
      name: string;
      title: string | null;
      description: string | null;
      uri: string | null;
      mimeType: string | null;
      inputSchema: Record<string, unknown> | null;
      annotations: Record<string, unknown> | null;
    }>
  > {
    const where: Prisma.McpServerWhereInput = orgId
      ? { OR: [{ ownerId }, { orgId }] }
      : { ownerId };
    const servers = await prisma.mcpServer.findMany({
      where,
      include: { tools: { where: { kind } } },
    });
    const out: Array<{
      serverId: string;
      serverName: string;
      allowList: string[];
      denyList: string[];
      name: string;
      title: string | null;
      description: string | null;
      uri: string | null;
      mimeType: string | null;
      inputSchema: Record<string, unknown> | null;
      annotations: Record<string, unknown> | null;
    }> = [];
    for (const s of servers) {
      if (s.status === "disabled") continue;
      for (const t of s.tools) {
        out.push({
          serverId: s.id,
          serverName: s.name,
          allowList: s.allowList,
          denyList: s.denyList,
          name: t.name,
          title: t.title,
          description: t.description,
          uri: t.uri,
          mimeType: t.mimeType,
          inputSchema: parseJsonRecord(t.inputSchema),
          annotations: parseJsonRecord(t.annotations),
        });
      }
    }
    return out;
  },

  /** Map a workspace cache query to allow-filtered McpToolSummary[]. */
  async listWorkspaceTools(ownerId: string, orgId: string | null): Promise<McpToolSummary[]> {
    const rows = await this.listWorkspaceCache(ownerId, orgId, "tool");
    return rows
      .filter((r) => isAllowed(r.name, r.allowList, r.denyList))
      .map((r) => ({
        id: `${r.serverId}::${r.name}`,
        serverId: r.serverId,
        serverName: r.serverName,
        kind: "tool" as const,
        name: r.name,
        title: r.title,
        description: r.description,
        uri: r.uri,
        mimeType: r.mimeType,
        inputSchema: r.inputSchema,
        annotations: r.annotations,
      }));
  },

  async listWorkspaceResources(ownerId: string, orgId: string | null): Promise<McpToolSummary[]> {
    const rows = await this.listWorkspaceCache(ownerId, orgId, "resource");
    return rows
      .filter((r) => isAllowed(r.uri ?? r.name, r.allowList, r.denyList))
      .map((r) => ({
        id: `${r.serverId}::${r.uri ?? r.name}`,
        serverId: r.serverId,
        serverName: r.serverName,
        kind: "resource" as const,
        name: r.name,
        title: r.title,
        description: r.description,
        uri: r.uri,
        mimeType: r.mimeType,
        inputSchema: r.inputSchema,
        annotations: r.annotations,
      }));
  },

  // ───────────── invocations / audit ─────────────

  async recordInvocation(input: RecordInvocationInput): Promise<McpInvocationRow> {
    const row = await prisma.mcpInvocation.create({
      data: {
        serverId: input.serverId,
        ownerId: input.ownerId,
        orgId: input.orgId,
        toolName: input.toolName,
        arguments: jsonOrNull(input.arguments),
        status: input.status,
        durationMs: input.durationMs,
        retries: input.retries,
        error: input.error ?? null,
        tokensEstimate: input.tokensEstimate ?? 0,
        streamed: input.streamed ?? false,
        workflowId: input.workflowId ?? null,
        nodeId: input.nodeId ?? null,
        agentId: input.agentId ?? null,
        runId: input.runId ?? null,
      },
      include: { server: { select: { name: true } } },
    });
    return toInvocationRow(row);
  },

  async listInvocations(ownerId: string, filters: ListInvocationsFilters = {}): Promise<McpInvocationRow[]> {
    const where: Prisma.McpInvocationWhereInput = { ownerId };
    if (filters.serverId) where.serverId = filters.serverId;
    if (filters.status) where.status = filters.status;
    if (filters.workflowId) where.workflowId = filters.workflowId;
    const rows = await prisma.mcpInvocation.findMany({
      where,
      include: { server: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: Math.min(filters.limit ?? 100, 500),
    });
    return rows.map(toInvocationRow);
  },

  async observabilitySummary(ownerId: string, orgId: string | null): Promise<McpObservabilitySummary> {
    const serverWhere: Prisma.McpServerWhereInput = orgId
      ? { OR: [{ ownerId }, { orgId }] }
      : { ownerId };
    const servers = await prisma.mcpServer.groupBy({
      by: ["status"],
      where: serverWhere,
      _count: { _all: true },
    });
    const total = servers.reduce((s, g) => s + g._count._all, 0);
    const byStatus = (st: McpServerStatus): number =>
      servers.find((g) => g.status === st)?._count._all ?? 0;

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const invWhere: Prisma.McpInvocationWhereInput = { ownerId, createdAt: { gte: since } };
    const [totalCalls, succeeded, failed, streamed, agg, recentFailures, topTools] = await Promise.all([
      prisma.mcpInvocation.count({ where: invWhere }),
      prisma.mcpInvocation.count({ where: { ...invWhere, status: "succeeded" } }),
      prisma.mcpInvocation.count({ where: { ...invWhere, status: "failed" } }),
      prisma.mcpInvocation.count({ where: { ...invWhere, streamed: true } }),
      prisma.mcpInvocation.aggregate({
        where: invWhere,
        _avg: { durationMs: true },
        _max: { durationMs: true },
      }),
      prisma.mcpInvocation.findMany({
        where: { ...invWhere, status: "failed" },
        include: { server: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.mcpInvocation.groupBy({
        by: ["toolName", "serverId"],
        where: invWhere,
        _count: { _all: true },
        // groupBy's _count orderBy takes a model field (the count of rows in
        // each group), not `_all`. serverId is always present → group size.
        orderBy: { _count: { serverId: "desc" } },
        take: 10,
      }),
    ]);

    // Resolve server names for top tools.
    const serverIds = [...new Set(topTools.map((t) => t.serverId))];
    const serverNames = serverIds.length
      ? await prisma.mcpServer.findMany({ where: { id: { in: serverIds } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(serverNames.map((s) => [s.id, s.name]));

    return {
      servers: {
        total,
        connected: byStatus("connected"),
        error: byStatus("error"),
        disabled: byStatus("disabled"),
        disconnected: byStatus("disconnected"),
      },
      invocations: {
        total: totalCalls,
        succeeded,
        failed,
        errorRate: totalCalls > 0 ? failed / totalCalls : 0,
        avgLatencyMs: agg._avg.durationMs ?? 0,
        p95LatencyMs: agg._max.durationMs ?? 0, // upper bound proxy without percentile SQL
        streamed,
        recentFailures: recentFailures.map(toInvocationRow),
      },
      topTools: topTools.map((t) => ({
        toolName: t.toolName,
        serverName: nameById.get(t.serverId) ?? null,
        calls: t._count._all,
      })),
    };
  },
};

// ─────────────────────────── invocation mapper ──────────────────────────────

// The exact payload shape of a McpInvocation findMany/create with the server
// name included — using Prisma's GetPayload guarantees this matches the
// generated types without a hand-maintained duplicate.
type InvocationWithServer = Prisma.McpInvocationGetPayload<{
  include: { server: { select: { name: true } } };
}>;

function toInvocationRow(row: InvocationWithServer): McpInvocationRow {
  return {
    id: row.id,
    serverId: row.serverId,
    serverName: row.server?.name ?? null,
    ownerId: row.ownerId,
    orgId: row.orgId,
    toolName: row.toolName,
    arguments: parseJsonRecord(row.arguments),
    status: row.status as McpInvocationStatus,
    durationMs: row.durationMs,
    retries: row.retries,
    error: row.error,
    tokensEstimate: row.tokensEstimate,
    streamed: row.streamed,
    workflowId: row.workflowId,
    nodeId: row.nodeId,
    agentId: row.agentId,
    runId: row.runId,
    createdAt: row.createdAt.toISOString(),
  };
}