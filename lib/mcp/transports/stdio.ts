// =============================================================================
// MCP stdio transport adapter
// =============================================================================
// Spawns a local process and talks to it over stdin/stdout via the SDK's
// StdioClientTransport. The decrypted `env` (StoredMcpServer.env) is merged on
// top of the inherited default environment so secrets (API keys, etc.) reach
// the child process without being written into the parent's env. stderr is
// piped so the connection manager can surface spawn errors.
//
// Server-only (Node.js).

import "server-only";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpTransportBuildContext, McpTransportAdapter } from "./index";

// Exported as a value; the registry (./index) imports and registers this in its
// own body. This module must NOT call `registerTransport` at its top level —
// that re-introduces the index↔adapter circular import whose hoisted top-level
// call hit the registry's temporal dead zone under Turbopack.
export const stdioAdapter: McpTransportAdapter = {
  id: "stdio",
  build({ server }: McpTransportBuildContext) {
    if (!server.command) {
      throw new Error(`MCP server "${server.name}" (stdio) has no command`);
    }
    // Merge the decrypted env over the safe defaults — never leak into parent.
    const env = { ...getDefaultEnvironment(), ...(server.env ?? {}) };
    return new StdioClientTransport({
      command: server.command,
      args: server.args ?? [],
      env,
      stderr: "pipe",
    });
  },
};