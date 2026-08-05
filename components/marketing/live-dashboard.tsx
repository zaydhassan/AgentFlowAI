"use client";

// Live product preview — a large mock dashboard that looks like the real
// product. Metrics count up, the chart animates, logs stream in, running
// agents pulse. Mounted lazily (ssr:false) from the page so it never bloats
// the initial bundle or blocks first paint.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Icon } from "@/components/ui/icon";

const METRICS = [
  { label: "Executions today", target: 184327, suffix: "+", icon: "Activity", color: "#7c5cff" },
  { label: "Success rate", target: 98.2, suffix: "%", decimals: 1, icon: "CheckCircle2", color: "#34d399" },
  { label: "Active agents", target: 42, suffix: "", icon: "Bot", color: "#22d3ee" },
  { label: "Avg latency", target: 38, suffix: "ms", icon: "Zap", color: "#5b8bff" },
];

const THROUGHPUT = [
  { t: "00", v: 120 }, { t: "02", v: 180 }, { t: "04", v: 150 }, { t: "06", v: 240 },
  { t: "08", v: 310 }, { t: "10", v: 280 }, { t: "12", v: 360 }, { t: "14", v: 420 },
  { t: "16", v: 390 }, { t: "18", v: 470 }, { t: "20", v: 520 }, { t: "22", v: 480 },
];

const LOG_POOL = [
  { lvl: "info", msg: "Gmail trigger fired · message received" },
  { lvl: "ai", msg: "AI Agent extracted 4 fields (confidence 0.97)" },
  { lvl: "ok", msg: "Memory upsert · vector store updated" },
  { lvl: "tool", msg: "MCP tool call · reconcile_invoice(…)" },
  { lvl: "ok", msg: "Database row inserted · id=inv_8821" },
  { lvl: "info", msg: "Slack notification · #finance notified" },
  { lvl: "warn", msg: "Rate limit approaching · backing off 1.2s" },
  { lvl: "ok", msg: "Workflow completed · 6/6 nodes in 3.1s" },
  { lvl: "ai", msg: "Copilot suggested cheaper route · -$0.04/run" },
];

const LEVEL_STYLES: Record<string, string> = {
  info: "text-info",
  ai: "text-ai",
  ok: "text-success",
  tool: "text-brand-2",
  warn: "text-warning",
};

const AGENTS = [
  { name: "Invoice Processor", status: "running", progress: 72 },
  { name: "Doc Classifier", status: "queued", progress: 0 },
  { name: "Slack Responder", status: "running", progress: 54 },
  { name: "Memory Curator", status: "running", progress: 91 },
];

