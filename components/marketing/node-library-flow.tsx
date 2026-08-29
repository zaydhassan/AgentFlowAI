"use client";

// Flow view — a miniature AgentFlow canvas mapping how node categories compose:
// Trigger → Think → Control → Connect. Pure SVG (bezier edges + SMIL traveling
// pulses, the same technique as HeroWorkflow — no JS animation loops). Hover/
// tap a category to trace its connections; reduced-motion users get static
// connections (particles are not rendered).

import { useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { CATEGORY_META, NODE_LIBRARY } from "@/lib/nodes";
import type { NodeCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const CARD_W = 150;
const CARD_H = 54;

// Flow layout order — Trigger column, Think column, Control column, Connect.
const FLOW_CATEGORIES: NodeCategory[] = [
  "scheduling",
  "memory",
  "ai",
  "rag",
  "mcp",
  "logic",
  "utilities",
  "developer",
  "communication",
  "gmail",
  "database",
  "cloud",
  "files",
  "integrations",
];

const XS = [30, 260, 490, 720];
const POSITIONS: Record<NodeCategory, number> = {
  scheduling: 194,
  memory: 64,
  ai: 194,
  rag: 324,
  mcp: 454,
  logic: 64,
  utilities: 194,
  developer: 324,
  communication: 64,
  gmail: 144,
  database: 224,
  cloud: 304,
  files: 384,
  integrations: 464,
};

// Left x/y for every category — matching FLOW_CATORS order.
function colOf(cat: NodeCategory): 0 | 1 | 2 | 3 {
  const i = FLOW_CATEGORIES.indexOf(cat);
  return (i < 1 ? 0 : i < 5 ? 1 : i < 8 ? 2 : 3) as 0 | 1 | 2 | 3;
}

// How categories typically compose on the canvas (source → drains into).
const EDGES: [NodeCategory, NodeCategory][] = [
  ["scheduling", "ai"],
  ["memory", "ai"],
  ["rag", "ai"],
  ["mcp", "ai"],
  ["ai", "logic"],
  ["ai", "utilities"],
  ["ai", "developer"],
  ["logic", "communication"],
  ["logic", "gmail"],
  ["logic", "database"],
  ["utilities", "files"],
  ["utilities", "cloud"],
  ["developer", "integrations"],
];

const VB_W = 920;
const VB_H = 560;
const STAGES = ["Trigger", "Think", "Control", "Connect"];

const NODES_IN = new Map<NodeCategory, number>(
  FLOW_CATEGORIES.map((c) => [c, NODE_LIBRARY.filter((n) => n.category === c).length]),
);

function edgePath(from: NodeCategory, to: NodeCategory): string {
  const x1 = XS[colOf(from)] + CARD_W;
  const y1 = POSITIONS[from] + CARD_H / 2;
  const x2 = XS[colOf(to)];
  const y2 = POSITIONS[to] + CARD_H / 2;
  const dx = Math.max(40, (x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function NodeLibraryFlow({
  matchCategories,
  onExplore,
}: {
  matchCategories: NodeCategory[];
  onExplore: (c: NodeCategory) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [focus, setFocus] = useState<NodeCategory | null>(null);
  const matchSet = useMemo(() => new Set(matchCategories), [matchCategories]);

  const edgeIndex = useMemo(
    () => EDGES.map(([a, b], i) => ({ id: `nl-edge-${i}`, gradId: `nl-grad-${a}-${b}`, a, b, d: edgePath(a, b) })),
    [],
  );

  const connected = useMemo(() => {
    if (!focus) return new Set<NodeCategory>();
    const s = new Set<NodeCategory>([focus]);
    for (const [a, b] of EDGES) {
      if (a === focus) s.add(b);
      if (b === focus) s.add(a);
    }
    return s;
  }, [focus]);

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[90%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(91,139,255,0.1), transparent 70%)" }}
        aria-hidden
      />
      {/* min-w keeps the map legible on phones; the wrapper scrolls, the page
          itself never does. */}
      <div className="relative overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="mx-auto h-auto w-full min-w-[760px] max-w-4xl overflow-visible"
          role="img"
          aria-label="Map of how AgentFlow node categories compose: schedule triggers feed AI nodes, AI nodes draw on memory, RAG and MCP tools, then flow through logic and developer controls out to communications, Gmail, databases, cloud, files and integrations"
        >
          <defs>
            {edgeIndex.map((e) => (
              <linearGradient key={`g-${e.gradId}`} id={e.gradId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={CATEGORY_META[e.a].color} />
                <stop offset="100%" stopColor={CATEGORY_META[e.b].color} />
              </linearGradient>
            ))}
            {edgeIndex.map((e) => (
              <path key={`d-${e.id}`} id={e.id} d={e.d} fill="none" />
            ))}
          </defs>

          {/* Stage labels */}
          {STAGES.map((s, i) => (
            <text
              key={s}
              x={XS[i] + CARD_W / 2}
              y={26}
              textAnchor="middle"
              style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", fill: "var(--color-fg-subtle)" }}
            >
              {s.toUpperCase()}
            </text>
          ))}

          {/* Base connectors — color-blended from source to target category. */}
          {edgeIndex.map((e) => {
            const lit = focus !== null && (e.a === focus || e.b === focus);
            const dimmed = focus !== null && !lit;
            return (
              <path
                key={`b-${e.id}`}
                d={e.d}
                fill="none"
                stroke={`url(#${e.gradId})`}
                strokeWidth={lit ? 2 : 1.5}
                opacity={dimmed ? 0.08 : lit ? 0.85 : 0.3}
                style={{ transition: "opacity 0.3s ease, stroke-width 0.3s ease" }}
              />
            );
          })}

          {/* Traveling pulses — SMIL, no JS loop. Omitted under
              prefers-reduced-motion. */}
          {!reduceMotion &&
            edgeIndex.map((e, i) => (
              <circle key={`m-${e.id}`} r={2.4} fill={CATEGORY_META[e.b].color} opacity={0.9}>
                <animateMotion dur={`${4 + (i % 4) * 0.8}s`} begin={`${i * 0.7}s`} repeatCount="indefinite">
                  <mpath href={`#${e.id}`} />
                </animateMotion>
              </circle>
            ))}

          {/* Category cards */}
          {FLOW_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const traced = focus !== null;
            const dimmedByTrace = traced && !connected.has(cat);
            const filteredOut = matchSet.size > 0 && !matchSet.has(cat);
            return (
              <foreignObject
                key={cat}
                x={XS[colOf(cat)]}
                y={POSITIONS[cat]}
                width={CARD_W}
                height={CARD_H}
                style={{ opacity: filteredOut || dimmedByTrace ? 0.22 : 1, transition: "opacity 0.3s ease" }}
              >
                <button
                  type="button"
                  onMouseEnter={() => setFocus(cat)}
                  onMouseLeave={() => setFocus((f) => (f === cat ? null : f))}
                  onClick={() => setFocus(cat)}
                  className={cn(
                    "group relative flex h-full w-full cursor-pointer items-center gap-2 rounded-xl border bg-surface-2/90 px-2.5 text-left backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 focus-ring",
                    focus === cat ? "border-border-strong bg-surface-3" : "border-border hover:border-border-strong",
                  )}
                  style={focus === cat ? { boxShadow: `0 8px 30px -12px ${meta.color}88, inset 0 0 0 1px ${meta.color}55` } : undefined}
                >
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                    style={{ background: `${meta.color}1f`, color: meta.color, boxShadow: `inset 0 0 0 1px ${meta.color}40` }}
                  >
                    <Icon name={meta.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold leading-tight text-fg">{meta.label}</span>
                    <span className="block text-[9px] leading-tight text-fg-subtle">
                      {filteredOut ? "filtered out" : `${NODES_IN.get(cat)} node${NODES_IN.get(cat) === 1 ? "" : "s"}`}
                    </span>
                  </span>
                </button>
              </foreignObject>
            );
          })}
        </svg>
      </div>

      <div className="mt-4 flex flex-col items-center gap-2 text-center">
        <p className="text-[11px] text-fg-subtle">
          How categories compose on the canvas — hover or tap a node to trace its connections.
        </p>
        {focus && (
          <button
            onClick={() => onExplore(focus)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-brand/40 bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:text-ai focus-ring"
          >
            <Icon name="LayoutGrid" className="h-3.5 w-3.5" />
            Explore {CATEGORY_META[focus].label} in grid view
          </button>
        )}
      </div>
    </div>
  );
}