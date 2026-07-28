// =============================================================================
// Preferences — cached user notification preferences.
// =============================================================================
// Per the brief's performance requirement ("Cache user preferences"), lookups
// are memoized per user with a short TTL so the emit path (which runs on every
// event) never hits the DB on a hot path. The cache is in-process (the queue
// worker and the web process each keep their own — a stale read here only means
// a notification might use a slightly-old opt-in for up to the TTL, which is
// acceptable and self-corrects). Invalidated on write.
//
// Server-only.

import "server-only";
import { repository } from "@/lib/notifications/repository";
import type {
  DigestFrequency,
  NotificationCategory,
  NotificationPreferences,
  PreferenceFlag,
} from "@/lib/notifications/types";

interface CachedPrefs extends NotificationPreferences {
  unsubscribeToken: string | null;
}

const TTL_MS = 30_000; // 30s — balances freshness vs DB load on the emit path
const _cache = new Map<string, { value: CachedPrefs; expires: number }>();

/** Get a user's preferences (cached for TTL_MS). */
export async function getPreferences(userId: string): Promise<CachedPrefs> {
  const hit = _cache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await repository.getPreferencesRow(userId);
  _cache.set(userId, { value, expires: Date.now() + TTL_MS });
  return value;
}

/** Invalidate the cache for a user (call after every preferences write). */
export function invalidatePreferences(userId: string): void {
  _cache.delete(userId);
}

/** Clear the whole cache — exposed for tests. */
export function __resetPreferencesCacheForTests(): void {
  _cache.clear();
}

// ─────────────────────────── routing helpers ─────────────────────────────────

/**
 * Is email enabled for this event's category, given the user's preferences?
 * `in_app` is always on (the feed is the dashboard source of truth).
 */
export function emailEnabledForEvent(
  prefs: NotificationPreferences,
  flag: PreferenceFlag,
): boolean {
  return prefs[flag] === true;
}

/**
 * Map a category → the preference flag that gates its email. Mirrors the
 * NOTIFICATION_EVENTS.preferenceFlag values.
 */
export function flagForCategory(category: NotificationCategory): PreferenceFlag {
  switch (category) {
    case "workflow": return "workflowEmails";
    case "ai": return "aiEmails";
    case "billing": return "billingEmails";
    case "security": return "securityEmails";
    case "integration": return "integrationEmails";
    case "system": return "productUpdates";
  }
}

/** Whether the user's frequency is a digest (not instant). */
export function isDigestFrequency(freq: DigestFrequency): boolean {
  return freq !== "instant";
}

/** Whether a digest of the given frequency should be sent, given prefs. */
export function digestOptedIn(prefs: NotificationPreferences, freq: "hourly" | "daily" | "weekly"): boolean {
  if (freq === "daily") return prefs.dailySummary;
  if (freq === "weekly") return prefs.weeklySummary;
  return true; // hourly follows the frequency setting itself
}