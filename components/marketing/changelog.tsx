"use client";

import Link from "next/link";
import { BlurReveal, StaggerContainer, StaggerItem } from "@/components/marketing/motion";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/* ── Release timeline (app/changelog/page.tsx) ───────────────────────────
   Premium vertical release timeline: glowing rail, breathing icon markers,
   accent-tinted release cards with staggered row reveals. All motion is
   transform/opacity via the shared Framer utilities (viewport `once`), and
   the continuous effects (`.cl-*` in globals.css) are CSS-only and disabled
   under prefers-reduced-motion. */

export type ReleaseNote = { kind: "New" | "Improved" | "Fixed"; body: string };

export type ReleaseEntry = {
  version: string;
  date: string;
  tag: "Released" | "Improved" | "Fixed";
  /** Release accent — drives marker, card bar, and hover glow. */
  accent: "brand" | "ai";
  /** Marker icon (lucide name, e.g. "Rocket"). */
  icon: string;
  /** Whether this is the latest release shown (adds "Latest" + prominence). */
  latest?: boolean;
  notes: ReleaseNote[];
};

// Header tag → badge tone: Released purple, Improved cyan, Fixed green.
const TAG_TONES = { Released: "brand", Improved: "ai", Fixed: "success" } as const;

// Row badge tone + contextual row icon per note kind.
const NOTE_META: Record<ReleaseNote["kind"], { tone: "brand" | "ai" | "success"; icon: string }> = {
  New: { tone: "brand", icon: "Sparkles" },
  Improved: { tone: "ai", icon: "TrendingUp" },
  Fixed: { tone: "success", icon: "Wrench" },
};

// Per-release accent styles — literal classes so Tailwind can statically
// extract them. Mostly near-black surfaces; the accent shows on the left
// bar, marker, and small hover accents only.
const ACCENTS = {
  brand: {
    marker:
      "border-brand/40 bg-brand/10 text-brand shadow-[0_0_18px_-4px_rgba(124,92,255,0.8)] group-hover/release:border-brand/60",
    bar: "bg-gradient-to-b from-brand via-brand/50 to-transparent",
    rowIcon: "group-hover/note:text-brand",
  },
  ai: {
    marker:
      "border-ai/40 bg-ai/10 text-ai shadow-[0_0_18px_-4px_rgba(34,211,238,0.8)] group-hover/release:border-ai/60",
    bar: "bg-gradient-to-b from-ai via-ai/50 to-transparent",
    rowIcon: "group-hover/note:text-ai",
  },
} as const;

/* ── Timeline ─────────────────────────────────────────────────────────── */

export function ReleaseTimeline({ entries }: { entries: ReleaseEntry[] }) {
  return (
    <div className="relative">
      {/* Glowing rail — hairline base + traveling light segment (CSS-only). */}
      <div className="pointer-events-none absolute inset-y-0 left-[21px] w-px sm:left-[23px]" aria-hidden>
        <span className="absolute inset-0 bg-gradient-to-b from-transparent via-border to-transparent" />
        <span className="cl-seek absolute inset-x-0" />
      </div>

      <ol className="space-y-12">
        {entries.map((e) => (
          <ReleaseItem key={e.version} entry={e} />
        ))}
      </ol>
    </div>
  );
}

/* ── One release: marker, header, card ────────────────────────────────── */

