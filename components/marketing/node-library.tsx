"use client";

// Landing-page Node Library section — "Interactive AI infrastructure map".
// Fully derived from lib/nodes NODE_LIBRARY/CATEGORY_META: every count shown is
// computed from that data. The strip in the header is a labeled demo pipeline
// (commonly used node types), not claimed live production traffic.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { BlurReveal } from "@/components/marketing/motion";
import { CATEGORY_META, CATEGORY_ORDER, NODE_LIBRARY } from "@/lib/nodes";
import type { NodeCategory, NodeDef } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NodeLibraryGrid } from "./node-library-grid";
import { NodeLibraryFlow } from "./node-library-flow";

// One-line capability description per category (marketing copy for this
// section only — kept alongside the section, not in the shared node data).
const CATEGORY_BLURBS: Record<NodeCategory, string> = {
  ai: "Intelligence for autonomous workflows.",
  communication: "Reach your team wherever they work.",
  gmail: "Read, send, and organize your email.",
  database: "Persist and query structured data.",
  logic: "Branch, merge, and route execution.",
  files: "Parse and generate documents.",
  cloud: "Provision and use cloud services.",
  integrations: "Business apps, wired to your agents.",
  developer: "Code, APIs, and raw HTTP.",
  utilities: "Small tools with big leverage.",
  scheduling: "Trigger workflows right on time.",
  memory: "Give agents persistent context.",
  rag: "Ground answers in your documents.",
  mcp: "Extend agents with external tools.",
};

// Commonly used node types on the canvas — a curated demo pipeline built from
// real node definitions. Labeled as a demo; no live-activity claim.
const DEMO_PIPELINE_TYPES = ["ai.openai", "ai.agent", "store.postgres", "comm.slack"] as const;

type ViewMode = "grid" | "flow";

function matchesQuery(node: NodeDef, query: string): boolean {
  const t = query.toLowerCase().trim();
  if (!t) return true;
  // Match name, type (provider/integration prefix included), description,
  // category label, and config field labels/codes ("capabilities").
  const scan = [
    node.label,
    node.type,
    node.description,
    CATEGORY_META[node.category].label,
    node.category,
    ...(node.configSchema?.flatMap((f) => [f.label, f.key]) ?? []),
  ];
  return scan.some((s) => s.toLowerCase().includes(t));
}

const NODE_COUNT = NODE_LIBRARY.length;
// Honest headline count, floored to the nearest ten (74 → "70+").
const HEADLINE_COUNT = Math.floor(NODE_COUNT / 10) * 10;

