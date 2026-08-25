import type { MemoryScope } from "@/lib/memory/types";

export type McpTransportId = "stdio" | "http" | "sse";
export type McpAuthScheme = "none" | "bearer" | "header" | "basic";
export type McpServerStatus = "disconnected" | "connected" | "error" | "disabled";
export type McpCacheKind = "tool" | "resource" | "prompt";
export type McpCapabilityKind = "tools" | "resources" | "prompts" | "logging" | "completion";
export type McpInvocationStatus = "succeeded" | "failed" | "streaming" | "cancelled";

export const MCP_TRANSPORTS: readonly McpTransportId[] = ["stdio", "http", "sse"];
export const MCP_AUTH_SCHEMES: readonly McpAuthScheme[] = ["none", "bearer", "header", "basic"];

// The authScheme selects which fields the transport reads when injecting auth.
// The whole object is serialized to JSON and AES-256-GCM encrypted (via
// lib/integrations/crypto.ts) before being stored in McpServer.credentials.

export interface McpCredentials {
  /** Bearer token (authScheme "bearer"). */
  token?: string;
  /** Custom header name (authScheme "header"). */
  headerName?: string;
  /** Custom header value (authScheme "header"). */
  headerValue?: string;
  /** Basic-auth username (authScheme "basic"). */
  username?: string;
  /** Basic-auth password (authScheme "basic"). */
  password?: string;
  /** Arbitrary extra request headers applied to http/sse transports. */
  headers?: Record<string, string>;
}

// These are what the API returns. They NEVER include credentials or env.

export interface McpHealth {
  ok: boolean;
  lastCheckedAt: string; // ISO
  latencyMs: number | null;
  error: string | null;
}

