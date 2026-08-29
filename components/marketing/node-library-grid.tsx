"use client";

// Grid view — category "capability modules" with real node counts, per-node
// hover detail popover, and drag affordances (the same `application/
// agentflow-node` MIME type the workflow builder's palette consumes).

import { useMemo } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { CATEGORY_META } from "@/lib/nodes";
import type { NodeCategory, NodeDef } from "@/lib/types";
import { cn } from "@/lib/utils";

const PREVIEW_NODES = 4;

export function NodeLibraryGrid({
  filtered,
  activeCategories,
  activeCategory,
  onExplore,
  onCollapse,
  ctaHref,
  blurbs,
}: {
  filtered: NodeDef[];
  activeCategories: NodeCategory[];
  activeCategory: NodeCategory | null;
  onExplore: (c: NodeCategory) => void;
  onCollapse: () => void;
  ctaHref: string;
  blurbs: Record<NodeCategory, string>;
}) {
  const reduceMotion = useReducedMotion();

  const byCategory = useMemo(() => {
    const m = new Map<NodeCategory, NodeDef[]>();
    for (const n of filtered) {
      if (!m.has(n.category)) m.set(n.category, []);
      m.get(n.category)!.push(n);
    }
    return m;
  }, [filtered]);

  if (activeCategories.length === 0) {
    return (
      <div className="glass mx-auto max-w-md rounded-xl border border-border px-8 py-14 text-center">
        <Icon name="SearchX" className="mx-auto h-6 w-6 text-fg-subtle" />
        <p className="mt-3 text-sm text-fg-muted">No nodes match your search.</p>
        <p className="mt-1 text-xs text-fg-subtle">
          Try a provider, tool, or capability — e.g. &ldquo;email&rdquo;, &ldquo;SQL&rdquo; or &ldquo;model&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4",
        activeCategories.length === 1 ? "mx-auto max-w-xl sm:max-w-none lg:grid-cols-2" : "lg:grid-cols-3 xl:grid-cols-4",
      )}
    >
      <AnimatePresence mode="popLayout">
        {activeCategories.map((cat, gi) => {
          const meta = CATEGORY_META[cat];
          const nodes = byCategory.get(cat)!;
          return (
            <motion.div
              key={cat}
              layout
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.35, delay: Math.min(gi * 0.06, 0.4), ease: [0.22, 1, 0.36, 1] }}
            >
              <CategoryModule
                cat={cat}
                meta={meta}
                nodes={nodes}
                blurredTop={blurbs[cat]}
                expanded={activeCategory === cat}
                onExplore={onExplore}
                onCollapse={onCollapse}
                ctaHref={ctaHref}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function CategoryModule({
  cat,
  meta,
  nodes,
  blurredTop,
  expanded,
  onExplore,
  onCollapse,
  ctaHref,
}: {
  cat: NodeCategory;
  meta: { label: string; color: string; icon: string };
  nodes: NodeDef[];
  blurredTop: string;
  expanded: boolean;
  onExplore: (c: NodeCategory) => void;
  onCollapse: () => void;
  ctaHref: string;
}) {
  const preview = expanded ? nodes : nodes.slice(0, PREVIEW_NODES);
  const hiddenCount = nodes.length - preview.length;

  return (
    // .nl-module — like .metric-card, but lets the detail popover escape the
    // card (metric-card clips overflow).
    <div className="nl-module h-full rounded-xl p-5" style={{ ["--glow" as string]: meta.color }}>
      {/* Subtle category illustration — a small icon constellation tinted with
          the category color, echoing the palette. */}
      <div className="pointer-events-none absolute -right-3 -top-3 select-none" aria-hidden>
        {[nodes[0], nodes[Math.min(1, nodes.length - 1)], nodes[nodes.length - 1]].map((n, i) => (
          <span
            key={i}
            className={cn("absolute grid place-items-center rounded-lg border border-border/60", i === 0 ? "h-9 w-9" : i === 1 ? "h-7 w-7" : "h-6 w-6")}
            style={{
              right: [30, 2, 0][i],
              top: [10, 36, 16][i],
              background: `${meta.color}${i === 0 ? "1f" : "14"}`,
              color: meta.color,
              opacity: i === 0 ? 0.8 : 0.45,
              transform: `rotate(${[-8, 8, 0][i]}deg)`,
            }}
          >
            <Icon name={n.icon} className={i === 0 ? "h-4 w-4" : "h-3 w-3"} />
          </span>
        ))}
      </div>

      <div className="relative">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg"
            style={{ background: `${meta.color}1f`, color: meta.color, boxShadow: `inset 0 0 0 1px ${meta.color}40` }}
          >
            <Icon name={meta.icon} className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold">{meta.label}</span>
          <span className="ml-auto rounded-full border border-border bg-surface-3/60 px-2 py-0.5 text-[10px] font-medium text-fg-muted">
            {nodes.length} {nodes.length === 1 ? "node" : "nodes"}
          </span>
        </div>

        <p className="mt-3 min-h-[2.25rem] text-xs leading-relaxed text-fg-muted">{blurredTop}</p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {preview.map((n) => (
            <NodePill key={n.type} node={n} ctaHref={ctaHref} />
          ))}
        </div>

        <div className="mt-4 flex h-5 items-center justify-between">
          {hiddenCount > 0 ? (
            <>
              <span className="text-[10px] text-fg-subtle">+{hiddenCount} more</span>
              <button
                onClick={() => onExplore(cat)}
                className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-brand transition-colors hover:text-ai focus-ring"
              >
                Explore nodes <Icon name="ArrowRight" className="h-3 w-3" />
              </button>
            </>
          ) : expanded ? (
            <button
              onClick={onCollapse}
              className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-fg-subtle transition-colors hover:text-fg focus-ring"
            >
              <Icon name="ChevronUp" className="h-3 w-3" /> Show all categories
            </button>
          ) : (
            <span className="text-[10px] text-fg-subtle">All {nodes.length} shown</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Pill: hover/focus shows a detail popover built from the node's real metadata
// (description, inputs, outputs). Anchored to the pill's left edge on desktop
// so it never overflows the page container.
function NodePill({ node, ctaHref }: { node: NodeDef; ctaHref: string }) {
  return (
    <div className="group relative pb-1">
      <Link
        href={ctaHref}
        draggable
        onDragStart={(e) => {
          // Same MIME type the builder's canvas drop handler reads — the drag
          // gesture mirrors the in-app palette.
          e.dataTransfer.setData("application/agentflow-node", node.type);
          e.dataTransfer.effectAllowed = "copy";
        }}
        className="node-pill inline-flex cursor-grab items-center gap-1.5 rounded-lg border border-border bg-surface-2/60 px-2.5 py-1.5 text-[11px] text-fg-muted transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-3/70 hover:text-fg focus-ring active:cursor-grabbing"
        title={`${node.label} — ${node.description}`}
      >
        <Icon name={node.icon} className="h-3 w-3 shrink-0" style={{ color: node.color }} />
        <span className="whitespace-nowrap">{node.label}</span>
      </Link>

      {/* Detail popover — hover/focus only (≥sm); touch users tap through to
          the dashboard where the full inspector exists. */}
      <div
        role="tooltip"
        className="nl-pop pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-60 max-w-[min(15rem,calc(100vw-4rem))] rounded-xl p-3.5 opacity-0 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.7)] transition-all duration-200 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 sm:block"
      >
        <div className="flex items-center gap-2">
          <span
            className="grid h-6 w-6 place-items-center rounded-md"
            style={{ background: `${node.color}1f`, color: node.color }}
          >
            <Icon name={node.icon} className="h-3 w-3" />
          </span>
          <span className="text-xs font-semibold">{node.label}</span>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-fg-muted">{node.description}</p>
        <div className="mt-2.5 space-y-1 text-[10px] text-fg-subtle">
          <span className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1">
              <Icon name="ArrowDownRight" className="h-3 w-3" /> Inputs
            </span>
            <span className="text-fg">{node.inputs}</span>
          </span>
          <span className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1">
              <Icon name="ArrowUpRight" className="h-3 w-3" /> Outputs
            </span>
            <span className="text-fg">{node.outputs}</span>
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1 border-t border-border pt-2.5 text-[10px] font-medium text-brand">
          Add to workflow <Icon name="ArrowRight" className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}