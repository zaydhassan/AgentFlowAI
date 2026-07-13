# Memory Engine — Migration Report

Production-grade Long-Term AI Memory for AgentFlow AI. This report documents the
schema, the storage/retrieval design, the security model, and the provider-swap
path. The memory engine integrates into the existing execution engine so AI
nodes that opt in **retrieve → inject → generate a real response → store** on
every run, and persist permanently.

## 1. What changed

**New (`lib/memory/`)** — a provider-agnostic Memory Engine mirroring the proven
`lib/payments/` + `lib/integrations/` pattern (`types → providers → repository →
facade → client`):

| File | Role |
|---|---|
| `types.ts` | Pure, client-safe types (`Memory`, `MemoryHit`, `MemoryCollection` — **no vector**); `MemoryScope`, `EmbeddingProvider` + `MemoryEngine` interfaces. |
| `embeddings.ts` | `OpenAIEmbeddingProvider` — fetch to `/v1/embeddings` (no SDK), batches of 64, model `text-embedding-3-small` (1536 dims), reuses `OPENAI_API_KEY`. Registry + `getEmbeddingProvider()` + `embeddingConfigured()`. |
| `repository.ts` | **Sole Prisma access** and the only place the vector is touched. Inserts/searches via `prisma.$queryRaw` (parameterized). `toClient()` strips the vector on the way out. |
| `retrieval.ts` | Pipeline: embed query → pgvector cosine → threshold filter → optional hybrid re-rank via **Reciprocal Rank Fusion** (RRF, k=60) over a generated `tsvector`. In-process LRU cache (256 entries, 60s TTL). |
| `engine.ts` | `MemoryEngine` facade: `recall` (retrieve + record hit/miss + touch access), `remember` (SHA-256 dedup → write), `manage` (merge/expire/promote, time-budgeted 4s). No-ops cleanly when embeddings unconfigured — **never fakes embeddings**. |
| `index.ts` | Server facade: re-exports + `memoryConfigured()` + `resolveOrgId(userId)` (cached membership lookup). |
| `client.ts` | `"use client"` dashboard helpers (fetch-based against `/api/memory/*`). Re-exports client-safe types. |

**New API routes (`app/api/memory/`)** — all `apiUser()`-guarded, ownership-checked
by `userId`, **never return vectors**:

- `GET/POST /api/memory` — list (or semantic search via `?q=`) / create.
- `DELETE /api/memory/[id]` — owner-only delete.
- `POST /api/memory/search` — semantic search → `MemoryHit[]` (content + score, no vector).
- `GET /api/memory/stats` — KPIs `{total, byScope, writes, hits, misses, recallRate, collections, storeSizeBytes}`.
- `GET/POST /api/memory/collections`, `DELETE /api/memory/collections/[id]`.
- `POST /api/memory/manage` — run maintenance → `{merged, expired, promoted}`.

**New UI:** `components/memory/memory-dashboard.tsx` — KPIs, semantic search, add/
delete memory, collections, run-maintenance. **Never renders embeddings.**

**Surgical/additive modifications:**
- `prisma/schema.prisma` — 5 new models + `memories`/`memoryCollections` on `User`, `memories` on `Workflow` (cascade). No existing model altered.
- `prisma/migrations/20260714000000_memory_engine/migration.sql` — additive only.
- `lib/execution/engine.ts` — new memory-aware AI branch (before the integration-action / simulation paths; those are unchanged) + `RunControls.workflowId`/`orgId`.
- `app/api/workflows/[id]/run/route.ts` — passes `workflowId` + `orgId` (via `resolveOrgId`) into the engine.
- `lib/ai/provider.ts` — `+completeText(system, user, signal?)` (real LLM, or deterministic fallback; never a mock).
- `lib/ai/deterministic.ts` — `+deterministicComplete(system, user)` (the shipped offline fallback, labelled as such).
- `lib/nodes.ts` — 3 config fields (`useMemory`, `memoryScope`, `memoryImportance`) appended to each of the 7 `category:"ai"` nodes; `useMemory: false` added to existing `defaultConfig`s. No new `ConfigFieldType`.
- `app/(app)/ai/memory/page.tsx` — mock client page → real server component (already sidebar-linked; no nav change).
- `.env.example` — appended Memory section.

