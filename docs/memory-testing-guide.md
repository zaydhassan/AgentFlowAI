# Memory Engine — Testing Guide

How to verify the Long-Term AI Memory engine end-to-end. All steps assume a
local Postgres with the `vector` extension available and `OPENAI_API_KEY` set
(for real embeddings + real LLM output). The no-key path is tested separately in
§3.

## 0. Prerequisites

```bash
# 1. env — at minimum, an OpenAI key (used for BOTH embeddings and LLM output).
#    Copy .env.example → .env and set:
OPENAI_API_KEY=sk-...
#    (optional tuning — defaults shown)
# MEMORY_ENABLED=true
# MEMORY_EMBEDDING_PROVIDER=openai
# MEMORY_TOP_K=5
# MEMORY_SIMILARITY_THRESHOLD=0.75

# 2. database — apply the additive migration (creates the vector extension + 5 tables).
npx prisma migrate deploy
npx prisma generate

# 3. type/build gate (must be clean before manual testing).
npx tsc --noEmit
npx next build
```

If `prisma migrate deploy` fails on `CREATE EXTENSION vector`, your DB role lacks
`CREATE` privilege or the extension isn't installed — see the migration report §7.

## 1. Manual e2e — first run writes a memory

1. `npx next dev` and sign in.
2. Open (or create) a workflow with an **AI** node, e.g. `trigger.manual → ai.openai`.
3. Select the `ai.openai` node. In the inspector, turn on **Use memory**, set
   **Memory scope** = Long-term, **Importance** = Medium, and set a System prompt
   like `You are a helpful assistant that summarizes input.`
4. Save and **Run**.
5. Watch the SSE `node:log` stream (inspector + execution dock — no UI changed):
   - `🧠 memory · retrieved 0 · scope=long_term` (first run, empty store → 0 hits).
   - The node generates a real response (real LLM if `OPENAI_API_KEY` set, else the
     deterministic fallback labelled `[deterministic fallback …]`).
   - `✓ memory · wrote 1 (scope=long_term, importance=0.6)`.
6. Open **/ai/memory** (sidebar). The new memory appears: scope badge `Long-term`,
   `importance 0.6`, `accessCount 1`, content `Q: …\n---\nA: …`. The KPI row shows
   `Memories ≥ 1`, `Writes ≥ 1`.

## 2. Manual e2e — second run hits

1. Run the **same** workflow again (same or similar input).
2. The log now shows a hit, e.g.:
   `🧠 memory · retrieved 1 (0.92) · scope=long_term`
   `   · [0.92] Q: Task: … (120-char preview)`
3. The AI node's augmented prompt includes a `Relevant memories (most relevant
   first, score in brackets):` block.
4. `/ai/memory` shows `accessCount` and `hits` incremented; `Recall rate` KPI rises.
5. Use the dashboard's **semantic search** box with a phrase similar to the stored
   memory — it returns the memory with a `score` badge. **Clear** returns to the
   listing.

## 3. No-key no-op path (no fake embeddings)

1. Unset `OPENAI_API_KEY` (and `ANTHROPIC_API_KEY`) and restart `next dev`.
2. Run the memory-enabled `ai.openai` node.
3. Expected log: `🧠 memory disabled — embeddings not configured (set OPENAI_API_KEY)`.
   The node **still** returns a real response (the deterministic fallback — labelled).
   No memory is written; no embedding API call is made.
4. `/ai/memory` shows the warning banner: "Embeddings not configured. Set
   OPENAI_API_KEY…".
5. Adding a memory from the dashboard returns `503` with a clear message (cannot
   embed without a key) — confirming no fake embeddings are ever written.

## 4. Workspace isolation

1. As user A, store a `workspace`-scoped memory (or run a node with
   Memory scope = Workspace). Confirm A sees it on `/ai/memory`.
2. Sign in as user B (different org, or no org) and open `/api/memory/search` (or
   the dashboard search). B sees **zero** of A's memories — retrieval/list are
   always filtered by `ownerId`, and `workspace` scope additionally filters by
   `orgId` via `resolveOrgId`. Cross-owner `DELETE /api/memory/[id]` returns `404`.

## 5. Maintenance

1. With several memories stored, click **Run maintenance** on `/ai/memory`.
2. Expected toast: `Maintenance done — merged X, expired Y, promoted Z.`
3. Verify:
   - A frequently-hit memory (`hitCount > 10`) got `importanceScore` bumped
     (`promoted`).
   - Storing an exact-duplicate content in the same scope **dedups** (the existing
     memory's `accessCount` increments; `deduplicated: true` in the engine; no new
     row). The toast/log shows `· dedup`.
   - A near-duplicate (cosine ≥ 0.92, both `importance ≥ 0.6`) is **merged** — the
     lower-importance one gets `status = "merged"` and disappears from the list /
     retrieval (`merged` count).
   - An old, untouched, low-importance memory (`importanceScore < 0.3 &&
     accessCount == 0 && age > 30d`) is **expired** (`status = "expired"`; excluded
     from retrieval).

## 6. Collections

1. Create a collection `customer-faq` from the dashboard. It appears with
   `0 memories`.
2. Store a memory with `collectionId` set (via the API, or future inspector
   support) — the collection's `memoryCount` increments and the row shows
   `· customer-faq`.
3. Filter the store list by `?collectionId=` — only that collection's memories
   return.
4. Delete the collection — memories are **kept** (`collectionId` set to null via
   `onDelete: SetNull`).

## 7. Security inspection (quick)

```bash
# Vectors never leave the server. Confirm no `vector`/`embedding` field in any
# memory API response:
curl -s localhost:3000/api/memory        -H "Cookie: <session>" | jq '.memories[0] | keys'
curl -s localhost:3000/api/memory/search -H "Cookie: <session>" \
     -H 'Content-Type: application/json' -d '{"query":"test"}' | jq '.hits[0].memory | keys'
# Neither list of keys should contain `vector` or `embedding`.
```

## 8. No regressions

- A workflow whose AI nodes have **Use memory off** (or no AI nodes) runs the
  simulation path exactly as before; `nodeTokens`/`nodeFailsOn`/`synthOutput`
  unchanged. The memory branch is a no-op for them.
- Gmail nodes still take the real-action branch (unchanged); the memory branch is
  gated on `category === "ai" && config.useMemory === true`.
- Billing, Authentication, Payment System, and the Workflow Builder UI are
  untouched.

## 9. Automated gates (run before merge)

```bash
npx prisma format && npx prisma validate
npx prisma generate
npx tsc --noEmit
npx next build
```
All four must pass clean. The migration must apply with no existing-table errors
(additive only).