// POST /api/payments/refund — refund a captured payment. Admin-only.
// Body: { paymentId, amountMinor? }
//   - Razorpay: refunds a payment (razorpay payment id).
//   - Stripe: refunds a payment intent.

import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { getPaymentProvider } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { paymentId: string; amountMinor?: number };

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const user = u.user;

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden — refunds are admin-only." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!body.paymentId) {
    return NextResponse.json({ error: "Missing paymentId." }, { status: 400 });
  }

  const provider = getPaymentProvider();
  if (!provider.configured) {
    return NextResponse.json(
      { error: "Payments are not configured on this environment." },
      { status: 503 },
    );
  }

  try {
    await provider.refund(body.paymentId, body.amountMinor);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Refund failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}