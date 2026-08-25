/**
 * Agent run limits — shared by the standalone agent runner
 * (app/api/agents/run/route.ts) and the in-workflow Multi-Agent node
 * (lib/execution/actions/multiagent.ts). Both clamp user/node-supplied values
 * into the same bounds so a workflow node and a direct API call behave
 * identically.
 */
export const AGENT_ITERATIONS_MIN = 1;
export const AGENT_ITERATIONS_MAX = 6;
export const AGENT_ITERATIONS_DEFAULT = 2;

/** Per-run timeout: 10s floor, 5min ceiling, 2min default. */
export const AGENT_TIMEOUT_MIN_MS = 10_000;
export const AGENT_TIMEOUT_MAX_MS = 300_000;
export const AGENT_TIMEOUT_DEFAULT_MS = 120_000;

/**
 * Coerce an unknown config value into a clamped integer. Non-finite / missing
 * values fall back to `dflt`; otherwise the value is rounded and clamped to
 * [`lo`, `hi`].
 */
export function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}