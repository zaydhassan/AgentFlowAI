"use client";

// Hero workflow visualization — a compact agent graph:
//   Trigger → AI Agent ⇄ Memory / Tools → Action
// Electric-blue connectors carry traveling particles while a slow execution
// cycle lights each stage in sequence (trigger → think → retrieve / use
// tools → act). Two compositions: the full graph from md up, a vertical
// stack below it, so the hero never overflows. Connector particles are SMIL
// (no JS loop); framer-motion handles entrance, pulses and the AI Agent
// halo. Reduced-motion users get a static graph.

import { useEffect, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionStyle,
} from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type StageKey = "trigger" | "agent" | "memory" | "tools" | "action";

type StageDef = {
  icon: string;
  title: string;
  sub: string;
  center?: boolean; // the AI Agent — visual centerpiece
};

const STAGES: Record<StageKey, StageDef> = {
  trigger: { icon: "Mail", title: "Trigger", sub: "gmail · new.message" },
  agent: { icon: "Sparkles", title: "AI Agent", sub: "claude · reasoning", center: true },
  memory: { icon: "Database", title: "Memory", sub: "context · pgvector" },
  tools: { icon: "Wrench", title: "Tools", sub: "mcp · tool.call" },
  action: { icon: "MessageSquare", title: "Action", sub: "slack · post #ops" },
};

type EdgeDef = {
  d: string;
  label?: string;
  icon?: string;
  lx?: number;
  ly?: number;
  hot: number; // execution phase during which this edge carries the pulse
};

type Layout = {
  id: string; // prefixes def ids so both mounted SVGs never collide
  w: number;
  h: number;
  cx: number; // AI Agent center — anchors the ambient field + orbit rings
  cy: number;
  nodes: Record<StageKey, { x: number; y: number; w: number; h: number }>;
  edges: EdgeDef[];
  rings: { r: number; stroke: string; dash?: boolean }[];
};

// Desktop/tablet graph. Side cards leave 70px connector gaps so the icon
// pills sit directly on the lines without touching a card.
const DESKTOP: Layout = {
  id: "d",
  w: 654,
  h: 420,
  cx: 327,
  cy: 212,
  nodes: {
    trigger: { x: 249, y: 22, w: 156, h: 60 },
    agent: { x: 228, y: 164, w: 198, h: 96 },
    memory: { x: 2, y: 180, w: 156, h: 64 },
    tools: { x: 496, y: 180, w: 156, h: 64 },
    action: { x: 249, y: 332, w: 156, h: 60 },
  },
  edges: [
    { d: "M 327 82 L 327 162", label: "TRIGGER", icon: "Zap", lx: 327, ly: 122, hot: 0 },
    { d: "M 158 214 L 226 214", label: "RETRIEVE", icon: "Search", lx: 193, ly: 214, hot: 2 },
    { d: "M 428 214 L 496 214", label: "USE TOOLS", icon: "Wrench", lx: 461, ly: 214, hot: 2 },
    { d: "M 327 262 L 327 330", label: "EXECUTE", icon: "Play", lx: 327, ly: 296, hot: 3 },
  ],
  rings: [
    { r: 150, stroke: "rgba(255,255,255,0.04)" },
    { r: 176, stroke: "rgba(33,150,243,0.06)", dash: true },
    { r: 202, stroke: "rgba(255,255,255,0.03)" },
  ],
};

// Mobile stack — same story, read top to bottom: Trigger → AI Agent →
// Memory / Tools → Action.
const MOBILE: Layout = {
  id: "m",
  w: 340,
  h: 432,
  cx: 170,
  cy: 155,
  nodes: {
    trigger: { x: 85, y: 6, w: 170, h: 54 },
    agent: { x: 75, y: 116, w: 190, h: 78 },
    memory: { x: 6, y: 248, w: 155, h: 54 },
    tools: { x: 179, y: 248, w: 155, h: 54 },
    action: { x: 85, y: 366, w: 170, h: 54 },
  },
  edges: [
    { d: "M 170 60 L 170 114", label: "TRIGGER", icon: "Zap", lx: 170, ly: 87, hot: 0 },
    { d: "M 83 248 C 83 224, 115 218, 115 196", label: "RETRIEVE", icon: "Search", lx: 99, ly: 221, hot: 2 },
    { d: "M 225 196 C 225 218, 257 224, 257 248", label: "USE TOOLS", icon: "Wrench", lx: 241, ly: 221, hot: 2 },
    { d: "M 83 302 C 83 338, 148 336, 148 364", hot: 3 },
    { d: "M 257 302 C 257 338, 192 336, 192 364", label: "EXECUTE", icon: "Play", lx: 170, ly: 340, hot: 3 },
  ],
  rings: [
    { r: 80, stroke: "rgba(255,255,255,0.04)" },
    { r: 100, stroke: "rgba(33,150,243,0.06)", dash: true },
    { r: 122, stroke: "rgba(255,255,255,0.03)" },
  ],
};

