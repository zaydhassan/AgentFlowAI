# Multi-Agent Runtime

Transforms AgentFlow AI from a single-agent workflow platform into a true
multi-agent orchestration platform. A team of specialized agents — Planner,
Research, Memory, Reasoning, Reviewer, Executor — collaborate to solve an
objective, orchestrated by **LangGraph**.

## Architecture

```
Execution Engine
  → Agent Runtime (lib/agents/runtime.ts)
    → Planner (decomposes objective, assigns subtasks)
    → Task Router (LangGraph conditional edges)
    → Specialized Agents (research / memory / reasoning — parallel)
    → Aggregator (join barrier)
    → Reviewer (approve / request revisions)
    → Executor (synthesize final answer)
  → Execution Engine
```

The runtime is a thin LangGraph layer over a **plugin registry** of
`AgentDefinition`s. Adding a new agent later = `registerAgent(...)`; the runtime
rebuilds the graph from the registry with no runtime edits.

### Graph topology

```
START → planner ─┬→ research ─┐
                 ├→ memory   ─┤→ aggregator → reviewer ──→ executor → END
                 └→ reasoning ┘                    │
                                       (revise) ←──┘
```

- **Parallel execution** — planner fans out to the three workers via plain
  edges; LangGraph runs all successors concurrently.
- **Aggregator** — a built-in join node (not a pluggable agent); the `results`
  channel's object-merge reducer combines the workers' parallel writes.
- **Conditional routing** — `reviewer → executor` (approved) or
  `reviewer → planner` (revisions requested).
- **Loop prevention** — the planner increments `iterations` (adder reducer) on
  every pass; the router force-routes to executor once `maxIterations` is hit.
  LangGraph's `recursionLimit` is a hard backstop.
- **Retries** — every agent node is wrapped with up to 2 retries + backoff
  (`PermissionError` and cancellation are not retried).
- **Human approval checkpoints** — compile with `interruptBefore:["reviewer"]`;
  the run pauses, emits `approval-requested`, and resumes via
  `POST /api/agents/run?control=resume&runId=…`.
- **Timeouts** — wall-clock per run + a per-LLM `AbortSignal`.

### Files

```
lib/agents/
  types.ts            AgentId, AgentDefinition, AgentState, AgentEvent, TraceEvent, RunTrace
  state.ts            LangGraph Annotation (shared state + reducers)
  registry.ts         registerAgent / getAgent / allAgents (modular plugin registry)
  prompts.ts          per-agent system prompts (shared preamble spliced in)
  llm.ts              wraps lib/ai/provider.completeText (+ JSON extraction)
  memory.ts           AgentMemoryGateway — the ONLY way agents touch memory
                      (workspace isolation + tool-permission enforcement)
  tracing.ts          TraceCollector — timeline, latency, tokens, reasoning path,
                      graph, retries, failures
  graph-builder.ts    builds the StateGraph from the registry
  runtime.ts          startAgentRun / resumeAgentRun / runAgentsToCompletion
                      + in-memory run registry (stop/resume)
  agents/
    planner.ts  research.ts  memory.ts  reasoning.ts  reviewer.ts  executor.ts
    index.ts    ensureAgentsRegistered()
  index.ts            public facade (server-only)

lib/execution/actions/multiagent.ts   bridge: runtime ↔ execution-engine action
lib/execution/engine.ts               dispatch branch for node.type === "ai.multiAgent"
lib/nodes.ts                          "ai.multiAgent" NodeDef
app/api/agents/run/route.ts           POST → SSE stream + control (resume/stop)
app/api/agents/[runId]/route.ts       GET trace / POST control (approve/reject/stop)
```

## The six agents

| Agent | Role | Memory touch | Tools |
|---|---|---|---|
| **Planner** | Decompose objective → subtasks; assign to workers | recalls context | llm, memory.recall |
| **Research** | Gather/summarize info per research subtask | stores findings (`kind:"finding"`) | llm, memory.recall, memory.remember |
| **Memory** | Retrieve + synthesize a memory brief | broad recall | llm, memory.recall |
| **Reasoning** | Step-by-step inference per reasoning subtask | — | llm, memory.recall |
| **Reviewer** | Approve / request revisions; honors human checkpoint | stores corrections (`kind:"correction"`) | llm, memory.remember |
| **Executor** | Synthesize the final answer | — | llm |

