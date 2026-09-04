"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CodeBlock } from "@/components/docs/code-block";
import { Icon } from "@/components/ui/icon";

export type GuideStep = {
  n: string;
  title: string;
  code: string;
  body: string;
};

export function DeveloperTimeline({ steps }: { steps: GuideStep[] }) {
  const reduceMotion = useReducedMotion();

  return (
    <ol className="relative mt-10 flex flex-col">
      {/* Vertical rail running through the numbered nodes. */}
      <div
        aria-hidden
        className="absolute bottom-6 left-[18px] top-6 w-px bg-gradient-to-b from-brand/50 via-brand-2/40 to-ai/50"
      />
      {steps.map((g, i) => (
        <motion.li
          key={g.n}
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
          className="relative flex gap-5 pb-8 last:pb-0"
        >
          {/* Glowing numbered node. */}
          <div className="relative z-10 shrink-0">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-brand/40 bg-bg font-mono text-xs font-semibold text-brand shadow-[0_0_16px_-4px_rgba(124,92,255,0.6)]">
              {g.n}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold tracking-tight">{g.title}</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fg-muted">{g.body}</p>
            <CodeBlock code={`$ ${g.code}`} language="bash" className="mt-4" />
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

// Premium horizontal callout — lightbulb + title + text + trailing action.
export function DocsCallout({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-border bg-surface-2/40"
    >
      {/* Soft purple→cyan wash. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(45% 80% at 0% 50%, rgba(124,92,255,0.10), transparent 70%), radial-gradient(40% 80% at 100% 50%, rgba(34,211,238,0.07), transparent 70%)",
        }}
      />
      <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand/25 bg-brand-soft text-brand">
          <Icon name="Lightbulb" className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{children}</p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </motion.div>
  );
}