// Detailed diagnostics — readiness + application version, build timestamp, Node
// version, environment, uptime, and per-dependency latency/status. Same status
// code policy as /ready (503 only when unhealthy). Not cached.
// Unauthenticated (intended for ops dashboards / on-call debugging). Consider
// restricting at the edge/proxy in production if the diagnostics are sensitive.

import { details, httpStatusFor } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const report = await details();
  return Response.json(report, {
    status: httpStatusFor(report),
    headers: { "cache-control": "no-store" },
  });
}