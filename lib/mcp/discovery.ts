// =============================================================================
// MCP discovery engine
// =============================================================================
// Pulls tools/resources/prompts/capabilities from a connected server and
// persists them into the cache (McpCapability + McpToolCache). Called:
//   • on explicit discovery (POST /servers/[id]/discover)
//   • after a health-check connect (POST /servers/[id]/test)
//   • on reconnect (registered as the connection manager's onReconnect handler)
// Caching the metadata is what lets the inspector dropdown, the planner's
// ctx.tools.list(), and the engine's tool resolution run without a live round
// trip to every server. Stale cache rows are pruned each refresh.
//
// Server-only.

import "server-only";
import { repository } from "./repository";
import { getConnection, setOnReconnect, type McpConnection } from "./connection-manager";
import { McpSdkClient } from "./sdk-client";
import type { McpCapabilityRow, McpCacheKind } from "./types";

export interface DiscoveryResult {
  serverId: string;
  capabilities: McpCapabilityRow[];
  tools: number;
  resources: number;
  resourceTemplates: number;
  prompts: number;
  refreshedAt: string;
}

/**
 * Discover + cache everything a server advertises. Establishes a connection if
 * one isn't already pooled. The capability blob is normalized; tools, static
 * resources, resource templates (as synthetic "resource" entries keyed by their
 * uriTemplate), and prompts are all written to McpToolCache.
 */
export async function discover(serverId: string, userId: string): Promise<DiscoveryResult> {
  const conn = await getConnection(serverId, userId);
  const client = conn.client;
  const caps = client.capabilityRows();

  const cacheItems: Array<{
    kind: McpCacheKind;
    name: string;
    title?: string | null;
    description?: string | null;
    inputSchema?: Record<string, unknown> | null;
    annotations?: Record<string, unknown> | null;
    uri?: string | null;
    mimeType?: string | null;
  }> = [];

  let tools = 0;
  let resources = 0;
  let resourceTemplates = 0;
  let prompts = 0;

  if (caps.find((c) => c.kind === "tools" && c.supported)) {
    const list = await client.listTools();
    tools = list.length;
    for (const t of list) {
      cacheItems.push({
        kind: "tool",
        name: t.name,
        title: t.title,
        description: t.description,
        inputSchema: t.inputSchema,
        annotations: t.annotations,
      });
    }
  }

  if (caps.find((c) => c.kind === "resources" && c.supported)) {
    const res = await client.listResources();
    resources = res.length;
    for (const r of res) {
      cacheItems.push({
        kind: "resource",
        name: r.name,
        uri: r.uri,
        description: r.description,
        mimeType: r.mimeType,
        annotations: r.annotations,
      });
    }
    // Resource templates are uriTemplate-based; cache them as "resource" rows
    // whose uri holds the template, so the inspector can list them too.
    const tmpl = await client.listResourceTemplates();
    resourceTemplates = tmpl.length;
    for (const t of tmpl) {
      cacheItems.push({
        kind: "resource",
        name: t.name,
        uri: t.uriTemplate,
        description: t.description,
        mimeType: t.mimeType,
      });
    }
  }

  if (caps.find((c) => c.kind === "prompts" && c.supported)) {
    const list = await client.listPrompts();
    prompts = list.length;
    for (const p of list) {
      cacheItems.push({
        kind: "prompt",
        name: p.name,
        description: p.description,
      });
    }
  }

  await repository.upsertCapabilities(serverId, caps);
  await repository.upsertToolCache(serverId, cacheItems);
  await repository.setLastDiscoveredAt(userId, serverId, new Date());

  return {
    serverId,
    capabilities: caps,
    tools,
    resources,
    resourceTemplates,
    prompts,
    refreshedAt: new Date().toISOString(),
  };
}

/** Convenience: refresh == discover (re-read from the live server). */
export async function refresh(serverId: string, userId: string): Promise<DiscoveryResult> {
  return discover(serverId, userId);
}

// ─────────────────────────── reconnect wiring ───────────────────────────────
// Register once at module load so the connection manager re-syncs metadata
// after a transport comes back. Guarded: discovery errors never propagate into
// the connection path (the connection is already usable; the next explicit
// discover will fix the cache).
setOnReconnect(async (serverId: string, userId: string, _client: McpSdkClient) => {
  try {
    await discover(serverId, userId);
  } catch {
    /* best-effort refresh on reconnect */
  }
  void _client;
});

// Re-export so callers import discovery from one place.
export { getConnection, type McpConnection };