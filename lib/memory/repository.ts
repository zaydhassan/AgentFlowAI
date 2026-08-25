import "server-only";
import { Prisma } from "@prisma/client";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { getEmbeddingProvider } from "./embeddings";
import { enqueueEmbedding } from "@/lib/queue";
import type {
  Memory,
  MemoryCollection,
  MemoryHit,
  MemoryScope,
  MemoryStats,
  MemoryStatus,
  RetrievalFilters,
  RememberInput,
} from "./types";

type MemoryRow = {
  id: string;
  ownerId: string;
  orgId: string | null;
  workflowId: string | null;
  agentId: string | null;
  collectionId: string | null;
  scope: string;
  status: string;
  content: string;
  contentHash: string;
  importanceScore: Prisma.Decimal | number;
  accessCount: number;
  hitCount: number;
  lastAccessedAt: Date | null;
  expiresAt: Date | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  collection?: { id: string; name: string } | null;
};

type SearchRow = MemoryRow & { score: Prisma.Decimal | number };

/** SHA-256 of normalized content; the dedup key per (ownerId, scope). */
export function hashContent(content: string): string {
  const norm = content.trim().toLowerCase().replace(/\s+/g, " ");
  return crypto.createHash("sha256").update(norm, "utf8").digest("hex");
}

function num(n: Prisma.Decimal | number | null | undefined): number {
  if (n == null) return 0;
  return typeof n === "number" ? n : Number(n);
}

function toClient(row: MemoryRow): Memory {
  return {
    id: row.id,
    ownerId: row.ownerId,
    orgId: row.orgId,
    workflowId: row.workflowId,
    agentId: row.agentId,
    collectionId: row.collectionId,
    scope: row.scope as MemoryScope,
    status: row.status as MemoryStatus,
    content: row.content,
    contentHash: row.contentHash,
    importanceScore: num(row.importanceScore),
    accessCount: row.accessCount,
    hitCount: row.hitCount,
    lastAccessedAt: row.lastAccessedAt ? row.lastAccessedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    collection: row.collection ?? null,
  };
}

/** pgvector accepts the text form `[1,2,3]`; JSON.stringify of a number[] gives exactly that. */
function vectorLiteral(vec: number[]): string {
  const safe = vec.map((n) => (Number.isFinite(n) ? n : 0));
  return "[" + safe.join(",") + "]";
}