// Execution cycle — one stage at a time: trigger fires → agent thinks →
// memory/tools engage → action lands.
const PHASE_MS = [2200, 2400, 2600, 2400];
const ACTIVE_STAGES: Record<number, StageKey[]> = {
  0: ["trigger"],
  1: ["agent"],
  2: ["memory", "tools"],
  3: ["action"],
};

// Entrance choreography (seconds).
const EDGE_DELAY = 0.15;
const EDGE_STAGGER = 0.08;
const NODE_DELAY = 0.32;
const NODE_STAGGER = 0.09;
const PILL_DELAY = 0.95;
const PARTICLE_DELAY = 1.2;
const CYCLE_START = 1.7;

const EASE = [0.22, 1, 0.36, 1] as const;

function EdgePill({
  label,
  icon,
  x,
  y,
  hot,
  delay,
}: {
  label: string;
  icon?: string;
  x: number;
  y: number;
  hot: boolean;
  delay: number;
}) {
  const w = label.length * 5.3 + (icon ? 19 : 8); // text + optional 8px glyph + 3px gap + padding
  const fill = hot ? "var(--color-brand-2)" : "var(--color-fg-muted)";
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay }}>
      <rect
        x={x - w / 2}
        y={y - 8}
        width={w}
        height={16}
        rx={8}
        fill="var(--color-surface)"
        stroke={hot ? "rgba(33,150,243,0.55)" : "rgba(33,150,243,0.3)"}
        strokeWidth={1}
        style={{ transition: "stroke 0.4s ease" }}
      />
      {icon && (
        <Icon
          name={icon}
          x={x - w / 2 + 4}
          y={y - 4}
          width={8}
          height={8}
          style={{ color: fill, transition: "color 0.4s ease" }}
        />
      )}
      <text
        x={icon ? x - w / 2 + 15 : x}
        y={y + 2.6}
        textAnchor={icon ? "start" : "middle"}
        style={{
          fontSize: 8,
          fontWeight: 600,
          letterSpacing: "0.08em",
          fontFamily: "var(--font-mono)",
          fill,
          transition: "fill 0.4s ease",
        }}
      >
        {label}
      </text>
    </motion.g>
  );
}

