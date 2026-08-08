"use client";

// Client hook for the /executions list page.
//
// Polls GET /api/executions every 10s (+ on tab focus) for the owner-scoped run
// list + status counts. No SSE here — a list only needs to reflect that a run is
// "running" and flip it to succeeded/failed within ~10s; the per-step live
// animation lives on the detail page (see use-execution.ts). The poll/visibility
// shape mirrors lib/observability/use-observability.ts.

import { useCallback, useEffect, useState } from "react";
import type { ExecutionsList } from "./types";

export interface UseExecutions {
  data: ExecutionsList | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useExecutions(): UseExecutions {
  const [data, setData] = useState<ExecutionsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/executions", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as ExecutionsList);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load executions.");
    } finally {
      setLoading(false);
    }
  }, []);

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
    };
  }, [refresh]);

  return { data, loading, error, refresh };
}