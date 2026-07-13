# MCP Testing Guide

End-to-end verification of the MCP layer. Assumes the app is running locally and
you are signed in. All `curl` examples use a cookie jar from the browser; you
can also exercise the same flows from the UI (Settings → MCP, then the workflow
builder's MCP palette).

## 0. Prerequisites

```bash
# 1. Install the SDK (already in package.json) and dependencies.
npm install

# 2. Run the migration + regenerate the client.
#    NOTE: stop any running `next dev` first — it holds a lock on the Prisma
#    query-engine DLL and `prisma generate` will fail with EPERM until it is
#    stopped. On Windows:  taskkill /F /PID <next-dev-pid>   (or close the terminal)
npx prisma migrate dev --name mcp_servers
npx prisma generate

# 3. Set the encryption key (reuse the integrations key) in .env, e.g.:
#    INTEGRATIONS_ENCRYPTION_KEY=<32-byte hex>
# 4. Start the app.
npm run dev
```

## 1. Register an stdio MCP server

Use the reference filesystem server (install it once globally or via npx):

```bash
curl -X POST http://localhost:3000/api/mcp/servers \
  -H "Content-Type: application/json" \
  -b cookie.txt \
  -d '{
    "name": "filesystem",
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
    "allowList": ["read_file", "list_directory", "search_files", "get_file_info"]
  }'
```

Expect `201` with the client-safe server object (no `credentials`, no `env`).
Note the returned `id`.

## 2. Health-check

```bash
curl -X POST http://localhost:3000/api/mcp/servers/<id>/test -b cookie.txt
```

Expect `{ "ok": true, "latencyMs": <n>, "error": null }` and the server's
`status` becomes `connected`.

## 3. Discover tools

```bash
curl -X POST http://localhost:3000/api/mcp/servers/<id>/discover -b cookie.txt
```

Expect `{ "tools": <n>, "resources": 0, "prompts": 0, "capabilities": [...] }`.
Then verify the cache:

```bash
curl http://localhost:3000/api/mcp/tools -b cookie.txt
```

Expect `{ "items": [ { "id": "filesystem::read_file", "name": "read_file", ... }, ... ] }`.

## 4. Invoke via the SSE endpoint

```bash
curl -N -X POST http://localhost:3000/api/mcp/invoke \
  -H "Content-Type: application/json" -b cookie.txt \
  -d '{ "serverId": "<id>", "toolName": "read_file", "arguments": { "path": "/tmp/README.txt" } }'
```

You should see streamed `data:` frames: optional `progress` events, then a
terminal `result` event carrying `{ "result": { "text": "...", "isError": false, "tokensEstimate": <n> } }`.

## 5. Workflow node path

1. Open the builder. The palette now has an **MCP** category with `MCP Tool` and
   `MCP Resource` nodes.
2. Add an `MCP Tool` node. In the inspector, the **Tool** dropdown lists the
   discovered tools (`<serverId>::<toolName>`). Set `arguments` JSON, e.g.
   `{ "path": "/tmp/README.txt" }`.
3. Run the workflow. The execution dock streams `node:log` lines
   (`MCP invoke …`, `MCP read_file ok (N tokens)`).
4. Assert a `McpInvocation` row exists:
   ```bash
   curl "http://localhost:3000/api/mcp/invocations?serverId=<id>" -b cookie.txt
   ```
   Expect `status: "succeeded"`, `streamed: false`, `tokensEstimate > 0`.
5. Assert a memory entry exists (when embeddings are configured) with
   `metadata.kind: "tool_output"` and `metadata.toolName: "read_file"`.

## 6. Multi-agent path

1. Add an `ai.multiAgent` node. Set an objective that benefits from a tool, e.g.
   *"Read /tmp/README.txt and summarize it."*
2. Run. The Planner emits `agent:log` lines: `MCP N tool(s) available;
   selecting one`, then `MCP read_file output folded into context`, and a
   reasoning step `Invoked MCP tool read_file`.
3. Confirm the final answer references the file contents.
4. `GET /api/mcp/observability` should reflect the call in `topTools` and
   `invocations.total`.

## 7. Observability

```bash
curl http://localhost:3000/api/mcp/observability -b cookie.txt
```

Expect `servers.connected`, `invocations.total/succeeded/failed`, `errorRate`,
`avgLatencyMs`, `recentFailures`, `topTools`.

## 8. Negative: deny-list hides a tool

Update the server with a deny entry:

```bash
curl -X PATCH http://localhost:3000/api/mcp/servers/<id> \
  -H "Content-Type: application/json" -b cookie.txt \
  -d '{ "denyList": ["write_file"] }'
```

Then `GET /api/mcp/tools` no longer lists `write_file`, and the inspector
dropdown no longer shows it. (Re-discover is not required for allow/deny
changes — they filter the existing cache.)

## 9. Negative: allow-list violation (non-retryable)

Invoke a denied tool through an agent (give a planner `mcp.invoke` and have it
pick `write_file`). The gateway throws `PermissionError`; the runtime does NOT
retry; the `McpInvocation` row has `status: "failed"`.

## 10. Negative: revoked credentials (retryable failure)

Patch the server with blank/invalid credentials and `POST .../test`:

```bash
curl -X PATCH http://localhost:3000/api/mcp/servers/<id> \
  -H "Content-Type: application/json" -b cookie.txt \
  -d '{ "authScheme": "bearer", "credentials": { "token": "invalid" } }'
curl -X POST http://localhost:3000/api/mcp/servers/<id>/test -b cookie.txt
```

Expect `{ "ok": false, "error": "..." }` and `status: "error"`. An in-workflow
invocation against an HTTP/SSE server with bad creds yields a `retryable: true`
failure; the engine retries (≤2) with backoff, then records `status: "failed"`.

## 11. Type-check + lint

```bash
npx tsc --noEmit
npx eslint lib/mcp app/api/mcp lib/agents/agents/planner.ts lib/execution/actions
```

Both should be clean. (If `tsc` reports missing `prisma.mcpServer` accessors,
`prisma generate` has not run yet — see step 0.)