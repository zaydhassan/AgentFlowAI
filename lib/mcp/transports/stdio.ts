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
import { registerTransport, type McpTransportBuildContext, type McpTransportAdapter } from "./index";

const adapter: McpTransportAdapter = {
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

registerTransport(adapter);