"use client";

// FAQ accordion — single-open behavior with smooth height animation.
// Answers are passed in from the server page (existing content, preserved).

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Icon } from "@/components/ui/icon";

export function ContactFaq({ faqs }: { faqs: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  return (
    <div className="mt-8 space-y-3">
      {faqs.map((f, i) => {
        const expanded = open === i;
        return (
          <div
            key={f.q}
            className={`rounded-xl border bg-surface-2/40 transition-colors duration-200 ${
              expanded ? "border-border-strong bg-surface-2/60" : "border-border hover:border-border-strong"
            }`}
          >
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : i)}
              aria-expanded={expanded}
              aria-controls={`faq-panel-${i}`}
              className="flex w-full cursor-pointer items-center justify-between gap-4 p-4 text-left text-sm font-medium focus-ring"
            >
              {f.q}
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border border-border bg-surface-3 text-fg-subtle transition-transform duration-200 ${
                  expanded ? "rotate-45 text-fg" : ""
                }`}
                aria-hidden
              >
                <Icon name="Plus" className="h-3.5 w-3.5" />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  id={`faq-panel-${i}`}
                  role="region"
                  initial={reduceMotion ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduceMotion ? { height: "auto", opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="border-t border-border/60 px-4 pb-4 pt-3 text-sm leading-relaxed text-fg-muted">
                    {f.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}