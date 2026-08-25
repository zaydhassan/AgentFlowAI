import "server-only";
import type {
  AgentEvent,
  AgentId,
  AgentTimelineEntry,
  ExecutionGraphSnapshot,
  RunTrace,
  TraceEvent,
  TraceKind,
} from "./types";

export interface TraceSink {
  (event: AgentEvent): void;
}

export class TraceCollector {
  readonly runId: string;
  readonly objective: string;
  readonly startedAt: number;
  private readonly events: TraceEvent[] = [];
  private readonly timeline = new Map<string, AgentTimelineEntry>();
  private readonly sink?: TraceSink;
  private readonly graph: ExecutionGraphSnapshot;
  private status: RunTrace["status"] = "running";
  private totalTokens = 0;
  private totalCost = 0;
  private retries = 0;
  private failures = 0;
  private iterations = 0;
  private finalAnswer?: string;
  private error?: string;

  constructor(opts: {
    runId: string;
    objective: string;
    startedAt: number;
    graph: ExecutionGraphSnapshot;
    sink?: TraceSink;
  }) {
    this.runId = opts.runId;
    this.objective = opts.objective;
    this.startedAt = opts.startedAt;
    this.graph = opts.graph;
    this.sink = opts.sink;
  }

  /** ms since run start — public so the runtime can stamp terminal events. */
  at(): number {
    return Date.now() - this.startedAt;
  }

  /** Rebind the stream sink (used by the runtime when resuming a run). */
  setSink(sink: TraceSink): void {
    (this as unknown as { sink?: TraceSink }).sink = sink;
  }

  private timelineKey(agent: AgentId, subtaskId?: string): string {
    return subtaskId ? `${agent}:${subtaskId}` : agent;
  }

  ensureTimeline(agent: AgentId, subtaskId?: string): AgentTimelineEntry {
    const key = this.timelineKey(agent, subtaskId);
    let entry = this.timeline.get(key);
    if (!entry) {
      entry = {
        agent,
        subtaskId,
        startedAt: this.at(),
        durationMs: 0,
        tokensUsed: 0,
        cost: 0,
        retries: 0,
        status: "running",
      };
      this.timeline.set(key, entry);
    }
    return entry;
  }

  /** Record a trace event + emit a matching stream event to the sink. */
  trace(agent: AgentId, kind: TraceKind, detail: string, extra?: Partial<TraceEvent>): void {
    const ev: TraceEvent = {
      at: this.at(),
      agent,
      kind,
      detail,
      ...extra,
    };
    this.events.push(ev);

    if (kind === "agent:retry") this.retries++;
    if (kind === "agent:fail") this.failures++;
    if (extra?.tokensUsed) this.totalTokens += extra.tokensUsed;
    if (kind === "plan") this.iterations++;
    if (kind === "agent:success" && extra?.durationMs != null) {
      const t = this.ensureTimeline(agent, extra.subtaskId);
      t.durationMs = extra.durationMs;
      t.tokensUsed = extra.tokensUsed ?? t.tokensUsed;
      t.status = "succeeded";
    }
    if (kind === "agent:fail") {
      const t = this.ensureTimeline(agent, extra?.subtaskId);
      t.status = "failed";
      if (extra?.error) t.error = extra.error;
    }
    if (kind === "agent:retry") {
      const t = this.ensureTimeline(agent, extra?.subtaskId);
      t.retries++;
      t.status = "running";
    }

    if (this.sink) this.sink(this.toStreamEvent(ev));
  }

  private toStreamEvent(ev: TraceEvent): AgentEvent {
    const base: AgentEvent = {
      type: this.kindToEventType(ev.kind),
      at: ev.at,
      runId: this.runId,
      agent: ev.agent,
      subtaskId: ev.subtaskId,
    };
    switch (ev.kind) {
      case "agent:log":
        return { ...base, log: ev.detail };
      case "agent:reasoning":
        return { ...base, reasoning: ev.detail };
      case "agent:memory":
        return { ...base, log: ev.detail };
      case "agent:retry":
        return { ...base, attempt: ev.attempt, log: ev.detail };
      case "agent:success":
        return { ...base, durationMs: ev.durationMs, tokensUsed: ev.tokensUsed };
      case "agent:fail":
        return { ...base, error: ev.error, attempt: ev.attempt };
      case "plan":
        return { ...base, plan: safeParsePlan(ev.detail) };
      case "review":
        return { ...base, review: safeParseReview(ev.detail) };
      default:
        return { ...base, log: ev.detail };
    }
  }

  private kindToEventType(kind: TraceKind): AgentEvent["type"] {
    switch (kind) {
      case "agent:start":
        return "agent:start";
      case "agent:log":
        return "agent:log";
      case "agent:reasoning":
        return "agent:reasoning";
      case "agent:memory":
        return "agent:memory";
      case "agent:retry":
        return "agent:retry";
      case "agent:success":
        return "agent:success";
      case "agent:fail":
        return "agent:fail";
      case "plan":
        return "plan";
      case "review":
        return "review";
      case "approval":
        return "approval";
      default:
        return "agent:log";
    }
  }

  setStatus(s: RunTrace["status"]): void {
    this.status = s;
  }
  setFinalAnswer(a: string): void {
    this.finalAnswer = a;
  }
  setError(e: string): void {
    this.error = e;
  }
  addTokens(n: number): void {
    this.totalTokens += n;
  }

  getTokens(): number {
    return this.totalTokens;
  }
  getCost(): number {
    return this.totalCost;
  }

  snapshot(): RunTrace {
    return {
      runId: this.runId,
      objective: this.objective,
      status: this.status,
      startedAt: this.startedAt,
      durationMs: this.at(),
      iterations: this.iterations,
      totalTokens: this.totalTokens,
      totalCost: this.totalCost,
      retries: this.retries,
      failures: this.failures,
      timeline: Array.from(this.timeline.values()),
      reasoningPath: this.events
        .filter((e) => e.kind === "agent:reasoning")
        .map((e) => ({ agent: e.agent, step: e.detail, at: e.at })),
      graph: this.graph,
      events: this.events,
      ...(this.finalAnswer != null ? { finalAnswer: this.finalAnswer } : {}),
      ...(this.error != null ? { error: this.error } : {}),
    };
  }

  /** Emit a non-trace stream event (run:start / approval-requested / complete / error). */
  emit(event: AgentEvent): void {
    if (this.sink) this.sink({ ...event, runId: this.runId });
  }
}

// The planner/reviewer store their structured output in state as real objects,
// but trace events are strings; these parse them back for the stream's
// plan/review fields. They tolerate plain JSON or a JSON blob inside text.

function safeParsePlan(detail: string): import("./types").ExecutionPlan | undefined {
  try {
    const json = extractFirstJson(detail);
    if (json && Array.isArray(json.subtasks)) return json as unknown as import("./types").ExecutionPlan;
  } catch {
    /* ignore */
  }
  return undefined;
}

function safeParseReview(detail: string): import("./types").ReviewOutcome | undefined {
  try {
    const json = extractFirstJson(detail);
    if (json && typeof json.approved === "boolean") {
      return {
        approved: json.approved,
        confidence: Number(json.confidence ?? 0.5),
        corrections: Array.isArray(json.corrections) ? json.corrections : [],
      };
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function extractFirstJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}