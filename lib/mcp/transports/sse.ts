import "server-only";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { buildAuthHeaders, type McpTransportBuildContext, type McpTransportAdapter } from "./index";

// Exported as a value; the registry (./index) imports and registers this in its
// own body. Do NOT call `registerTransport` at the top level here — see the
// note in ./index (index↔adapter circular import → registry TDZ under Turbopack).
export const sseAdapter: McpTransportAdapter = {
  id: "sse",
  build({ server }: McpTransportBuildContext) {
    if (!server.endpoint) {
      throw new Error(`MCP server "${server.name}" (sse) has no endpoint`);
    }
    const headers = buildAuthHeaders(server.authScheme, server.credentials);
    const baseFetch = globalThis.fetch.bind(globalThis);
    // eventsource's EventSourceInit has no `headers`; wrap fetch so the GET
    // stream carries the same auth headers as the POST channel.
    const authedFetch = (url: string | URL, init?: RequestInit) =>
      baseFetch(url, {
        ...init,
        headers: { ...headers, ...((init?.headers as Record<string, string>) ?? {}) },
      });
    return new SSEClientTransport(new URL(server.endpoint), {
      eventSourceInit: { fetch: authedFetch },
      requestInit: { headers },
    });
  },
};