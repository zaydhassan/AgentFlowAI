-- Long-Term AI Memory Engine (PostgreSQL + pgvector). Provider-agnostic memory
-- store: one Memory row per remembered fact/exchange, with the embedding vector
-- in a separate Embedding row. Vectors are read/written via prisma.$queryRaw
-- (the `vector` column is Unsupported() in Prisma). Memory is isolated per owner
-- (ownerId) and optionally per workspace (orgId); the API layer NEVER returns the
-- vector. Additive only — no existing table is touched.

-- pgvector extension provides the `vector` type + cosine distance operator `<=>`.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "Memory" (
    "id"              TEXT NOT NULL,
    "ownerId"         TEXT NOT NULL,
    "orgId"           TEXT,
    "workflowId"      TEXT,
    "agentId"         TEXT,
    "collectionId"    TEXT,
    "scope"           TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'active',
    "content"         TEXT NOT NULL,
    "contentHash"     TEXT NOT NULL,
    "importanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "accessCount"     INTEGER NOT NULL DEFAULT 0,
    "hitCount"        INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt"  TIMESTAMP(3),
    "expiresAt"       TIMESTAMP(3),
    "metadata"        JSONB,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    -- Full-text search vector over content, generated + stored for hybrid retrieval.
    "search"          TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED,

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Embedding" (
    "id"        TEXT NOT NULL,
    "memoryId"  TEXT NOT NULL,
    "vector"    vector(1536),
    "model"     TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "dims"      INTEGER NOT NULL DEFAULT 1536,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Embedding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemoryCollection" (
    "id"          TEXT NOT NULL,
    "ownerId"     TEXT NOT NULL,
    "orgId"       TEXT,
    "name"        TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemoryMetadata" (
    "id"        TEXT NOT NULL,
    "memoryId"  TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    "valueType" TEXT NOT NULL DEFAULT 'string',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryMetadata_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemoryEvent" (
    "id"        TEXT NOT NULL,
    "ownerId"   TEXT NOT NULL,
    "orgId"     TEXT,
    "kind"      TEXT NOT NULL,
    "scope"     TEXT NOT NULL,
    "memoryId"  TEXT,
    "score"     DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryEvent_pkey" PRIMARY KEY ("id")
);

-- Memory: dedup unique + listing/importance indexes + full-text GIN.
CREATE UNIQUE INDEX "Memory_ownerId_scope_contentHash_key"
    ON "Memory"("ownerId", "scope", "contentHash");
CREATE INDEX "Memory_ownerId_scope_updatedAt_idx"
    ON "Memory"("ownerId", "scope", "updatedAt");
CREATE INDEX "Memory_ownerId_importanceScore_idx"
    ON "Memory"("ownerId", "importanceScore");
CREATE INDEX "Memory_workflowId_idx" ON "Memory"("workflowId");
CREATE INDEX "Memory_agentId_idx" ON "Memory"("agentId");
CREATE INDEX "Memory_collectionId_idx" ON "Memory"("collectionId");
CREATE INDEX "Memory_metadata_idx" ON "Memory" USING GIN ("metadata");
CREATE INDEX "Memory_search_idx" ON "Memory" USING GIN ("search");

-- Embedding: HNSW for fast approximate cosine nearest-neighbour + memoryId lookup.
CREATE INDEX "Embedding_vector_idx" ON "Embedding" USING hnsw ("vector" vector_cosine_ops);
CREATE INDEX "Embedding_memoryId_idx" ON "Embedding"("memoryId");

-- MemoryCollection.
CREATE UNIQUE INDEX "MemoryCollection_ownerId_name_key"
    ON "MemoryCollection"("ownerId", "name");
CREATE INDEX "MemoryCollection_orgId_idx" ON "MemoryCollection"("orgId");

-- MemoryMetadata.
CREATE INDEX "MemoryMetadata_memoryId_key_idx" ON "MemoryMetadata"("memoryId", "key");
CREATE INDEX "MemoryMetadata_key_value_idx" ON "MemoryMetadata"("key", "value");

-- MemoryEvent.
CREATE INDEX "MemoryEvent_ownerId_createdAt_idx" ON "MemoryEvent"("ownerId", "createdAt");
CREATE INDEX "MemoryEvent_kind_idx" ON "MemoryEvent"("kind");

-- Foreign keys. Owner/workflow cascade; collection set null; embedding/metadata
-- cascade with their parent memory.
ALTER TABLE "Memory"
    ADD CONSTRAINT "Memory_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Memory"
    ADD CONSTRAINT "Memory_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Memory"
    ADD CONSTRAINT "Memory_collectionId_fkey"
    FOREIGN KEY ("collectionId") REFERENCES "MemoryCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Embedding"
    ADD CONSTRAINT "Embedding_memoryId_fkey"
    FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryCollection"
    ADD CONSTRAINT "MemoryCollection_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryMetadata"
    ADD CONSTRAINT "MemoryMetadata_memoryId_fkey"
    FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;