import "server-only";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { buildAuthHeaders, type McpTransportBuildContext, type McpTransportAdapter } from "./index";

// Exported as a value; the registry (./index) imports and registers this in its
// own body. Do NOT call `registerTransport` at the top level here — see the
// note in ./index (index↔adapter circular import → registry TDZ under Turbopack).
export const httpAdapter: McpTransportAdapter = {
  id: "http",
  build({ server }: McpTransportBuildContext) {
    if (!server.endpoint) {
      throw new Error(`MCP server "${server.name}" (http) has no endpoint`);
    }
    const headers = buildAuthHeaders(server.authScheme, server.credentials);
    headers["Accept"] ??= "application/json, text/event-stream";
    return new StreamableHTTPClientTransport(new URL(server.endpoint), {
      requestInit: { headers },
      sessionId: server.lastSessionId ?? undefined,
    });
  },
};