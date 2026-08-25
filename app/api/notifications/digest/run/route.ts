import { NextResponse } from "next/server";
import { runDueDigests } from "@/lib/notifications";
import { enqueueTick } from "@/lib/notifications/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  const provided = req.headers.get("x-cron-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { enqueued } = await runDueDigests();
    // Re-arm the in-process heartbeat too (best-effort; no-op if queue down).
    await enqueueTick().catch(() => {});
    return NextResponse.json({ ok: true, enqueued });
  } catch (err) {
    return NextResponse.json(
      { error: "Digest tick failed.", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}