function ReleaseItem({ entry }: { entry: ReleaseEntry }) {
  const accent = ACCENTS[entry.accent];
  return (
    <li className="group/release-item relative pl-14 sm:pl-16">
      {/* Release marker — icon container riding the rail, breathing halo.
          The reveal wrapper is the positioned element so its transform can't
          hijack the marker's containing block. */}
      <BlurReveal y={10} className="absolute left-0 top-0">
        <span
          data-accent={entry.accent}
          className={cn(
            "relative grid h-11 w-11 place-items-center rounded-xl border backdrop-blur-sm transition-all duration-300 group-hover/release-item:scale-110 sm:h-12 sm:w-12",
            accent.marker,
          )}
          aria-hidden
        >
          <span className="cl-halo absolute inset-0 rounded-xl" />
          <Icon name={entry.icon} className="relative h-5 w-5" />
        </span>
      </BlurReveal>

      {/* Release header — version, tag, latest, date. */}
      <BlurReveal y={14}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-0.5">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">v{entry.version}</h2>
          <Badge tone={TAG_TONES[entry.tag]}>{entry.tag}</Badge>
          {entry.latest && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-[11px] font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden /> Latest
            </span>
          )}
          <span className="text-xs text-fg-subtle">{entry.date}</span>
        </div>
      </BlurReveal>

      {/* Release card — near-black surface, accent bar, staggered rows. */}
      <StaggerContainer
        stagger={0.06}
        className={cn(
          "card-hover relative mt-5 overflow-hidden rounded-2xl border bg-surface-2/40 transition-colors duration-300 group-hover/release-item:border-border-strong",
          entry.latest && "border-brand/30 bg-surface-2/60 shadow-[0_0_48px_-14px_rgba(124,92,255,0.4)]",
        )}
      >
        {/* Left accent bar */}
        <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[2px]", accent.bar)} />

        {entry.notes.map((n, j) => (
          <StaggerItem
            key={j}
            y={10}
            className={cn(
              "group/note flex items-start gap-3 px-4 py-3.5 transition-colors duration-200 hover:bg-surface-3/50 sm:px-5",
              j > 0 && "border-t border-border/60",
            )}
          >
            <Badge tone={NOTE_META[n.kind].tone} className="mt-0.5 shrink-0">
              {n.kind}
            </Badge>
            <span className="min-w-0 flex-1 text-sm leading-relaxed text-fg-muted">{n.body}</span>
            <Icon
              name={NOTE_META[n.kind].icon}
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0 text-fg-subtle transition-all duration-200 group-hover/note:scale-110",
                accent.rowIcon,
              )}
              aria-hidden
            />
          </StaggerItem>
        ))}
      </StaggerContainer>
    </li>
  );
}

/* ── Roadmap CTA — wide premium container with glowing doc icon ───────── */

export function RoadmapCTA() {
  return (
    <BlurReveal className="mt-14">
      <div className="mx-auto w-full rounded-2xl bg-gradient-to-r from-brand/40 via-border to-ai/40 p-px">
        <div className="relative overflow-hidden rounded-[calc(1rem-1px)] bg-surface/90 px-6 py-7 sm:px-8">
          <div
            className="pointer-events-none absolute -left-16 top-0 h-full w-56 rounded-full opacity-40 blur-3xl"
            style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(124,92,255,0.3), transparent 70%)" }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-16 bottom-0 h-full w-56 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(34,211,238,0.25), transparent 70%)" }}
            aria-hidden
          />

          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            {/* Document/search icon with orbital rings + glow. */}
            <div className="relative h-16 w-16 shrink-0" aria-hidden>
              <span className="orbital-ring absolute inset-0 opacity-70" style={{ animationDuration: "50s" }} />
              <span
                className="orbital-ring absolute inset-2 opacity-50"
                style={{ animationDirection: "reverse", animationDuration: "34s" }}
              />
              <span
                className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border border-brand/40 bg-brand-soft text-brand shadow-[0_0_24px_-4px_rgba(124,92,255,0.7)]"
              >
                <Icon name="FileSearch" className="h-5 w-5" />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold tracking-tight">
                Earlier releases predate the public changelog.
              </h3>
              <p className="mt-1.5 text-sm text-fg-muted">
                Want a deeper look at where we&rsquo;re headed? See the roadmap.
              </p>
            </div>

            {/* Gradient-border CTA — arrow nudges on hover. */}
            <Link
              href="/about"
              className="group/cta focus-ring inline-flex shrink-0 rounded-xl bg-gradient-to-r from-brand/60 to-ai/60 p-px transition-shadow duration-300 hover:shadow-[0_0_28px_-6px_rgba(124,92,255,0.7)]"
            >
              <span className="inline-flex items-center gap-2 rounded-[calc(0.75rem-1px)] bg-surface px-4 py-2 text-sm font-medium text-fg transition-colors duration-300 group-hover/cta:bg-surface-2">
                View roadmap
                <Icon
                  name="ArrowRight"
                  className="h-4 w-4 transition-transform duration-200 group-hover/cta:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </BlurReveal>
  );
}