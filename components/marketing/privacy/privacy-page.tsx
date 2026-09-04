"use client";

import { useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { PrivacyHero } from "./privacy-hero";
import { PrivacyTrustCallouts } from "./privacy-trust-callouts";
import { PrivacyToc, PrivacyTocMobile, type TocItem } from "./privacy-toc";
import { PrivacySection, type PrivacySectionData } from "./privacy-section";
import { PrivacyContactCta } from "./privacy-contact-cta";

export type PrivacyPageProps = {
  sections: PrivacySectionData[];
  lastUpdated: string;
  email: string;
};

export function PrivacyPage({ sections, lastUpdated, email }: PrivacyPageProps) {
  const tocItems: TocItem[] = sections.map((s) => ({ id: s.id, title: s.h }));
  const [activeId, setActiveId] = useState<string | null>(tocItems[0]?.id ?? null);

  // Highlight the section currently scrolled into the reading zone. The
  // observer fires when a section's top edge enters the band just below the
  // fixed navbar, which matches where a reader is looking.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      // Top offset ~ the fixed navbar + margin; bottom pulls the trigger zone
      // to the upper third of the viewport.
      { rootMargin: "-100px 0px -70% 0px", threshold: 0 }
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // sections is static page data — stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On short viewports where the last section can't reach the trigger zone,
  // pin it active once the reader hits the page bottom.
  useEffect(() => {
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        setActiveId(tocItems[tocItems.length - 1]?.id ?? null);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [tocItems]);

  return (
    <MotionConfig reducedMotion="user">
      <PrivacyHero lastUpdated={lastUpdated} />
      <PrivacyTrustCallouts />

      {/* Two-column legal documentation layout: sticky TOC + content cards.
          The background behind the text stays far more subtle than the hero. */}
      <section className="relative" aria-label="Privacy policy content">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="grid-overlay absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,transparent,#000_10%,#000_90%,transparent)]" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(30% 20% at 0% 30%, rgba(124,92,255,0.05), transparent 70%), radial-gradient(28% 20% at 100% 60%, rgba(34,211,238,0.04), transparent 70%)",
            }}
          />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-5 pb-16 pt-10 lg:px-8">
          {/* Compact TOC for small screens. */}
          <div className="mb-8 lg:hidden">
            <PrivacyTocMobile items={tocItems} activeId={activeId} />
          </div>

          <div className="grid gap-10 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-14">
            <aside className="hidden lg:block">
              <div className="sticky top-28 max-h-[calc(100dvh-9rem)] overflow-y-auto pr-2">
                <PrivacyToc items={tocItems} activeId={activeId} />
              </div>
            </aside>

            <div className="min-w-0 max-w-3xl space-y-6">
              {sections.map((s, i) => (
                <PrivacySection key={s.id} section={s} index={i} email={email} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative" aria-label="Privacy contact">
        <div className="mx-auto w-full max-w-7xl px-5 pb-24 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <PrivacyContactCta email={email} />
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}