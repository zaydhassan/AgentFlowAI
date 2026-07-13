// Repository pattern — the only place that reads/writes the billing Prisma
// models. Provider implementations and webhook handlers call into here so
// Prisma upsert logic is defined once (no duplication) and the provider-aware
// columns (stripe_* vs razorpay_*) are written consistently.
//
// Idempotency: subscriptions key on userId (@unique), invoices on the active
// provider's invoice id (@unique), events on a recorded audit-log action.
// A concurrent webhook re-delivery converges to the same state even if it
// slips past the event-dedup fast path.

import "server-only";
import { prisma } from "@/lib/db";
import type { ProviderId } from "@/lib/payments/types";
import type { CardSnapshot, ProviderInvoice, ProviderSubscriptionState } from "@/lib/payments/types";

type Provider = Exclude<ProviderId, never>;

const stripeCols = (state: ProviderSubscriptionState) => ({
  stripeSubscriptionId: state.providerSubscriptionId,
  // price/product ids are resolved at the provider layer and passed via state
  // when available; we keep the existing columns null here for Razorpay.
  stripePriceId: null,
  stripeProductId: null,
});

const razorpayCols = (state: ProviderSubscriptionState, extra?: { customerId?: string | null; paymentId?: string | null; orderId?: string | null; planId?: string | null }) => ({
  razorpaySubscriptionId: state.providerSubscriptionId,
  razorpayCustomerId: extra?.customerId ?? null,
  razorpayPaymentId: extra?.paymentId ?? null,
  razorpayOrderId: extra?.orderId ?? null,
  razorpayPlanId: extra?.planId ?? null,
});

export const subscriptions = {
  /** Upsert a subscription by userId, writing the active provider's columns. */
  async upsertByUserId(
    provider: Provider,
    userId: string,
    customerId: string | null,
    state: Partial<ProviderSubscriptionState> & { providerSubscriptionId: string },
    extra?: { paymentId?: string | null; orderId?: string | null; planId?: string | null },
  ) {
    const shared = {
      plan: state.plan ?? "free",
      interval: state.interval ?? null,
      status: state.status ?? "incomplete",
      currentPeriodStart: state.currentPeriodStart ?? null,
      currentPeriodEnd: state.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd ?? false,
      paused: state.paused ?? false,
      trialEnd: state.trialEnd ?? null,
      latestInvoiceId: state.latestInvoiceId ?? null,
      cardBrand: state.card?.brand ?? null,
      cardLast4: state.card?.last4 ?? null,
      cardExpMonth: state.card?.expMonth ?? null,
      cardExpYear: state.card?.expYear ?? null,
    };

    if (provider === "razorpay") {
      return prisma.subscription.upsert({
        where: { userId },
        update: {
          ...shared,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripePriceId: null,
          stripeProductId: null,
          ...razorpayCols({ ...state, providerSubscriptionId: state.providerSubscriptionId } as ProviderSubscriptionState, { customerId: customerId, ...extra }),
        },
        create: {
          userId,
          ...shared,
          ...razorpayCols({ ...state, providerSubscriptionId: state.providerSubscriptionId } as ProviderSubscriptionState, { customerId: customerId, ...extra }),
        },
      });
    }

    // stripe
    return prisma.subscription.upsert({
      where: { userId },
      update: {
        ...shared,
        stripeCustomerId: customerId,
        ...stripeCols({ ...state, providerSubscriptionId: state.providerSubscriptionId } as ProviderSubscriptionState),
        razorpayCustomerId: null,
        razorpaySubscriptionId: null,
        razorpayPaymentId: null,
        razorpayOrderId: null,
        razorpayPlanId: null,
      },
      create: {
        userId,
        ...shared,
        stripeCustomerId: customerId,
        ...stripeCols({ ...state, providerSubscriptionId: state.providerSubscriptionId } as ProviderSubscriptionState),
      },
    });
  },

  async setCancelAtPeriodEnd(userId: string, value: boolean) {
    return prisma.subscription.update({ where: { userId }, data: { cancelAtPeriodEnd: value } });
  },

  async setPaused(userId: string, paused: boolean) {
    return prisma.subscription.update({ where: { userId }, data: { paused } });
  },

  async setStatus(userId: string, status: string, plan?: string) {
    return prisma.subscription.update({
      where: { userId },
      data: plan ? { status, plan } : { status },
    });
  },

  /** Drop to free + clear provider linkage (used on cancel-complete / expired). */
  async resetToFree(userId: string, provider: Provider) {
    return prisma.subscription.update({
      where: { userId },
      data: {
        plan: "free",
        status: "canceled",
        cancelAtPeriodEnd: false,
        paused: false,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        trialEnd: null,
        latestInvoiceId: null,
        ...(provider === "razorpay"
          ? { razorpaySubscriptionId: null, razorpayPaymentId: null, razorpayOrderId: null, razorpayPlanId: null }
          : { stripeSubscriptionId: null, stripePriceId: null, stripeProductId: null }),
      },
    });
  },

  async findByUserId(userId: string) {
    return prisma.subscription.findUnique({ where: { userId } });
  },
};

