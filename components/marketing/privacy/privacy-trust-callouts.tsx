"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "@/components/ui/icon";

// Each line is grounded in the policy content on this page — these callouts
// summarize existing statements, they do not introduce new claims.
const CALLOUTS = [
  {
    icon: "SlidersHorizontal",
    title: "Your data, your control",
    body: "Access, export, or delete your data with the controls described in this policy.",
  },
  {
    icon: "Eye",
    title: "Transparent practices",
    body: "What we collect, why we collect it, and who we share it with — documented here.",
  },
  {
    icon: "Lock",
    title: "Secure by design",
    body: "Data is encrypted in transit (TLS) and at rest, with least-privilege access.",
  },
] as const;

export function PrivacyTrustCallouts() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      aria-label="Privacy principles"
      className="relative mx-auto max-w-5xl px-5 pb-4 lg:px-8"
    >
      <ul className="grid gap-4 sm:grid-cols-3">
        {CALLOUTS.map((c, i) => (
          <motion.li
            key={c.title}
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: i * 0.08 }}
            className="relative overflow-hidden rounded-2xl border border-border bg-surface-2/40 p-5"
          >
            {/* Hairline purple→cyan accent along the top edge. */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-brand/50 via-brand-2/30 to-ai/50" aria-hidden />
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                <Icon name={c.icon} className="h-4.5 w-4.5" />
              </span>
              <h2 className="text-sm font-semibold tracking-tight">{c.title}</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-fg-muted">{c.body}</p>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}