// POST /api/stripe/webhook — receives Stripe events, verifies the signature,
// and updates the local DB. Idempotent (keyed on event.id).
//
// Important: must read the raw body for signature verification. We bypass
// the parsed JSON and use request.text().

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripe, stripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";
// Keep dynamic so the route is never cached.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!stripeConfigured) {
    return NextResponse.json(
      { error: "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env." },
      { status: 503 },
    );
  }
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not initialized" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${msg}` }, { status: 400 });
  }

  // Idempotency: we keep an AuditLog row per event id. (Re-deliveries no-op.)
  try {
    const existing = await prisma.auditLog.findFirst({
      where: { action: `stripe.event.${event.id}` },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ received: true, dedup: true });
    }
  } catch {
    // ignore — fall through
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(s);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(sub, event.type);
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(inv);
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(inv);
        break;
      }
      default:
        // Unhandled event type — record it for observability.
        break;
    }
  } catch (err) {
    console.error("[stripe webhook] handler error", event.type, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  try {
    await prisma.auditLog.create({
      data: { action: `stripe.event.${event.id}`, metadata: { type: event.type } as object },
    });
  } catch {
    // ignore
  }
  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId =
    (session.metadata?.userId as string | undefined) ??
    (typeof session.customer === "string" ? await findUserIdByCustomer(session.customer) : null);
  if (!userId) return;

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (customerId) {
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  }

  // If this checkout produced a subscription, the customer.subscription.created
  // event will fire next; no need to do the work here.
}

async function handleSubscriptionChange(sub: Stripe.Subscription, type: string) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (!user) {
    console.warn("[stripe webhook] subscription for unknown customer", customerId);
    return;
  }

  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  const planFromPrice = priceIdToPlan(priceId);
  // Newer Stripe SDKs move current_period_end onto the subscription item.
  const periodEnd = item?.current_period_end ?? null;
  const currentPeriodEnd =
    periodEnd && Number.isFinite(periodEnd) ? new Date(periodEnd * 1000) : null;

  const plan = type === "customer.subscription.deleted" ? "free" : planFromPrice ?? "pro";

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      plan,
      status: sub.status,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
    create: {
      userId: user.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      plan,
      status: sub.status,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (!user) return;
  await prisma.invoice.upsert({
    where: { stripeInvoiceId: invoice.id ?? "" },
    update: {
      status: invoice.status ?? "paid",
      amount: invoice.amount_paid ?? invoice.amount_due ?? 0,
      number: invoice.number ?? null,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      pdfUrl: invoice.invoice_pdf ?? null,
    },
    create: {
      userId: user.id,
      stripeInvoiceId: invoice.id ?? `unknown_${Date.now()}`,
      number: invoice.number ?? null,
      amount: invoice.amount_paid ?? invoice.amount_due ?? 0,
      currency: invoice.currency ?? "usd",
      status: invoice.status ?? "paid",
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      pdfUrl: invoice.invoice_pdf ?? null,
    },
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (!user) return;
  await prisma.invoice.upsert({
    where: { stripeInvoiceId: invoice.id ?? "" },
    update: { status: "uncollectible" },
    create: {
      userId: user.id,
      stripeInvoiceId: invoice.id ?? `failed_${Date.now()}`,
      amount: invoice.amount_due ?? 0,
      currency: invoice.currency ?? "usd",
      status: "uncollectible",
      number: invoice.number ?? null,
    },
  });
}

function priceIdToPlan(priceId: string | null): "pro" | "business" | null {
  if (!priceId) return null;
  if (
    priceId === process.env.STRIPE_PRICE_PRO_MONTHLY ||
    priceId === process.env.STRIPE_PRICE_PRO_YEARLY
  ) return "pro";
  if (
    priceId === process.env.STRIPE_PRICE_BUSINESS_MONTHLY ||
    priceId === process.env.STRIPE_PRICE_BUSINESS_YEARLY
  ) return "business";
  return null;
}

async function findUserIdByCustomer(customerId: string): Promise<string | null> {
  const u = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return u?.id ?? null;
}
