# MCP (Model Context Protocol) Support

AgentFlow AI is MCP-native: agents and workflow nodes discover and invoke
external tools **dynamically through MCP servers** instead of per-provider
hardcoded integrations. This document describes the architecture, configuration,
security model, and extension points.

The implementation follows the official Model Context Protocol specification and
uses the official `@modelcontextprotocol/sdk` as its only MCP dependency.

---

## Architecture

```
Execution Engine (lib/execution/engine.ts — unchanged)
  → Agent Runtime (lib/agents — additive ctx.tools seam)
    → AgentToolGateway (lib/mcp/gateway.ts = ctx.tools; permission + workspace + audit)
      → Tool Registry + Connection Manager (lib/mcp)
        → McpSdkClient (wraps @modelcontextprotocol/sdk Client)
          → Transport adapters (stdio / http / sse — registry, future-additive)
            → Connected MCP Servers → External Tools
```

**The Agent Runtime never communicates directly with tools.** All tool
execution flows through the MCP Runtime (`lib/mcp`). Agents call
`ctx.tools.list()` / `ctx.tools.invoke(ref, args)`; workflow nodes are routed
through `lib/execution/actions/mcp.ts`. Neither touches the SDK, the connection
pool, or credentials.

### Modules (all under `lib/mcp/`)

| Module | Responsibility |
| --- | --- |
| `types.ts` | Pure types + the `AgentToolGateway` interface. No runtime, importable from client + server. |
| `permissions.ts` | Allow/deny pattern matching (deny-first, `*` glob, prefix wildcard). |
| `repository.ts` | Prisma data layer; the ONLY place credentials/env are encrypted/decrypted (reuses `lib/integrations/crypto.ts`, AES-256-GCM). |
| `transports/index.ts` | Transport registry + `buildTransport()`. Add a transport = one file + one `registerTransport()`. |
| `transports/stdio.ts` `http.ts` `sse.ts` | SDK transport adapters. |
| `sdk-client.ts` | The ONLY module that imports the SDK `Client`. Thin wrapper: connect, list*, callTool, readResource, getPrompt, ping, close. Wires progress → `onProgress`, honours `AbortSignal`. |
| `connection-manager.ts` | In-process persistent connection pool (`Map<serverId, McpConnection>`). Ownership-checked, health-checked, refresh-on-reconnect. |
| `discovery.ts` | Discovers + caches tools/resources/prompts/capabilities. Called on connect, reconnect, and `POST /servers/[id]/discover`. |
| `tool-registry.ts` | Workspace-aggregated, allow-filtered tool resolution. The security boundary between "advertised" and "permitted". |
| `audit.ts` | Records every invocation (`McpInvocation`) + mirrors to the Memory Engine (`getMemoryEngine().remember`). |
| `gateway.ts` | Concrete `AgentToolGateway` (the `ctx.tools` surface). Reuses `PermissionError`. |
| `index.ts` | Server-only facade — the single import surface for the rest of the app. |
| `client.ts` | Browser fetch wrappers for `/api/mcp/**`. |

### Database (additive)

Four new Prisma models, all workspace-isolated (`ownerId` FK→User Cascade +
`orgId String?` workspace filter), mirroring the `IntegrationAccount` template:

- `McpServer` — connection definition (transport, endpoint/command, encrypted
  credentials + env, allow/deny lists, status, health, last session id).
  `@@unique([ownerId, name])`.
- `McpCapability` — server-advertised capabilities (tools/resources/prompts/
  logging/completion). `@@unique([serverId, kind])`.
- `McpToolCache` — cached tool/resource/prompt metadata. Refreshed on discover;
  stale rows pruned. `@@unique([serverId, kind, name])`.
- `McpInvocation` — the audit row for every call (status, latency, retries,
  error, tokens, streamed, run context). Indexes on `[serverId, createdAt]`,
  `[ownerId, createdAt]`, `[workflowId]`.

No existing model was modified (a back-relation `mcpServers McpServer[]` was
added to `User`).

---

## Transports

| id | SDK class | Use |
| --- | --- | --- |
| `stdio` | `StdioClientTransport` | Local process spawned from `command` + `args`; decrypted `env` merged over the inherited defaults. |
| `http` | `StreamableHTTPClientTransport` | Streamable HTTP (recommended). Auth headers in `requestInit`; session id threaded for resumability. |
| `sse` | `SSEClientTransport` | Legacy SSE (supported during migration). Auth headers in `requestInit` (POST) + a `fetch` wrapper (GET stream). |

### Auth schemes

`authScheme` selects how decrypted `McpCredentials` become HTTP headers
(`buildAuthHeaders` in `transports/index.ts`):

- `none` — no auth header (extra `credentials.headers` still applied).
- `bearer` — `Authorization: Bearer <token>`.
- `basic` — `Authorization: Basic <base64(user:pass)>`.
- `header` — a custom `<headerName>: <headerValue>`.

stdio ignores auth (it uses `env` for secrets). Credentials are encrypted at
rest (AES-256-GCM via `INTEGRATIONS_ENCRYPTION_KEY`, the same key
`lib/integrations` uses) and decrypted only into the in-memory `StoredMcpServer`,
never serialized to a response.

### Adding a transport (modularity)

1. Create `lib/mcp/transports/<id>.ts` implementing `McpTransportAdapter`.
2. Call `registerTransport(adapter)` at module load.
3. Add the id to `MCP_TRANSPORTS` in `lib/mcp/types.ts` (so the API validates it).

