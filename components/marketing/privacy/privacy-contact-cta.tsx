"use client";

import Link from "next/link";
import { FadeIn } from "@/components/marketing/motion";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

const focusClass =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function PrivacyContactCta({ email }: { email: string }) {
  return (
    <FadeIn y={18} className="relative overflow-hidden rounded-3xl border border-border">
      {/* Purple→cyan ambient wash, strongest at the edges so text stays dominant. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(60% 90% at 8% 20%, rgba(124,92,255,0.16), transparent 70%), radial-gradient(50% 80% at 95% 80%, rgba(34,211,238,0.12), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 grid-overlay opacity-60 [mask-image:radial-gradient(80%_100%_at_50%_50%,#000,transparent)]"
        aria-hidden
      />

      <div className="relative flex flex-col items-center gap-5 p-10 text-center sm:p-14">
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-brand/25 bg-brand-soft text-brand shadow-[0_0_28px_-6px_rgba(124,92,255,0.5)]">
          <Icon name="ShieldCheck" className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Questions about privacy?
          </h2>
          <p className="mt-2 text-fg-muted">We&apos;re here to help.</p>
        </div>
        <Link href="/contact">
          <Button size="lg" variant="ai">
            Contact us
            <Icon name="ArrowRight" className="h-4 w-4" aria-hidden />
          </Button>
        </Link>
        <p className="text-sm text-fg-subtle">
          Or email{" "}
          <a href={`mailto:${email}`} className={`${focusClass} text-brand hover:underline`}>
            {email}
          </a>
        </p>
      </div>
    </FadeIn>
  );
}