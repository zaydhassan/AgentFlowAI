import "server-only";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { repository } from "@/lib/payments/repository";
import { PLAN_META, intervalFromPeriod, type Interval, type PaidPlan } from "@/lib/payments/plans";
import type {
  CheckoutInit,
  CheckoutSession,
  PaymentMethodData,
  PaymentProvider,
  PaymentVerification,
  PlanId,
  ProviderSubscriptionState,
  VerificationResult,
  WebhookEvent,
} from "@/lib/payments/types";

export const STRIPE_API_VERSION = "2026-06-24.dahlia" as const;

const PRICE_ENV: Record<string, () => string | undefined> = {
  "pro:monthly": () => process.env.STRIPE_PRICE_PRO_MONTHLY ?? process.env.STRIPE_PRO_PRICE_ID,
  "pro:yearly": () => process.env.STRIPE_PRICE_PRO_YEARLY,
  "business:monthly": () => process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? process.env.STRIPE_BUSINESS_PRICE_ID,
  "business:yearly": () => process.env.STRIPE_PRICE_BUSINESS_YEARLY,
};

const PAID_PLANS: PaidPlan[] = ["pro", "business"];
const INTERVALS: Interval[] = ["monthly", "yearly"];

function envPriceId(plan: PaidPlan, interval: Interval): string | undefined {
  return PRICE_ENV[`${plan}:${interval}`]?.();
}

export class StripeProvider implements PaymentProvider {
  readonly id = "stripe" as const;

  get configured(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  }

  private client(): Stripe {
    const s = getStripe();
    if (!s) throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY in .env.");
    return s;
  }

  private yearlyAmountCents(plan: PaidPlan): number {
    return PLAN_META[plan].priceAmount.yearly * 12 * 100;
  }
  private monthlyAmountCents(plan: PaidPlan): number {
    return PLAN_META[plan].priceAmount.monthly * 100;
  }

