import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { buildTransport } from "./transports";
import type {
  McpCallResult,
  McpConnectOptions,
  McpProgress,
  McpResourceResult,
  McpCapabilityKind,
  McpCapabilityRow,
  McpCacheKind,
  StoredMcpServer,
} from "./types";

const CLIENT_INFO = { name: "agentflow-ai", version: "1.0.0" } as const;

// Rough token estimate (chars/4). Good enough for observability; no tokenizer dep.
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export interface DiscoveredTool {
  name: string;
  title?: string | null;
  description?: string | null;
  inputSchema?: Record<string, unknown> | null;
  annotations?: Record<string, unknown> | null;
}
export interface DiscoveredResource {
  name: string;
  uri: string;
  description?: string | null;
  mimeType?: string | null;
  annotations?: Record<string, unknown> | null;
}
export interface DiscoveredPrompt {
  name: string;
  description?: string | null;
  arguments?: Array<{ name: string; description?: string | null; required?: boolean }>;
}
export interface DiscoveredResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string | null;
  mimeType?: string | null;
}

export class McpSdkClient {
  private readonly client: Client;
  private transport: Transport | null = null;

  private constructor(client: Client) {
    this.client = client;
  }

  /** Build a transport, construct the SDK Client, and complete the MCP handshake. */
  static async connect(opts: McpConnectOptions): Promise<McpSdkClient> {
    const { server, signal } = opts;
    const transport = buildTransport({ server, signal });
    const client = new Client(CLIENT_INFO, {
      capabilities: {
        // We don't currently use roots/elicitation/sampling; advertise nothing
        // extra so servers don't expect callbacks we don't implement.
      },
    });
    // The SDK handshake (initialize) is itself abortable via RequestOptions.signal.
    await client.connect(transport, { signal });
    const wrapped = new McpSdkClient(client);
    wrapped.transport = transport;
    return wrapped;
  }

  /** Server-advertised capabilities, post-handshake. */
  getServerCapabilities(): { tools?: unknown; resources?: unknown; prompts?: unknown; logging?: unknown; completion?: unknown } | undefined {
    return this.client.getServerCapabilities();
  }

  /** Normalize the capability blob into our row shape (with a sensible default set). */
  capabilityRows(): McpCapabilityRow[] {
    const caps = this.getServerCapabilities();
    const has = (k: McpCapabilityKind): boolean => Boolean(caps && (caps as Record<string, unknown>)[k]);
    const kinds: McpCapabilityKind[] = ["tools", "resources", "prompts", "logging", "completion"];
    return kinds.map((k) => ({ kind: k, supported: has(k) }));
  }

  getServerVersion(): { name?: string; version?: string } | undefined {
    return this.client.getServerVersion();
  }

  async ping(signal?: AbortSignal): Promise<void> {
    await this.client.ping({ signal });
  }

  async listTools(signal?: AbortSignal): Promise<DiscoveredTool[]> {
    const out: DiscoveredTool[] = [];
    let cursor: string | undefined;
    do {
      const res = await this.client.listTools({ cursor }, { signal });
      for (const t of res.tools) {
        out.push({
          name: t.name,
          title: t.title ?? null,
          description: t.description ?? null,
          inputSchema: (t.inputSchema ?? null) as Record<string, unknown> | null,
          annotations: (t.annotations ?? null) as Record<string, unknown> | null,
        });
      }
      cursor = res.nextCursor;
    } while (cursor);
    return out;
  }

  async listResources(signal?: AbortSignal): Promise<DiscoveredResource[]> {
    const out: DiscoveredResource[] = [];
    let cursor: string | undefined;
    do {
      const res = await this.client.listResources({ cursor }, { signal });
      for (const r of res.resources) {
        out.push({
          name: r.name,
          uri: r.uri,
          description: r.description ?? null,
          mimeType: r.mimeType ?? null,
          annotations: (r.annotations ?? null) as Record<string, unknown> | null,
        });
      }
      cursor = res.nextCursor;
    } while (cursor);
    return out;
  }

  async listResourceTemplates(signal?: AbortSignal): Promise<DiscoveredResourceTemplate[]> {
    const out: DiscoveredResourceTemplate[] = [];
    let cursor: string | undefined;
    do {
      const res = await this.client.listResourceTemplates({ cursor }, { signal });
      for (const r of res.resourceTemplates) {
        out.push({
          uriTemplate: r.uriTemplate,
          name: r.name,
          description: r.description ?? null,
          mimeType: r.mimeType ?? null,
        });
      }
      cursor = res.nextCursor;
    } while (cursor);
    return out;
  }