**Untouched (per constraints):** Billing, Gmail Integration, Authentication,
Payment System, Workflow Builder UI. The builder's generic inspector renders
the three new config fields with no inspector/validator change.

## 2. Database schema

Five new tables; no existing table touched. `CREATE EXTENSION IF NOT EXISTS vector;`
runs first (requires the `vector` extension and `CREATE` privilege on the DB —
see §7).

### `Memory`
One remembered fact/exchange. `ownerId` (FK→User CASCADE), `orgId String?`,
`workflowId String?` (FK→Workflow CASCADE), `agentId String?` (node id, **no FK** —
mirrors `ExecutionStep.nodeId`), `collectionId String?` (FK→MemoryCollection SET
NULL), `scope`, `status` (`active`/`expired`/`merged`), `content Text`,
`contentHash` (SHA-256), `importanceScore Double @default(0.5)`, `accessCount`,
`hitCount`, `lastAccessedAt`, `expiresAt`, `metadata Json`, timestamps.
- `@@unique([ownerId, scope, contentHash])` — dedup key per (owner, scope).
- `@@index([ownerId, scope, updatedAt])`, `@@index([ownerId, importanceScore])`,
  `@@index([workflowId])`, `@@index([agentId])`, GIN on `metadata`.
- Generated column: `"search" TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', coalesce(content,''))) STORED`, with a GIN index — powers hybrid full-text retrieval.

### `Embedding`
`memoryId` (FK→Memory CASCADE, `@unique`), `vector Unsupported("vector(1536)")`,
`model`, `dims @default(1536)`, `createdAt`.
- **HNSW** index `USING hnsw (vector vector_cosine_ops)` — approximate nearest
  neighbor for cosine similarity. Plus `@@index([memoryId])`.
- Separate from `Memory` so a memory can later hold multiple chunk embeddings
  without a schema change.

### `MemoryCollection`
Named grouping ("customer-faq"). `ownerId` (FK→User CASCADE), `orgId?`, `name`,
`description @default("")`, `createdAt`. `@@unique([ownerId, name])`.

