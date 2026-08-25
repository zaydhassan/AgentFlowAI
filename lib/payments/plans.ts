import "server-only";
import type { Interval, PaidPlan, PlanId } from "@/lib/payments/types";
import { PLAN_META } from "@/lib/payments/plan-meta";

export type { Interval, PlanId, PaidPlan };
export { PLAN_META } from "@/lib/payments/plan-meta";

export const PAID_PLANS: PaidPlan[] = ["pro", "business"];
export const INTERVALS: Interval[] = ["monthly", "yearly"];

/**
 * Numeric monthly credit allotment per plan — the single source of truth used
 * by metering/remaining-credit math (dashboard, billing, digest scheduler).
 * `PLAN_META[plan].credits` is the human display string and must stay in sync
 * with these numbers. Free = 1,000 (the advertised free tier); enterprise has
 * no display string and uses a conservative default.
 */
export const PLAN_CREDIT_LIMIT: Record<PlanId, number> = {
  free: 1_000,
  pro: 150_000,
  business: 1_000_000,
  enterprise: 50_000_000,
};

/** Currency for charges (Razorpay + Stripe). Default USD to preserve pricing. */
export function chargeCurrency(): string {
  return (process.env.RAZORPAY_CURRENCY ?? process.env.CHARGE_CURRENCY ?? "usd").toLowerCase();
}

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