  async listPrompts(signal?: AbortSignal): Promise<DiscoveredPrompt[]> {
    const out: DiscoveredPrompt[] = [];
    let cursor: string | undefined;
    do {
      const res = await this.client.listPrompts({ cursor }, { signal });
      for (const p of res.prompts) {
        out.push({
          name: p.name,
          description: p.description ?? null,
          arguments: p.arguments?.map((a) => ({
            name: a.name,
            description: a.description ?? null,
            required: a.required ?? false,
          })),
        });
      }
      cursor = res.nextCursor;
    } while (cursor);
    return out;
  }

  /**
   * Invoke a tool. Wires SDK progress notifications → onProgress, honours the
   * abort signal, and (when resetTimeoutOnProgress is set) keeps long-running
   * calls alive across progress ticks. Never throws on a *tool* error — those
   * come back as isError:true in the result. Transport/cancellation errors
   * still throw and are handled by the caller (retryable classification).
   */
  async callTool(
    name: string,
    args: Record<string, unknown> | null,
    opts: { signal?: AbortSignal; onProgress?: (p: McpProgress) => void; timeout?: number; maxTotalTimeout?: number } = {},
  ): Promise<McpCallResult> {
    const res = await this.client.callTool(
      { name, arguments: args ?? undefined },
      undefined,
      {
        signal: opts.signal,
        timeout: opts.timeout,
        maxTotalTimeout: opts.maxTotalTimeout,
        resetTimeoutOnProgress: Boolean(opts.onProgress),
        onprogress: opts.onProgress
          ? (progress: { progress?: number; total?: number; message?: string }) =>
              opts.onProgress!({
                progress: progress.progress,
                total: progress.total,
                message: progress.message,
              })
          : undefined,
      },
    );
    const content = (res.content ?? []) as unknown[];
    const text = content
      .map((c) => (typeof c === "object" && c !== null && (c as { type?: string }).type === "text"
        ? String((c as { text?: unknown }).text ?? "")
        : ""))
      .filter(Boolean)
      .join("\n\n");
    return {
      text,
      content,
      structuredContent: (res.structuredContent ?? null) as Record<string, unknown> | null,
      isError: res.isError === true,
      tokensEstimate: estimateTokens(text),
    };
  }

  /** Read a resource by URI; returns the first text/blob content part. */
  async readResource(uri: string, signal?: AbortSignal): Promise<McpResourceResult> {
    const res = await this.client.readResource({ uri }, { signal });
    const first = res.contents[0];
    if (!first) {
      return { uri, text: "", blob: null, mimeType: null, tokensEstimate: 0 };
    }
    const text = "text" in first ? String(first.text) : "";
    const blob = "blob" in first ? String(first.blob) : null;
    return {
      uri: first.uri,
      text,
      blob,
      mimeType: first.mimeType ?? null,
      tokensEstimate: estimateTokens(text) + (blob ? Math.ceil(blob.length / 4) : 0),
    };
  }

  /** Fetch a prompt by name (optionally with arguments). */
  async getPrompt(
    name: string,
    args?: Record<string, string> | null,
    signal?: AbortSignal,
  ): Promise<{ description?: string | null; messages: Array<{ role: string; text: string }> }> {
    const res = await this.client.getPrompt({ name, arguments: args ?? undefined }, { signal });
    return {
      description: res.description ?? null,
      messages: (res.messages ?? []).map((m) => ({
        role: m.role,
        text: typeof m.content === "object" && m.content !== null && (m.content as { type?: string }).type === "text"
          ? String((m.content as { text?: unknown }).text ?? "")
          : "",
      })),
    };
  }

  /** The session id advertised by Streamable HTTP servers (for resumability), if any. */
  get sessionId(): string | undefined {
    const t = this.transport as unknown as { sessionId?: string };
    return t?.sessionId;
  }

  /** Hook fired when the transport closes (remote-initiated or via close()). */
  set onclose(handler: (() => void) | undefined) {
    this.client.onclose = handler;
  }

  /** Hook fired on transport-level errors. */
  set onerror(handler: ((error: Error) => void) | undefined) {
    this.client.onerror = handler;
  }

  async close(): Promise<void> {
    try {
      await this.client.close();
    } catch {
      /* best-effort close */
    }
  }
}

export type { McpConnectOptions, StoredMcpServer };
export type { McpCacheKind };