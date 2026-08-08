"use client";

// Client hook for the AI Observability page.
//
// Two real-time channels, both reusing existing server infra:
//   1. Polls GET /api/observability every 10s (+ on tab focus) for the
//      aggregated snapshot — KPIs, trend, recent runs, in-flight list.
//   2. For each in-flight run in that snapshot, opens a native EventSource to
//      the existing per-execution SSE route
//      (/api/workflows/[id]/executions/[eid]/stream) and folds live node-step
//      events into a `live[eid]` map the page renders.
//
// Reconciles EventSources as the in-flight set changes between polls: opens
// new ones, closes ones that have left the set (they moved to `recent`). When a
// run completes (or the server reports `not-live`), the source is closed so
// EventSource doesn't reconnect to a finished run.
//
// `ExecutionEvent` is imported type-only from the server-only engine module —
// the import is erased, so the server-only guard never fires in the bundle.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExecutionEvent } from "@/lib/execution/engine";
import type { InFlightRun, ObservabilitySummary } from "./types";

export interface LiveStep {
  nodeId: string;
  nodeName: string;
  status: "running" | "succeeded" | "failed" | "retrying";
  log?: string;
  durationMs?: number;
  tokensUsed?: number;
  cost?: number;
  retries?: number;
  error?: string;
  nodeType?: string;
}

export interface LiveRunState {
  steps: LiveStep[];
  status: "running" | "succeeded" | "failed";
  totals?: ExecutionEvent["totals"];
  lastEventAt: number;
}

