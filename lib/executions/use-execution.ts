"use client";

// Client hook for the /executions/[id] detail page.
//
// Two channels, reusing existing server infra (same pattern as the observability
// hook, but for a single run and with the full inspection payload):
//   1. Fetches GET /api/executions/[id] for the persisted snapshot — the run's
//      final state + its steps, including the AI Debugger inspection payload
//      (nodeType/config/input/output/prompt/memories) per step.
//   2. If the run is in flight, opens a native EventSource to the existing
//      per-workflow SSE route (/api/workflows/[workflowId]/executions/[id]/stream)
//      and folds live node events into a `live` LiveRunState.
//
// The page renders `steps` — a merge of the persisted steps (already-finished
// nodes from before subscribe) overlaid by live updates by nodeId, so a mid-run
// viewer sees the whole run. When the run completes, the source closes and the
// hook refreshes the snapshot so the persisted final state (totals, error)
// replaces the live view. If the server reports `{ type: "not-live" }` (run
// finished between fetch + subscribe, or server restarted) the source closes
// and the persisted snapshot stands on its own.
//
// `workflowId` is optional: the list page links to /executions/[id] without it,
// so the hook reads it from the fetched detail. A caller that already has it can
// pass it to open the stream one render sooner.
//
// `ExecutionEvent` is imported type-only from the server-only engine module —
// the import is erased, so the server-only guard never fires in the bundle.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExecutionEvent } from "@/lib/execution/engine";
import type { ExecutionDetail, ExecutionStepRow, LiveRunState, LiveStep } from "./types";

