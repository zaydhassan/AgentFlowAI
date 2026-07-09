// POST /api/stripe/checkout — creates a Stripe Checkout Session for the
// requested plan + interval and returns its URL.
//
// Authenticated users only. Returns 401 for anonymous callers.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getStripe, getPriceId, stripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

type Body = { plan: "pro" | "business"; interval: "monthly" | "yearly" };

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    // requireUser redirects to /login on failure; only happens for direct
    // API hits.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { plan, interval } = body;

  // Test-mode fallback: no Stripe key. Simulate the redirect to a placeholder
  // page that records a Free plan in the DB and reports success. The fallback
  // is checked BEFORE the price-id lookup because in dev we don't have one.
  if (!stripeConfigured) {
    const url = new URL("/settings/billing?simulated=1&plan=" + plan + "&interval=" + interval, req.url);
    return NextResponse.json({ url: url.toString(), simulated: true });
  }

  const priceId = getPriceId(plan, interval);
  if (!priceId) {
    return NextResponse.json(
      { error: `Missing Stripe price ID for ${plan}:${interval}. Set STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()} in your .env.` },
      { status: 500 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not initialized" }, { status: 500 });
  }

  // Reuse or create a Stripe customer.
  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { stripeCustomerId: true, email: true, name: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let customerId = existing.stripeCustomerId;
  if (!customerId || customerId.startsWith("pending_")) {
    const customer = await stripe.customers.create({
      email: existing.email ?? undefined,
      name: existing.name ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id },
    });
  }

  const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/settings/billing?canceled=1`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    automatic_tax: { enabled: false },
    metadata: { userId: user.id, plan, interval },
  });

  return NextResponse.json({ url: session.url });
}