Per the brief: the Planner retrieves context, Research stores findings, the
Reviewer stores corrections. All memory access goes through the memory gateway —
the MemoryEngine is never bypassed.

## Memory & security

- **Workspace isolation** — every memory call is scoped by `userId` + `orgId` +
  `workflowId` + `agentId`. The `MemoryEngine` enforces `ownerId` filtering; the
  gateway guarantees the scoping fields are always set from the run context. No
  cross-workspace memory is possible.
- **Tool permissions** — each `AgentDefinition` declares `tools: ToolPermission[]`.
  The `AgentMemoryGateway` throws `PermissionError` if an agent calls a memory
  tool it did not declare.
- **Graceful no-op** — when embeddings are unconfigured (`OPENAI_API_KEY` unset),
  the gateway no-ops (returns empty/null) and logs it; the run still completes.

## LLM calls

Agents call `ctx.llm.complete(...)` / `ctx.llm.completeJson(...)`, which wrap
`lib/ai/provider.completeText` — the same pluggable path the rest of the app
uses (real OpenAI/Anthropic over fetch when a key is set, deterministic fallback
otherwise). No new SDK surface; the only new dependency is `@langchain/langgraph`.

## Observability

The `RunTrace` exposes everything the brief requires:

- **Agent timeline** — `trace.timeline[]` (per-agent start, duration, tokens, retries, status)
- **Agent latency** — `timeline[i].durationMs`
- **Token usage** — `timeline[i].tokensUsed` + `trace.totalTokens`
- **Reasoning path** — `trace.reasoningPath[]` (agent + step + timestamp)
- **Execution graph** — `trace.graph` (static node/edge snapshot)
- **Retries** — `timeline[i].retries` + `trace.retries`
- **Failures** — `timeline[i].status/error` + `trace.failures`

Events stream live as `AgentEvent`s over SSE (`run:start`, `agent:start`,
`agent:reasoning`, `agent:log`, `agent:memory`, `agent:retry`, `agent:success`,
`agent:fail`, `plan`, `review`, `approval-requested`, `approval`, `complete`).

## API

### `POST /api/agents/run`
Start a run (SSE). Body:
```json
{ "objective": "...", "input": {}, "maxIterations": 2, "timeoutMs": 120000,
  "requireApproval": false, "memoryScope": "long_term", "guidance": "...",
  "workflowId": "...", "nodeId": "..." }
```
Streams `AgentEvent`s. With `requireApproval: true`, ends with
`approval-requested` (run stays resident for resume).

### `POST /api/agents/run?control=resume&runId=<id>`
Resume an approval checkpoint. Body: `{ "approved": true, "feedback": "..." }`.
Streams the remaining events through `complete`.

### `POST /api/agents/run?control=stop&runId=<id>`
Cancel a live run. Returns `{ ok: boolean }`.

### `GET /api/agents/run/[runId]`
Live trace snapshot for an in-flight or paused run (workspace-owner only):
`{ trace: RunTrace, status: "running"|"awaiting_approval"|"done" }`.

### `POST /api/agents/run/[runId]`
Control: `{ "action": "approve" | "reject" | "stop", "feedback": "..." }`.
`approve`/`reject` returns the resume URL to continue the SSE stream.

## Workflow Builder integration

A single new node was added — **Multi-Agent** (`ai.multiAgent`), category `ai`.
No builder UI was redesigned; the palette/inspector auto-render from
`NODE_LIBRARY`. Internally the node launches the LangGraph runtime via the
execution-engine dispatch branch (`lib/execution/engine.ts`), streaming
per-agent logs as `node:log` events. The node output is
`{ text, finalAnswer, plan, review, runId }`.

In-workflow runs complete end-to-end (the engine's own breakpoint mechanism
provides pre-node human approval). Mid-run approval checkpoints are available
via the standalone `/api/agents/run` SSE API.

## Adding a new agent (modularity)

1. Write `lib/agents/agents/my-agent.ts` exporting an `AgentDefinition`
   (`id`, `label`, `tools`, `run(ctx, state)`).
2. Register it in `lib/agents/agents/index.ts` (`registerAgent(myAgent)`).
3. If it should run in the parallel worker block or affect routing, wire it in
   `lib/agents/graph-builder.ts` — otherwise no runtime change is needed.

The runtime iterates `allAgents()` to build the graph, so a newly registered
agent is picked up automatically.