export interface UseExecution {
  detail: ExecutionDetail | null;
  /** Persisted steps overlaid with live updates by nodeId; ready to render. */
  steps: ExecutionStepRow[];
  live: LiveRunState | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// Convert a live step to the persisted-step shape the page already renders, so
// the timeline has one render type. `base` carries id/startedAt (which live
// events don't repeat) when the node was already in the persisted snapshot.
function liveToRow(s: LiveStep, base?: ExecutionStepRow): ExecutionStepRow {
  return {
    id: base?.id ?? s.nodeId,
    nodeId: s.nodeId,
    nodeName: s.nodeName,
    status: s.status,
    startedAt: base?.startedAt ?? "",
    durationMs: s.durationMs ?? 0,
    tokensUsed: s.tokensUsed ?? null,
    cost: s.cost ?? null,
    retries: s.retries ?? 0,
    logs: s.logs,
    reasoning: s.reasoning,
    nodeType: s.nodeType ?? null,
    config: s.config,
    input: s.input,
    output: s.output,
    prompt: s.prompt ?? null,
    memories: s.memories ?? null,
    error: s.error ?? null,
  };
}

// Merge persisted steps with the live overlay. Persisted steps seed the order and
// cover nodes that finished before the viewer subscribed; live steps overlay by
// nodeId (more up-to-date logs/reasoning/payload) and append any node that started
// after the snapshot was fetched.
export function mergeSteps(
  persisted: ExecutionStepRow[],
  live: LiveRunState | null,
): ExecutionStepRow[] {
  if (!live || live.steps.length === 0) return persisted;
  const persistedById = new Map(persisted.map((p) => [p.nodeId, p]));
  const liveById = new Map(live.steps.map((s) => [s.nodeId, s]));

  const merged: ExecutionStepRow[] = persisted.map((p) => {
    const lv = liveById.get(p.nodeId);
    return lv ? liveToRow(lv, p) : p;
  });
  // Append live nodes not present in the persisted snapshot (started after fetch).
  for (const lv of live.steps) {
    if (!persistedById.has(lv.nodeId)) merged.push(liveToRow(lv));
  }
  return merged;
}

export function useExecution(eid: string, workflowId?: string): UseExecution {
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [live, setLive] = useState<LiveRunState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const srcRef = useRef<EventSource | null>(null);
  // Avoid re-fetching on every render; track the in-flight request so a late
  // fetch doesn't overwrite a newer one.
  const reqIdRef = useRef(0);

  const closeStream = useCallback(() => {
    if (srcRef.current) {
      srcRef.current.close();
      srcRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    try {
      const res = await fetch(`/api/executions/${eid}`, { cache: "no-store" });
      if (reqId !== reqIdRef.current) return; // superseded by a newer fetch.
      if (res.status === 404) {
        setDetail(null);
        setError(null);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as ExecutionDetail;
      setDetail(d);
      setError(null);
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load execution.");
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [eid]);

  // Fetch the snapshot once per eid.
  useEffect(() => {
    setLoading(true);
    void refresh();
    return () => {
      reqIdRef.current++; // invalidate any in-flight fetch on unmount/redirect.
    };
  }, [eid, refresh]);

  // Apply a single ExecutionEvent to the live state.
  const applyEvent = useCallback(
    (evt: ExecutionEvent, src: EventSource) => {
      // Terminal: freeze with final status, close, then refresh to pick up the
      // persisted final state (totals, error) and drop the live overlay.
      if (evt.type === "complete") {
        src.close();
        if (srcRef.current === src) srcRef.current = null;
        setLive((prev) => {
          const cur = prev ?? { steps: [], status: "running" as const, lastEventAt: 0 };
          const status: LiveRunState["status"] =
            evt.totals?.status === "succeeded"
              ? "succeeded"
              : evt.totals?.status === "failed"
                ? "failed"
                : cur.status;
          return { ...cur, status, totals: evt.totals, lastEventAt: Date.now() };
        });
        // Give the persisted row a beat to flush, then swap to the snapshot.
        setTimeout(() => void refresh(), 400);
        return;
      }

      setLive((prev) => {
        const cur = prev ?? { steps: [], status: "running" as const, lastEventAt: Date.now() };
        const next: LiveRunState = { ...cur, lastEventAt: Date.now() };

        switch (evt.type) {
          case "started":
            return { steps: [], status: "running", lastEventAt: Date.now() };

          case "node:start": {
            // Don't double-add if the node is already present (mid-run subscribe).
            if (cur.steps.some((s) => s.nodeId === evt.nodeId)) return prev;
            next.steps = [
              ...cur.steps,
              {
                nodeId: evt.nodeId ?? "",
                nodeName: evt.nodeName ?? "",
                status: "running",
                logs: [],
                reasoning: [],
                nodeType: evt.nodeType,
              },
            ];
            break;
          }

          case "node:log": {
            const steps = cur.steps.slice();
            const last = steps[steps.length - 1];
            if (last && evt.log) steps[steps.length - 1] = { ...last, logs: [...last.logs, evt.log] };
            next.steps = steps;
            break;
          }

          case "node:reasoning": {
            const steps = cur.steps.slice();
            const last = steps[steps.length - 1];
            if (last && evt.reasoning)
              steps[steps.length - 1] = { ...last, reasoning: [...last.reasoning, evt.reasoning] };
            next.steps = steps;
            break;
          }

          case "node:retry": {
            const steps = cur.steps.slice();
            const idx = evt.nodeId ? steps.findIndex((s) => s.nodeId === evt.nodeId) : steps.length - 1;
            if (idx >= 0) steps[idx] = { ...steps[idx], status: "retrying" };
            next.steps = steps;
            break;
          }

          case "node:success":
          case "node:fail": {
            const status: LiveStep["status"] = evt.type === "node:success" ? "succeeded" : "failed";
            const steps = cur.steps.slice();
            const idx = evt.nodeId ? steps.findIndex((s) => s.nodeId === evt.nodeId) : -1;
            const patch: Partial<LiveStep> = {
              status,
              durationMs: evt.durationMs,
              tokensUsed: evt.tokensUsed,
              cost: evt.cost,
              retries: evt.retries,
              error: evt.error,
              nodeType: evt.nodeType,
              config: evt.config,
              input: evt.input,
              output: evt.output,
              prompt: evt.prompt,
              memories: evt.memories,
            };
            if (idx >= 0) {
              steps[idx] = { ...steps[idx], ...patch };
            } else if (evt.nodeId) {
              // Subscribed mid-run (no prior node:start for this node); register now.
              steps.push({
                nodeId: evt.nodeId,
                nodeName: evt.nodeName ?? evt.nodeId,
                logs: [],
                reasoning: [],
                ...patch,
              } as LiveStep);
            }
            next.steps = steps;
            break;
          }

          default:
            return prev; // unknown event type — no state change
        }
        return { ...prev, ...next, steps: next.steps };
      });
    },
    [refresh],
  );

  // Open/close the SSE stream based on the snapshot's status. While the run is
  // running, subscribe; once it's finished, ensure no stream lingers.
  useEffect(() => {
    closeStream();
    setLive(null);

    if (!detail || detail.status !== "running") return;
    if (typeof EventSource === "undefined") return; // SSR guard.

    const wfId = detail.workflowId ?? workflowId;
    if (!wfId) return;

    const src = new EventSource(`/api/workflows/${wfId}/executions/${eid}/stream`);
    srcRef.current = src;
    src.onmessage = (ev) => {
      // The stream route also yields a terminal `{ type: "not-live" }` frame when
      // the run isn't in flight on the server (finished between fetch + subscribe,
      // or server restarted). It isn't part of ExecutionEvent, so handle it at the
      // parse boundary and only forward real events.
      let evt: ExecutionEvent | { type: "not-live" };
      try {
        evt = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (evt.type === "not-live") {
        // Run finished while we were subscribing — refresh to get the final state.
        closeStream();
        setLive(null);
        void refresh();
        return;
      }
      applyEvent(evt, src);
    };
    // Terminal frame from sseStream: `event: done`. Close (idempotent if
    // `complete` already closed it) so EventSource doesn't reconnect.
    src.addEventListener("done", () => closeStream());
    // EventSource auto-reconnects on transient network errors; if the run is
    // genuinely gone the route yields `not-live`/`complete` and we close.
    src.onerror = () => {
      /* no-op — auto-reconnect handles it */
    };

    return () => closeStream();
  }, [eid, detail, workflowId, applyEvent, closeStream, refresh]);

  const steps = useMemo(() => mergeSteps(detail?.steps ?? [], live), [detail, live]);

  return { detail, steps, live, loading, error, refresh };
}