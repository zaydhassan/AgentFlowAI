// Final CTA — closing panel for the About page. Server component; links to
// existing routes only.

import Link from "next/link";
import { BlurReveal } from "@/components/marketing/motion";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function AboutCta() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 pt-4 lg:px-8">
      <BlurReveal className="relative overflow-hidden rounded-3xl border border-border mesh-bg px-8 py-16 text-center lg:py-20">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(124,92,255,0.6), rgba(34,211,238,0.6), transparent)",
          }}
          aria-hidden
        />
        <div className="relative">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            We&rsquo;re just getting started.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-fg-muted">
            Join us as we build the future of autonomous systems.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" variant="ai" className="btn-shine w-full">
                <Icon name="Rocket" className="h-4 w-4" /> Start building free
              </Button>
            </Link>
            <Link href="/contact" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full">
                <Icon name="Mail" className="h-4 w-4" /> Talk to us
              </Button>
            </Link>
          </div>
        </div>
      </BlurReveal>
    </section>
  );
}