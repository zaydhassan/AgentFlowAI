"use client";

// Lightweight, dependency-free data hooks for the dashboard. The repo has no
// SWR/React Query and we add none — these are small fetch+poll hooks with
// loading/error/refresh state.
//
//   useDashboardData(intervalMs?)  → GET /api/dashboard (cached 60s server-side)
//   useHealth(intervalMs?)         → GET /api/health/ready (unauthenticated, live)
//
// Both: fetch on mount, poll on an interval, expose a manual refresh(), abort
// in-flight requests on unmount, and keep stale data visible across refresh
// failures so the UI never blanks out on a transient network blip.

import { useCallback, useEffect, useState } from "react";
import type { DashboardPayload } from "@/lib/dashboard/aggregations";
import type { ReadinessReport } from "@/lib/health/types";

interface DataState<T> {
  data: T | null;
  loading: boolean; // true only during the very first load
  error: string | null;
  lastUpdated: number | null; // epoch ms of the last successful fetch
  refresh: () => void;
}

function usePoll<T>(url: string, intervalMs: number): DataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  // Bumping this state forces an immediate refetch (manual refresh). It's a
  // dep of the effect below, so a bump tears down + restarts the fetch+poll.
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
        if (cancelled) return;
        if (res.status === 401) {
          setError("Sign in to view your dashboard.");
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = (await res.json()) as T;
        if (cancelled) return;
        setData(json);
        setError(null);
        setLastUpdated(Date.now());
      } catch (err) {
        if (cancelled || (err as Error)?.name === "AbortError") return;
        setError((err as Error)?.message ?? "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    const id = setInterval(run, intervalMs);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, [url, intervalMs, tick]);

  return { data, loading, error, lastUpdated, refresh };
}

export function useDashboardData(intervalMs = 30_000): DataState<DashboardPayload> {
  return usePoll<DashboardPayload>("/api/dashboard", intervalMs);
}

export function useHealth(intervalMs = 30_000): DataState<ReadinessReport> {
  return usePoll<ReadinessReport>("/api/health/ready", intervalMs);
}