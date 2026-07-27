// Readiness probe — every dependency probed (Postgres, Redis, Queue, Memory,
// MCP, AI, Payment) with statuses + latencies, aggregated into healthy/degraded/
// unhealthy. 200 when healthy or degraded (still serving); 503 when unhealthy
// (Postgres down — stop routing traffic). Not cached.
// Unauthenticated (platforms poll without credentials).

import { httpStatusFor, readiness } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const report = await readiness();
  return Response.json(report, {
    status: httpStatusFor(report),
    headers: { "cache-control": "no-store" },
  });
}