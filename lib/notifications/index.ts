import "server-only";

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

export {
  notify,
  deliverDelivery,
  buildAndSendDigest,
  triggerDigestForUser,
  getPreferencesForUser,
  updatePreferencesForUser,
  computeQuietHoursDelay,
} from "@/lib/notifications/engine";

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

export {
  getPreferences,
  invalidatePreferences,
  emailEnabledForEvent,
  flagForCategory,
  isDigestFrequency,
  digestOptedIn,
} from "@/lib/notifications/preferences";

export {
  NOTIFICATION_QUEUE,
  enqueueDelivery,
  enqueueDigest,
  enqueueTick,
  startNotificationWorker,
  handleNotificationJob,
} from "@/lib/notifications/queue";
export type { DeliverJobData, DigestJobData, TickJobData } from "@/lib/notifications/queue";

export { getProvider, providerConfigured } from "@/lib/notifications/providers";
export { EmailProvider, getEmailProvider } from "@/lib/notifications/providers";

export { renderEvent, renderDigestEmail, renderGeneric } from "@/lib/notifications/templates";

export { computePeriod, buildDigestData, runDueDigests } from "@/lib/notifications/scheduler";
export type { Period } from "@/lib/notifications/scheduler";