export interface McpServer {
  id: string;
  ownerId: string;
  orgId: string | null;
  name: string;
  transport: McpTransportId;
  endpoint: string | null;
  command: string | null;
  args: string[];
  authScheme: McpAuthScheme | null;
  status: McpServerStatus;
  health: McpHealth | null;
  allowList: string[];
  denyList: string[];
  lastSessionId: string | null;
  lastDiscoveredAt: string | null; // ISO
  capabilities: McpCapabilityRow[];
  metadata: Record<string, unknown> | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface McpCapabilityRow {
  kind: McpCapabilityKind;
  supported: boolean;
}

export interface McpToolSummary {
  id: string; // <serverId>::<name> — stable composite id used by nodes & agents
  serverId: string;
  serverName: string;
  kind: McpCacheKind;
  name: string;
  title: string | null;
  description: string | null;
  uri: string | null;
  mimeType: string | null;
  inputSchema: Record<string, unknown> | null;
  annotations: Record<string, unknown> | null;
}

export interface McpInvocationRow {
  id: string;
  serverId: string;
  serverName: string | null;
  ownerId: string;
  orgId: string | null;
  toolName: string;
  arguments: Record<string, unknown> | null;
  status: McpInvocationStatus;
  durationMs: number;
  retries: number;
  error: string | null;
  tokensEstimate: number;
  streamed: boolean;
  workflowId: string | null;
  nodeId: string | null;
  agentId: string | null;
  runId: string | null;
  createdAt: string; // ISO
}

export interface McpObservabilitySummary {
  servers: {
    total: number;
    connected: number;
    error: number;
    disabled: number;
    disconnected: number;
  };
  invocations: {
    total: number;
    succeeded: number;
    failed: number;
    errorRate: number; // 0–1
    avgLatencyMs: number;
    p95LatencyMs: number;
    streamed: number;
    recentFailures: McpInvocationRow[];
  };
  topTools: { toolName: string; serverName: string | null; calls: number }[];
}

// Decrypted, never serialized to a response (mirrors StoredIntegrationAccount).

export interface StoredMcpServer {
  id: string;
  ownerId: string;
  orgId: string | null;
  name: string;
  transport: McpTransportId;
  endpoint: string | null;
  command: string | null;
  args: string[];
  env: Record<string, string> | null; // decrypted stdio env
  authScheme: McpAuthScheme | null;
  credentials: McpCredentials | null; // decrypted
  status: McpServerStatus;
  health: McpHealth | null;
  allowList: string[];
  denyList: string[];
  lastSessionId: string | null;
  lastDiscoveredAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface McpConnectOptions {
  server: StoredMcpServer;
  signal: AbortSignal;
  onProgress?: (p: McpProgress) => void;
}

/** A progress notification from a long-running tool call (MCP spec §6.2.3). */
export interface McpProgress {
  progress?: number;
  total?: number;
  message?: string;
}

/** Result of a tool call, normalized for agents and the engine. */
export interface McpCallResult {
  /** Concatenated text content (text parts joined with "\n\n"); "" if none. */
  text: string;
  /** Raw content parts from the server (text/image/audio/resource/resource_link). */
  content: unknown[];
  /** Structured output, when the tool declares an outputSchema. */
  structuredContent: Record<string, unknown> | null;
  isError: boolean;
  tokensEstimate: number;
}

/** Result of reading a resource. */
export interface McpResourceResult {
  uri: string;
  text: string;
  blob: string | null;
  mimeType: string | null;
  tokensEstimate: number;
}

/** Reference to a tool: either explicit (serverId + toolName) or composite id. */
export type ToolInvokeRef =
  | { serverId: string; toolName: string }
  | { tool: string }; // "<serverId>::<toolName>"

// The ONLY surface agents use to touch MCP tools (ctx.tools). Mirrors
// AgentMemoryGateway (lib/agents/memory.ts): permission-checked against the
// agent's declared tools, workspace-isolated, and audited. Agents never import
// the MCP SDK, never touch the connection pool, never see credentials.

export interface McpToolDescriptor {
  /** Composite id "<serverId>::<name>". */
  id: string;
  serverId: string;
  serverName: string;
  name: string;
  title: string | null;
  description: string | null;
  inputSchema: Record<string, unknown> | null;
  annotations: Record<string, unknown> | null;
}

export interface InvokeOptions {
  /** Per-call abort signal (composed with the run's signal by the gateway). */
  signal?: AbortSignal;
  /** Streaming progress callback (forwarded to the SDK callTool request). */
  onProgress?: (p: McpProgress) => void;
  /** Optional run context for audit + memory scoping. */
  workflowId?: string | null;
  nodeId?: string | null;
  runId?: string | null;
  /** Memory scope for the tool_output memory entry (defaults to "agent"). */
  memoryScope?: MemoryScope;
}

export interface AgentToolGateway {
  /** Whether the agent declared a tool permission (e.g. "mcp.invoke"). */
  can(tool: string): boolean;
  /** Throw PermissionError if the agent may not invoke MCP tools. */
  ensure(tool: string): void;
  /** List MCP tools available to this agent (workspace + allow-list + declared-scope filtered). */
  list(): Promise<McpToolDescriptor[]>;
  /** Invoke a tool. Audits + mirrors to memory. Never throws on tool errors — returns isError. */
  invoke(
    ref: ToolInvokeRef,
    args?: Record<string, unknown>,
    opts?: InvokeOptions,
  ): Promise<McpCallResult>;
}

export interface CreateMcpServerInput {
  ownerId: string;
  orgId?: string | null;
  name: string;
  transport: McpTransportId;
  endpoint?: string | null;
  command?: string | null;
  args?: string[];
  env?: Record<string, string> | null;
  authScheme?: McpAuthScheme | null;
  credentials?: McpCredentials | null;
  allowList?: string[];
  denyList?: string[];
  metadata?: Record<string, unknown> | null;
}

export type UpdateMcpServerInput = Partial<Omit<CreateMcpServerInput, "ownerId">>;

export interface RecordInvocationInput {
  serverId: string;
  ownerId: string;
  orgId: string | null;
  toolName: string;
  arguments: Record<string, unknown> | null;
  status: McpInvocationStatus;
  durationMs: number;
  retries: number;
  error?: string | null;
  tokensEstimate?: number;
  streamed?: boolean;
  workflowId?: string | null;
  nodeId?: string | null;
  agentId?: string | null;
  runId?: string | null;
}

export interface ListInvocationsFilters {
  serverId?: string;
  status?: McpInvocationStatus;
  workflowId?: string;
  limit?: number;
}