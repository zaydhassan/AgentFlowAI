import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { queueSnapshot } from "@/lib/queue";
import { startMemoryEmbeddingWorker } from "@/lib/queue/workers/memory-embedding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await apiUser();
  if ("error" in u) return u.error;
  return NextResponse.json({ queues: await queueSnapshot() });
}

// POST /api/queue → start the memory-embedding worker (idempotent). Useful when
// QUEUE_WORKER_AUTOSTART=false or to restart after a Redis outage. The worker
// also autostarts via instrumentation.ts on server boot.
export async function POST() {
  const u = await apiUser();
  if ("error" in u) return u.error;
  startMemoryEmbeddingWorker();
  return NextResponse.json({ ok: true, worker: "memory-embedding" });
}