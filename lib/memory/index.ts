// Server facade for the memory engine. Re-exports the public server API the
// execution engine + API routes use, plus the client-safe types. Mirrors the
// lib/integrations/index.ts + lib/payments/index.ts facade pattern.
//
// Server-only.

import "server-only";
import { prisma } from "@/lib/db";
import { embeddingConfigured } from "./embeddings";
import { memoryEngine } from "./engine";

export { memoryEngine };
export { embeddingConfigured } from "./embeddings";
// Re-exported for the queue worker (lib/queue/workers/memory-embedding), which
// generates embeddings off the request path. Additive; no behavior change.
export { getEmbeddingProvider } from "./embeddings";
export { hashContent } from "./repository";
export { retrieve, invalidateCache } from "./retrieval";
export { repository } from "./repository";
export type {
  Memory,
  MemoryCollection,
  MemoryHit,
  MemoryScope,
  MemoryStatus,
  EventKind,
  RetrievalRequest,
  RetrievalResult,
  RetrievalFilters,
  RememberInput,
  RememberResult,
  MemoryStats,
  ManageResult,
  EmbeddingProvider,
  EmbeddingProviderId,
} from "./types";

/** Master switch + embeddings configured. The single gate the engine checks. */
export function memoryConfigured(): boolean {
  if (process.env.MEMORY_ENABLED === "false") return false;
  return embeddingConfigured();
}

/** The active MemoryEngine (single shared instance). */
export function getMemoryEngine() {
  return memoryEngine;
}

// ─────────────────────────── workspace resolution ──────────────────────────
// Per-process cache of userId → primary orgId (the user's earliest membership).
// Used to scope "workspace" memory. Null when the user has no org — workspace
// scope then falls back to user-scoped isolation.

const orgCache = new Map<string, string | null>();

export async function resolveOrgId(userId: string): Promise<string | null> {
  if (orgCache.has(userId)) return orgCache.get(userId) ?? null;
  const m = await prisma.membership.findFirst({
    where: { userId },
    select: { orgId: true },
    orderBy: { joinedAt: "asc" },
  });
  const orgId = m?.orgId ?? null;
  orgCache.set(userId, orgId);
  return orgId;
}