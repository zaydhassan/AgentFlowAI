"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "@/components/ui/icon";

export function SecurityPractices({
  practices,
  disclosure,
  note,
  email,
}: {
  practices: string[];
  disclosure: string;
  note: string;
  email: string;
}) {
  return (
    <div className="grid gap-10 md:grid-cols-2 lg:gap-14">
      {/* LEFT — practices checklist with sequential check reveals. */}
      <div>
        <div className="flex items-center gap-2 text-brand">
          <Icon name="ShieldCheck" className="h-4 w-4" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-widest">Our approach</span>
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          Security practices
        </h2>
        <p className="mt-3 max-w-md text-base leading-relaxed text-fg-muted">
          Operational safeguards that run continuously across the platform.
        </p>
        <ul className="mt-8 space-y-4">
          {practices.map((p, i) => (
            <PracticeItem key={p} text={p} index={i} />
          ))}
        </ul>
      </div>

      <DisclosurePanel disclosure={disclosure} note={note} email={email} />
    </div>
  );
}

function PracticeItem({ text, index }: { text: string; index: number }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="flex items-start gap-3 text-[15px] leading-relaxed text-fg-muted"
    >
      <motion.span
        initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.35, delay: index * 0.08 + 0.1, type: "spring", stiffness: 300, damping: 20 }}
        className="mt-0.5 shrink-0"
      >
        <Icon name="CheckCircle2" className="h-5 w-5 text-success" aria-hidden />
      </motion.span>
      {text}
    </motion.li>
  );
}

// RIGHT — responsible-disclosure panel with a copyable email field.
function DisclosurePanel({
  disclosure,
  note,
  email,
}: {
  disclosure: string;
  note: string;
  email: string;
}) {
  const [copied, setCopied] = useState(false);
  const reduceMotion = useReducedMotion();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be blocked (permissions / non-secure context).
    }
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[20px] border border-border bg-surface-2/60 md:self-start"
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(50% 60% at 0% 0%, rgba(124,92,255,0.12), transparent 70%), radial-gradient(45% 60% at 100% 100%, rgba(34,211,238,0.08), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-brand/50 via-brand-2/30 to-ai/50"
        aria-hidden
      />

      <div className="relative p-7 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-brand/25 bg-brand-soft text-brand">
            <Icon name="Bug" className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
            Responsible disclosure
          </span>
        </div>

        <h3 className="mt-4 text-lg font-semibold tracking-tight">Found a vulnerability?</h3>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{disclosure}</p>

        {/* Copyable email field. */}
        <div className="mt-5 flex items-stretch gap-2">
          <div
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-border bg-bg/60 px-4 py-2.5 transition-colors duration-200 focus-within:border-brand/40"
          >
            <Icon name="Mail" className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden />
            <span
              className="truncate select-all font-mono text-[13px] text-fg/90"
              title={email}
            >
              {email}
            </span>
          </div>
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy ${email} to clipboard`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface-2/80 px-3.5 text-xs font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg focus-ring"
          >
            <Icon name={copied ? "Check" : "Copy"} className="h-3.5 w-3.5" aria-hidden />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-fg-subtle">
          <Icon name="Info" className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {note}
        </p>
      </div>
    </motion.div>
  );
}