export interface UseObservability {
  summary: ObservabilitySummary | null;
  live: Record<string, LiveRunState>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useObservability(): UseObservability {
  const [summary, setSummary] = useState<ObservabilitySummary | null>(null);
  const [live, setLive] = useState<Record<string, LiveRunState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sourcesRef = useRef<Map<string, EventSource>>(new Map());

  const closeSource = useCallback((eid: string, dropLive: boolean) => {
    const src = sourcesRef.current.get(eid);
    if (src) {
      src.close();
      sourcesRef.current.delete(eid);
    }
    if (dropLive) {
      setLive((prev) => {
        if (!(eid in prev)) return prev;
        const next = { ...prev };
        delete next[eid];
        return next;
      });
    }
  }, []);

  const applyEvent = useCallback(
    (eid: string, evt: ExecutionEvent, src: EventSource) => {
      // Terminal event: freeze the row with the final status, close the source
      // (leave the live entry so the UI shows the just-finished run until the
      // next poll moves it into `recent`).
      if (evt.type === "complete") {
        src.close();
        sourcesRef.current.delete(eid);
        setLive((prev) => {
          const cur = prev[eid] ?? { steps: [], status: "running" as const, lastEventAt: 0 };
          const status: LiveRunState["status"] =
            evt.totals?.status === "succeeded"
              ? "succeeded"
              : evt.totals?.status === "failed"
                ? "failed"
                : cur.status;
          return { ...prev, [eid]: { ...cur, status, totals: evt.totals, lastEventAt: Date.now() } };
        });
        return;
      }

      setLive((prev) => {
        const cur = prev[eid] ?? { steps: [], status: "running" as const, lastEventAt: Date.now() };
        const next: LiveRunState = { ...cur, lastEventAt: Date.now() };

        switch (evt.type) {
          case "started":
            return { ...prev, [eid]: { steps: [], status: "running", lastEventAt: Date.now() } };
          case "node:start":
            next.steps = [
              ...cur.steps,
              { nodeId: evt.nodeId ?? "", nodeName: evt.nodeName ?? "", status: "running", nodeType: evt.nodeType },
            ];
            break;
          case "node:log":
          case "node:reasoning": {
            const steps = cur.steps.slice();
            const last = steps[steps.length - 1];
            if (last) steps[steps.length - 1] = { ...last, log: evt.log ?? evt.reasoning ?? last.log };
            next.steps = steps;
            break;
          }
          case "node:retry": {
            const steps = cur.steps.slice();
            const last = steps[steps.length - 1];
            if (last) steps[steps.length - 1] = { ...last, status: "retrying" };
            next.steps = steps;
            break;
          }
          case "node:success":
          case "node:fail": {
            const status: LiveStep["status"] = evt.type === "node:success" ? "succeeded" : "failed";
            const steps = cur.steps.slice();
            const idx = evt.nodeId ? steps.findIndex((s) => s.nodeId === evt.nodeId) : -1;
            if (idx >= 0) {
              steps[idx] = {
                ...steps[idx],
                status,
                durationMs: evt.durationMs,
                tokensUsed: evt.tokensUsed,
                cost: evt.cost,
                retries: evt.retries,
                error: evt.error ?? steps[idx].error,
                nodeType: evt.nodeType ?? steps[idx].nodeType,
              };
            } else if (evt.nodeId) {
              // Subscribed mid-run (no prior node:start); register the step now.
              steps.push({
                nodeId: evt.nodeId,
                nodeName: evt.nodeName ?? evt.nodeId,
                status,
                durationMs: evt.durationMs,
                tokensUsed: evt.tokensUsed,
                cost: evt.cost,
                retries: evt.retries,
                error: evt.error,
                nodeType: evt.nodeType,
              });
            }
            next.steps = steps;
            break;
          }
          default:
            return prev; // unknown event type — no state change
        }
        return { ...prev, [eid]: next };
      });
    },
    [closeSource],
  );

  const openStream = useCallback(
    (eid: string, workflowId: string) => {
      if (sourcesRef.current.has(eid)) return;
      if (typeof EventSource === "undefined") return; // SSR guard.
      const src = new EventSource(`/api/workflows/${workflowId}/executions/${eid}/stream`);
      sourcesRef.current.set(eid, src);
      src.onmessage = (ev) => {
        // The stream route also yields a terminal `{ type: "not-live" }` frame
        // when the run isn't in flight on the server (finished between poll +
        // subscribe, or server restarted). It isn't part of ExecutionEvent, so
        // we handle it at the parse boundary and only forward real events.
        let evt: ExecutionEvent | { type: "not-live" };
        try {
          evt = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (evt.type === "not-live") {
          closeSource(eid, true);
          return;
        }
        applyEvent(eid, evt, src);
      };
      // Terminal frame from sseStream: `event: done`. Close (idempotent if
      // `complete` already closed it) so EventSource doesn't reconnect.
      src.addEventListener("done", () => closeSource(eid, false));
      // EventSource auto-reconnects on transient network errors; if the run is
      // genuinely gone the route yields `not-live`/`complete` and we close.
      src.onerror = () => {
        /* no-op — auto-reconnect handles it */
      };
    },
    [applyEvent, closeSource],
  );

  const reconcile = useCallback(
    (inFlight: InFlightRun[]) => {
      const sources = sourcesRef.current;
      const nextIds = new Set(inFlight.map((r) => r.executionId));
      const wfById = new Map(inFlight.map((r) => [r.executionId, r.workflowId]));

      // Close sources for runs no longer in flight (they moved to `recent`).
      for (const eid of sources.keys()) {
        if (!nextIds.has(eid)) closeSource(eid, true);
      }
      // Open sources for newly in-flight runs.
      for (const eid of nextIds) {
        if (!sources.has(eid)) {
          const wfId = wfById.get(eid);
          if (wfId) openStream(eid, wfId);
        }
      }
    },
    [closeSource, openStream],
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/observability", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ObservabilitySummary;
      setSummary(data);
      reconcile(data.inFlight);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load observability data.");
    } finally {
      setLoading(false);
    }
  }, [reconcile]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 10_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      for (const [, src] of sourcesRef.current) src.close();
      sourcesRef.current.clear();
    };
  }, [refresh]);

  return { summary, live, loading, error, refresh };
}