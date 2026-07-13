// Payments facade + factory. The rest of the app imports only from
// "@/lib/payments" and never references a specific provider. The active
// provider is selected by PAYMENT_PROVIDER (default "razorpay"); Stripe remains
// available behind the same interface when PAYMENT_PROVIDER=stripe.

import "server-only";
import type { PaymentProvider, ProviderId } from "@/lib/payments/types";
import { RazorpayProvider } from "@/lib/payments/providers/razorpay";
import { StripeProvider, getStripe, appUrl as stripeAppUrl, trialDays as stripeTrialDays } from "@/lib/payments/providers/stripe";

export type {
  PaymentProvider,
  ProviderId,
  PlanId,
  Interval,
  PaidPlan,
  CheckoutInit,
  CheckoutSession,
  PaymentVerification,
  VerificationResult,
  ProviderSubscriptionState,
  ProviderInvoice,
  WebhookEvent,
  PaymentMethodData,
  CardSnapshot,
} from "@/lib/payments/types";

export { PLAN_META, PAID_PLANS, INTERVALS, chargeCurrency, planAmountMinor, cycleAmountMinor, intervalFromPeriod } from "@/lib/payments/plans";

// Re-export the Stripe helpers for the retained StripeProvider's webhook route
// and any diagnostics (the Stripe webhook route delegates to the provider, which
// holds its own copies; these are kept for compatibility).
export { getStripe, STRIPE_API_VERSION } from "@/lib/payments/providers/stripe";

const providers: Record<ProviderId, PaymentProvider> = {
  razorpay: new RazorpayProvider(),
  stripe: new StripeProvider(),
};

/** The configured provider id. Defaults to razorpay. */
export function activeProviderId(): ProviderId {
  const v = (process.env.PAYMENT_PROVIDER ?? "razorpay").toLowerCase();
  return v === "stripe" ? "stripe" : "razorpay";
}

/** The active PaymentProvider instance. */
export function getPaymentProvider(): PaymentProvider {
  return providers[activeProviderId()];
}

/** Whether the active provider has the keys it needs to run. */
export function paymentConfigured(): boolean {
  return getPaymentProvider().configured;
}

/** Public app URL for provider return URLs (shared by both providers). */
export function appUrl(requestUrl: string | URL): string {
  return stripeAppUrl(requestUrl);
}

/** Trial length in days for a customer's first subscription. Default 0. */
export function trialDays(): number {
  return stripeTrialDays();
}