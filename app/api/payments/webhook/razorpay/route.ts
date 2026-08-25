import { NextResponse } from "next/server";
import { repository } from "@/lib/payments/repository";
import { getPaymentProvider } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Razorpay webhook secret is not configured." },
      { status: 503 },
    );
  }

  const provider = getPaymentProvider();
  if (provider.id !== "razorpay" || !provider.configured) {
    return NextResponse.json({ error: "Razorpay is not configured." }, { status: 503 });
  }

  const rawBody = await req.text();
  const verified = provider.verifyWebhookSignature(rawBody, req.headers);
  if (!verified.ok || !verified.event) {
    return NextResponse.json({ error: "Webhook signature verification failed." }, { status: 400 });
  }
  const event = verified.event;

  // Idempotency fast path — true idempotency is the unique-key upserts downstream.
  if (await repository.events.seen("razorpay", event.id)) {
    return NextResponse.json({ received: true, dedup: true });
  }

  try {
    await provider.handleWebhookEvent(event);
  } catch (err) {
    console.error("[razorpay webhook] handler error", event.type, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  await repository.events.record("razorpay", event.id, event.type);
  return NextResponse.json({ received: true });
}