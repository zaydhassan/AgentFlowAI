"use client";

import { useMemo } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionStyle,
} from "framer-motion";
import { Icon } from "@/components/ui/icon";

type Node = {
  icon: string;
  label: string;
  sub: string;
  color: string;
  running?: boolean;
};

const NODES: Node[] = [
  { icon: "Mail", label: "Gmail Trigger", sub: "new.message", color: "#f43f5e" },
  { icon: "Sparkles", label: "AI Agent", sub: "claude · reasoning", color: "#7c5cff", running: true },
  { icon: "Brain", label: "Memory", sub: "vector store", color: "#22d3ee" },
  { icon: "Wrench", label: "MCP Tool", sub: "tool.call", color: "#5b8bff" },
  { icon: "MessageSquare", label: "Slack", sub: "post #ops", color: "#a855f7" },
  { icon: "Database", label: "Database", sub: "upsert row", color: "#34d399" },
];

const VB_W = 420;
const VB_H = 600;
const NW = 168;
const NH = 58;
const positions = [
  { x: 16, y: 24 },
  { x: 236, y: 110 },
  { x: 16, y: 196 },
  { x: 236, y: 282 },
  { x: 16, y: 368 },
  { x: 236, y: 454 },
];
const centers = positions.map((p) => ({ x: p.x + NW / 2, y: p.y + NH / 2 }));

function edgePath(i: number): string {
  const a = centers[i];
  const b = centers[i + 1];
  const c1x = a.x + 80;
  const c2x = b.x - 80;
  return `M ${a.x} ${a.y} C ${c1x} ${a.y}, ${c2x} ${b.y}, ${b.x} ${b.y}`;
}

export function HeroWorkflow() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), {
    stiffness: 120,
    damping: 18,
  });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-6, 6]), {
    stiffness: 120,
    damping: 18,
  });

  const edges = useMemo(() => NODES.slice(0, -1).map((_, i) => edgePath(i)), []);

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
      className="relative w-full max-w-[440px] mx-auto select-none"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ perspective: 1000 }}
    >
      <motion.div style={innerStyle} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-auto overflow-visible" role="img" aria-label="Example autonomous AI agent workflow">
          <defs>
            <linearGradient id="wf-stroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7c5cff" />
              <stop offset="50%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#5b8bff" />
            </linearGradient>
            {edges.map((d, i) => (
              <path key={`p${i}`} id={`wf-edge-${i}`} d={d} fill="none" />
            ))}
          </defs>

          {/* Faint base connectors */}
          {edges.map((d, i) => (
            <path key={`b${i}`} d={d} fill="none" stroke="var(--color-border)" strokeWidth={1.5} />
          ))}

          {/* Animated gradient connectors */}
          {edges.map((d, i) => (
            <path
              key={`f${i}`}
              d={d}
              fill="none"
              stroke="url(#wf-stroke)"
              strokeWidth={2}
              className="wf-edge"
              style={{ opacity: 0.9 }}
            />
          ))}

          {/* Traveling pulses along each connector (SMIL, no JS). */}
          {edges.map((_, i) => (
            <circle key={`m${i}`} r={3.2} fill="#22d3ee" style={{ filter: "drop-shadow(0 0 4px rgba(34,211,238,0.9))" }}>
              <animateMotion dur={`${1.6 + i * 0.15}s`} repeatCount="indefinite" rotate="auto">
                <mpath href={`#wf-edge-${i}`} />
              </animateMotion>
            </circle>
          ))}

          {/* Nodes */}
          {NODES.map((n, i) => {
            const p = positions[i];
            return (
              <foreignObject key={n.label} x={p.x} y={p.y} width={NW} height={NH}>
                <motion.div
                  className="h-full w-full"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 4 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
                >
                  <div className="relative h-full w-full">
                    {/* Glow halo */}
                    <motion.span
                      className="pointer-events-none absolute -inset-2 rounded-2xl"
                      style={{ background: `radial-gradient(circle at center, ${n.color}55, transparent 70%)`, filter: "blur(8px)" }}
                      animate={{ opacity: n.running ? [0.55, 0.9, 0.55] : [0.25, 0.5, 0.25] }}
                      transition={{ duration: n.running ? 1.8 : 3.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    {/* Card */}
                    <div className="node-glow relative flex h-full w-full items-center gap-2.5 rounded-xl border border-border bg-surface-2/90 px-3 backdrop-blur-sm">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                        style={{ background: `${n.color}1f`, color: n.color, boxShadow: `inset 0 0 0 1px ${n.color}40` }}
                      >
                        <Icon name={n.icon} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-semibold leading-tight text-fg">{n.label}</span>
                        <span className="block truncate text-[10px] leading-tight text-fg-subtle">{n.sub}</span>
                      </span>
                      {n.running && (
                        <span className="ml-auto flex items-center gap-1 text-[9px] font-medium text-success">
                          <span className="status-dot inline-block h-1.5 w-1.5 rounded-full bg-success" />
                          run
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              </foreignObject>
            );
          })}
        </svg>
      </motion.div>
    </div>
  );
}