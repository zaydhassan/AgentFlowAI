"use client";

import { Icon } from "@/components/ui/icon";
import { motion, useReducedMotion } from "framer-motion";

// Value-prop block shared by the auth pages. `full` renders on the desktop
// right panel (large heading, vertical feature list). `compact` renders on
// mobile above the form (smaller heading, 2×2 feature grid) so the right-side
// content is visible on small screens where the side panel is hidden.
const FEATURES = [
  { icon: "Sparkles", t: "Natural-language workflow builder" },
  { icon: "Wrench", t: "Self-healing executions" },
  { icon: "LineChart", t: "Full AI observability" },
  { icon: "ShieldCheck", t: "RBAC, audit logs, SSO ready" },
] as const;

export function AuthShowcase({ variant }: { variant: "full" | "compact" }) {
  const reduce = useReducedMotion();
  const full = variant === "full";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: full ? 10 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: full ? 0.5 : 0.45, ease: "easeOut" }}
      className={full ? "max-w-md" : undefined}
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-1 text-xs text-fg-muted">
        <Icon name="Sparkles" className="h-3 w-3 text-brand" />
        AI-native automation platform
      </div>
      <h2
        className={
          full
            ? "mt-6 text-3xl font-semibold tracking-tight"
            : "mt-4 text-xl font-semibold tracking-tight"
        }
      >
        The automation platform where <span className="text-brand-gradient">AI is the engine</span>.
      </h2>
      <p className={full ? "mt-4 text-fg-muted" : "mt-3 text-sm text-fg-muted"}>
        Reason over every step. Recover from failures automatically. Let a copilot optimize cost and
        architecture. Build in minutes, scale with confidence.
      </p>

      <motion.ul
        initial={reduce ? false : "hidden"}
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.07, delayChildren: full ? 0.2 : 0.1 } },
        }}
        className={full ? "mt-8 space-y-3" : "mt-5 grid grid-cols-2 gap-2.5"}
      >
        {FEATURES.map((f) => (
          <motion.li
            key={f.t}
            variants={{
              hidden: reduce ? {} : { opacity: 0, y: 6 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
            }}
            className={
              full
                ? "group flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 px-4 py-3 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong"
                : "flex items-center gap-2 rounded-lg border border-border bg-surface-2/40 px-2.5 py-2"
            }
          >
            <span
              className={
                full
                  ? "grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand"
                  : "grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand-soft text-brand"
              }
            >
              <Icon name={f.icon} className={full ? "h-4 w-4" : "h-3.5 w-3.5"} />
            </span>
            <span className={full ? "text-sm" : "text-[11px] leading-tight text-fg-muted"}>{f.t}</span>
          </motion.li>
        ))}
      </motion.ul>
    </motion.div>
  );
}