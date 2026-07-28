// POST /api/notifications/digest — build + send a digest for the current user
// on demand (dev/admin testing). Body: { frequency: "hourly"|"daily"|"weekly" }.
// Runs synchronously and returns the period covered. In production, digests are
// driven by the scheduler heartbeat / cron route — this is a manual trigger.

import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth/api";
import { triggerDigestForUser } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  frequency: z.enum(["hourly", "daily", "weekly"]).default("daily"),
});

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid frequency.", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { periodStart, periodEnd } = await triggerDigestForUser(user.id, parsed.data.frequency);
    return NextResponse.json({ ok: true, frequency: parsed.data.frequency, periodStart, periodEnd });
  } catch (err) {
    return NextResponse.json(
      { error: "Digest build failed.", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}