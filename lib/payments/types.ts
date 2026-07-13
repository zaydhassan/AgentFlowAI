// Payment provider abstraction — provider-agnostic domain types + the
// PaymentProvider interface. The rest of the app imports only from
// "@/lib/payments" and never calls a specific provider (Stripe / Razorpay)
// directly. Concrete providers live in lib/payments/providers/* and are
// selected by the factory in lib/payments/index.ts.
//
// This file is PURE TYPES (no runtime, no secrets) so it can be imported from
// both server and client code. The client checkout helper in
// lib/payments/client.ts re-exports the client-safe subset.

import type { PaymentMethodData } from "@/components/billing/payment-method-card";

/** The four product tiers. Enterprise is contact-sales (no self-serve checkout). */
export type PlanId = "free" | "pro" | "business" | "enterprise";

/** Billing cadence. Razorpay "monthly"/"yearly" plan periods map to these. */
export type Interval = "monthly" | "yearly";

/** Which provider is active. Drives provider-specific columns + flows. */
export type ProviderId = "razorpay" | "stripe";

/** Paid plans (the two that go through checkout). */
export type PaidPlan = Exclude<PlanId, "free" | "enterprise">;

/** A card on file, normalized for display. Reused by both providers. */
export type { PaymentMethodData };

/** Denormalized card snapshot synced from the provider for quick display. */
export interface CardSnapshot {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

/** Request to start a checkout for a plan/interval. */
export interface CheckoutInit {
  userId: string;
  userEmail: string | null;
  userName: string | null;
  plan: PlanId;
  interval: Interval;
  trialDays?: number;
  /** Incoming request URL — used by Stripe to build success/cancel return URLs. */
  returnUrl?: string;
  /** When upgrading/downgrading, the prior subscription to cancel on success. */
  changeFromSubscriptionId?: string | null;
}

/**
 * Provider-agnostic checkout descriptor. The client branches on `provider`:
 *  - "stripe": redirect to `url` (server-hosted Checkout Session).
 *  - "razorpay": open checkout.js with `razorpayKeyId` + `razorpayOrderId`
 *    (+ optional `razorpaySubscriptionId`), then POST the result to verify.
 */
export interface CheckoutSession {
  provider: ProviderId;
  /** Stripe: the hosted Checkout URL. */
  url?: string;
  /** Razorpay: public key_id (safe for the browser). */
  razorpayKeyId?: string;
  /** Razorpay: order to pay (from the subscription's first invoice). */
  razorpayOrderId?: string;
  /** Razorpay: subscription being authorized (linked to the order). */
  razorpaySubscriptionId?: string;
  /** Razorpay: amount in the smallest currency unit (cents/paise). */
  amount?: number;
  currency?: string;
  planName?: string;
  description?: string;
  prefillEmail?: string;
  prefillName?: string;
}

/** The client-side payment result to verify on the backend (Razorpay). */
export interface PaymentVerification {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  razorpaySubscriptionId?: string;
}

/** Provider-synced subscription state (the source of truth mirrored to Prisma). */
export interface ProviderSubscriptionState {
  providerSubscriptionId: string;
  plan: PlanId;
  interval: Interval | null;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  paused: boolean;
  trialEnd: Date | null;
  latestInvoiceId: string | null;
  card: CardSnapshot | null;
}

/** A provider invoice mirrored to Prisma (amount in the smallest currency unit). */
export interface ProviderInvoice {
  providerInvoiceId: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string;
  pdfUrl: string | null;
  hostedUrl: string | null;
  createdAt: Date;
  razorpayPaymentId?: string | null;
}

/** A normalized webhook event handed off to the provider's handler. */
export interface WebhookEvent {
  id: string;
  type: string;
  /** The raw provider payload, already signature-verified. */
  data: unknown;
}

/** Result of backend payment verification. */
export interface VerificationResult {
  ok: boolean;
  subscriptionId?: string;
  userId?: string;
  error?: string;
}

/**
 * The single interface the app talks to. Provider implementations live in
 * lib/payments/providers/{razorpay,stripe}.ts. Webhook handling is split into
 * signature verification (provider-specific) + event dispatch so the route
 * layer stays thin.
 */
export interface PaymentProvider {
  readonly id: ProviderId;
  readonly configured: boolean;

  /** Create a checkout for a plan/interval. */
  createCheckout(init: CheckoutInit): Promise<CheckoutSession>;

  /** Verify a client-side payment (Razorpay HMAC signature). Stripe is a no-op.
   *  `ctx` carries the authenticated user id (ownership guard) and the prior
   *  subscription id to cancel on an upgrade/downgrade. */
  verifyPayment(
    v: PaymentVerification,
    ctx?: { userId?: string; priorSubscriptionId?: string | null },
  ): Promise<VerificationResult>;

  /** Fetch the customer's default payment method for display. */
  getPaymentMethod(userId: string): Promise<PaymentMethodData | null>;

  /** Fetch the live subscription state from the provider. */
  getSubscriptionState(subId: string): Promise<ProviderSubscriptionState | null>;

  /** Cancel at the end of the current period (access continues until then). */
  cancelAtPeriodEnd(subId: string): Promise<void>;

  /** Pause an active subscription. */
  pause(subId: string): Promise<void>;

  /** Resume a paused subscription (un-pause). */
  resume(subId: string): Promise<void>;

  /** Upgrade/downgrade: create a checkout for a new plan. */
  changePlan(userId: string, plan: PlanId, interval: Interval): Promise<CheckoutSession>;

  /** Refund a captured payment (admin-only at the route layer). */
  refund(paymentId: string, amountMinor?: number): Promise<void>;

  /**
   * Open in-app management. Stripe → Customer Portal URL; Razorpay → a hosted
   * card-registration link. Both return a `url` the client redirects to, so the
   * client stays provider-agnostic.
   */
  createManagementSession(userId: string, returnUrl: string): Promise<CheckoutSession>;

  /** Verify a webhook signature and return the parsed event, or null. */
  verifyWebhookSignature(rawBody: string, headers: Headers): { ok: boolean; event?: WebhookEvent };

  /** Handle a verified webhook event (sync state via the repository). */
  handleWebhookEvent(event: WebhookEvent): Promise<void>;
}