export function LiveDashboard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  // Precompute the custom area-chart geometry. Deterministic + no per-point
  // DOM keys means no React key collisions (and no recharts dependency here).
  const { areaPath, linePath, dots } = useMemo(() => {
    const n = THROUGHPUT.length;
    const max = Math.max(...THROUGHPUT.map((d) => d.v));
    const pts = THROUGHPUT.map((d, i) => ({
      x: (i / (n - 1)) * 100,
      y: 100 - (d.v / max) * 92 - 4,
    }));
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
    const area = `${line} L 100 100 L 0 100 Z`;
    return { areaPath: area, linePath: line, dots: pts };
  }, []);

  const [logs, setLogs] = useState<{ id: number; lvl: string; msg: string }[]>(
    LOG_POOL.slice(0, 3).map((l, i) => ({ id: i, ...l }))
  );
  const logId = useRef(3);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!inView) return;
    // Guard against a second interval starting before the first is cleared
    // (React Strict Mode double-invokes effects in dev; this keeps exactly one).
    if (startedRef.current) return;
    startedRef.current = true;
    const timer = setInterval(() => {
      // Generate the id atomically inside the updater so it can never collide.
      setLogs((prev) => {
        const id = logId.current;
        logId.current += 1;
        return [...prev.slice(-6), { id, ...LOG_POOL[id % LOG_POOL.length] }];
      });
    }, 1500);
    return () => {
      clearInterval(timer);
      startedRef.current = false;
    };
  }, [inView]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="surface-premium relative overflow-hidden rounded-2xl shadow-[0_40px_120px_-40px_rgba(0,0,0,0.7)]"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-danger/70" />
        <span className="h-3 w-3 rounded-full bg-warning/70" />
        <span className="h-3 w-3 rounded-full bg-success/70" />
        <span className="ml-3 text-xs text-fg-subtle">agentflow · production</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-success">
          <span className="status-dot inline-block h-1.5 w-1.5 rounded-full bg-success" /> live
        </span>
      </div>

      <div className="grid grid-cols-1 gap-px bg-border lg:grid-cols-3">
        {/* Left / main column */}
        <div className="space-y-px lg:col-span-2">
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            {METRICS.map((m) => (
              <div key={m.label} className="bg-surface p-4">
                <div className="flex items-center gap-2 text-fg-subtle">
                  <span
                    className="grid h-6 w-6 place-items-center rounded-md"
                    style={{ background: `${m.color}1a`, color: m.color }}
                  >
                    <Icon name={m.icon} className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
                  <AnimatedCounter
                    value={inView ? m.target : 0}
                    duration={1400}
                    suffix={m.suffix}
                    format={
                      m.decimals
                        ? (n) => n.toFixed(m.decimals!)
                        : (n) => Math.round(n).toLocaleString("en-US")
                    }
                  />
                </div>
                <div className="mt-1 text-[11px] text-fg-subtle">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Throughput chart — custom SVG (no per-point keys, no recharts). */}
          <div className="bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-fg-muted">Throughput · last 24h</span>
              <span className="text-[11px] text-success">▲ 12.4%</span>
            </div>
            <div className="mt-3 h-[150px]">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="lp-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <motion.path
                  d={areaPath}
                  fill="url(#lp-area)"
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : {}}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
                <motion.path
                  d={linePath}
                  fill="none"
                  stroke="#7c5cff"
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  initial={{ pathLength: 0 }}
                  animate={inView ? { pathLength: 1 } : {}}
                  transition={{ duration: 1.4, ease: "easeInOut" }}
                />
                {dots.map((p, i) => (
                  <circle
                    key={`pt-${THROUGHPUT[i].t}`}
                    cx={p.x}
                    cy={p.y}
                    r={0.7}
                    fill="#22d3ee"
                  />
                ))}
              </svg>
              <div className="mt-1 flex justify-between text-[9px] text-fg-subtle">
                {["00", "06", "12", "18", "22"].map((t) => (
                  <span key={`tick-${t}`}>{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Execution logs (streaming) */}
          <div className="bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-fg-muted">Execution logs</span>
              <span className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
                <span className="status-dot inline-block h-1.5 w-1.5 rounded-full bg-ai" /> streaming
              </span>
            </div>
            <div className="mt-3 h-[132px] space-y-1.5 overflow-hidden font-mono text-[11px]">
              {logs.map((l) => (
                <div key={`log-${l.id}`} className="log-line flex items-start gap-2">
                  <span className="text-fg-subtle">›</span>
                  <span className={LEVEL_STYLES[l.lvl]}>{l.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-px">
          {/* Running agents */}
          <div className="bg-surface p-4">
            <span className="text-xs font-medium text-fg-muted">Running agents</span>
            <div className="mt-3 space-y-3">
              {AGENTS.map((a) => (
                <div key={a.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-fg">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          a.status === "running" ? "bg-success status-dot" : "bg-warning"
                        }`}
                      />
                      {a.name}
                    </span>
                    <span className="text-fg-subtle">{a.status === "running" ? `${a.progress}%` : "queued"}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    {a.status === "running" && (
                      <motion.div
                        className="progress-anim h-full rounded-full"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${a.progress}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notification */}
          <div className="bg-surface p-4">
            <span className="text-xs font-medium text-fg-muted">Notifications</span>
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-border bg-surface-2/60 p-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand-soft text-brand">
                <Icon name="Bell" className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium">Workflow self-healed</span>
                <span className="block text-[11px] text-fg-subtle">Invoice flow retried a stale token and recovered in 1.4s.</span>
              </span>
            </div>
          </div>

          {/* Memory usage */}
          <div className="bg-surface p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-fg-muted">Memory usage</span>
              <span className="text-fg-subtle tabular-nums">6.8 / 10 GB</span>
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-surface-3">
              <motion.div
                className="progress-anim h-full rounded-full"
                initial={{ width: 0 }}
                whileInView={{ width: "68%" }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { k: "Vectors", v: "2.4M" },
                { k: "Collections", v: "38" },
                { k: "Hits", v: "94%" },
              ].map((s) => (
                <div key={s.k} className="rounded-lg border border-border bg-surface-2/50 p-2">
                  <div className="text-sm font-semibold tabular-nums">{s.v}</div>
                  <div className="text-[10px] text-fg-subtle">{s.k}</div>
                </div>
              ))}
            </div>
          </div>

          {/* AI response */}
          <div className="bg-surface p-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-ai/10 text-ai">
                <Icon name="Sparkles" className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium text-fg">AI Copilot</span>
            </div>
            <p className="mt-2.5 text-[12px] leading-relaxed text-fg-muted">
              “I rerouted the extraction step to a faster model and added a retry guard. Estimated
              <span className="text-success"> −18% cost</span> and
              <span className="text-success"> −240ms latency</span> per run.”
              <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-ai/70" />
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}