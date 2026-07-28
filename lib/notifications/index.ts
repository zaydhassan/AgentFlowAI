// =============================================================================
// Notifications facade — the single import for the rest of the app.
// =============================================================================
// Server code imports from "@/lib/notifications"; client code imports the
// client-safe subset from "@/lib/notifications/client". This facade re-exports
// the public surface and wires the boot-time template seeding.
//
// Provider-agnostic: no caller ever references EmailProvider/Resend directly.
// Adding a delivery channel = one new provider file + one factory line — the
// engine, queue, templates, and this facade are untouched.
//
// Server-only.

import "server-only";

// ── types (pure, client-safe) ──
export type {
  NotificationCategory,
  NotificationSeverity,
  NotificationChannel,
  DeliveryStatus,
  DigestFrequency,
  NotificationEventKey,
  NotificationEventMeta,
  PreferenceFlag,
  NotificationPayload,
  NotificationPreferences,
  NotificationRecord,
  DeliveryRecord,
  EmitResult,
  OutboundMessage,
  SendResult,
  NotificationProvider,
  RenderedTemplate,
  TemplateContext,
  DigestData,
  DigestStat,
  DigestChartPoint,
} from "@/lib/notifications/types";
export {
  NOTIFICATION_EVENTS,
  DEFAULT_PREFERENCES,
  FREQUENCIES,
  PREFERENCE_TOGGLES,
} from "@/lib/notifications/types";

// ── engine (the entry points) ──
export {
  notify,
  deliverDelivery,
  buildAndSendDigest,
  triggerDigestForUser,
  getPreferencesForUser,
  updatePreferencesForUser,
  computeQuietHoursDelay,
} from "@/lib/notifications/engine";

// ── repository (data access) ──
export {
  repository,
  createNotification,
  listNotifications,
  getNotification,
  countUnread,
  markRead,
  markAllRead,
  deleteNotification,
  buildDedupKey,
  seedTemplates,
} from "@/lib/notifications/repository";
export type { ListFilter, NotificationRow } from "@/lib/notifications/repository";

// ── preferences (cached routing) ──
export {
  getPreferences,
  invalidatePreferences,
  emailEnabledForEvent,
  flagForCategory,
  isDigestFrequency,
  digestOptedIn,
} from "@/lib/notifications/preferences";

// ── queue (delivery + scheduler heartbeat) ──
export {
  NOTIFICATION_QUEUE,
  enqueueDelivery,
  enqueueDigest,
  enqueueTick,
  startNotificationWorker,
  handleNotificationJob,
} from "@/lib/notifications/queue";
export type { DeliverJobData, DigestJobData, TickJobData } from "@/lib/notifications/queue";

// ── providers (provider-agnostic factory) ──
export { getProvider, providerConfigured } from "@/lib/notifications/providers";
export { EmailProvider, getEmailProvider } from "@/lib/notifications/providers";

// ── templates (lazy registry) ──
export { renderEvent, renderDigestEmail, renderGeneric } from "@/lib/notifications/templates";

// ── scheduler (digest periods + due dispatch) ──
export { computePeriod, buildDigestData, runDueDigests } from "@/lib/notifications/scheduler";
export type { Period } from "@/lib/notifications/scheduler";