### `MemoryMetadata`
Structured key/value (the brief's explicit model). `memoryId` (FK→Memory CASCADE),
`key`, `value`, `valueType @default("string")`, `createdAt`.
`@@index([memoryId, key])`, `@@index([key, value])`.

### `MemoryEvent`
Observability/audit (powers hits/misses/writes/recall-rate KPIs). `ownerId`,
`orgId?`, `kind` (`retrieve`/`write`/`hit`/`miss`/`merge`/`expire`/`promote`),
`scope`, `memoryId?`, `score Double?`, `createdAt`.
`@@index([ownerId, createdAt])`, `@@index([kind])`.

## 3. Why `Unsupported("vector(1536)")` + raw SQL

Prisma's typed client cannot natively represent pgvector's `vector` type without
preview flags. Declaring the column `Unsupported("vector(1536)")` lets Prisma
generate the model (so `prisma.memory.*` works for all scalar fields) while
**all vector reads/writes go through `prisma.$queryRaw` / `$executeRaw` with
parameterized SQL**. The vector is bound as its text literal (`[1,2,3]`) then cast
to `::vector` — it is never interpolated as raw SQL, so it is injection-safe. The
typed client is never asked to select the `vector` column (it can't); `findSimilar`
fetches the vector via raw SQL as text instead.

## 4. Retrieval design

`recall(req)` in `retrieval.ts`:
1. Embed the query via the provider (`embedOne`).
2. pgvector cosine search: `1 - (e."vector" <=> $vec::vector) AS score`, ordered by
   `<=>` distance, fetch `topK * 3` then threshold-filter in JS (HNSW uses the
   `ORDER BY` distance for the index).
3. Filters: always `ownerId = userId` (isolation), plus scope context
   (`workflowId` / `agentId` / `orgId` for `workspace`), plus optional
   `collectionId` / `minImportance` / `since` / `metadata @> jsonb.
4. Optional **hybrid**: full-text search via `ts_rank(plainto_tsquery(...))` over
   the generated `search` tsvector, fused with semantic ranks via **Reciprocal
   Rank Fusion** (`score = Σ 1/(k + rank)`, k=60).
5. LRU cache keyed by `SHA-256(query + scope + filters)`, 256 entries, 60s TTL,
   move-to-end on hit. `invalidateCache()` is called on every new write.

## 5. Memory management (`manage`)

Time-budgeted to 4s per pass (`MANAGE_BUDGET_MS`), invoked by
`POST /api/memory/manage` and fire-and-forget best-effort after a write.
- **Dedup** — inline on write: `SHA-256(normalized content)` per `(ownerId, scope)`
  via `@@unique`; a duplicate is touched (access bumped) instead of re-written.
- **Promote** — `hitCount > 10` and `importanceScore < 1.0` → `+0.1` (cap 1.0).
- **Expire** — `importanceScore < 0.3 && accessCount == 0 && age > 30d` →
  `status = "expired"` (excluded from retrieval; kept for audit).
- **Merge** — `importanceScore >= 0.6` → `findSimilar` (cosine ≥ 0.92) within scope;
  keep the higher-importance memory, fold the other's access/hit counts, mark it
  `merged`, delete its embedding row (frees the vector).

## 6. Security model

- **Workspace isolation:** every retrieval/list/search is filtered by
  `ownerId = userId`. `workspace` scope additionally filters by `orgId` resolved
  via `resolveOrgId` (cached membership lookup). A second user's memories are
  invisible (the API routes return 404 for cross-owner deletes, never 403, to
  avoid leaking existence).
- **Embeddings never exposed:** the client-safe `Memory`/`MemoryHit`/`MemoryCollection`
  shapes have no vector field. `toClient()` strips it. The dashboard and all API
  routes only ever return these shapes.
- **Raw SQL is parameterized:** the vector literal is the only "raw-ish" input and
  it is a number-array literal bound as a parameter then cast — never string-interpolated.
- **`agentId` has no FK** (matches `ExecutionStep.nodeId`): node ids are ephemeral
  graph identifiers, not rows, so no dangling-FK risk when a workflow is deleted.
  `workflowId` is a FK with `onDelete: Cascade` (a deleted workflow's `workflow`/
  `agent` scoped memories go with it, which is the correct semantics).

## 7. Operations

- **Applying the migration:** `npx prisma migrate deploy` applies
  `20260714000000_memory_engine`. `CREATE EXTENSION vector` requires a role with
  `CREATE` privilege on the database (or a superuser). On managed Postgres
  (RDS/Supabase/Neon) ensure the `vector` extension is available and the deploy
  role can create extensions. The migration is idempotent (`IF NOT EXISTS`).
- **Additive guarantee:** no existing table is altered; existing rows are
  untouched. Rolling back drops the five new tables + the extension (the
  extension can be dropped with `DROP EXTENSION vector` once no vector columns
  remain).
- **Fixed dimension tradeoff:** the column is `vector(1536)` (OpenAI
  `text-embedding-3-small`). Switching to a different-dimension model (e.g. a
  768-dim Voyage model) requires a migration to resize the column + HNSW index and
  a full re-embed of all memories (the `Embedding` row carries `model` + `dims`
  for traceability). The provider seam (`EmbeddingProvider`) means the engine and
  execution code need no changes — only a new provider + a re-embed migration.

## 8. Provider-swap path (future)

The swappable seam is `EmbeddingProvider` (`embedBatch` / `embedOne` / `dims` /
`model` / `configured`). Today only `openai` is registered. To add Voyage/Cohere/
local:
1. Implement the provider in `embeddings.ts` (fetch-based, no SDK — matches
   `lib/ai` philosophy) and add it to the registry.
2. Set `MEMORY_EMBEDDING_PROVIDER` env to the new id.
3. If the dimension differs, ship a resize + re-embed migration.
No change to `repository.ts`, `retrieval.ts`, `engine.ts`, the execution engine,
or the API routes — the architecture is closed over `EmbeddingProvider`.

## 9. Future integrations (MCP / RAG / multi-agent)

The execution engine talks **only** to `MemoryEngine` (`recall` / `remember` /
`manage`). Because that interface is stable and provider-agnostic, future
consumers attach at the same seam:
- **RAG** — a `rag.*` palette node can call `recall` directly; retrieval + fusion
  already implemented.
- **Multi-agent** — agents share `workspace`-scoped memory via `orgId`; per-agent
  memory via `agentId`.
- **MCP** — an MCP server exposing `recall`/`remember` as tools calls the same
  facade, with no engine change.

No redesign required: the memory system is the single, stable boundary.