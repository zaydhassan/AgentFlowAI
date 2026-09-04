"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "@/components/ui/icon";

// Three compact trust statements, each grounded in content already on the
// page (enterprise offerings, published practices, scoping/residency controls).
const TRUST_ITEMS = [
  {
    icon: "Building2",
    title: "Built for enterprise",
    body: "Security questionnaires, SOC 2 report access, and self-hosted VPC deployment.",
  },
  {
    icon: "Eye",
    title: "Transparent practices",
    body: "Continuous scanning, third-party penetration testing, and coordinated disclosure.",
  },
  {
    icon: "SlidersHorizontal",
    title: "Your data, your control",
    body: "Scoped tokens, per-workspace secret vaults, and data residency options.",
  },
] as const;

export function SecurityTrustRow() {
  const reduceMotion = useReducedMotion();

  return (
    <section aria-label="Security principles" className="relative mx-auto max-w-7xl px-5 pb-4 lg:px-8">
      <ul className="grid gap-4 sm:grid-cols-3">
        {TRUST_ITEMS.map((t, i) => (
          <motion.li
            key={t.title}
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: i * 0.08 }}
            className="flex items-start gap-3.5 rounded-2xl border border-border bg-surface-2/40 p-5"
          >
            <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <Icon name={t.icon} className="h-4.5 w-4.5" aria-hidden />
              {/* Soft glow halo behind the icon. */}
              <span
                className="absolute inset-0 -z-10 rounded-xl bg-brand/30 blur-lg"
                aria-hidden
              />
            </span>
            <span className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight">{t.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-fg-muted">{t.body}</p>
            </span>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}