import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { normalizeGraph } from "@/lib/workflow/graph";
import {
  runWorkflow,
  registerRun,
  resumeRun,
  stepRun,
  pauseRun,
  stopRun,
  unregisterRun,
  type ExecutionEvent,
  type EngineGraph,
} from "@/lib/execution/engine";
import { SSE_HEADERS } from "@/lib/execution/sse";
import { executionBus } from "@/lib/execution/event-bus";
import { resolveOrgId } from "@/lib/memory";
import { notify, type NotificationEventKey } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

interface StepAccum {
  nodeId: string;
  nodeName: string;
  status: "running" | "succeeded" | "failed" | "retrying" | "skipped";
  startedAt: number;
  durationMs: number;
  tokensUsed: number;
  cost: number;
  retries: number;
  logs: string[];
  reasoning: string[];
  error?: string;
  // ── Debugger inspection payload (persisted to ExecutionStep). Populated
  //  from the optional fields the engine carries on node:success/node:fail.
  nodeType?: string;
  config?: unknown;
  input?: unknown;
  output?: unknown;
  prompt?: { system: string; user: string };
  memories?: { score: number; id: string; content: string; scope?: string }[];
}

export async function POST(req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id } = await params;

  const url = new URL(req.url);
  const control = url.searchParams.get("control");
  const executionId = url.searchParams.get("executionId");

  if (control === "resume" && executionId) {
    const ok = resumeRun(executionId);
    if (ok) {
      // Notification Engine: emit a resume event (non-blocking, best-effort).
      try {
        const exec = await prisma.execution.findUnique({
          where: { id: executionId },
          select: { workflowId: true, workflow: { select: { name: true } } },
        });
        void notify("workflow.resumed", {
          entityType: "execution",
          entityId: executionId,
          link: `/executions/${executionId}`,
          data: { workflowId: id, workflowName: exec?.workflow?.name ?? "workflow", executionId },
        }, { userId: user.id }).catch(() => { /* best-effort */ });
      } catch { /* best-effort */ }
    }
    return NextResponse.json({ ok });
  }
  if (control === "stop" && executionId) {
    return NextResponse.json({ ok: stopRun(executionId) });
  }
  if (control === "step" && executionId) {
    return NextResponse.json({ ok: stepRun(executionId) });
  }
  if (control === "pause" && executionId) {
    return NextResponse.json({ ok: pauseRun(executionId) });
  }

  const wf = await prisma.workflow.findUnique({ where: { id }, select: { ownerId: true, graph: true, name: true } });
  if (!wf || wf.ownerId !== user.id) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: { graph?: unknown; breakpoints?: string[]; trigger?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }

  const graph = normalizeGraph(body.graph ?? wf.graph) as EngineGraph;
  const breakpoints = new Set((body.breakpoints ?? []).filter((b) => typeof b === "string"));
  const trigger = body.trigger === "schedule" ? "schedule" : "manual";

  // Resolve the user's primary org once per run — scopes "workspace" memory.
  // Negligible cost (cached in-memory after the first lookup per process).
  const orgId = await resolveOrgId(user.id);

  if (graph.nodes.length === 0) {
    return NextResponse.json({ error: "Add at least one node before running." }, { status: 400 });
  }

  // Create the Execution row up front so we have an id to control the run.
  const execution = await prisma.execution.create({
    data: {
      workflowId: id,
      ownerId: user.id,
      status: "running",
      trigger,
    },
  });

  const handle = registerRun(execution.id);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown, event?: string) => {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        const framed = event ? `event: ${event}\n${payload}` : payload;
        try {
          controller.enqueue(encoder.encode(framed));
        } catch {
          /* client gone */
        }
      };

      const steps = new Map<string, StepAccum>();
      const ensure = (ev: ExecutionEvent): StepAccum => {
        let s = steps.get(ev.nodeId!);
        if (!s) {
          s = {
            nodeId: ev.nodeId!,
            nodeName: ev.nodeName ?? ev.nodeId!,
            status: "running",
            startedAt: Date.now(),
            durationMs: 0,
            tokensUsed: 0,
            cost: 0,
            retries: 0,
            logs: [],
            reasoning: [],
          };
          steps.set(ev.nodeId!, s);
        }
        return s;
      };

      let totals: ExecutionEvent["totals"] | undefined;

      // Copy the optional debugger inspection payload from an event onto its
      // accumulated step. Only node:success/node:fail carry these fields; other
      // event types leave them untouched (the first terminal event wins).
      const captureInspection = (s: StepAccum, ev: ExecutionEvent) => {
        if (ev.nodeType) s.nodeType = ev.nodeType;
        if (ev.config !== undefined) s.config = ev.config;
        if (ev.input !== undefined) s.input = ev.input;
        if (ev.output !== undefined) s.output = ev.output;
        if (ev.prompt) s.prompt = ev.prompt;
        if (ev.memories) s.memories = ev.memories;
      };

      // Announce the execution id first so the client can control the run.
      send({ type: "execution", executionId: execution.id, workflowId: id, name: wf.name });
      send({ type: "started", at: 0 });

      const gen = runWorkflow(graph, {
        breakpoints,
        awaitResume: handle.resume!,
        stopped: () => handle.stopFlag,
        stepMode: () => handle.stepMode,
        userId: user.id,
        workflowId: id,
        orgId,
      });

      try {
        for await (const ev of gen) {
          send(ev);
          // Fan out to any second-client live subscribers (debugger stream route).
          executionBus.publish(execution.id, ev);
          switch (ev.type) {
            case "node:start":
              ensure(ev);
              break;
            case "node:log":
              if (ev.log) ensure(ev).logs.push(ev.log);
              break;
            case "node:reasoning":
              if (ev.reasoning) ensure(ev).reasoning.push(ev.reasoning);
              break;
            case "node:retry":
              ensure(ev).status = "retrying";
              break;
            case "node:success": {
              const s = ensure(ev);
              s.status = "succeeded";
              s.durationMs = ev.durationMs ?? s.durationMs;
              s.tokensUsed = ev.tokensUsed ?? s.tokensUsed;
              s.cost = ev.cost ?? s.cost;
              s.retries = ev.retries ?? s.retries;
              captureInspection(s, ev);
              break;
            }
            case "node:fail": {
              const s = ensure(ev);
              s.status = "failed";
              s.durationMs = ev.durationMs ?? s.durationMs;
              s.tokensUsed = ev.tokensUsed ?? s.tokensUsed;
              s.cost = ev.cost ?? s.cost;
              s.retries = ev.retries ?? s.retries;
              if (ev.error) s.error = ev.error;
              if (ev.log && !s.logs.includes(ev.log)) s.logs.push(ev.log);
              captureInspection(s, ev);
              break;
            }
            case "complete":
              totals = ev.totals;
              break;
          }
        }
      } catch (err) {
        console.error("[run] engine error", err);
        totals = {
          durationMs: 0,
          totalTokens: 0,
          totalCost: 0,
          retried: 0,
          status: "failed",
          error: err instanceof Error ? err.message : "execution error",
        };
      } finally {
        send({ type: "done" }, "done");

        // Persist steps + finalize the execution regardless of stream outcome.
        const finalStatus = totals?.status ?? (handle.stopFlag ? "cancelled" : "failed");
        try {
          const stepRows = Array.from(steps.values());
          if (stepRows.length > 0) {
            await prisma.executionStep.createMany({
              data: stepRows.map((s) => ({
                executionId: execution.id,
                nodeId: s.nodeId,
                nodeName: s.nodeName,
                status: s.status,
                durationMs: s.durationMs,
                tokensUsed: s.tokensUsed,
                cost: s.cost,
                retries: s.retries,
                logs: s.logs,
                reasoning: s.reasoning.length ? s.reasoning : undefined,
                nodeType: s.nodeType,
                config: s.config as never,
                input: s.input as never,
                output: s.output as never,
                prompt: s.prompt as never,
                memories: s.memories as never,
                error: s.error,
              })),
            });
          }
          await prisma.execution.update({
            where: { id: execution.id },
            data: {
              status: finalStatus,
              finishedAt: new Date(),
              durationMs: totals?.durationMs ?? 0,
              totalTokens: totals?.totalTokens ?? 0,
              totalCost: totals?.totalCost ?? 0,
              retried: totals?.retried ?? 0,
              error: totals?.error ?? null,
            },
          });
          await prisma.workflow.update({
            where: { id },
            data: { lastRunAt: new Date(), status: finalStatus === "failed" ? "error" : "active" },
          });

          // The engine dedupes per (user, event, entity, day) and routes per the
          // user's preferences. Never throws — wrapped so it can't break the run.
          const wfEvent: NotificationEventKey | null =
            finalStatus === "succeeded" ? "workflow.completed"
            : finalStatus === "failed" ? "workflow.failed"
            : finalStatus === "cancelled" ? "workflow.cancelled"
            : null;
          if (wfEvent) {
            void notify(wfEvent, {
              entityType: "execution",
              entityId: execution.id,
              link: `/executions/${execution.id}`,
              data: {
                workflowId: id,
                workflowName: wf.name,
                executionId: execution.id,
                durationMs: totals?.durationMs ?? 0,
                tokens: totals?.totalTokens ?? 0,
                cost: totals?.totalCost ?? 0,
                error: totals?.error ?? null,
              },
            }, { userId: user.id }).catch(() => { /* best-effort */ });
          }
        } catch (dbErr) {
          console.error("[run] persistence error", dbErr);
        } finally {
          unregisterRun(execution.id);
        }

        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      stopRun(execution.id);
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}