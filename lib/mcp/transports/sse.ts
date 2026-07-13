// =============================================================================
// MCP SSE transport adapter (legacy, still supported)
// =============================================================================
// SSEClientTransport is deprecated by the spec in favour of Streamable HTTP,
// but many servers still use it, so clients must support both during the
// migration period. Auth headers go into requestInit for the POST channel.
// The initial SSE GET has no headers field on EventSourceInit, so we wrap
// fetch to inject them there too — otherwise the stream request would be
// unauthenticated on servers that require it.
//
// Server-only.

import "server-only";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { buildAuthHeaders, registerTransport, type McpTransportBuildContext, type McpTransportAdapter } from "./index";

const adapter: McpTransportAdapter = {
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

registerTransport(adapter);