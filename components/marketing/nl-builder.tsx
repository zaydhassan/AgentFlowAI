"use client";

// Landing-page "Natural-language builder" section — recomposed as a
// describe → reason → construct → run product demonstration:
//   left:  prompt panel (existing product copy)
//   right: Planner Agent reasoning panel (sequenced, in-view only)
//   below: generated 7-node workflow preview + example prompts + feature strip
//
// Pure marketing demo: no API calls, no fabricated claims. All node cards
// resolve to real NODE_LIBRARY definitions. Animations are gated on
// useReducedMotion and only run when the section is in view.

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { FlowChain } from "@/components/marketing/flow-chain";
import { NODE_LIBRARY } from "@/lib/nodes";

// ── Planner reasoning steps (existing homepage product copy) ────────────────
const PLANNER_STEPS = [
  { label: "Parse user intent", time: "0.4s" },
  { label: "Decompose into 6 tasks", time: "0.8s" },
  { label: "Map tasks to nodes", time: "1.1s" },
  { label: "Validate connections", time: "1.6s" },
  { label: "Estimate cost · $4.20 · ~3m", time: "0.9s" },
];
const STEP_STAGGER = 0.9; // seconds between steps coming up
const PLANNER_TOTAL_MS = (PLANNER_STEPS.length * STEP_STAGGER + 0.8) * 1000;

// ── Generated workflow → real node definitions ──────────────────────────────
const GENERATED_TYPES = [
  "trigger.schedule",
  "gmail.trigger.newEmail",
  "ai.claude",
  "store.postgres",
  "cloud.s3",
  "comm.slack",
  "doc.pdf",
];
const GENERATED_SUB = ["Trigger", "New Email", "AI", "Save Data", "Upload File", "Notify", "Monthly Report"];

const generatedWorkflow = GENERATED_TYPES.map((type, i) => {
  const def = NODE_LIBRARY.find((n) => n.type === type);
  if (!def) throw new Error(`node def missing: ${type}`);
  return { type, label: def.label, icon: def.icon, color: def.color, sub: GENERATED_SUB[i] };
});

// ── Example prompt chips (this section's demo copy) ─────────────────────────
const EXAMPLE_PROMPTS = [
  "Lead qualification agent",
  "Customer support bot",
  "Daily analytics pipeline",
  "File summarizer",
];

// ── Bottom feature strip (existing product capabilities: planner, copilot,
//    self-heal/retries, cost estimates already ship in the product) ──────────
const FEATURES = [
  { icon: "Sparkles", title: "Planner + Copilot", copy: "AI reasons over your request and picks the optimal path." },
  { icon: "ShieldCheck", title: "Validated connections", copy: "Every edge is tested for reliability, latency, and timeout." },
  { icon: "Coins", title: "Cost aware", copy: "Smart estimates help optimize before execution." },
  { icon: "Activity", title: "Production ready", copy: "Logging, retries, alerts, and observability built in." },
];

