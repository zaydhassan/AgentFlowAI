import "server-only";
import { prisma } from "@/lib/db";
import { getCache } from "@/lib/cache";
import { queueSnapshot } from "@/lib/queue";
import { memoryConfigured } from "@/lib/memory";
import { aiConfigured, aiProvider } from "@/lib/ai/provider";
import { activeProviderId, paymentConfigured } from "@/lib/payments";
import type { CheckResult, HealthProvider } from "./types";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Race a promise against a timeout. Rejects on timeout (the probe maps that to a status). */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} check timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

// A failure here is the only thing that makes the app UNHEALTHY — without the
// database the app cannot serve.
export const postgresProvider: HealthProvider = {
  name: "postgres",
  critical: true,
  async check(timeoutMs: number): Promise<CheckResult> {
    const start = Date.now();
    try {
      await withTimeout(prisma.$queryRaw`SELECT 1`, timeoutMs, "postgres");
      return { name: "postgres", status: "healthy", latencyMs: Date.now() - start, configured: true, detail: "SELECT 1 ok" };
    } catch (e) {
      return { name: "postgres", status: "unhealthy", latencyMs: Date.now() - start, configured: true, error: errMsg(e) };
    }
  },
};

// Redis failure → DEGRADED (the cache + queue fall back to in-memory). When
// REDIS_URL is unset the app intentionally runs without Redis — that's healthy,
// not degraded (reported with configured:false).
export const redisProvider: HealthProvider = {
  name: "redis",
  critical: false,
  async check(timeoutMs: number): Promise<CheckResult> {
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      return { name: "redis", status: "healthy", latencyMs: 0, configured: false, detail: "REDIS_URL not set (in-memory/noop cache)" };
    }
    const start = Date.now();
    try {
      const ok = await withTimeout(getCache().ping(), timeoutMs, "redis");
      return {
        name: "redis",
        status: ok ? "healthy" : "degraded",
        latencyMs: Date.now() - start,
        configured: true,
        detail: ok ? "PING ok" : "PING returned false",
      };
    } catch (e) {
      return { name: "redis", status: "degraded", latencyMs: Date.now() - start, configured: true, error: errMsg(e) };
    }
  },
};

// Queue failure → DEGRADED (enqueue falls back to synchronous). When the queue
// is disabled or Redis is absent it's intentionally off — healthy, configured:false.
export const queueProvider: HealthProvider = {
  name: "queue",
  critical: false,
  async check(timeoutMs: number): Promise<CheckResult> {
    const enabled = (process.env.QUEUE_ENABLED ?? "true").toLowerCase() !== "false";
    const url = process.env.REDIS_URL?.trim();
    if (!enabled || !url) {
      return { name: "queue", status: "healthy", latencyMs: 0, configured: false, detail: "queue disabled or REDIS_URL unset" };
    }
    const start = Date.now();
    try {
      const snap = await withTimeout(queueSnapshot(), timeoutMs, "queue");
      const queues = Object.keys(snap);
      return {
        name: "queue",
        status: "healthy",
        latencyMs: Date.now() - start,
        configured: true,
        detail: `${queues.length} queue(s) registered`,
        queues: snap,
      };
    } catch (e) {
      return { name: "queue", status: "degraded", latencyMs: Date.now() - start, configured: true, error: errMsg(e) };
    }
  },
};

// Memory failure / not configured → DEGRADED (memory-enabled nodes no-op
// cleanly). Config check only — no embeddings call on every probe.
export const memoryProvider: HealthProvider = {
  name: "memory",
  critical: false,
  async check(): Promise<CheckResult> {
    const start = Date.now();
    const configured = memoryConfigured();
    return {
      name: "memory",
      status: configured ? "healthy" : "degraded",
      latencyMs: Date.now() - start,
      configured,
      detail: configured ? "embeddings configured" : "memory disabled (embeddings not configured)",
    };
  },
};

// MCP is user-scoped (no system ping exported), so this is a system-scoped
// read-only count of configured MCP servers via the shared prisma client —
// confirms the MCP data layer is reachable and surfaces how many servers exist.
// MCP failure → DEGRADED (optional tooling).
export const mcpProvider: HealthProvider = {
  name: "mcp",
  critical: false,
  async check(timeoutMs: number): Promise<CheckResult> {
    const start = Date.now();
    try {
      const count = await withTimeout(prisma.mcpServer.count(), timeoutMs, "mcp");
      return {
        name: "mcp",
        status: "healthy",
        latencyMs: Date.now() - start,
        configured: true,
        detail: `${count} MCP server(s) configured`,
        servers: count,
      };
    } catch (e) {
      return { name: "mcp", status: "degraded", latencyMs: Date.now() - start, configured: false, error: errMsg(e) };
    }
  },
};

// AI not configured → DEGRADED (the app runs on the deterministic fallback —
// READY, but with degraded capability, per the spec). Config check only: a live
// model completion on every probe would cost money + latency and add an external
// dependency to the hot health path.
export const aiProviderCheck: HealthProvider = {
  name: "ai",
  critical: false,
  async check(): Promise<CheckResult> {
    const start = Date.now();
    const configured = aiConfigured;
    const provider = aiProvider();
    return {
      name: "ai",
      status: configured ? "healthy" : "degraded",
      latencyMs: Date.now() - start,
      configured,
      provider,
      detail: configured ? `provider: ${provider}` : "deterministic fallback (no API key configured)",
    };
  },
};

// Payments not configured → DEGRADED (checkout returns 503; the rest of the app
// serves normally). Config check only — a live provider API call per probe
// would be rate-limited and slow.
export const paymentProviderCheck: HealthProvider = {
  name: "payment",
  critical: false,
  async check(): Promise<CheckResult> {
    const start = Date.now();
    const configured = paymentConfigured();
    const provider = activeProviderId();
    return {
      name: "payment",
      status: configured ? "healthy" : "degraded",
      latencyMs: Date.now() - start,
      configured,
      provider,
      detail: configured ? `provider: ${provider}` : `${provider} not configured`,
    };
  },
};

/** All probes, in a stable order. The runner preserves this order in results. */
export const ALL_PROVIDERS: HealthProvider[] = [
  postgresProvider,
  redisProvider,
  queueProvider,
  memoryProvider,
  mcpProvider,
  aiProviderCheck,
  paymentProviderCheck,
];