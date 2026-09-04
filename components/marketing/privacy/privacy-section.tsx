"use client";

import { Fragment, type ReactNode } from "react";
import { FadeIn } from "@/components/marketing/motion";
import { Icon } from "@/components/ui/icon";

export type PrivacySectionData = {
  id: string;
  h: string;
  subtitle?: string;
  icon: string;
  body: string[];
};

const focusClass =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function PrivacySection({
  section,
  index,
  email,
}: {
  section: PrivacySectionData;
  index: number;
  email?: string;
}) {
  return (
    <FadeIn
      y={18}
      className="group relative scroll-mt-28 rounded-2xl border border-border bg-surface-2/40 transition-[border-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-[0_16px_40px_-16px_rgba(124,92,255,0.25)]"
      id={section.id}
    >
      {/* Hairline purple→cyan accent along the top edge, brightening on hover. */}
      <div
        className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-brand/40 via-brand-2/25 to-ai/40 transition-opacity duration-200 group-hover:opacity-100"
        aria-hidden
      />

      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex h-7 items-center rounded-full border border-brand/25 bg-brand-soft px-2.5 font-mono text-[11px] font-semibold text-brand">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{section.h}</h2>
            {section.subtitle && (
              <p className="mt-1.5 text-sm text-fg-subtle">{section.subtitle}</p>
            )}
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface-3/60 text-fg-muted transition-colors duration-200 group-hover:border-brand/30 group-hover:text-brand">
            <Icon name={section.icon} className="h-5 w-5" aria-hidden />
          </span>
        </div>

        <ul className="mt-5 space-y-3">
          {section.body.map((p) => (
            <li key={p} className="flex items-start gap-3 text-[15px] leading-7 text-fg-muted">
              <span className="mt-[13px] h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-brand to-ai" aria-hidden />
              <span>{linkify(p, email)}</span>
            </li>
          ))}
        </ul>
      </div>
    </FadeIn>
  );
}

// The policy text embeds the privacy email in plain prose; split it out so the
// address renders as a mailto link without changing any wording.
function linkify(text: string, email?: string): ReactNode {
  if (!email || !text.includes(email)) return text;
  const parts = text.split(email);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && (
        <a href={`mailto:${email}`} className={`${focusClass} text-brand hover:underline`}>
          {email}
        </a>
      )}
    </Fragment>
  ));
}