export function NaturalLanguageBuilder() {
  const reduceMotion = useReducedMotion();
  const [runId, setRunId] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [planning, setPlanning] = useState(false);

  // The send button replays the reasoning demo; "planning" lights it up while
  // the sequence runs, then resets. No requests are made.
  const planningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function replay(nextPrompt?: string) {
    if (nextPrompt !== undefined) setPrompt(nextPrompt);
    setRunId((r) => r + 1);
    setPlanning(true);
    if (planningTimer.current) clearTimeout(planningTimer.current);
    planningTimer.current = setTimeout(() => setPlanning(false), PLANNER_TOTAL_MS);
  }

  return (
    <div className="relative">
      {/* Restrained radial ambient — thin, not blobby. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
        style={{ background: "radial-gradient(55% 60% at 30% 0%, rgba(124,92,255,0.12), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-16"
        >
          {/* ── LEFT — headline + prompt panel ─────────────────────── */}
          <div>
            <Badge tone="ai" className="mb-4">Natural-language builder</Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Describe it.
              <br />
              <span className="text-brand-gradient">Ship it.</span>
            </h2>
            <p className="mt-5 max-w-lg text-fg-muted">
              Type what you want in plain English. The planner agent decomposes your request, picks
              the right nodes, connects them with validated edges, and hands you a working workflow
              — with a copilot ready to optimize cost, latency, and reliability.
            </p>

            {/* Prompt panel */}
            <div className="glass mt-8 rounded-2xl border border-border p-5">
              <div className="flex items-center gap-2 text-xs text-fg-subtle">
                <Icon name="User" className="h-3.5 w-3.5" /> you
              </div>
              <p className="mt-2 text-sm leading-relaxed">
                &ldquo;When an invoice arrives in Gmail: extract the data, save to Postgres, upload
                to S3, notify Slack, and generate a monthly report.&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs text-ai">
                <Icon name="Sparkles" className="h-3.5 w-3.5" /> AgentFlow
              </div>
              <p className="mt-2 text-sm text-fg-muted">
                Built a 7-node workflow with a Schedule trigger, Claude extraction, OCR backup, and
                a monthly report branch. Ready to run? <span className="text-brand">Yes</span>
              </p>

              {/* Prompt input + glowing send */}
              <form
                className="mt-4 flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  replay();
                }}
              >
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe any workflow…"
                  aria-label="Describe a workflow (demo replay)"
                  className="h-10 w-full min-w-0 rounded-xl border border-border bg-surface-2/60 px-3.5 text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand/50"
                />
                <button
                  type="submit"
                  aria-label="Generate workflow (demo replay)"
                  className="grid h-10 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-brand/40 bg-brand-soft text-brand shadow-[0_0_18px_-4px_rgba(124,92,255,0.6)] transition-all duration-200 hover:border-brand hover:text-ai hover:shadow-[0_0_24px_-2px_rgba(124,92,255,0.8)] focus-ring"
                >
                  <Icon
                    name={planning ? "LoaderCircle" : "SendHorizontal"}
                    className={`h-4 w-4 ${planning ? "animate-spin" : ""}`}
                  />
                </button>
              </form>
              <p className="mt-3 text-[10px] text-fg-subtle">
                Product demo — the planner reasoning below replays while it &ldquo;builds&rdquo;.
              </p>
            </div>
          </div>

          {/* ── RIGHT — Planner Agent reasoning panel ───────────────── */}
          <PlannerPanel key={runId} reduceMotion={Boolean(reduceMotion)} />
        </motion.div>

        {/* ── Example prompt chips ──────────────────────────────────── */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-2.5">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-widest text-fg-subtle">Try</span>
          {EXAMPLE_PROMPTS.map((p, i) => (
            <motion.button
              key={p}
              initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: 0.35 + i * 0.07 }}
              onClick={() => replay(p)}
              className="cursor-pointer rounded-full border border-border bg-surface-2/50 px-3.5 py-2 text-xs text-fg-muted transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand-soft/40 hover:text-fg hover:shadow-[0_4px_20px_-6px_rgba(124,92,255,0.5)] focus-ring"
            >
              {p}
            </motion.button>
          ))}
        </div>

        {/* ── Generated workflow preview ────────────────────────────── */}
        <WorkflowPreview />

        {/* ── Bottom feature strip ──────────────────────────────────── */}
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="mt-16 grid grid-cols-1 gap-6 rounded-2xl border border-border bg-surface/40 p-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:p-0 lg:divide-x lg:divide-border"
        >
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-3.5 lg:px-7 lg:py-6">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-surface-2">
                <Icon name={f.icon} className="h-4 w-4 text-brand" />
              </span>
              <div>
                <div className="text-sm font-semibold">{f.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-fg-muted">{f.copy}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

/* ── Planner Agent panel ───────────────────────────────────────────────── */

// Remounted (key={runId}) to replay the reasoning sequence.
function PlannerPanel({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="glass-strong relative rounded-2xl border border-border p-6"
    >
      <div className="mb-6 flex items-center justify-between text-xs text-fg-subtle">
        <span className="font-medium">Planner Agent</span>
        <span className="flex items-center gap-1.5 text-success">
          <span className="dot dot-live bg-success" /> reasoning
        </span>
      </div>

      <div className="space-y-3.5">
        {PLANNER_STEPS.map((s, i) => (
          <StepRow key={s.label} label={s.label} time={s.time} delay={i * STEP_STAGGER} reduceMotion={reduceMotion} />
        ))}
      </div>

      {/* Progress bar — fills across the reasoning sequence. */}
      <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <motion.div
          className="progress-anim h-full rounded-full"
          initial={{ width: reduceMotion ? "100%" : "0%" }}
          whileInView={{ width: "100%" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: reduceMotion ? 0.2 : PLANNER_TOTAL_MS / 1000, ease: "linear" }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-fg-subtle">
        <span>planning · validating · estimating</span>
        <span>ready to run</span>
      </div>
    </motion.div>
  );
}

function StepRow({
  label,
  time,
  delay,
  reduceMotion,
}: {
  label: string;
  time: string;
  delay: number;
  reduceMotion: boolean;
}) {
  const inView = { once: true, margin: "-60px" } as const;
  return (
    <motion.div
      className="relative flex items-center gap-3"
      initial={reduceMotion ? undefined : { opacity: 0.35, y: 4 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={inView}
      transition={{ duration: 0.4, delay }}
    >
      {/* Soft glow that flares while this step is the "active" one. */}
      <motion.span
        aria-hidden
        className="absolute -left-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(124,92,255,0.4), transparent 65%)" }}
        initial={reduceMotion ? { opacity: 0 } : { opacity: [0, 1, 1, 0] }}
        whileInView={{ opacity: 0 }}
        viewport={inView}
        transition={reduceMotion ? { duration: 0.1, delay } : { duration: 1.2, delay, times: [0, 0.3, 0.7, 1] }}
      />
      <span className="relative grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft">
        {/* spinner → check crossfade */}
        <motion.span
          className="absolute grid h-6 w-6 place-items-center rounded-full"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.35, delay }}
        >
          <Icon name="LoaderCircle" className="h-3.5 w-3.5 animate-spin text-brand" />
        </motion.span>
        <motion.span
          className="grid h-6 w-6 place-items-center rounded-full bg-success/15"
          initial={{ opacity: reduceMotion ? 1 : 0, scale: reduceMotion ? 1 : 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 22, delay: reduceMotion ? 0 : delay + 0.4 }}
        >
          <Icon name="Check" className="h-3 w-3 text-success" />
        </motion.span>
      </span>
      <span className="text-sm">{label}</span>
      <span className="ml-auto text-[10px] text-fg-subtle">{time}</span>
    </motion.div>
  );
}

/* ── Generated workflow preview ────────────────────────────────────────── */

function WorkflowPreview() {
  return (
    <div className="mt-16">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-fg-subtle">
          What AgentFlow constructs
        </h3>
        <span className="hidden text-[11px] text-fg-subtle sm:block">
          7 nodes from one prompt
        </span>
      </div>
      <FlowChain nodes={generatedWorkflow} />
    </div>
  );
}
