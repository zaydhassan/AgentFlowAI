// Stripe SDK singleton. Centralizes API version, plan/price mapping, and the
// dev fallback ("TEST MODE — simulate") when STRIPE_SECRET_KEY is missing.

import "server-only";
import Stripe from "stripe";

// Pin the API version. If you upgrade the stripe SDK, double-check this
// against the SDK's ApiVersion constant in stripe/cjs/apiVersion.js.
export const STRIPE_API_VERSION = "2026-06-24.dahlia" as const;

export type PlanId = "free" | "pro" | "business" | "enterprise";
export type Interval = "monthly" | "yearly";

export const PLAN_META: Record<
  Exclude<PlanId, "free" | "enterprise">,
  { label: string; tagline: string; features: string[]; priceLabel: (i: Interval) => string; priceAmount: Record<Interval, number>; credits: string }
> = {
  pro: {
    label: "Pro",
    tagline: "For makers & small teams",
    priceAmount: { monthly: 29, yearly: 24 },
    priceLabel: (i) => (i === "monthly" ? "$29 / mo" : "$24 / mo"),
    credits: "150,000 / mo",
    features: [
      "25 active workflows",
      "AI Copilot + self-heal",
      "Priority execution",
      "Version history",
      "3 workspace members",
    ],
  },
  business: {
    label: "Business",
    tagline: "For scaling teams",
    priceAmount: { monthly: 99, yearly: 82 },
    priceLabel: (i) => (i === "monthly" ? "$99 / mo" : "$82 / mo"),
    credits: "1,000,000 / mo",
    features: [
      "Unlimited workflows",
      "RBAC + audit logs",
      "SSO ready",
      "10 workspace members",
      "Secrets manager",
      "Usage analytics",
    ],
  },
};

const PRICE_ENV: Record<string, () => string | undefined> = {
  "pro:monthly": () => process.env.STRIPE_PRICE_PRO_MONTHLY,
  "pro:yearly": () => process.env.STRIPE_PRICE_PRO_YEARLY,
  "business:monthly": () => process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
  "business:yearly": () => process.env.STRIPE_PRICE_BUSINESS_YEARLY,
};

export function getPriceId(plan: "pro" | "business", interval: Interval): string | null {
  return PRICE_ENV[`${plan}:${interval}`]?.() ?? null;
}

export const stripeConfigured = Boolean(
  process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET,
);

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
