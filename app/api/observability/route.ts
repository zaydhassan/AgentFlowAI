// GET /api/observability — the aggregated, owner-scoped snapshot that powers
// the AI Observability page: KPIs (p50/p99 latency, cost, success rate,
// retries, running now), the 14-day trend, AI-node call distribution, in-flight
// runs (with their workflowId so the client can open the per-run SSE stream),
// recent executions, prompt versions, audit logs, and an optional MCP fold-in.
//
// Polled by the client hook every 10s + on focus. `force-dynamic` keeps it
// uncached; `nodejs` runtime is required for Prisma + the server-only module.

import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { getObservabilitySummary } from "@/lib/observability/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await apiUser();
  if ("error" in u) return u.error;
  return NextResponse.json(await getObservabilitySummary(u.user.id));
}