export const repository = {
  async findByHash(ownerId: string, scope: MemoryScope, contentHash: string): Promise<Memory | null> {
    const row = await prisma.memory.findUnique({
      where: { ownerId_scope_contentHash: { ownerId, scope, contentHash } },
      include: { collection: { select: { id: true, name: true } } },
    });
    return row ? toClient(row as unknown as MemoryRow) : null;
  },

  /** Insert a memory + its embedding (vector via raw SQL). Caller has already dedup-checked.
   *
   *  Embedding generation is QUEUED (non-blocking) via the background job queue
   *  when it is available: the memory row is written immediately and the vector
   *  is attached later by the MemoryEmbeddingWorker (lib/queue). When the queue
   *  is unavailable, the embedding is generated synchronously as a graceful
   *  fallback — identical to the pre-queue behavior. This is the ONLY change to
   *  the Memory Engine (replace synchronous embedding generation with queued
   *  execution); recall/manage are untouched. A memory whose embedding is still
   *  pending simply isn't returned by vector search until the worker attaches
   *  the vector (hybrid/FTS still find it). */
  async insertMemory(input: RememberInput & { contentHash: string }): Promise<Memory> {
    const provider = getEmbeddingProvider();
    if (!provider.configured) throw new Error("Embeddings not configured.");
    const metadata = (input.metadata ?? null) as Prisma.JsonObject | null;

    const row = await prisma.memory.create({
      data: {
        ownerId: input.userId,
        orgId: input.orgId ?? null,
        workflowId: input.workflowId ?? null,
        agentId: input.agentId ?? null,
        collectionId: input.collectionId ?? null,
        scope: input.scope,
        status: "active",
        content: input.content,
        contentHash: input.contentHash,
        importanceScore: input.importance ?? 0.5,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.DbNull,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
      include: { collection: { select: { id: true, name: true } } },
    });

    // Embedding generation: queue it (non-blocking) when the job queue is up;
    // otherwise generate synchronously (graceful fallback = pre-queue behavior).
    // The vector-INSERT SQL lives in attachEmbedding() — repository stays the
    // ONLY place the vector is touched, including when the worker calls it.
    const queued = await enqueueEmbedding(row.id, input.content);
    if (!queued) {
      const { vector, dims, model } = await provider.embedOne(input.content);
      await repository.attachEmbedding(row.id, vector, dims, model);
    }

    return toClient(row as unknown as MemoryRow);
  },

  /**
   * Attach an embedding vector to a memory row (the worker calls this after
   * generating the embedding off the request path). Idempotent: ON CONFLICT
   * ("memoryId") DO NOTHING on the unique memoryId, so a retried/duplicate job
   * never double-inserts. This is the ONLY vector-write path; insertMemory's
   * sync-fallback branch also goes through here.
   */
  async attachEmbedding(memoryId: string, vector: number[], dims: number, model: string): Promise<void> {
    const lit = vectorLiteral(vector);
    await prisma.$executeRaw`
      INSERT INTO "Embedding" ("id", "memoryId", "vector", "model", "dims", "createdAt")
      VALUES (${crypto.randomUUID()}, ${memoryId}, ${lit}::vector, ${model}, ${dims}, CURRENT_TIMESTAMP)
      ON CONFLICT ("memoryId") DO NOTHING
    `;
  },

  async touchAccess(id: string, hit: boolean): Promise<void> {
    await prisma.memory.update({
      where: { id },
      data: {
        accessCount: { increment: 1 },
        ...(hit ? { hitCount: { increment: 1 } } : {}),
        lastAccessedAt: new Date(),
      },
    });
  },

  async deleteMemory(id: string): Promise<void> {
    await prisma.memory.delete({ where: { id } });
  },

  async findById(id: string): Promise<Memory | null> {
    const row = await prisma.memory.findUnique({
      where: { id },
      include: { collection: { select: { id: true, name: true } } },
    });
    return row ? toClient(row as unknown as MemoryRow) : null;
  },

  async list(opts: {
    ownerId: string;
    scope?: MemoryScope;
    workflowId?: string;
    collectionId?: string;
    limit?: number;
  }): Promise<Memory[]> {
    const rows = await prisma.memory.findMany({
      where: {
        ownerId: opts.ownerId,
        status: "active",
        ...(opts.scope ? { scope: opts.scope } : {}),
        ...(opts.workflowId ? { workflowId: opts.workflowId } : {}),
        ...(opts.collectionId ? { collectionId: opts.collectionId } : {}),
      },
      include: { collection: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: opts.limit ?? 50,
    });
    return rows.map((r) => toClient(r as unknown as MemoryRow));
  },

  /** pgvector cosine semantic search. Returns hits with similarity score, newest-first tiebreak. */
  async search(args: {
    userId: string;
    orgId?: string | null;
    scope: MemoryScope;
    queryVector: number[];
    topK: number;
    threshold: number;
    workflowId?: string | null;
    agentId?: string | null;
    filters?: RetrievalFilters;
  }): Promise<MemoryHit[]> {
    const vec = vectorLiteral(args.queryVector);
    const conds: Prisma.Sql[] = [
      Prisma.sql`m."ownerId" = ${args.userId}`,
      Prisma.sql`m."scope" = ${args.scope}`,
      Prisma.sql`m."status" = 'active'`,
    ];
    if (args.scope === "workspace" && args.orgId) conds.push(Prisma.sql`m."orgId" = ${args.orgId}`);
    if (args.workflowId) conds.push(Prisma.sql`m."workflowId" = ${args.workflowId}`);
    if (args.agentId) conds.push(Prisma.sql`m."agentId" = ${args.agentId}`);
    if (args.filters?.collectionId) conds.push(Prisma.sql`m."collectionId" = ${args.filters.collectionId}`);
    if (args.filters?.minImportance != null) conds.push(Prisma.sql`m."importanceScore" >= ${args.filters.minImportance}`);
    if (args.filters?.since) conds.push(Prisma.sql`m."createdAt" >= ${new Date(args.filters.since)}`);
    if (args.filters?.metadata) {
      conds.push(Prisma.sql`m."metadata" @> ${args.filters.metadata as unknown as Prisma.JsonObject}::jsonb`);
    }
    const where = Prisma.join(conds, " AND ");

    // Pull a wider net then threshold-filter in JS (HNSW uses the ORDER BY).
    const fetchK = args.topK * 3;
    const rows = await prisma.$queryRaw<SearchRow[]>`
      SELECT m.*, 1 - (e."vector" <=> ${vec}::vector) AS score
      FROM "Embedding" e
      JOIN "Memory" m ON m."id" = e."memoryId"
      WHERE ${where}
      ORDER BY e."vector" <=> ${vec}::vector, m."updatedAt" DESC
      LIMIT ${fetchK}
    `;

    const hits: MemoryHit[] = [];
    for (let i = 0; i < rows.length; i++) {
      const score = num(rows[i].score);
      if (score < args.threshold) continue;
      hits.push({ memory: toClient(rows[i]), score, rank: hits.length + 1 });
      if (hits.length >= args.topK) break;
    }
    return hits;
  },

  /** Find near-duplicates (cosine > mergeThreshold) within scope, for the merge pass. */
  async findSimilar(args: { userId: string; scope: MemoryScope; memoryId: string; threshold: number; limit?: number }): Promise<{ id: string; score: number }[]> {
    // The vector column is Unsupported() — fetch it via raw SQL as text, recast in the query.
    const targetRows = await prisma.$queryRaw<{ vector: string }[]>`
      SELECT vector::text AS vector FROM "Embedding" WHERE "memoryId" = ${args.memoryId}
    `;
    if (targetRows.length === 0) return [];
    const vec = targetRows[0].vector;
    const rows = await prisma.$queryRaw<{ id: string; score: number }[]>`
      SELECT m."id" AS id, 1 - (e."vector" <=> ${vec}::vector) AS score
      FROM "Embedding" e
      JOIN "Memory" m ON m."id" = e."memoryId"
      WHERE m."ownerId" = ${args.userId} AND m."scope" = ${args.scope} AND m."status" = 'active'
        AND m."id" <> ${args.memoryId}
        AND 1 - (e."vector" <=> ${vec}::vector) >= ${args.threshold}
      ORDER BY e."vector" <=> ${vec}::vector
      LIMIT ${args.limit ?? 10}
    `;
    return rows.map((r) => ({ id: r.id, score: num(r.score) }));
  },

  /** Full-text search over the generated `search` tsvector (for hybrid retrieval). */
  async ftsSearch(args: {
    userId: string;
    orgId?: string | null;
    scope: MemoryScope;
    query: string;
    topK: number;
    workflowId?: string | null;
    agentId?: string | null;
    filters?: RetrievalFilters;
  }): Promise<{ memory: Memory; score: number }[]> {
    const conds: Prisma.Sql[] = [
      Prisma.sql`m."ownerId" = ${args.userId}`,
      Prisma.sql`m."scope" = ${args.scope}`,
      Prisma.sql`m."status" = 'active'`,
    ];
    if (args.scope === "workspace" && args.orgId) conds.push(Prisma.sql`m."orgId" = ${args.orgId}`);
    if (args.workflowId) conds.push(Prisma.sql`m."workflowId" = ${args.workflowId}`);
    if (args.agentId) conds.push(Prisma.sql`m."agentId" = ${args.agentId}`);
    if (args.filters?.collectionId) conds.push(Prisma.sql`m."collectionId" = ${args.filters.collectionId}`);
    if (args.filters?.minImportance != null) conds.push(Prisma.sql`m."importanceScore" >= ${args.filters.minImportance}`);
    if (args.filters?.since) conds.push(Prisma.sql`m."createdAt" >= ${new Date(args.filters.since)}`);
    const where = Prisma.join(conds, " AND ");
    const tsq = args.query.trim();
    const rows = await prisma.$queryRaw<SearchRow[]>`
      SELECT m.*, ts_rank(m."search", plainto_tsquery('english', ${tsq})) AS score
      FROM "Memory" m
      WHERE ${where} AND m."search" @@ plainto_tsquery('english', ${tsq})
      ORDER BY ts_rank(m."search", plainto_tsquery('english', ${tsq})) DESC
      LIMIT ${args.topK}
    `;
    return rows.map((r) => ({ memory: toClient(r), score: num(r.score) }));
  },

  async listForManage(userId: string, scope?: MemoryScope): Promise<{ id: string; scope: string; importanceScore: number; hitCount: number; accessCount: number; createdAt: Date }[]> {
    const rows = await prisma.memory.findMany({
      where: { ownerId: userId, status: "active", ...(scope ? { scope } : {}) },
      select: { id: true, scope: true, importanceScore: true, hitCount: true, accessCount: true, createdAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      scope: r.scope,
      importanceScore: num(r.importanceScore),
      hitCount: r.hitCount,
      accessCount: r.accessCount,
      createdAt: r.createdAt,
    }));
  },

  async mergeInto(keepId: string, dropId: string): Promise<void> {
    // Keep the higher-importance memory; fold the drop's access/hit counts in,
    // mark it merged, delete its embedding (frees the vector row).
    await prisma.$transaction([
      prisma.memory.update({
        where: { id: keepId },
        data: { accessCount: { increment: 0 }, hitCount: { increment: 0 } },
      }),
      prisma.memory.update({
        where: { id: dropId },
        data: { status: "merged" },
      }),
    ]);
    const drop = await prisma.memory.findUnique({ where: { id: dropId }, select: { accessCount: true, hitCount: true } });
    if (drop) {
      await prisma.memory.update({
        where: { id: keepId },
        data: { accessCount: { increment: drop.accessCount }, hitCount: { increment: drop.hitCount } },
      });
    }
    await prisma.embedding.deleteMany({ where: { memoryId: dropId } }).catch(() => {});
  },

  async setStatus(id: string, status: MemoryStatus): Promise<void> {
    await prisma.memory.update({ where: { id }, data: { status } });
  },

  async setImportance(id: string, importanceScore: number): Promise<void> {
    await prisma.memory.update({ where: { id }, data: { importanceScore } });
  },

  async listCollections(ownerId: string): Promise<MemoryCollection[]> {
    const rows = await prisma.memoryCollection.findMany({
      where: { ownerId },
      include: { _count: { select: { memories: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      ownerId: r.ownerId,
      orgId: r.orgId,
      name: r.name,
      description: r.description,
      createdAt: r.createdAt.toISOString(),
      memoryCount: r._count.memories,
    }));
  },

  async createCollection(ownerId: string, name: string, description?: string): Promise<MemoryCollection> {
    const row = await prisma.memoryCollection.create({
      data: { ownerId, name, description: description ?? "" },
      include: { _count: { select: { memories: true } } },
    });
    return {
      id: row.id,
      ownerId: row.ownerId,
      orgId: row.orgId,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
      memoryCount: 0,
    };
  },

  async deleteCollection(id: string): Promise<void> {
    // Memories reference it with onDelete: SetNull, so this just removes the grouping.
    await prisma.memoryCollection.delete({ where: { id } });
  },

  async findCollection(ownerId: string, id: string): Promise<MemoryCollection | null> {
    const row = await prisma.memoryCollection.findUnique({
      where: { id },
      include: { _count: { select: { memories: true } } },
    });
    if (!row || row.ownerId !== ownerId) return null;
    return {
      id: row.id,
      ownerId: row.ownerId,
      orgId: row.orgId,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
      memoryCount: row._count.memories,
    };
  },

  async recordEvent(input: { ownerId: string; orgId?: string | null; kind: string; scope: string; memoryId?: string | null; score?: number | null }): Promise<void> {
    await prisma.memoryEvent.create({
      data: {
        ownerId: input.ownerId,
        orgId: input.orgId ?? null,
        kind: input.kind,
        scope: input.scope,
        memoryId: input.memoryId ?? null,
        score: input.score ?? null,
      },
    });
  },

  async stats(ownerId: string): Promise<MemoryStats> {
    const [byScopeRows, eventRows, collections, storeSizeRows] = await Promise.all([
      prisma.memory.groupBy({ by: ["scope"], where: { ownerId, status: "active" }, _count: true }),
      prisma.memoryEvent.groupBy({ by: ["kind"], where: { ownerId }, _count: true }),
      prisma.memoryCollection.count({ where: { ownerId } }),
      prisma.$queryRaw<{ bytes: bigint }[]>`SELECT COALESCE(SUM(octet_length("content")), 0)::bigint AS bytes FROM "Memory" WHERE "ownerId" = ${ownerId} AND "status" = 'active'`,
    ]);

    const byScope: Record<string, number> = {};
    let total = 0;
    for (const r of byScopeRows) {
      byScope[r.scope] = r._count;
      total += r._count;
    }
    const counts: Record<string, number> = {};
    for (const r of eventRows) counts[r.kind] = r._count;
    const writes = counts.write ?? 0;
    const hits = counts.hit ?? 0;
    const misses = counts.miss ?? 0;
    const recallDenom = hits + misses;

    return {
      total,
      byScope,
      writes,
      hits,
      misses,
      recallRate: recallDenom > 0 ? hits / recallDenom : 0,
      collections,
      storeSizeBytes: Number(storeSizeRows[0]?.bytes ?? 0),
    };
  },
};