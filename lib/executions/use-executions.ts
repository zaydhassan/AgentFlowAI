"use client";

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
    // Poll-on-mount + interval; `refresh` performs the async fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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