  private async getOrCreatePriceId(plan: PaidPlan, interval: Interval): Promise<string | null> {
    const env = envPriceId(plan, interval);
    if (env) return env;

    const stripe = getStripe();
    if (!stripe) return null;

    const cached = await repository.planPrices.find("stripe", plan, interval);
    if (cached) return cached;

    const amount = interval === "monthly" ? this.monthlyAmountCents(plan) : this.yearlyAmountCents(plan);
    const product = await stripe.products.create({
      name: `AgentFlow ${PLAN_META[plan].label}`,
      description: PLAN_META[plan].tagline,
      metadata: { plan, app: "agentflow" },
    });
    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: amount,
      recurring: { interval: interval === "monthly" ? "month" : "year" },
      metadata: { plan, interval, app: "agentflow" },
    });
    await repository.planPrices.saveStripe(plan, interval, product.id, price.id);
    return price.id;
  }

  private async priceIdToPlan(priceId: string | null): Promise<PaidPlan | null> {
    if (!priceId) return null;
    for (const plan of PAID_PLANS) {
      if (envPriceId(plan, "monthly") === priceId || envPriceId(plan, "yearly") === priceId) return plan;
    }
    const cached = await prisma.planPrice.findUnique({ where: { stripePriceId: priceId }, select: { plan: true } });
    return (cached?.plan as PaidPlan | null) ?? null;
  }

  private async priceIdToInterval(priceId: string | null): Promise<Interval | null> {
    if (!priceId) return null;
    for (const plan of PAID_PLANS) {
      if (envPriceId(plan, "monthly") === priceId) return "monthly";
      if (envPriceId(plan, "yearly") === priceId) return "yearly";
    }
    const cached = await prisma.planPrice.findUnique({ where: { stripePriceId: priceId }, select: { interval: true } });
    return (cached?.interval as Interval | null) ?? null;
  }

  async createCheckout(init: CheckoutInit): Promise<CheckoutSession> {
    if (init.plan === "free" || init.plan === "enterprise") {
      throw new Error(`Plan ${init.plan} does not support self-serve checkout.`);
    }
    const stripe = this.client();
    const plan = init.plan as PaidPlan;

    const priceId = envPriceId(plan, init.interval) ?? (await this.getOrCreatePriceId(plan, init.interval));
    if (!priceId) throw new Error(`Could not resolve a Stripe price for ${plan}:${init.interval}.`);

    const existing = await prisma.user.findUnique({
      where: { id: init.userId },
      select: { stripeCustomerId: true, email: true, name: true },
    });
    let customerId = existing?.stripeCustomerId ?? null;
    if (!customerId || customerId.startsWith("pending_")) {
      const customer = await stripe.customers.create({
        email: existing?.email ?? undefined,
        name: existing?.name ?? undefined,
        metadata: { userId: init.userId },
      });
      customerId = customer.id;
      await repository.customers.linkToUser("stripe", init.userId, customer.id);
    }

    const hasSub = await prisma.subscription.findUnique({ where: { userId: init.userId }, select: { status: true } });
    const firstSubscription = !hasSub || hasSub.status === "free" || !hasSub.status;
    const requestedTrial = init.trialDays && init.trialDays > 0 ? init.trialDays : trialDays();
    const applyTrial = firstSubscription && requestedTrial > 0;

    const baseUrl = appUrl(init.returnUrl ?? "");
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: !applyTrial,
      billing_address_collection: "auto",
      automatic_tax: { enabled: false },
      ...(applyTrial
        ? { subscription_data: { trial_period_days: requestedTrial, metadata: { userId: init.userId, plan, interval: init.interval } } }
        : { subscription_data: { metadata: { userId: init.userId, plan, interval: init.interval } } }),
      success_url: `${baseUrl}/settings/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/settings/billing?canceled=1`,
      metadata: { userId: init.userId, plan, interval: init.interval },
    });

    return { provider: "stripe", url: session.url ?? undefined };
  }

  async verifyPayment(_v: PaymentVerification): Promise<VerificationResult> {
    // Stripe uses a redirect + webhook flow; the client never posts a payment
    // result to verify. The webhook is the source of truth.
    return { ok: true };
  }

  async getPaymentMethod(userId: string): Promise<PaymentMethodData | null> {
    const stripe = getStripe();
    if (!stripe) return null;
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
    const customerId = u?.stripeCustomerId;
    if (!customerId || customerId.startsWith("pending_")) return null;
    try {
      const customer = await stripe.customers.retrieve(customerId, {
        expand: ["invoice_settings.default_payment_method"],
      });
      if (customer.deleted) return null;
      const pm = customer.invoice_settings?.default_payment_method;
      const card =
        pm && typeof pm === "object" && "card" in pm
          ? (pm as { card: { brand: string; last4: string; exp_month: number; exp_year: number } }).card
          : null;
      const addr = customer.address ?? null;
      return {
        brand: card?.brand ?? null,
        last4: card?.last4 ?? null,
        expMonth: card?.exp_month ?? null,
        expYear: card?.exp_year ?? null,
        country: addr?.country ?? null,
        address: addr
          ? {
              line1: addr.line1,
              line2: addr.line2,
              city: addr.city,
              state: addr.state,
              postalCode: addr.postal_code,
              country: addr.country,
            }
          : null,
      };
    } catch {
      return null;
    }
  }

  async getSubscriptionState(subId: string): Promise<ProviderSubscriptionState | null> {
    const stripe = this.client();
    try {
      const sub = await stripe.subscriptions.retrieve(subId, { expand: ["default_payment_method", "items.data.price.product"] });
      const item = sub.items?.data?.[0];
      const priceId = item?.price?.id ?? null;
      const planFromPrice = await this.priceIdToPlan(priceId);
      const interval = intervalFromPeriod(item?.price?.recurring?.interval) ?? (await this.priceIdToInterval(priceId));
      const periodStart = item?.current_period_start ?? null;
      const periodEnd = item?.current_period_end ?? null;
      const latestInvoice = sub.latest_invoice;
      const product = item?.price?.product;
      const stripeProductId = typeof product === "string" ? product : (product as Stripe.Product | null)?.id ?? null;
      const card = await this.readCard(stripe, sub.default_payment_method);
      return {
        providerSubscriptionId: sub.id,
        plan: (planFromPrice ?? "pro") as PlanId,
        interval,
        status: sub.status,
        currentPeriodStart: periodStart && Number.isFinite(periodStart) ? new Date(periodStart * 1000) : null,
        currentPeriodEnd: periodEnd && Number.isFinite(periodEnd) ? new Date(periodEnd * 1000) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        paused: false,
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        latestInvoiceId: typeof latestInvoice === "string" ? latestInvoice : (latestInvoice as Stripe.Invoice | null)?.id ?? null,
        card: card
          ? { brand: card.brand, last4: card.last4, expMonth: card.expMonth, expYear: card.expYear }
          : null,
      };
    } catch {
      return null;
    }
  }

  async cancelAtPeriodEnd(subId: string): Promise<void> {
    await this.client().subscriptions.update(subId, { cancel_at_period_end: true });
  }

  async pause(_subId: string): Promise<void> {
    // Stripe has no native subscription pause. The Razorpay provider owns this
    // path; StripeProvider is dormant under the default config.
    throw new Error("Pause is not supported for Stripe subscriptions.");
  }

  async resume(subId: string): Promise<void> {
    // For Stripe, "resume" = clear a scheduled cancellation (un-cancel).
    await this.client().subscriptions.update(subId, { cancel_at_period_end: false });
  }

  async changePlan(userId: string, plan: PlanId, interval: Interval): Promise<CheckoutSession> {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    return this.createCheckout({
      userId,
      userEmail: u?.email ?? null,
      userName: u?.name ?? null,
      plan,
      interval,
    });
  }

  async refund(paymentId: string, amountMinor?: number): Promise<void> {
    const stripe = this.client();
    await stripe.refunds.create({ payment_intent: paymentId, ...(amountMinor ? { amount: amountMinor } : {}) });
  }

  async createManagementSession(userId: string, returnUrl: string): Promise<CheckoutSession> {
    const stripe = this.client();
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
    if (!u?.stripeCustomerId || u.stripeCustomerId.startsWith("pending_")) {
      throw new Error("No Stripe customer yet. Subscribe to a plan first.");
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: u.stripeCustomerId,
      return_url: returnUrl,
    });
    return { provider: "stripe", url: session.url };
  }

  verifyWebhookSignature(rawBody: string, headers: Headers): { ok: boolean; event?: WebhookEvent } {
    const stripe = getStripe();
    if (!stripe) return { ok: false };
    const sig = headers.get("stripe-signature");
    if (!sig) return { ok: false };
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    try {
      const event = stripe.webhooks.constructEvent(rawBody, sig, secret);
      return { ok: true, event: { id: event.id, type: event.type, data: event } };
    } catch {
      return { ok: false };
    }
  }

  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    const e = event.data as Stripe.Event;
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutCompleted(e.data.object as Stripe.Checkout.Session);
        break;
      case "customer.created":
        await this.handleCustomerCreated(e.data.object as Stripe.Customer);
        break;
      case "customer.updated":
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await this.handleSubscriptionChange(e.data.object as Stripe.Subscription, event.type);
        break;
      case "invoice.created":
        await this.handleInvoiceCreated(e.data.object as Stripe.Invoice);
        break;
      case "invoice.paid":
        await this.handleInvoicePaid(e.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await this.handleInvoicePaymentFailed(e.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId =
      (session.metadata?.userId as string | undefined) ??
      (typeof session.customer === "string" ? await this.findUserIdByCustomer(session.customer) : null);
    if (!userId) return;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (customerId) await repository.customers.linkToUser("stripe", userId, customerId);
  }

  private async handleCustomerCreated(customer: Stripe.Customer) {
    const userId = customer.metadata?.userId as string | undefined;
    const email = customer.email ?? null;
    if (!userId && !email) return;
    const byId = userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, stripeCustomerId: true } })
      : null;
    const target =
      byId ?? (email ? await prisma.user.findUnique({ where: { email }, select: { id: true, stripeCustomerId: true } }) : null);
    if (!target) return;
    if (target.stripeCustomerId && target.stripeCustomerId === customer.id) return;
    await prisma.user.update({ where: { id: target.id }, data: { stripeCustomerId: customer.id } });
  }

  private async handleInvoiceCreated(invoice: Stripe.Invoice) {
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId || !invoice.id) return;
    const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true } });
    if (!user) return;
    await prisma.invoice.upsert({
      where: { stripeInvoiceId: invoice.id },
      update: {
        status: invoice.status ?? "open",
        amount: invoice.amount_due ?? invoice.total ?? 0,
        number: invoice.number ?? null,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        pdfUrl: invoice.invoice_pdf ?? null,
      },
      create: {
        userId: user.id,
        stripeInvoiceId: invoice.id,
        number: invoice.number ?? null,
        amount: invoice.amount_due ?? invoice.total ?? 0,
        currency: invoice.currency ?? "usd",
        status: invoice.status ?? "open",
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        pdfUrl: invoice.invoice_pdf ?? null,
      },
    });
  }

  private async handleSubscriptionChange(sub: Stripe.Subscription, type: string) {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true } });
    if (!user) return;

    const item = sub.items?.data?.[0];
    const priceId = item?.price?.id ?? null;
    const planFromPrice = await this.priceIdToPlan(priceId);
    const interval = intervalFromPeriod(item?.price?.recurring?.interval) ?? (await this.priceIdToInterval(priceId));

    const periodStart = item?.current_period_start ?? null;
    const periodEnd = item?.current_period_end ?? null;
    const currentPeriodStart = periodStart && Number.isFinite(periodStart) ? new Date(periodStart * 1000) : null;
    const currentPeriodEnd = periodEnd && Number.isFinite(periodEnd) ? new Date(periodEnd * 1000) : null;
    const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
    const cancelAt = sub.cancel_at ? new Date(sub.cancel_at * 1000) : null;
    const product = item?.price?.product;
    const stripeProductId = typeof product === "string" ? product : (product as Stripe.Product | null)?.id ?? null;
    const latestInvoice = sub.latest_invoice;
    const latestInvoiceId = typeof latestInvoice === "string" ? latestInvoice : (latestInvoice as Stripe.Invoice | null)?.id ?? null;
    const card = await this.readCard(getStripe()!, sub.default_payment_method);
    const plan = type === "customer.subscription.deleted" ? "free" : ((planFromPrice ?? "pro") as PlanId);

    await repository.subscriptions.upsertByUserId(
      "stripe",
      user.id,
      customerId,
      {
        providerSubscriptionId: sub.id,
        plan,
        interval,
        status: sub.status,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        paused: false,
        trialEnd,
        latestInvoiceId,
        card: card ? { brand: card.brand, last4: card.last4, expMonth: card.expMonth, expYear: card.expYear } : null,
      },
      // stripe price/product ids are passed via extra so the repository can keep
      // the stripe columns populated (repository.stripeCols nulls them otherwise).
      { planId: priceId },
    );

    // Persist the stripe price/product ids directly (the shared repository
    // keeps the stripeSubscriptionId; price/product live on the row).
    await prisma.subscription.update({
      where: { userId: user.id },
      data: { stripePriceId: priceId, stripeProductId },
    });
    if (cancelAt) {
      await prisma.subscription.update({ where: { userId: user.id }, data: { cancelAt } });
    }
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId || !invoice.id) return;
    const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true } });
    if (!user) return;
    await prisma.invoice.upsert({
      where: { stripeInvoiceId: invoice.id },
      update: {
        status: invoice.status ?? "paid",
        amount: invoice.amount_paid ?? invoice.amount_due ?? 0,
        number: invoice.number ?? null,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        pdfUrl: invoice.invoice_pdf ?? null,
      },
      create: {
        userId: user.id,
        stripeInvoiceId: invoice.id,
        number: invoice.number ?? null,
        amount: invoice.amount_paid ?? invoice.amount_due ?? 0,
        currency: invoice.currency ?? "usd",
        status: invoice.status ?? "paid",
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        pdfUrl: invoice.invoice_pdf ?? null,
      },
    });
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId || !invoice.id) return;
    const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true } });
    if (!user) return;
    await prisma.invoice.upsert({
      where: { stripeInvoiceId: invoice.id },
      update: { status: "uncollectible" },
      create: {
        userId: user.id,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_due ?? 0,
        currency: invoice.currency ?? "usd",
        status: "uncollectible",
        number: invoice.number ?? null,
      },
    });
  }

  private async readCard(
    stripe: Stripe,
    pm: Stripe.Subscription["default_payment_method"],
  ): Promise<{ brand: string; last4: string; expMonth: number; expYear: number } | null> {
    const pmId = typeof pm === "string" ? pm : pm?.id;
    if (!pmId) return null;
    try {
      const method = await stripe.paymentMethods.retrieve(pmId);
      const card = method.card;
      if (!card) return null;
      return { brand: card.brand, last4: card.last4, expMonth: card.exp_month, expYear: card.exp_year };
    } catch {
      return null;
    }
  }

  private async findUserIdByCustomer(customerId: string): Promise<string | null> {
    return repository.customers.findUserIdByCustomer("stripe", customerId);
  }
}

let _stripe: Stripe | null = null;
export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (_stripe) return _stripe;
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });
  return _stripe;
}

export function appUrl(requestUrl: string | URL): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  try {
    return new URL(requestUrl.toString()).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export function trialDays(): number {
  const raw = Number.parseInt(process.env.PAYMENT_TRIAL_DAYS ?? process.env.STRIPE_TRIAL_DAYS ?? "0", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}