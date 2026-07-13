// Retrieval pipeline: embed query → pgvector cosine search → metadata/threshold
// filter → rank → optional hybrid re-rank (semantic + full-text via reciprocal
// rank fusion) → MemoryHit[] (content + score, never the vector). Includes an
// in-process LRU cache keyed by hash(query+scope+filters) with a short TTL —
// repeated retrievals within a run are cheap.
//
// Server-only.

import "server-only";
import crypto from "node:crypto";
import { getEmbeddingProvider } from "./embeddings";
import { repository } from "./repository";
import type { MemoryHit, RetrievalRequest, RetrievalResult } from "./types";

const TOP_K = Number(process.env.MEMORY_TOP_K ?? 5);
const THRESHOLD = Number(process.env.MEMORY_SIMILARITY_THRESHOLD ?? 0.75);
const RRF_K = 60; // standard reciprocal-rank-fusion constant

// ─────────────────────────── LRU cache ──────────────────────────────────────

interface CacheEntry { result: RetrievalResult; expiresAt: number }
const CACHE_MAX = 256;
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

function cacheKey(req: RetrievalRequest): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        q: req.query,
        s: req.scope,
        u: req.userId,
        o: req.orgId ?? null,
        w: req.workflowId ?? null,
        a: req.agentId ?? null,
        k: req.topK ?? TOP_K,
        t: req.threshold ?? THRESHOLD,
        f: req.filters ?? null,
        h: req.hybrid ?? false,
      }),
    )
    .digest("hex");
}

function cacheGet(key: string): RetrievalResult | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    cache.delete(key);
    return null;
  }
  // Move-to-end (LRU recency).
  cache.delete(key);
  cache.set(key, e);
  return e.result;
}

function cacheSet(key: string, result: RetrievalResult): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─────────────────────────── reciprocal rank fusion ────────────────────────

function rrf(semantic: MemoryHit[], fts: { memory: { id: string }; score: number }[], topK: number): MemoryHit[] {
  const semRank = new Map<string, number>(); // 1-based rank
  semantic.forEach((h, i) => semRank.set(h.memory.id, i + 1));
  const ftsRank = new Map<string, number>();
  fts.forEach((f, i) => ftsRank.set(f.memory.id, i + 1));

  const ids = new Set<string>([...semRank.keys(), ...ftsRank.keys()]);
  const scored: { id: string; score: number; sem?: MemoryHit }[] = [];
  for (const id of ids) {
    const r1 = semRank.get(id);
    const r2 = ftsRank.get(id);
    const fused = (r1 ? 1 / (RRF_K + r1) : 0) + (r2 ? 1 / (RRF_K + r2) : 0);
    const sem = semantic.find((h) => h.memory.id === id);
    scored.push({ id, score: fused, sem });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, topK)
    .map((s, i) => ({
      memory: s.sem?.memory ?? ({ id: s.id } as MemoryHit["memory"]), // FTS-only hit: fetch handled by caller
      score: s.score,
      rank: i + 1,
    }));
}

// ─────────────────────────── public API ─────────────────────────────────────

export async function retrieve(req: RetrievalRequest): Promise<RetrievalResult> {
  const topK = req.topK ?? TOP_K;
  const threshold = req.threshold ?? THRESHOLD;

  const key = cacheKey(req);
  const cached = cacheGet(key);
  if (cached) return { ...cached, cacheHit: true };

  const provider = getEmbeddingProvider();
  if (!provider.configured) {
    return { hits: [], total: 0, cacheHit: false };
  }

  // Semantic: embed + pgvector cosine.
  const { vector } = await provider.embedOne(req.query);
  const semantic = await repository.search({
    userId: req.userId,
    orgId: req.orgId,
    scope: req.scope,
    queryVector: vector,
    topK,
    threshold,
    workflowId: req.workflowId,
    agentId: req.agentId,
    filters: req.filters,
  });

  let hits = semantic;

  if (req.hybrid) {
    const fts = await repository.ftsSearch({
      userId: req.userId,
      orgId: req.orgId,
      scope: req.scope,
      query: req.query,
      topK: topK * 2,
      workflowId: req.workflowId,
      agentId: req.agentId,
      filters: req.filters,
    });
    if (fts.length > 0) {
      // FTS may surface memories the semantic pass missed; fetch any FTS-only
      // memories so the fused result carries full content.
      const semIds = new Set(semantic.map((h) => h.memory.id));
      const ftsOnly = fts.filter((f) => !semIds.has(f.memory.id));
      const fused = rrf(
        semantic,
        fts.map((f) => ({ memory: { id: f.memory.id }, score: f.score })),
        topK,
      );
      hits = fused.map((h) => {
        const sem = semantic.find((s) => s.memory.id === h.memory.id);
        if (sem) return { memory: sem.memory, score: h.score, rank: h.rank };
        const ftsHit = ftsOnly.find((f) => f.memory.id === h.memory.id);
        return ftsHit ? { memory: ftsHit.memory, score: h.score, rank: h.rank } : h;
      });
    }
  }

  const result: RetrievalResult = { hits, total: hits.length, cacheHit: false };
  cacheSet(key, result);
  return result;
}

/** Clear the in-process retrieval cache (e.g. after a memory write in the same process). */
export function invalidateCache(): void {
  cache.clear();
}