function NodeCard({
  stage,
  def,
  active,
  delay,
  reduceMotion,
}: {
  stage: StageKey;
  def: StageDef;
  active: boolean;
  delay: number;
  reduceMotion: boolean;
}) {
  const big = !!def.center;
  const status =
    stage === "agent"
      ? { text: "Running", textClass: "text-running" }
      : stage === "trigger" || active
        ? { text: "Active", textClass: "text-success" }
        : { text: "Ready", textClass: "text-fg-subtle" };

  return (
    <motion.div
      className="h-full w-full"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.94 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      <div className="relative h-full w-full">
        {big && !reduceMotion && (
          <>
            {/* Breathing halo + pulse ring — the one accent on the canvas. */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute -inset-2.5 rounded-2xl"
              style={{ background: "radial-gradient(55% 55% at 50% 50%, rgba(33,150,243,0.2), transparent 72%)", filter: "blur(10px)" }}
              animate={{ opacity: [0.5, 0.85, 0.5] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.span
              aria-hidden
              className="pointer-events-none absolute -inset-1 rounded-[13px]"
              style={{ border: "1px solid rgba(33,150,243,0.35)" }}
              animate={{ opacity: [0.7, 0.15, 0.7] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}

        <div
          className={cn(
            "relative flex h-full w-full items-center rounded-xl transition-all duration-500 hover:-translate-y-px",
            big ? "gap-2.5 rounded-[13px] px-3.5" : "gap-2 px-2.5",
            big
              ? active
                ? "border border-brand/80 shadow-[0_20px_52px_-16px_rgba(33,150,243,0.65),0_0_30px_-6px_rgba(33,150,243,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]"
                : "border border-brand/60 shadow-[0_20px_48px_-18px_rgba(33,150,243,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]"
              : active
                ? "border border-brand/55 shadow-[0_14px_36px_-16px_rgba(33,150,243,0.45)]"
                : "border border-border hover:border-border-strong",
          )}
          style={big ? { background: "linear-gradient(180deg, var(--color-surface-2), var(--color-surface))" } : { background: "var(--color-surface)" }}
        >
          <span
            className={cn(
              "grid shrink-0 place-items-center rounded-lg transition-all duration-500",
              big ? "h-10 w-10 rounded-xl" : "h-[30px] w-[30px]",
            )}
            style={
              big || active
                ? { background: "rgba(33,150,243,0.14)", color: "var(--color-brand-2)", boxShadow: "inset 0 0 0 1px rgba(33,150,243,0.38)" }
                : { background: "rgba(33,150,243,0.08)", color: "var(--color-brand)", boxShadow: "inset 0 0 0 1px rgba(33,150,243,0.25)" }
            }
          >
            <Icon name={def.icon} className={big ? "h-[22px] w-[22px]" : "h-5 w-5"} />
          </span>

          <span className="min-w-0 flex-1">
            <span className={cn("block truncate font-semibold leading-tight text-fg", big ? "text-[14px]" : "text-[11.5px]")}>{def.title}</span>
            <span className={cn("mt-0.5 block truncate font-mono leading-tight text-fg-muted tracking-[-0.02em]", big ? "text-[10px]" : "text-[8.5px]")}>{def.sub}</span>
            {/* Status row — third line of the text column, vertically centered
                with the icon via the card's items-center. */}
            <span className={cn("mt-1 flex items-center gap-1.5 transition-colors duration-300", status.textClass)}>
              {big ? (
                <motion.span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-running"
                  animate={reduceMotion ? undefined : { opacity: [1, 0.35, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                    status.textClass === "text-success" ? "bg-success status-dot" : "bg-fg-subtle",
                  )}
                />
              )}
              <span className="text-[8px] font-semibold leading-none tracking-wide">{status.text}</span>
            </span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function WorkflowGraph({ layout, phase, reduceMotion }: { layout: Layout; phase: number; reduceMotion: boolean }) {
  const id = layout.id;
  const activeSet = ACTIVE_STAGES[phase] ?? [];

  return (
    <svg
      viewBox={`0 0 ${layout.w} ${layout.h}`}
      // Explicit intrinsic size: without it the SVG defaults to 300×150 and
      // the hero grid item shrink-wraps the graph instead of filling the column.
      width={layout.w}
      height={layout.h}
      className="h-auto w-full overflow-visible"
      role="img"
      aria-label="Example agent workflow: a Gmail trigger feeds an AI agent, which retrieves context from memory and calls MCP tools before executing a Slack action"
    >
      <defs>
        <radialGradient id={`wf-${id}-glow`}>
          <stop offset="0%" stopColor="rgba(33,150,243,0.13)" />
          <stop offset="55%" stopColor="rgba(33,150,243,0.05)" />
          <stop offset="100%" stopColor="rgba(33,150,243,0)" />
        </radialGradient>
        <radialGradient id={`wf-${id}-light`}>
          <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id={`wf-${id}-fade`} cx="50%" cy="48%" r="62%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <pattern id={`wf-${id}-dots`} width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="1.2" cy="1.2" r="0.9" fill="rgba(33,150,243,0.16)" />
        </pattern>
        <mask id={`wf-${id}-dotmask`}>
          <rect width={layout.w} height={layout.h} fill={`url(#wf-${id}-fade)`} />
        </mask>
        {layout.edges.map((e, i) => (
          <path key={`def-${i}`} id={`wf-${id}-e${i}`} d={e.d} fill="none" />
        ))}
      </defs>

      {/* Ambient field — glow, faint light, dotted grid, orbit rings. */}
      <circle cx={layout.cx} cy={layout.cy} r={Math.min(layout.w, layout.h) * 0.62} fill={`url(#wf-${id}-glow)`} />
      <ellipse cx={layout.w / 2} cy={layout.h * 0.1} rx={layout.w * 0.55} ry={layout.h * 0.28} fill={`url(#wf-${id}-light)`} />
      <rect width={layout.w} height={layout.h} fill={`url(#wf-${id}-dots)`} mask={`url(#wf-${id}-dotmask)`} opacity={0.55} />
      {layout.rings.map((ring, i) => (
        <circle
          key={`r${i}`}
          cx={layout.cx}
          cy={layout.cy}
          r={ring.r}
          fill="none"
          stroke={ring.stroke}
          strokeWidth={1}
          strokeDasharray={ring.dash ? "1 7" : undefined}
        />
      ))}

      {/* Connectors — the base stroke draws in; a flowing dash keeps the
          lines alive; SMIL pulses ride the paths. */}
      {layout.edges.map((e, i) => {
        const hot = e.hot === phase;
        return (
          <g key={`e${i}`}>
            <motion.path
              d={e.d}
              fill="none"
              stroke="var(--color-brand)"
              strokeWidth={hot ? 2.4 : 2}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: hot ? 0.95 : 0.5 }}
              transition={{
                pathLength: { duration: 0.65, delay: EDGE_DELAY + i * EDGE_STAGGER, ease: "easeOut" },
                opacity: { duration: 0.45 },
              }}
              style={{ transition: "stroke-width 0.45s ease" }}
            />
            <path
              d={e.d}
              fill="none"
              stroke="var(--color-brand-2)"
              strokeWidth={1.3}
              className="wf-edge"
              style={{ opacity: hot ? 0.55 : 0.28, transition: "opacity 0.5s ease" }}
            />
            {/* Execution pulse — mounts when its edge's phase starts, so the
                dot always departs from the source node. */}
            {hot && !reduceMotion && (
              <circle key={`hp${i}`} r={3.4} fill="var(--color-brand)" style={{ filter: "drop-shadow(0 0 6px rgba(33,150,243,0.9))" }} opacity={0}>
                <animateMotion dur="1.05s" repeatCount="indefinite">
                  <mpath href={`#wf-${id}-e${i}`} />
                </animateMotion>
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.8;1" dur="1.05s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Ambient particle — slow, one per connector. */}
            {!reduceMotion && (
              <circle key={`p${i}`} r={2.1} fill="var(--color-brand-2)" style={{ filter: "drop-shadow(0 0 4px rgba(66,165,245,0.55))" }} opacity={0}>
                <animateMotion dur={`${2.6 + (i % 3) * 0.5}s`} begin={`${PARTICLE_DELAY + i * 0.55}s`} repeatCount="indefinite">
                  <mpath href={`#wf-${id}-e${i}`} />
                </animateMotion>
                <animate
                  attributeName="opacity"
                  values="0;0.9;0.9;0"
                  keyTimes="0;0.12;0.85;1"
                  dur={`${2.6 + (i % 3) * 0.5}s`}
                  begin={`${PARTICLE_DELAY + i * 0.55}s`}
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </g>
        );
      })}

      {/* Connector labels. */}
      {layout.edges.map((e, i) =>
        e.label && e.lx !== undefined && e.ly !== undefined ? (
          <EdgePill key={`l${i}`} label={e.label} icon={e.icon} x={e.lx} y={e.ly} hot={e.hot === phase} delay={PILL_DELAY + i * 0.05} />
        ) : null,
      )}

      {/* Nodes. */}
      {(Object.keys(layout.nodes) as StageKey[]).map((stage, i) => {
        const box = layout.nodes[stage];
        return (
          <foreignObject key={stage} x={box.x} y={box.y} width={box.w} height={box.h} overflow="visible">
            <NodeCard
              stage={stage}
              def={STAGES[stage]}
              active={activeSet.includes(stage)}
              delay={NODE_DELAY + i * NODE_STAGGER}
              reduceMotion={reduceMotion}
            />
          </foreignObject>
        );
      })}
    </svg>
  );
}

export function HeroWorkflow() {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState(-1);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  // Subtle tilt — a hint of depth, not a gimmick.
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [3, -3]), {
    stiffness: 120,
    damping: 18,
  });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-3, 3]), {
    stiffness: 120,
    damping: 18,
  });

  // Execution cycle — loops forever, one stage at a time.
  useEffect(() => {
    if (reduceMotion) return;
    let step = 0;
    let timer: number | undefined;
    const advance = () => {
      setPhase(step % 4);
      timer = window.setTimeout(advance, PHASE_MS[step % 4]);
      step += 1;
    };
    timer = window.setTimeout(advance, CYCLE_START);
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    mx.set(0);
    my.set(0);
  }

  const innerStyle: MotionStyle = { rotateX: rx, rotateY: ry, transformPerspective: 1000 };

  return (
    <div
      className="relative mx-auto w-full max-w-[600px] select-none xl:w-[632px] xl:max-w-none"
      onMouseMove={reduceMotion ? undefined : onMove}
      onMouseLeave={onLeave}
      style={{ perspective: 1000 }}
    >
      <motion.div
        style={innerStyle}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
      >
        {/* Full graph from md up, vertical stack below — no overflow either way. */}
        <div className="hidden md:block">
          <WorkflowGraph layout={DESKTOP} phase={reduceMotion ? -1 : phase} reduceMotion={!!reduceMotion} />
        </div>
        <div className="mx-auto w-full max-w-[356px] md:hidden">
          <WorkflowGraph layout={MOBILE} phase={reduceMotion ? -1 : phase} reduceMotion={!!reduceMotion} />
        </div>
      </motion.div>
    </div>
  );
}