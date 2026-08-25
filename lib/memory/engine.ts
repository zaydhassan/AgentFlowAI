import "server-only";
import { embeddingConfigured } from "./embeddings";
import { retrieve, invalidateCache } from "./retrieval";
import { repository, hashContent } from "./repository";
import type {
  ManageResult,
  MemoryEngine,
  MemoryScope,
  RememberInput,
  RememberResult,
  RetrievalRequest,
  RetrievalResult,
} from "./types";

const MERGE_THRESHOLD = 0.92;
const EXPIRE_IMPORTANCE = 0.3;
const EXPIRE_AGE_DAYS = 30;
const PROMOTE_HIT_THRESHOLD = 10;
const PROMOTE_BUMP = 0.1;
const MANAGE_BUDGET_MS = 4000;

export const memoryEngine: MemoryEngine = {
  async recall(req: RetrievalRequest): Promise<RetrievalResult> {
    if (!embeddingConfigured()) return { hits: [], total: 0, cacheHit: false };

    const result = await retrieve(req);
    void repository
      .recordEvent({ ownerId: req.userId, orgId: req.orgId ?? null, kind: "retrieve", scope: req.scope })
      .catch(() => {});

    if (result.hits.length === 0) {
      void repository
        .recordEvent({ ownerId: req.userId, orgId: req.orgId ?? null, kind: "miss", scope: req.scope })
        .catch(() => {});
      return result;
    }

    for (const hit of result.hits) {
      void repository.recordEvent({
        ownerId: req.userId,
        orgId: req.orgId ?? null,
        kind: "hit",
        scope: req.scope,
        memoryId: hit.memory.id,
        score: hit.score,
      }).catch(() => {});
      void repository.touchAccess(hit.memory.id, true).catch(() => {});
    }
    return result;
  },

  async remember(input: RememberInput): Promise<RememberResult> {
    if (!embeddingConfigured()) return { memory: null, deduplicated: false };

    const contentHash = hashContent(input.content);
    const existing = await repository.findByHash(input.userId, input.scope, contentHash);
    if (existing) {
      // Duplicate within scope — touch it (bump access) instead of re-writing.
      void repository.touchAccess(existing.id, false).catch(() => {});
      void repository
        .recordEvent({ ownerId: input.userId, orgId: input.orgId ?? null, kind: "write", scope: input.scope, memoryId: existing.id })
        .catch(() => {});
      return { memory: existing, deduplicated: true };
    }

    const memory = await repository.insertMemory({ ...input, contentHash });
    invalidateCache();
    void repository
      .recordEvent({ ownerId: input.userId, orgId: input.orgId ?? null, kind: "write", scope: input.scope, memoryId: memory.id })
      .catch(() => {});
    return { memory, deduplicated: false };
  },

  async manage(userId: string): Promise<ManageResult> {
    const t0 = Date.now();
    const out: ManageResult = { merged: 0, expired: 0, promoted: 0 };

    if (!embeddingConfigured()) return out;

    const memories = await repository.listForManage(userId);
    const now = Date.now();
    const expireAgeMs = EXPIRE_AGE_DAYS * 24 * 60 * 60 * 1000;

    for (const m of memories) {
      if (Date.now() - t0 > MANAGE_BUDGET_MS) break;

      if (m.hitCount > PROMOTE_HIT_THRESHOLD && m.importanceScore < 1.0) {
        const next = Math.min(1.0, m.importanceScore + PROMOTE_BUMP);
        await repository.setImportance(m.id, next);
        void repository.recordEvent({ ownerId: userId, kind: "promote", scope: "", memoryId: m.id }).catch(() => {});
        out.promoted++;
        continue;
      }

      if (
        m.importanceScore < EXPIRE_IMPORTANCE &&
        m.accessCount === 0 &&
        now - m.createdAt.getTime() > expireAgeMs
      ) {
        await repository.setStatus(m.id, "expired");
        void repository.recordEvent({ ownerId: userId, kind: "expire", scope: "", memoryId: m.id }).catch(() => {});
        out.expired++;
        continue;
      }

      // Merge near-duplicates (only check higher-importance memories to bound work).
      if (m.importanceScore >= 0.6) {
        const similar = await repository.findSimilar({ userId, scope: m.scope as MemoryScope, memoryId: m.id, threshold: MERGE_THRESHOLD, limit: 1 });
        if (similar.length > 0) {
          await repository.mergeInto(m.id, similar[0].id);
          void repository.recordEvent({ ownerId: userId, kind: "merge", scope: m.scope, memoryId: m.id }).catch(() => {});
          out.merged++;
        }
      }
    }

    if (out.merged > 0 || out.expired > 0) invalidateCache();
    return out;
  },
};