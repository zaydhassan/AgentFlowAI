import { NextResponse } from "next/server";
import { repository, updatePreferencesForUser } from "@/lib/notifications";
import { appUrl } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const pref = await repository.getPreferencesByToken(token);
  if (!pref) {
    return NextResponse.json({ error: "Invalid or expired unsubscribe link." }, { status: 404 });
  }

  // One-click unsubscribe: turn off every email category + digests + product
  // updates. The in-app feed stays on (it is the dashboard source of truth).
  await updatePreferencesForUser(pref.userId, {
    workflowEmails: false,
    aiEmails: false,
    billingEmails: false,
    securityEmails: false,
    integrationEmails: false,
    dailySummary: false,
    weeklySummary: false,
    productUpdates: false,
    frequency: "instant",
  });

  const prefsHref = appUrl(`/notifications/preferences?token=${encodeURIComponent(token)}`);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed — AgentFlow AI</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{margin:0;background:#f6f7fb;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f1020;}
    .card{max-width:480px;margin:60px auto;background:#fff;border:1px solid #e7e8ef;border-radius:16px;padding:36px;text-align:center;}
    .badge{display:inline-block;width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#7c5cff,#22d3ee);margin-bottom:18px;}
    h1{font-size:20px;margin:0 0 8px;}
    p{color:#5b5c70;font-size:14px;line-height:1.55;margin:0 0 18px;}
    a{color:#7c5cff;text-decoration:none;font-weight:600;}
  </style></head>
  <body><div class="card">
    <div class="badge"></div>
    <h1>You've been unsubscribed</h1>
    <p>You will no longer receive AgentFlow notification emails. Your in-app notifications are unaffected.</p>
    <p><a href="${prefsHref}">Manage notification preferences</a></p>
  </div></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}