export function NodeLibrary({ ctaHref }: { ctaHref: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<NodeCategory | "all">("all");
  const [view, setView] = useState<ViewMode>("grid");
  const searchRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  // ⌘K / "/" focuses the node search — mirrors the builder palette habit.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && /^(input|textarea|select)$/i.test(target.tagName);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reduceMotion]);

  const counts = useMemo(() => {
    const m = new Map<NodeCategory, number>();
    for (const n of NODE_LIBRARY) m.set(n.category, (m.get(n.category) ?? 0) + 1);
    return m;
  }, []);

  const filtered = useMemo(
    () => NODE_LIBRARY.filter((n) => (category === "all" || n.category === category) && matchesQuery(n, query)),
    [category, query],
  );

  // Categories that still have nodes after filtering — drives empty modules out
  // of the grid and dims non-matching nodes in the flow view.
  const activeCategories = useMemo(() => {
    const present = new Set(filtered.map((n) => n.category));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [filtered]);

  const searching = query.trim().length > 0 || category !== "all";

  const demoNodes = useMemo(
    () =>
      DEMO_PIPELINE_TYPES.map((t) => NODE_LIBRARY.find((n) => n.type === t)).filter(
        (n): n is NodeDef => Boolean(n),
      ),
    [],
  );

  return (
    <div className="relative">
      {/* Restrained ambient glow + subtle grid, behind everything. */}
      <div className="grid-overlay pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[720px] max-w-full -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(124,92,255,0.16), transparent 70%)" }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
        {/* ── Section hero ─────────────────────────────────────────── */}
        <BlurReveal className="mx-auto max-w-2xl text-center">
          <Badge tone="brand" className="mb-4">Node Library</Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {HEADLINE_COUNT}+ nodes. One canvas.
          </h2>
          <p className="mt-5 text-fg-muted">
            Connect AI models, communication tools, databases, cloud services, memory, RAG, and
            developer tools — everything your agents need to think, act, remember, and connect.
          </p>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/70 px-3.5 py-1.5 text-xs text-fg-muted">
            <span className="dot dot-live bg-success" />
            {NODE_COUNT} nodes available
          </p>
        </BlurReveal>

        {/* ── Search + filters ─────────────────────────────────────── */}
        <BlurReveal delay={0.08} className="mx-auto mt-12 max-w-3xl">
          <div
            className="glass relative flex items-center gap-3 rounded-xl border border-border px-4 py-3 shadow-[0_8px_40px_-16px_rgba(124,92,255,0.35)] transition-colors focus-within:border-border-strong"
            role="search"
          >
            <Icon name="Search" className="h-4 w-4 shrink-0 text-fg-subtle" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search nodes, integrations, or capabilities…"
              aria-label="Search nodes and integrations"
              className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
            />
            <kbd className="hidden shrink-0 items-center gap-1 rounded-md border border-border bg-surface-3 px-1.5 py-0.5 text-[10px] text-fg-subtle sm:flex">
              ⌘K
            </kbd>
            {searching && (
              <button
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
                className="shrink-0 cursor-pointer rounded-md p-1 text-fg-subtle transition-colors hover:text-fg focus-ring"
                aria-label="Clear search"
              >
                <Icon name="X" className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category filter — horizontal scroll on mobile. */}
          <div className="mt-4 -mx-5 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0" style={{ scrollbarWidth: "none" }}>
            <div className="flex w-max gap-2 lg:w-auto lg:flex-wrap lg:justify-center">
              <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
                All <span className="text-fg-subtle">{NODE_COUNT}</span>
              </FilterChip>
              {CATEGORY_ORDER.map((c) => (
                <FilterChip key={c} active={category === c} onClick={() => setCategory(c)} color={CATEGORY_META[c].color}>
                  {CATEGORY_META[c].label} <span className="text-fg-subtle">{counts.get(c)}</span>
                </FilterChip>
              ))}
            </div>
          </div>
        </BlurReveal>

        {/* ── View toggle ──────────────────────────────────────────── */}
        <div className="mt-10 flex items-center justify-between gap-4">
          <p className="hidden text-xs text-fg-subtle sm:block">
            {searching
              ? `${filtered.length} node${filtered.length === 1 ? "" : "s"} match your filters`
              : "Every node exposes inputs, outputs, settings, logs, and retry."}
          </p>
          <div className="glass flex rounded-lg border border-border p-1" role="tablist" aria-label="Node library view">
            {(["grid", "flow"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "relative cursor-pointer rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors focus-ring",
                  view === v ? "text-fg" : "text-fg-subtle hover:text-fg-muted",
                )}
              >
                {view === v && (
                  <motion.span
                    layoutId="nl-view-pill"
                    className="absolute inset-0 rounded-md bg-brand-soft shadow-[inset_0_0_0_1px_rgba(124,92,255,0.3)]"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <Icon name={v === "grid" ? "LayoutGrid" : "Waypoints"} className="h-3.5 w-3.5" />
                  {v === "grid" ? "Grid View" : "Flow View"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Views ────────────────────────────────────────────────── */}
        <div className="relative mt-8">
          {view === "grid" ? (
            <NodeLibraryGrid
              filtered={filtered}
              activeCategories={activeCategories}
              activeCategory={category === "all" ? null : category}
              onExplore={setCategory}
              onCollapse={() => setCategory("all")}
              ctaHref={ctaHref}
              blurbs={CATEGORY_BLURBS}
            />
          ) : (
            <NodeLibraryFlow
              matchCategories={activeCategories}
              onExplore={(c) => {
                setCategory(c);
                setView("grid");
              }}
            />
          )}
        </div>

        {/* ── Commonly used demo pipeline + featured nodes ─────────── */}
        <div className="mx-auto mt-14 max-w-3xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
            Commonly used on the canvas
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {demoNodes.map((n, i) => (
              <motion.span
                key={n.type}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.35, delay: i * 0.07 }}
                className="flex items-center gap-2"
              >
                <button
                  onClick={() => {
                    setQuery(n.label);
                    setCategory("all");
                    setView("grid");
                    searchRef.current?.focus();
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface-2/60 px-2.5 py-1.5 text-xs text-fg-muted transition-all hover:-translate-y-0.5 hover:border-border-strong hover:text-fg focus-ring"
                  title={`Filter for ${n.label}`}
                >
                  <Icon name={n.icon} className="h-3.5 w-3.5" style={{ color: n.color }} />
                  {n.label}
                </button>
                {i < demoNodes.length - 1 && <Icon name="ArrowRight" className="h-3 w-3 text-fg-subtle" aria-hidden />}
              </motion.span>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-fg-subtle">
            Demo pipeline — real node types from the library, not live execution data.
          </p>
        </div>

        {/* ── Bottom CTA ───────────────────────────────────────────── */}
        <BlurReveal className="mx-auto mt-20 max-w-4xl">
          <div className="surface-premium relative overflow-hidden rounded-2xl border border-border px-8 py-12 text-center">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(124,92,255,0.6), rgba(34,211,238,0.6), transparent)" }}
              aria-hidden
            />
            <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              More nodes. More possibilities.
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm text-fg-muted">
              Need an integration we don&rsquo;t have yet? Tell us what connects to your workflow —
              or build it yourself with the developer toolkit.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/contact" className="w-full sm:w-auto">
                <Button variant="ai" size="sm" className="btn-shine w-full">
                  <Icon name="PlusCircle" className="h-4 w-4" /> Request an integration
                </Button>
              </Link>
              <Link href="/docs/integrations" className="w-full sm:w-auto">
                <Button variant="secondary" size="sm" className="w-full">
                  <Icon name="BookOpen" className="h-4 w-4" /> Browse the docs
                </Button>
              </Link>
            </div>
          </div>
        </BlurReveal>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all focus-ring",
        active
          ? "border-brand/50 bg-brand-soft text-fg"
          : "border-border bg-surface-2/50 text-fg-muted hover:border-border-strong hover:text-fg",
      )}
      aria-pressed={active}
    >
      {color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />}
      {children}
    </button>
  );
}