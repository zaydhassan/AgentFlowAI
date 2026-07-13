// Pure types for the Long-Term AI Memory engine. No runtime, no server-only —
// safe to import from client and server. Mirrors the lib/payments/types.ts +
// lib/integrations/types.ts pattern: the client-safe shapes (Memory,
// MemoryCollection, MemoryHit) NEVER include the embedding vector; the server
// shapes (StoredMemory) are server-only and carry plaintext vectors in-memory.
//
// The memory engine is provider-agnostic: the swappable seam is
// EmbeddingProvider (OpenAI today; Voyage/Cohere/local later). The vector store
// is PostgreSQL + pgvector (fixed by design — no Pinecone); access lives in
// repository.ts via prisma.$queryRaw.

/** The six memory types from the brief, modelled as retrieval/write scopes. */
export type MemoryScope =
  | "short_term"
  | "conversation"
  | "long_term"
  | "workflow"
  | "agent"
  | "workspace";

export type MemoryStatus = "active" | "expired" | "merged";

export type EventKind =
  | "retrieve"
  | "write"
  | "hit"
  | "miss"
  | "merge"
  | "expire"
  | "promote";

export type EmbeddingProviderId = "openai"; // | "voyage" | "cohere" | "local" later

// ─────────────────────────── client-safe shapes ────────────────────────────
// These are the ONLY shapes returned to the browser. No vector, ever.

export interface Memory {
  id: string;
  ownerId: string;
  orgId: string | null;
  workflowId: string | null;
  agentId: string | null;
  collectionId: string | null;
  scope: MemoryScope;
  status: MemoryStatus;
  content: string;
  contentHash: string;
  importanceScore: number;
  accessCount: number;
  hitCount: number;
  lastAccessedAt: string | null; // ISO
  expiresAt: string | null; // ISO
  metadata: Record<string, unknown> | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  collection?: { id: string; name: string } | null;
}

export interface MemoryCollection {
  id: string;
  ownerId: string;
  orgId: string | null;
  name: string;
  description: string;
  createdAt: string; // ISO
  memoryCount: number;
}

export interface MemoryHit {
  memory: Memory;
  /** Cosine similarity in [0,1] (1 - cosine distance). */
  score: number;
  /** Rank within the result set (1-based). */
  rank: number;
}

// ─────────────────────────── request / result types ────────────────────────

export interface RetrievalFilters {
  /** Filter by minimum importance. */
  minImportance?: number;
  /** Filter by collection. */
  collectionId?: string;
  /** Arbitrary Jsonb metadata match (e.g. { tags: ["sales"] }). */
  metadata?: Record<string, unknown>;
  /** Only memories created after this ISO date. */
  since?: string;
}

export interface RetrievalRequest {
  userId: string;
  orgId?: string | null;
  scope: MemoryScope;
  query: string;
  workflowId?: string | null;
  agentId?: string | null;
  topK?: number;
  threshold?: number;
  filters?: RetrievalFilters;
  /** Blend semantic + full-text via reciprocal rank fusion (default false). */
  hybrid?: boolean;
}

export interface RetrievalResult {
  hits: MemoryHit[];
  total: number;
  cacheHit: boolean;
}

export interface RememberInput {
  userId: string;
  orgId?: string | null;
  scope: MemoryScope;
  content: string;
  importance?: number;
  workflowId?: string | null;
  agentId?: string | null;
  collectionId?: string | null;
  metadata?: Record<string, unknown>;
  expiresAt?: string | null;
}

export interface RememberResult {
  memory: Memory | null;
  /** True when a duplicate (same contentHash in scope) already existed and was touched instead. */
  deduplicated: boolean;
}

export interface MemoryStats {
  total: number;
  byScope: Record<string, number>;
  writes: number;
  hits: number;
  misses: number;
  recallRate: number;
  collections: number;
  storeSizeBytes: number;
}

export interface ManageResult {
  merged: number;
  expired: number;
  promoted: number;
}

// ─────────────────────────── provider interfaces ───────────────────────────

export interface EmbeddingVector {
  vector: number[];
  dims: number;
  model: string;
}

/** Swappable embedding provider. OpenAI today; add Voyage/Cohere/local later. */
export interface EmbeddingProvider {
  readonly id: EmbeddingProviderId;
  readonly model: string;
  readonly dims: number;
  readonly configured: boolean;
  /** Embed a batch of texts (single API call when the provider supports it). */
  embedBatch(texts: string[]): Promise<EmbeddingVector[]>;
  /** Convenience for a single text. */
  embedOne(text: string): Promise<EmbeddingVector>;
}

/** High-level memory engine — the single surface the execution engine + API routes call. */
export interface MemoryEngine {
  recall(req: RetrievalRequest): Promise<RetrievalResult>;
  remember(input: RememberInput): Promise<RememberResult>;
  manage(userId: string): Promise<ManageResult>;
}