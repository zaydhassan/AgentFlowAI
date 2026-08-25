import "server-only";
import { getMemoryEngine, embeddingConfigured } from "@/lib/memory";
import type { MemoryHit, MemoryScope } from "@/lib/memory/types";
import type { ToolPermission } from "./types";

export class PermissionError extends Error {
  constructor(agent: string, tool: string) {
    super(`Agent "${agent}" is not permitted to use tool "${tool}"`);
    this.name = "PermissionError";
  }
}

export interface MemoryGatewayOptions {
  agent: string;
  userId: string;
  orgId: string | null;
  workflowId: string | null;
  nodeId: string | null;
  defaultScope: MemoryScope;
  tools: ToolPermission[];
}

export interface RememberResult {
  id: string | null;
  deduplicated: boolean;
  /** True when embeddings are unconfigured and the engine no-op'd. */
  disabled: boolean;
}

export class AgentMemoryGateway {
  private readonly engine = getMemoryEngine();
  constructor(private readonly opts: MemoryGatewayOptions) {}

  private can(tool: string): boolean {
    return this.opts.tools.some((t) => t.tool === tool);
  }

  private ensure(tool: string): void {
    if (!this.can(tool)) throw new PermissionError(this.opts.agent, tool);
  }

  recall(query: string, opts?: { topK?: number; scope?: MemoryScope }): Promise<MemoryHit[]> {
    this.ensure("memory.recall");
    if (!embeddingConfigured()) return Promise.resolve([]);
    return this.engine
      .recall({
        userId: this.opts.userId,
        orgId: this.opts.orgId,
        scope: opts?.scope ?? this.opts.defaultScope,
        query,
        workflowId: this.opts.workflowId,
        agentId: this.opts.nodeId,
        topK: opts?.topK ?? 5,
        threshold: 0.7,
      })
      .then((r) => r.hits)
      .catch(() => [] as MemoryHit[]);
  }

  remember(
    content: string,
    opts?: { importance?: number; kind?: string; metadata?: Record<string, unknown>; scope?: MemoryScope },
  ): Promise<RememberResult> {
    this.ensure("memory.remember");
    if (!embeddingConfigured()) {
      return Promise.resolve({ id: null, deduplicated: false, disabled: true });
    }
    return this.engine
      .remember({
        userId: this.opts.userId,
        orgId: this.opts.orgId,
        scope: opts?.scope ?? this.opts.defaultScope,
        content,
        importance: opts?.importance ?? 0.6,
        workflowId: this.opts.workflowId,
        agentId: this.opts.nodeId,
        metadata: { kind: opts?.kind ?? "finding", ...(opts?.metadata ?? {}) },
      })
      .then((r) => ({ id: r.memory?.id ?? null, deduplicated: r.deduplicated, disabled: false }))
      .catch(() => ({ id: null, deduplicated: false, disabled: true }));
  }
}