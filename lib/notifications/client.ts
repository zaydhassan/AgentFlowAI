// =============================================================================
// Notifications client — the client-safe subset for the UI.
// =============================================================================
// Re-exports the pure types + fetch helpers the bell / settings / history page
// use. No server-only imports, no secrets, no Prisma. The components talk to the
// /api/notifications routes through these helpers.

import type { NotificationPreferences, NotificationRecord } from "@/lib/notifications/types";

export type {
  NotificationCategory,
  NotificationSeverity,
  NotificationChannel,
  DeliveryStatus,
  DigestFrequency,
  NotificationEventKey,
  NotificationPreferences,
  NotificationRecord,
  DeliveryRecord,
  DigestData,
  DigestStat,
} from "@/lib/notifications/types";
export {
  DEFAULT_PREFERENCES,
  FREQUENCIES,
  PREFERENCE_TOGGLES,
} from "@/lib/notifications/types";

/** Query params for listing notifications. */
export interface NotificationListQuery {
  category?: string;
  severity?: string;
  read?: boolean;
  q?: string;
  since?: string;
  until?: string;
  limit?: number;
  cursor?: string;
}

/** Response shape for the list endpoint. */
export interface NotificationListResponse {
  items: NotificationRecord[];
  nextCursor: string | null;
  total: number;
  unread: number;
}

export type { NotificationListQuery as ListQuery };

function qs(query: NotificationListQuery): string {
  const p = new URLSearchParams();
  if (query.category) p.set("category", query.category);
  if (query.severity) p.set("severity", query.severity);
  if (typeof query.read === "boolean") p.set("read", String(query.read));
  if (query.q) p.set("q", query.q);
  if (query.since) p.set("since", query.since);
  if (query.until) p.set("until", query.until);
  if (query.limit) p.set("limit", String(query.limit));
  if (query.cursor) p.set("cursor", query.cursor);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** List the current user's notifications (search + filter + cursor pagination). */
export async function listNotificationsApi(
  query: NotificationListQuery = {},
): Promise<NotificationListResponse> {
  const res = await fetch(`/api/notifications${qs(query)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`listNotifications failed: ${res.status}`);
  return res.json() as Promise<NotificationListResponse>;
}

/** Get just the unread count (lighter than a full list for the bell badge). */
export async function getUnreadCountApi(): Promise<number> {
  const res = await fetch("/api/notifications?unread=1", { cache: "no-store" });
  if (!res.ok) return 0;
  const data = await res.json() as { unread: number };
  return data.unread ?? 0;
}

/** Mark one notification read/unread. */
export async function markReadApi(id: string, read: boolean): Promise<boolean> {
  const res = await fetch(`/api/notifications/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ read }),
  });
  return res.ok;
}

/** Mark all (optionally category-filtered) notifications read. */
export async function markAllReadApi(category?: string): Promise<number> {
  const res = await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "markAllRead", category }),
  });
  if (!res.ok) return 0;
  const data = await res.json() as { updated: number };
  return data.updated ?? 0;
}

/** Delete a notification. */
export async function deleteNotificationApi(id: string): Promise<boolean> {
  const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
  return res.ok;
}

/** Fetch the current user's preferences. */
export async function getPreferencesApi(): Promise<NotificationPreferences> {
  const res = await fetch("/api/notifications/preferences", { cache: "no-store" });
  if (!res.ok) throw new Error(`getPreferences failed: ${res.status}`);
  return res.json() as Promise<NotificationPreferences>;
}

/** Save the current user's preferences. */
export async function savePreferencesApi(
  prefs: NotificationPreferences,
): Promise<NotificationPreferences> {
  const res = await fetch("/api/notifications/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error(`savePreferences failed: ${res.status}`);
  return res.json() as Promise<NotificationPreferences>;
}