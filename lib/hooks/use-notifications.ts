"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listNotificationsApi,
  markAllReadApi,
  markReadApi,
  type NotificationListQuery,
  type NotificationRecord,
} from "@/lib/notifications/client";

const POLL_MS = 30_000;

export function useNotifications() {
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumping tick forces an immediate refetch (manual refresh / revert).
  const [tick, setTick] = useState(0);
  // Holds an optional query for the next tick-driven fetch (cleared after use).
  const queryRef = useRef<NotificationListQuery | undefined>(undefined);

  const refresh = useCallback((query?: NotificationListQuery) => {
    queryRef.current = query;
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    // Capture + clear the pending query so it applies to this fetch only.
    const query = queryRef.current;
    queryRef.current = undefined;

    const run = async () => {
      try {
        const data = await listNotificationsApi({ limit: 20, ...query });
        if (cancelled) return;
        setItems(data.items);
        setUnread(data.unread);
        setTotal(data.total);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "failed to load notifications");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    const id = setInterval(run, POLL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, [tick]);

  const markRead = useCallback(async (id: string, read: boolean) => {
    // Optimistic update.
    setItems((arr) => arr.map((n) => (n.id === id ? { ...n, read } : n)));
    setUnread((u) => Math.max(0, u + (read ? -1 : 1)));
    const ok = await markReadApi(id, read);
    if (!ok) refresh(); // revert on failure
    return ok;
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const updated = await markAllReadApi();
    if (updated > 0) {
      setItems((arr) => arr.map((n) => ({ ...n, read: true })));
      setUnread(0);
    }
    return updated;
  }, []);

  return { items, unread, total, loading, error, refresh, markRead, markAllRead };
}