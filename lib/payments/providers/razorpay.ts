import "server-only";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { prisma } from "@/lib/db";
import { repository } from "@/lib/payments/repository";
import {
  chargeCurrency,
  planAmountMinor,
  PLAN_META,
  intervalFromPeriod,
} from "@/lib/payments/plans";
import type {
  CheckoutInit,
  CheckoutSession,
  PaidPlan,
  PaymentMethodData,
  PaymentProvider,
  PaymentVerification,
  PlanId,
  ProviderInvoice,
  ProviderSubscriptionState,
  VerificationResult,
  WebhookEvent,
  Interval,
} from "@/lib/payments/types";

interface RazorpaySubscriptionEntity {
  id: string;
  entity: "subscription";
  plan_id: string;
  status: string;
  customer_id: string;
  current_start?: number | null;
  current_end?: number | null;
  start_at?: number | null;
  end_at?: number | null;
  charge_at?: number | null;
  total_count?: number | null;
  paid_count?: number | null;
  quantity?: number | null;
  notes?: Record<string, string> | null;
  pause_at?: number | null;
  created_at?: number | null;
  short_url?: string | null;
}

interface RazorpayInvoiceEntity {
  id: string;
  entity: "invoice";
  subscription_id?: string | null;
  payment_id?: string | null;
  order_id?: string | null;
  status: string;
  amount: number;
  currency: string;
  invoice_number?: string | null;
  short_url?: string | null;
  created_at?: number | null;
}

interface RazorpayPaymentEntity {
  id: string;
  entity: "payment";
  status: string;
  amount: number;
  currency: string;
  method: string | null;
  order_id?: string | null;
  invoice_id?: string | null;
  card?: { last4?: string | null; network?: string | null; expiry?: string | null } | null;
  email?: string | null;
  contact?: string | null;
  notes?: Record<string, string> | null;
  created_at?: number | null;
}

interface RazorpayOrderEntity {
  id: string;
  entity: "order";
  amount: number;
  currency: string;
  status: string;
  receipt?: string | null;
  notes?: Record<string, string> | null;
}

interface RazorpayWebhookPayload {
  entity: "event";
  account_id?: string;
  event: string;
  contains?: string[];
  payload?: {
    subscription?: { entity: "subscription"; subscription: RazorpaySubscriptionEntity };
    payment?: { entity: "payment"; payment: RazorpayPaymentEntity };
    invoice?: { entity: "invoice"; invoice: RazorpayInvoiceEntity };
    order?: { entity: "order"; order: RazorpayOrderEntity };
  };
}

function envPlanId(plan: PaidPlan, interval: Interval): string | undefined {
  return process.env[`RAZORPAY_PLAN_${plan.toUpperCase()}_${interval.toUpperCase()}`];
}

export class RazorpayProvider implements PaymentProvider {
  readonly id = "razorpay" as const;

  get configured(): boolean {
    return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  }

  private client(): Razorpay {
    if (!this.configured) {
      throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.");
    }
    return getRazorpay();
  }

  /** Resolve a Razorpay plan id (env → cache → auto-create). */
  private async resolvePlanId(plan: PaidPlan, interval: Interval): Promise<string> {
    const env = envPlanId(plan, interval);
    if (env) return env;

    const cached = await repository.planPrices.find("razorpay", plan, interval);
    if (cached) return cached;

    const rzp = this.client();
    const amount = planAmountMinor(plan, interval);
    const currency = chargeCurrency();
    const created = (await rzp.plans.create({
      period: interval === "monthly" ? "monthly" : "yearly",
      interval: 1,
      item: {
        name: `AgentFlow ${PLAN_META[plan].label}`,
        amount,
        currency,
        description: `${PLAN_META[plan].label} plan, billed ${interval === "monthly" ? "monthly" : "yearly"}`,
      },
      notes: { plan, interval, app: "agentflow" },
    } as unknown as Parameters<typeof rzp.plans.create>[0])) as { id: string };

    await repository.planPrices.saveRazorpay(plan, interval, created.id);
    return created.id;
  }

