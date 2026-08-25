import type { Interval, PaidPlan } from "@/lib/payments/types";

/**
 * Plan display metadata — the single source of truth for plan names, taglines,
 * feature lists, credit strings, and prices shown on the pricing page, the
 * marketing landing page, and the billing page. Pure data, no env reads and no
 * secrets, so it is safe to import from client components (unlike
 * `lib/payments/plans.ts`, which is `server-only` because it also carries
 * charge-math helpers).
 *
 * `priceAmount` is in whole major units (dollars). Pro $29/mo ($24/mo billed
 * yearly), Business $99/mo ($82/mo billed yearly). `priceAmount` is the source
 * of truth for both providers' recurring amounts; `planAmountMinor` /
 * `cycleAmountMinor` in `plans.ts` derive from it.
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