export type HealthStatus = "healthy" | "degraded" | "unhealthy";

/** Result of probing one dependency. Extra fields (e.g. queues, provider) are allowed. */
export interface CheckResult {
  name: string;
  status: HealthStatus;
  latencyMs: number;
  /** Whether the dependency is configured/active (false when intentionally absent). */
  configured?: boolean;
  /** True when a failure makes the overall status UNHEALTHY (postgres only). */
  critical?: boolean;
  /** Human-readable summary / detail. */
  detail?: string;
  /** Error message when the probe failed. */
  error?: string;
  [key: string]: unknown;
}

/**
 * Probes one dependency. `check` must self-cap at `timeoutMs` so the runner's
 * overall budget (2s) holds. Return a CheckResult — do NOT throw (the runner
 * also guards, but a thrown check is treated as degraded).
 */
export interface HealthProvider {
  readonly name: string;
  /** If true, an `unhealthy` result makes the overall status UNHEALTHY. */
  readonly critical: boolean;
  check(timeoutMs: number): Promise<CheckResult>;
}

/** Readiness report — GET /api/health/ready. */
export interface ReadinessReport {
  status: HealthStatus;
  checks: CheckResult[];
  timestamp: string;
}

/** Detailed diagnostics — GET /api/health/details. */
export interface DetailsReport extends ReadinessReport {
  version: string;
  buildTimestamp: string | null;
  nodeVersion: string;
  environment: string;
  uptimeSeconds: number;
}