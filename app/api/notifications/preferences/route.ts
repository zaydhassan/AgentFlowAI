// GET /api/notifications/preferences[?token=]  — fetch preferences
// PUT /api/notifications/preferences[?token=]  — save preferences (validates +
//   writes through the cache). Returns the stored shape.
//
// Auth: session (apiUser) OR a valid ?token=<unsubscribeToken> (so the
// preferences link in every email works for logged-out recipients). Both paths
// resolve the same userId; the token path is ownership-verified by the token
// itself (never accepts a bare userId). The body is zod-validated.

import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth/api";
import { getPreferencesForUser, updatePreferencesForUser, repository } from "@/lib/notifications";
import { DEFAULT_PREFERENCES } from "@/lib/notifications/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prefsSchema = z.object({
  workflowEmails: z.boolean(),
  aiEmails: z.boolean(),
  billingEmails: z.boolean(),
  securityEmails: z.boolean(),
  integrationEmails: z.boolean(),
  dailySummary: z.boolean(),
  weeklySummary: z.boolean(),
  productUpdates: z.boolean(),
  frequency: z.enum(["instant", "hourly", "daily", "weekly"]),
  quietHoursStart: z.string().nullable().optional(),
  quietHoursEnd: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
});

/** Resolve the acting userId from a session OR a ?token= unsubscribe token. */
async function resolveUserId(req: Request): Promise<{ userId: string } | { error: NextResponse }> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (token) {
    const pref = await repository.getPreferencesByToken(token);
    if (!pref) return { error: NextResponse.json({ error: "Invalid or expired link." }, { status: 404 }) };
    return { userId: pref.userId };
  }
  const u = await apiUser();
  if ("error" in u) return { error: u.error };
  return { userId: u.user.id };
}

function stripToken<T extends { unsubscribeToken?: string }>(prefs: T) {
  const { unsubscribeToken: _t, ...client } = prefs;
  void _t;
  return client;
}

export async function GET(req: Request) {
  const res = await resolveUserId(req);
  if ("error" in res) return res.error;
  const prefs = await getPreferencesForUser(res.userId);
  return NextResponse.json({ ...DEFAULT_PREFERENCES, ...stripToken(prefs as typeof prefs & { unsubscribeToken?: string }) });
}

export async function PUT(req: Request) {
  const res = await resolveUserId(req);
  if ("error" in res) return res.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = prefsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preferences.", details: parsed.error.flatten() }, { status: 400 });
  }

  const saved = await updatePreferencesForUser(res.userId, parsed.data);
  return NextResponse.json(saved);
}