// POST /api/payments/webhook/stripe — Stripe webhook, refactored to delegate to
// the StripeProvider + repository. DORMANT under the default
// PAYMENT_PROVIDER=razorpay config; fully functional when PAYMENT_PROVIDER=stripe.
//
// Must read the raw body for signature verification (request.text()).

import { NextResponse } from "next/server";
import { repository } from "@/lib/payments/repository";
import { activeProviderId, getPaymentProvider } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (activeProviderId() !== "stripe") {
    // Not the active provider — refuse so misrouted events don't mutate state.
    return NextResponse.json({ error: "Stripe is not the active provider." }, { status: 503 });
  }

  const provider = getPaymentProvider();
  if (!provider.configured) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const rawBody = await req.text();
  const verified = provider.verifyWebhookSignature(rawBody, req.headers);
  if (!verified.ok || !verified.event) {
    return NextResponse.json({ error: "Webhook signature verification failed." }, { status: 400 });
  }
  const event = verified.event;

  if (await repository.events.seen("stripe", event.id)) {
    return NextResponse.json({ received: true, dedup: true });
  }

  try {
    await provider.handleWebhookEvent(event);
  } catch (err) {
    console.error("[stripe webhook] handler error", event.type, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  await repository.events.record("stripe", event.id, event.type);
  return NextResponse.json({ received: true });
}