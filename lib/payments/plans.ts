// Shared plan metadata + currency-aware amount helpers. This is the canonical
// home for PlanId/Interval/PLAN_META — both providers and the billing UI import
// from here so pricing stays in sync with what each provider charges.

import "server-only";
import type { Interval, PaidPlan, PlanId } from "@/lib/payments/types";

export type { Interval, PlanId, PaidPlan };

export const PAID_PLANS: PaidPlan[] = ["pro", "business"];
export const INTERVALS: Interval[] = ["monthly", "yearly"];

/**
 * Numeric monthly credit allotment per plan. `PLAN_META[plan].credits` is the
 * human display string (e.g. "150,000 / mo"); this is the numeric form used by
 * metering/remaining-credit math (dashboard, billing). Values mirror the
 * display strings for paid plans; free/enterprise have no display string and
 * use conservative defaults. Additive — the display strings stay as-is.
 */
export const PLAN_CREDIT_LIMIT: Record<PlanId, number> = {
  free: 50_000,
  pro: 150_000,
  business: 1_000_000,
  enterprise: 50_000_000,
};

/** Currency for charges (Razorpay + Stripe). Default USD to preserve pricing. */
export function chargeCurrency(): string {
  return (process.env.RAZORPAY_CURRENCY ?? process.env.CHARGE_CURRENCY ?? "usd").toLowerCase();
}

/**
 * Plan metadata. `priceAmount` is in whole major units (dollars). Pro $29/mo
 * ($24/mo billed yearly), Business $99/mo ($82/mo billed yearly). `priceAmount`
 * is the source of truth for both providers' recurring amounts.
 */
export const PLAN_META: Record<
  PaidPlan,
  {
    label: string;
    tagline: string;
    features: string[];
    priceLabel: (i: Interval) => string;
    priceAmount: Record<Interval, number>;
    credits: string;
  }
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

/**
 * The charge amount for a plan/interval in the smallest currency unit
 * (cents for USD, paise for INR). Yearly is the monthly-equivalent × 12, matching
 * the previous Stripe pricing. Note: for INR the same PLAN_META numbers are
 * treated as rupees — pick INR-appropriate amounts in PLAN_META before enabling
 * `RAZORPAY_CURRENCY=inr` (documented in .env.example).
 */
export function planAmountMinor(plan: PaidPlan, interval: Interval): number {
  const monthly = PLAN_META[plan].priceAmount[interval];
  // interval "yearly" already represents the per-month price billed yearly;
  // a full year's charge is monthly × 12.
  return monthly * 12 * 100;
}

/** Monthly-only amount in minor units (used for the per-cycle recurring charge). */
export function cycleAmountMinor(plan: PaidPlan, interval: Interval): number {
  return PLAN_META[plan].priceAmount[interval] * 100;
}

/** Normalize a provider recurring interval string into our Interval. */
export function intervalFromPeriod(value: string | null | undefined): Interval | null {
  if (value === "month" || value === "monthly") return "monthly";
  if (value === "year" || value === "yearly") return "yearly";
  return null;
}