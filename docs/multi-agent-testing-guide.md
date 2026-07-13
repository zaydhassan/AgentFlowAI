# Multi-Agent Runtime — Testing Guide

How to verify the multi-agent runtime end-to-end. Two paths:

- **No-key path** (deterministic LLM fallback + no-op memory) — works offline,
  no Postgres or API key needed. Exercises the full LangGraph orchestration,
  parallel execution, revision loop, loop prevention, streaming, and the
  approval checkpoint.
- **Full path** — real LLM output + real memory recall/store. Requires
  `OPENAI_API_KEY` and the memory migration applied (see
  `docs/memory-testing-guide.md`).

## 0. Prerequisites

```bash
# type/build gate (must be clean)
npx tsc --noEmit

# the only new dependency
npm install @langchain/langgraph
```

For the full path, also:
```bash
OPENAI_API_KEY=sk-...
npx prisma migrate deploy && npx prisma generate
```

## 1. Unit-ish check — run to completion (no key needed)

The runtime is a server module, so the easiest live check is a throwaway route.
Add a temporary `app/api/agents/_t/route.ts`? — no: Next.js excludes `_`-prefixed
folders from routing. Use a non-underscore folder, e.g.
`app/api/agents/devtest/route.ts`, that calls `runAgentsToCompletion` with a
fixed objective and `userId:"devtest-user"`, then:

```bash
npx next dev -p 3137
curl -sS "http://localhost:3137/api/agents/devtest?objective=List%203%20Friday-deploy%20risks" | jq .
```

Expected:
- `status: "succeeded"`
- `trace.iterations` ∈ {1, 2} (1 if the reviewer approved, 2 if it requested a
  revision and loop-prevention forced completion — both are correct)
- `trace.timeline` has entries for `planner`, `memory`, `reasoning`,
  `research`, `reviewer`, `executor`
- `research`/`memory`/`reasoning` share the same `startedAt` (parallel)
- `trace.reasoningPath` is non-empty
- `trace.graph` lists all 7 nodes + the 11 edges
- `totalTokens > 0` (char-based estimate in the fallback path)

Delete the throwaway route after.

## 2. Streaming (SSE) check

Same throwaway route, `?stream=1`:

```bash
curl -N "http://localhost:3137/api/agents/devtest?stream=1&objective=Test" \
  | grep -E "agent:start|agent:success|plan|complete"
```

Expected: events arrive incrementally — `run:start` → `agent:start` (planner) →
`plan` → `agent:start` for the three workers (near-simultaneous `at`) →
`agent:success` per agent → `review` → `executor` → `complete`.

## 3. Human approval checkpoint

Throwaway route with `?approval=1`:

```bash
# 1) start — pauses at the reviewer, emits approval-requested
curl -N "http://localhost:3137/api/agents/devtest?stream=1&approval=1&objective=Approve%20me" \
  | grep "approval-requested"
# → {"type":"approval-requested",...,"runId":"devtest_...","plan":{...},"approvalToken":"devtest_..."}

# 2) resume with the runId from step 1
curl -N "http://localhost:3137/api/agents/devtest?resume=devtest_...&decision=approve" \
  | grep -E "approval|review|complete"
```

Expected: the resume stream shows the `reviewer` running, an `approval` event
("operator override: approving…" when the fallback reviewer would otherwise
request revisions), then `executor` → `complete`. With `decision=reject`, the
reviewer routes back to `planner` with the feedback as a correction.

## 4. Loop prevention

With `maxIterations: 1` and the deterministic fallback (reviewer always
requests revisions because its output is non-JSON), the run must still
terminate: the router force-routes to `executor` once `iterations >= 1`.
Confirm `trace.iterations === 1` and `status === "succeeded"`.

## 5. Authenticated API (real session)

```bash
# cookie jar from your signed-in browser, or a dev session
curl -N -b cookies.txt -X POST http://localhost:3000/api/agents/run \
  -H "Content-Type: application/json" \
  -d '{"objective":"Summarize Q3 churn drivers and propose 3 fixes","maxIterations":2}'
```

- `GET /api/agents/run/<runId>` → live `{ trace, status }` while in flight.
- `POST /api/agents/run/<runId>` `{"action":"stop"}` → cancels.
- `POST /api/agents/run/<runId>` `{"action":"approve"}` → returns the resume URL.

## 6. Workflow Builder node

1. `npx next dev`, sign in, open a workflow.
2. Add a **Multi-Agent** node (`ai.multiAgent`) from the AI palette.
3. Inspector: set **Objective** = "Draft a release-note bullet list from the
   upstream input", **Max revision loops** = 2, **Memory scope** = Long-term.
4. Optionally feed it from a `trigger.manual` node (its output becomes the
   objective when the Objective field is blank).
5. **Run**. The execution dock shows per-agent `node:log` lines streamed from
   the runtime (planner → research/memory/reasoning → reviewer → executor).
6. The node output (`{ text, finalAnswer, plan, review, runId }`) is available
   to downstream nodes.

## 7. Full path — real memory round-trip

With `OPENAI_API_KEY` set and the memory migration applied:

1. Run a Multi-Agent node with **Memory scope** = Long-term on an objective
   that mentions a distinctive token (e.g. "project Atlas").
2. Inspect `trace.events` for `agent:memory` entries: the Planner recalls, the
   Memory agent retrieves, Research stores a finding, the Reviewer stores a
   correction (on revision).
3. Run a second Multi-Agent node on a related objective — the Planner's
   `agent:memory` log should show the prior findings recalled (workspace-scoped
   to the signed-in user).

## 8. What is NOT exercised by the no-key path

- Real LLM JSON parsing (Planner/Reviewer) — the fallback returns plain text, so
  the Planner uses its fallback decomposition and the Reviewer always requests
  revisions; both fallbacks are intentional and verified.
- Real embedding recall/store — the gateway no-ops and logs
  "no prior memories recalled".
- Cross-workspace isolation — verify manually by running as two different users
  and confirming memory recalls are owner-scoped (enforced by `MemoryEngine` +
  the gateway).