export const invoices = {
  /** Upsert an invoice keyed on the active provider's invoice id. */
  async upsert(provider: Provider, userId: string, inv: ProviderInvoice) {
    const base = {
      number: inv.number,
      amount: inv.amount,
      currency: inv.currency,
      status: inv.status,
      hostedInvoiceUrl: inv.hostedUrl,
      pdfUrl: inv.pdfUrl,
    };
    if (provider === "razorpay") {
      return prisma.invoice.upsert({
        where: { razorpayInvoiceId: inv.providerInvoiceId },
        update: { ...base, razorpayPaymentId: inv.razorpayPaymentId ?? null },
        create: {
          userId,
          razorpayInvoiceId: inv.providerInvoiceId,
          razorpayPaymentId: inv.razorpayPaymentId ?? null,
          ...base,
        },
      });
    }
    return prisma.invoice.upsert({
      where: { stripeInvoiceId: inv.providerInvoiceId },
      update: base,
      create: { userId, stripeInvoiceId: inv.providerInvoiceId, ...base },
    });
  },

  async markUncollectible(provider: Provider, userId: string, providerInvoiceId: string, amount: number, currency: string, number: string | null) {
    if (provider === "razorpay") {
      return prisma.invoice.upsert({
        where: { razorpayInvoiceId: providerInvoiceId },
        update: { status: "uncollectible" },
        create: { userId, razorpayInvoiceId: providerInvoiceId, amount, currency, status: "uncollectible", number },
      });
    }
    return prisma.invoice.upsert({
      where: { stripeInvoiceId: providerInvoiceId },
      update: { status: "uncollectible" },
      create: { userId, stripeInvoiceId: providerInvoiceId, amount, currency, status: "uncollectible", number },
    });
  },
};

export const customers = {
  /** Find the local user that owns a provider customer id. */
  async findUserIdByCustomer(provider: Provider, customerId: string): Promise<string | null> {
    const where = provider === "razorpay" ? { razorpayCustomerId: customerId } : { stripeCustomerId: customerId };
    const u = await prisma.user.findFirst({ where, select: { id: true } });
    return u?.id ?? null;
  },

  /** Link a provider customer id to a user (idempotent; won't clobber a match). */
  async linkToUser(provider: Provider, userId: string, customerId: string) {
    const col = provider === "razorpay" ? "razorpayCustomerId" : "stripeCustomerId";
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { [col]: true } as Record<string, boolean>,
    });
    const current = (existing as Record<string, string | null> | null)?.[col] ?? null;
    if (current === customerId) return;
    await prisma.user.update({ where: { id: userId }, data: { [col]: customerId } });
  },
};

/** Idempotency: record/lookup a webhook event by its provider-scoped id. */
export const events = {
  prefix(provider: Provider) {
    return provider === "razorpay" ? "razorpay.event." : "stripe.event.";
  },

  async seen(provider: Provider, eventId: string): Promise<boolean> {
    try {
      const existing = await prisma.auditLog.findFirst({
        where: { action: `${this.prefix(provider)}${eventId}` },
        select: { id: true },
      });
      return Boolean(existing);
    } catch {
      return false;
    }
  },

  async record(provider: Provider, eventId: string, type: string) {
    try {
      await prisma.auditLog.create({
        data: { action: `${this.prefix(provider)}${eventId}`, metadata: { type } as object },
      });
    } catch {
      // ignore — best-effort observability
    }
  },
};

/** Cached provider plan/price provisioning (shared by both providers). */
export const planPrices = {
  async find(provider: Provider, plan: string, interval: string) {
    const row = await prisma.planPrice.findUnique({ where: { plan_interval: { plan, interval } } });
    if (!row) return null;
    if (provider === "razorpay") return row.razorpayPlanId;
    return row.stripePriceId;
  },

  async saveStripe(plan: string, interval: string, productId: string, priceId: string) {
    return prisma.planPrice.upsert({
      where: { stripePriceId: priceId },
      update: { plan, interval, stripeProductId: productId, stripePriceId: priceId, razorpayPlanId: null },
      create: { plan, interval, stripeProductId: productId, stripePriceId: priceId },
    });
  },

  async saveRazorpay(plan: string, interval: string, planId: string) {
    return prisma.planPrice.upsert({
      where: { razorpayPlanId: planId },
      update: { plan, interval, razorpayPlanId: planId, stripeProductId: null, stripePriceId: null },
      create: { plan, interval, razorpayPlanId: planId },
    });
  },
};

/**
 * Aggregate repository — the single import the providers and routes use. All
 * Prisma writes go through here (provider-aware upserts, idempotency).
 */
export const repository = {
  subscriptions,
  invoices,
  customers,
  events,
  planPrices,
};