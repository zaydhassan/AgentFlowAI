import "server-only";
import { ALL_PROVIDERS } from "./checks";
import type { CheckResult, DetailsReport, HealthStatus, ReadinessReport } from "./types";
import { flushLogger, getLogger } from "@/lib/logger";

export * from "./types";
export { ALL_PROVIDERS } from "./checks";

const healthLogger = getLogger("health");

const OVERALL_BUDGET_MS = 2000;

function clampTimeout(ms: number): number {
  return Math.min(Math.max(ms, 100), OVERALL_BUDGET_MS);
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Run every probe in parallel; each capped at `timeoutMs`. Returns aligned results. */
export async function runHealthChecks(timeoutMs?: number): Promise<CheckResult[]> {
  const t = clampTimeout(Number(timeoutMs ?? process.env.HEALTH_CHECK_TIMEOUT_MS ?? 1500));
  // Outer guard: never exceed the 2s budget even if a probe ignores its timeout.
  const guarded = ALL_PROVIDERS.map(async (p): Promise<CheckResult> => {
    try {
      const r = await Promise.race([
        p.check(t),
        new Promise<CheckResult>((resolve) =>
          setTimeout(
            () => resolve({ name: p.name, status: "degraded", latencyMs: t, configured: false, error: `check exceeded ${OVERALL_BUDGET_MS}ms budget` }),
            OVERALL_BUDGET_MS,
          ),
        ),
      ]);
      return { ...r, critical: p.critical };
    } catch (e) {
      return {
        name: p.name,
        status: "degraded",
        latencyMs: t,
        configured: false,
        critical: p.critical,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });
  return Promise.all(guarded);
}

/** Aggregate per-check statuses into one overall status. */
export function aggregateStatus(results: CheckResult[]): HealthStatus {
  let unhealthy = false;
  let degraded = false;
  for (const r of results) {
    if (r.status === "unhealthy") {
      if (r.critical) unhealthy = true;
      else degraded = true;
    } else if (r.status === "degraded") {
      degraded = true;
    }
  }
  return unhealthy ? "unhealthy" : degraded ? "degraded" : "healthy";
}

/** Log every non-healthy check (warn level) + flush the async sink. */
async function logFailures(checks: CheckResult[]): Promise<void> {
  let logged = false;
  for (const c of checks) {
    if (c.status !== "healthy") {
      healthLogger.warn(`health.check.${c.status}`, {
        check: c.name,
        configured: c.configured,
        latencyMs: c.latencyMs,
        error: c.error,
        detail: c.detail,
      });
      logged = true;
    }
  }
  if (logged) await flushLogger();
}

/** Liveness — the process is alive. Cheap; no dependency checks. */
export function liveness(): { status: "ok" } {
  return { status: "ok" };
}

/** Readiness — every dependency probed, statuses + latencies aggregated. */
export async function readiness(): Promise<ReadinessReport> {
  const checks = await runHealthChecks();
  await logFailures(checks);
  return { status: aggregateStatus(checks), checks, timestamp: nowIso() };
}

/** Detailed diagnostics — readiness + version/build/node/environment/uptime. */
export async function details(): Promise<DetailsReport> {
  const checks = await runHealthChecks();
  await logFailures(checks);
  return {
    status: aggregateStatus(checks),
    checks,
    timestamp: nowIso(),
    version: process.env.APP_VERSION ?? "0.1.0",
    buildTimestamp: process.env.BUILD_TIMESTAMP ?? null,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV ?? "development",
    uptimeSeconds: Math.round(process.uptime()),
  };
}

/** HTTP status for a report — 503 only when UNHEALTHY (still serve when degraded). */
export function httpStatusFor(report: { status: HealthStatus }): number {
  return report.status === "unhealthy" ? 503 : 200;
}