No other file changes — `sdk-client.ts`, `connection-manager.ts`, `discovery.ts`,
`gateway.ts`, the agent runtime, and the engine never need editing. This is how
future MCP transport revisions are adopted with minimal change.

---

## Allow / deny lists

Each `McpServer` carries `allowList` and `denyList` (string patterns). Matching
is deny-first (`permissions.ts`):

- A name matching any deny pattern is rejected.
- Empty `allowList` = allow all (deny still wins).
- Otherwise the name must match an allow pattern.
- Patterns: `*` = all; trailing `*` = prefix wildcard (`github.*`); else exact.

The tool registry applies these before a tool is exposed to the agent gateway,
the node inspector dropdown, or the engine action. The engine action re-checks
the policy against the live server config at invoke time.

---

## The two workflow nodes

Additive only — no existing node was modified.

- **`mcp.tool`** (MCP category, purple `#8b5cf6`) — invokes a discovered tool.
  Config: `tool` (`mcp.tool` dropdown, value `<serverId>::<toolName>`),
  `arguments` (JSON), `timeoutMs`.
- **`mcp.resource`** — reads a discovered resource. Config: `resource`
  (`mcp.resource` dropdown, value `<serverId>::<uri>`), `arguments` (JSON, fills
  URI-template variables).

Both are routed to `runMcpAction` (`lib/execution/actions/mcp.ts`) via the
existing `runAction` seam — `engine.ts` is unchanged. They stream `node:log`
events to the execution dock and write a `McpInvocation` row + a Memory Engine
entry per call.

---

## Agent integration

The Planner agent has `mcp.invoke` permission. After recalling workspace memory
and before producing its plan, it:

1. Inspects available MCP tools (`ctx.tools.list()`).
2. Asks the model to pick the best tool for the objective and produce arguments.
3. Invokes it through `ctx.tools.invoke(...)` (audited, workspace-isolated).
4. Folds the returned data into the planning context.
5. Continues reasoning.

This block is **guarded and backward-compatible**: when the agent has no
`mcp.invoke` permission, or no MCP servers are connected/discovered, `list()`
returns `[]` and planning proceeds exactly as before. Any failure in the block
is non-fatal.

`ctx.tools` (`AgentToolGateway`) is constructed in `buildAgentContext`
(`lib/agents/runtime.ts`) — one additive field. The graph topology, state
reducers, loop prevention, approval checkpoints, retry wrapper, and `driveGraph`
are untouched.

### Adding an agent that uses MCP

Add `mcp.invoke` to the agent's `tools` (and optionally `mcp: { serverId,
toolName }` to narrow scope). The runtime wires `ctx.tools` automatically. No
runtime change required.

---

## Security

- **Workspace isolation**: every connection is obtained through
  `repository.getServerOwned(userId, serverId)`; a user can never reach a server
  they don't own. `orgId` scopes the workspace tool/resource aggregation.
- **Tool permissions**: `AgentToolGateway.ensure()` throws `PermissionError`
  (reused from `lib/agents/memory.ts`) if an agent lacks `mcp.invoke`. The
  runtime's retry wrapper treats `PermissionError` as non-retryable.
- **Allow-list**: only permitted tools are exposed and invocable.
- **Credential encryption**: AES-256-GCM, reusing `INTEGRATIONS_ENCRYPTION_KEY`.
- **Audit**: every invocation writes a `McpInvocation` row (server, tool, args,
  status, latency, retries, error, tokens, streamed, run context) and a Memory
  Engine entry (`metadata.kind: tool_output | tool_failure | tool_call`).

---

## Observability

`GET /api/mcp/observability` returns: connected/disconnected/error/disabled
server counts; total/succeeded/failed calls; error rate; average + max latency;
streamed-event count; recent failures; top tools by call count.

`GET /api/mcp/invocations` returns the audit trail (filterable by
`serverId`, `status`, `workflowId`, `limit`).

---

## API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/mcp/servers` | List servers (client-safe) |
| POST | `/api/mcp/servers` | Register a server |
| GET | `/api/mcp/servers/[id]` | Get one server |
| PATCH | `/api/mcp/servers/[id]` | Update a server |
| DELETE | `/api/mcp/servers/[id]` | Delete a server |
| POST | `/api/mcp/servers/[id]/test` | Connect + ping (health) |
| POST | `/api/mcp/servers/[id]/discover` | Refresh cached metadata |
| GET | `/api/mcp/tools` | Allow-filtered workspace tools |
| GET | `/api/mcp/resources` | Allow-filtered workspace resources |
| POST | `/api/mcp/invoke` | Stream a tool invocation (SSE) |
| GET | `/api/mcp/invocations` | Audit trail |
| GET | `/api/mcp/observability` | Summary metrics |

---

## Caveat: single-process connection pool

The connection pool is an in-process `Map<serverId, McpConnection>`, consistent
with the existing run registries (`lib/agents/runtime.ts`,
`lib/execution/engine.ts`). This suits the single-process dev server. For a
multi-instance deployment, connections would need to be externalized (a sidecar
or a shared MCP gateway process); the `connection-manager` seam is the place
that change would land — the rest of the stack is unaffected.

---

## Environment

- `INTEGRATIONS_ENCRYPTION_KEY` — 32-byte key (hex/base64/utf-8), reused from
  the integrations layer. Required to encrypt credentials + stdio env.
- `@modelcontextprotocol/sdk` — the only new dependency (already in
  `package.json`).