  private async ensureCustomer(userId: string, email: string | null, name: string | null): Promise<string> {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { razorpayCustomerId: true },
    });
    const existing = u?.razorpayCustomerId;
    if (existing && !existing.startsWith("pending_")) return existing;

    const rzp = this.client();
    const customer = (await rzp.customers.create({
      name: name ?? undefined,
      email: email ?? undefined,
      notes: { userId },
    } as unknown as Parameters<typeof rzp.customers.create>[0])) as { id: string };

    await repository.customers.linkToUser("razorpay", userId, customer.id);
    return customer.id;
  }

  async createCheckout(init: CheckoutInit): Promise<CheckoutSession> {
    if (init.plan === "free" || init.plan === "enterprise") {
      throw new Error(`Plan ${init.plan} does not support self-serve checkout.`);
    }
    const rzp = this.client();
    const plan = init.plan as PaidPlan;

    const planId = await this.resolvePlanId(plan, init.interval);
    const customerId = await this.ensureCustomer(init.userId, init.userEmail, init.userName);

    // Create the subscription. total_count is omitted so it recurs indefinitely
    // until cancelled (matches the prior Stripe recurring behaviour).
    const sub = (await rzp.subscriptions.create({
      plan_id: planId,
      customer_id: customerId,
      quantity: 1,
      notes: { userId: init.userId, plan, interval: init.interval, app: "agentflow" },
      ...(init.trialDays && init.trialDays > 0
        ? { trial: { enabled: true, period: { interval: "day", count: init.trialDays } } }
        : {}),
    } as unknown as Parameters<typeof rzp.subscriptions.create>[0])) as RazorpaySubscriptionEntity;

    // The first invoice is auto-created and carries the order_id the modal needs.
    const orderId = await this.firstInvoiceOrderId(sub.id, plan, init.interval);
    const amount = orderId ? await this.orderAmount(orderId) : planAmountMinor(plan, init.interval);

    return {
      provider: "razorpay",
      razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      razorpayOrderId: orderId ?? undefined,
      razorpaySubscriptionId: sub.id,
      amount,
      currency: chargeCurrency(),
      planName: `AgentFlow ${PLAN_META[plan].label}`,
      description: `${PLAN_META[plan].label} — ${init.interval}`,
      prefillEmail: init.userEmail ?? undefined,
      prefillName: init.userName ?? undefined,
    };
  }

  /** Fetch the order_id of the subscription's first invoice (best-effort). */
  private async firstInvoiceOrderId(subId: string, plan: PaidPlan, interval: Interval): Promise<string | null> {
    const rzp = this.client();
    try {
      const list = (await rzp.invoices.all({ subscription_id: subId, count: 1 } as unknown as Parameters<typeof rzp.invoices.all>[0])) as {
        items?: RazorpayInvoiceEntity[];
      };
      const inv = list?.items?.[0];
      return inv?.order_id ?? null;
    } catch {
      // Fall back to no order — the client treats a missing order as
      // "subscription created, no payment required" (e.g. a zero-amount trial).
      return null;
    }
  }

  private async orderAmount(orderId: string): Promise<number> {
    const rzp = this.client();
    try {
      const order = (await rzp.orders.fetch(orderId)) as RazorpayOrderEntity;
      return order.amount;
    } catch {
      return 0;
    }
  }

  async verifyPayment(
    v: PaymentVerification,
    ctx?: { userId?: string; priorSubscriptionId?: string | null },
  ): Promise<VerificationResult> {
    if (!this.configured) return { ok: false, error: "Razorpay is not configured." };
    if (!v.razorpayOrderId || !v.razorpayPaymentId || !v.razorpaySignature) {
      return { ok: false, error: "Missing payment response fields." };
    }

    // Backend signature verification — never trust the frontend. The expected
    // signature is HMAC-SHA256(key_secret, `${order_id}|${payment_id}`).
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${v.razorpayOrderId}|${v.razorpayPaymentId}`)
      .digest("hex");

    if (!safeEqual(expected, v.razorpaySignature)) {
      return { ok: false, error: "Payment signature verification failed." };
    }

    const subId = v.razorpaySubscriptionId;
    if (!subId) return { ok: false, error: "Missing subscription reference." };

    const state = await this.getSubscriptionState(subId);
    if (!state) return { ok: false, error: "Could not fetch subscription state." };

    const userId = await repository.customers.findUserIdByCustomer("razorpay", state.customerId ?? "");
    if (!userId) return { ok: false, error: "Subscription customer not linked to an account." };
    if (ctx?.userId && ctx.userId !== userId) {
      return { ok: false, error: "Subscription does not belong to this account." };
    }

    // Cancel the prior subscription on an upgrade/downgrade so we never double
    // charge. Razorpay cancellations are immediate here (the new sub is active).
    if (ctx?.priorSubscriptionId && ctx.priorSubscriptionId !== subId) {
      try {
        await this.client().subscriptions.cancel(ctx.priorSubscriptionId, { cancel_at_cycle_end: 0 } as unknown as Parameters<Razorpay["subscriptions"]["cancel"]>[1]);
      } catch (err) {
        console.warn("[razorpay] failed to cancel prior subscription", err);
      }
    }

    await repository.subscriptions.upsertByUserId(
      "razorpay",
      userId,
      state.customerId,
      { ...state, providerSubscriptionId: subId },
      { paymentId: v.razorpayPaymentId, orderId: v.razorpayOrderId, planId: state.planId },
    );

    // Mirror the first invoice as paid so billing history shows immediately
    // (the webhook reconciles on its own delivery).
    await this.syncFirstInvoice(subId, userId, v.razorpayPaymentId);

    return { ok: true, subscriptionId: subId, userId };
  }

  async getPaymentMethod(userId: string): Promise<PaymentMethodData | null> {
    // Razorpay has no hosted portal; we surface the card synced onto the
    // Subscription row by the webhook (subscription.charged reads the payment).
    const sub = await repository.subscriptions.findByUserId(userId);
    if (!sub?.cardLast4) return null;
    return {
      brand: sub.cardBrand,
      last4: sub.cardLast4,
      expMonth: sub.cardExpMonth,
      expYear: sub.cardExpYear,
      country: null,
      address: null,
    };
  }

  async getSubscriptionState(subId: string): Promise<(ProviderSubscriptionState & { customerId: string | null; planId: string | null }) | null> {
    const rzp = this.client();
    try {
      const sub = (await rzp.subscriptions.fetch(subId)) as RazorpaySubscriptionEntity;
      return this.mapSubscriptionState(sub);
    } catch {
      return null;
    }
  }

  private mapSubscriptionState(sub: RazorpaySubscriptionEntity): ProviderSubscriptionState & { customerId: string | null; planId: string | null } {
    const planFromNotes = (sub.notes?.plan as PlanId | undefined) ?? "pro";
    const interval = sub.notes?.interval ? intervalFromPeriod(sub.notes.interval as string) : null;
    return {
      providerSubscriptionId: sub.id,
      plan: planFromNotes,
      interval,
      status: sub.status,
      currentPeriodStart: toMaybeDate(sub.current_start),
      currentPeriodEnd: toMaybeDate(sub.current_end),
      // Razorpay does not expose a pending "cancel at period end" flag; that
      // is tracked locally (set when the user cancels).
      cancelAtPeriodEnd: false,
      paused: sub.status === "paused" || Boolean(sub.pause_at),
      trialEnd: null,
      latestInvoiceId: null,
      card: null,
      customerId: sub.customer_id ?? null,
      planId: sub.plan_id ?? null,
    };
  }

  async cancelAtPeriodEnd(subId: string): Promise<void> {
    const rzp = this.client();
    await rzp.subscriptions.cancel(subId, { cancel_at_cycle_end: 1 } as unknown as Parameters<Razorpay["subscriptions"]["cancel"]>[1]);
  }

  async pause(subId: string): Promise<void> {
    const rzp = this.client();
    await rzp.subscriptions.pause(subId, {} as unknown as Parameters<Razorpay["subscriptions"]["pause"]>[1]);
  }

  async resume(subId: string): Promise<void> {
    // Resume = un-pause (Razorpay's resume endpoint is for paused subs only).
    const rzp = this.client();
    await rzp.subscriptions.resume(subId, {} as unknown as Parameters<Razorpay["subscriptions"]["resume"]>[1]);
  }

  async changePlan(userId: string, plan: PlanId, interval: Interval): Promise<CheckoutSession> {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    const sub = await repository.subscriptions.findByUserId(userId);
    return this.createCheckout({
      userId,
      userEmail: u?.email ?? null,
      userName: u?.name ?? null,
      plan,
      interval,
      changeFromSubscriptionId: sub?.razorpaySubscriptionId ?? null,
    });
  }

  async refund(paymentId: string, amountMinor?: number): Promise<void> {
    const rzp = this.client();
    const params = amountMinor ? { amount: amountMinor } : {};
    await rzp.payments.refund(paymentId, params as unknown as Parameters<Razorpay["payments"]["refund"]>[1]);
  }

  async createManagementSession(_userId: string, _returnUrl: string): Promise<CheckoutSession> {
    // Razorpay has no hosted Customer Portal, and its registration-link API is
    // India-mandate-specific (NACH / e-mandate / UPI autopay) — there is no
    // hosted flow to update an international card on an existing subscription.
    // Surface this honestly rather than fabricate a broken redirect. The
    // billing UI still offers cancel/pause/resume/downgrade for management; to
    // change the card, the customer cancels and re-subscribes (or contacts
    // support). The ManageButton is hidden for Razorpay; this guards the
    // PaymentMethodCard "Update card" action.
    throw new Error(
      "Razorpay does not expose a hosted card-update flow. To change your card, cancel and restart your subscription, or contact support.",
    );
  }

  verifyWebhookSignature(rawBody: string, headers: Headers): { ok: boolean; event?: WebhookEvent } {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return { ok: false };
    const sig = headers.get("x-razorpay-signature");
    if (!sig) return { ok: false };

    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!safeEqual(expected, sig)) return { ok: false };

    try {
      const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
      const type = payload.event;
      const entityId = primaryEntityId(payload);
      const id = entityId ? `${type}:${entityId}` : type;
      return { ok: true, event: { id, type, data: payload } };
    } catch {
      return { ok: false };
    }
  }

  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    const payload = event.data as RazorpayWebhookPayload;
    switch (event.type) {
      case "subscription.activated":
      case "subscription.charged":
        await this.onSubscriptionActivated(payload);
        break;
      case "subscription.cancelled":
      case "subscription.completed":
        await this.onSubscriptionEnded(payload);
        break;
      case "payment.authorized":
      case "payment.captured":
        await this.onPaymentAuthorized(payload);
        break;
      case "payment.failed":
        await this.onPaymentFailed(payload);
        break;
      case "order.paid":
        // Informational: the subscription/invoice events drive state. Recorded
        // for observability via the event log in the route.
        break;
      case "invoice.paid":
        await this.onInvoicePaid(payload);
        break;
      default:
        break;
    }
  }

  private async onSubscriptionActivated(payload: RazorpayWebhookPayload): Promise<void> {
    const sub = payload.payload?.subscription?.subscription;
    if (!sub) return;
    const userId = await repository.customers.findUserIdByCustomer("razorpay", sub.customer_id ?? "");
    if (!userId) return;
    const state = this.mapSubscriptionState(sub);
    await repository.subscriptions.upsertByUserId("razorpay", userId, state.customerId, state, {
      planId: state.planId,
    });
    await this.syncFirstInvoice(sub.id, userId, null);
  }

  private async onSubscriptionEnded(payload: RazorpayWebhookPayload): Promise<void> {
    const sub = payload.payload?.subscription?.subscription;
    if (!sub) return;
    const userId = await repository.customers.findUserIdByCustomer("razorpay", sub.customer_id ?? "");
    if (!userId) return;
    await repository.subscriptions.resetToFree(userId, "razorpay");
  }

  private async onPaymentAuthorized(payload: RazorpayWebhookPayload): Promise<void> {
    const payment = payload.payload?.payment?.payment;
    if (!payment) return;
    // Sync the card onto the subscription row for display. Best-effort.
    if (payment.card?.last4) {
      const inv = payment.invoice_id ? await this.fetchInvoice(payment.invoice_id) : null;
      const subId = inv?.subscription_id;
      if (subId) {
        const userId = await this.userIdForSubscription(subId);
        if (userId) {
          await prisma.subscription.update({
            where: { userId },
            data: {
              cardBrand: payment.card.network ?? null,
              cardLast4: payment.card.last4,
            },
          });
        }
      }
    }
  }

  private async onPaymentFailed(payload: RazorpayWebhookPayload): Promise<void> {
    const payment = payload.payload?.payment?.payment;
    if (!payment) return;
    const inv = payment.invoice_id ? await this.fetchInvoice(payment.invoice_id) : null;
    if (!inv) return;
    const userId = inv.subscription_id ? await this.userIdForSubscription(inv.subscription_id) : null;
    if (!userId) return;
    await repository.invoices.markUncollectible("razorpay", userId, inv.id, inv.amount, inv.currency, inv.invoice_number ?? null);
    await repository.subscriptions.setStatus(userId, "halted");
  }

  private async onInvoicePaid(payload: RazorpayWebhookPayload): Promise<void> {
    const inv = payload.payload?.invoice?.invoice;
    if (!inv) return;
    const userId = inv.subscription_id ? await this.userIdForSubscription(inv.subscription_id) : null;
    if (!userId) return;
    await repository.invoices.upsert("razorpay", userId, toProviderInvoice(inv));
  }

  private async fetchInvoice(invoiceId: string): Promise<RazorpayInvoiceEntity | null> {
    try {
      return (await this.client().invoices.fetch(invoiceId)) as RazorpayInvoiceEntity;
    } catch {
      return null;
    }
  }

  private async userIdForSubscription(subId: string): Promise<string | null> {
    // The Subscription row stores razorpaySubscriptionId; look the user up by it.
    const row = await prisma.subscription.findFirst({
      where: { razorpaySubscriptionId: subId },
      select: { userId: true },
    });
    return row?.userId ?? null;
  }

  private async syncFirstInvoice(subId: string, userId: string, paymentId: string | null): Promise<void> {
    try {
      const list = (await this.client().invoices.all({ subscription_id: subId, count: 1 } as unknown as Parameters<Razorpay["invoices"]["all"]>[0])) as {
        items?: RazorpayInvoiceEntity[];
      };
      const inv = list?.items?.[0];
      if (!inv) return;
      await repository.invoices.upsert("razorpay", userId, toProviderInvoice(inv, paymentId));
    } catch {
      // best-effort
    }
  }
}

let _rzp: Razorpay | null = null;
function getRazorpay(): Razorpay {
  if (_rzp) return _rzp;
  _rzp = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
  return _rzp;
}

function primaryEntityId(payload: RazorpayWebhookPayload): string | null {
  const p = payload.payload;
  if (!p) return null;
  return (
    p.subscription?.subscription?.id ??
    p.payment?.payment?.id ??
    p.invoice?.invoice?.id ??
    p.order?.order?.id ??
    null
  );
}

function toMaybeDate(unix: number | null | undefined): Date | null {
  if (!unix || !Number.isFinite(unix)) return null;
  return new Date(unix * 1000);
}

function toProviderInvoice(inv: RazorpayInvoiceEntity, paymentIdOverride?: string | null): ProviderInvoice {
  return {
    providerInvoiceId: inv.id,
    number: inv.invoice_number ?? null,
    amount: inv.amount,
    currency: inv.currency,
    status: inv.status === "paid" ? "paid" : inv.status,
    pdfUrl: inv.short_url ?? null,
    hostedUrl: inv.short_url ?? null,
    createdAt: toMaybeDate(inv.created_at) ?? new Date(0),
    razorpayPaymentId: paymentIdOverride ?? inv.payment_id ?? null,
  };
}

/** Constant-time string compare to avoid timing oracles on signatures. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}