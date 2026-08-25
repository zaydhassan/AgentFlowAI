/** Logical notification category. Drives preferences + templates + the feed. */
export type NotificationCategory =
  | "workflow"
  | "ai"
  | "integration"
  | "billing"
  | "security"
  | "system";

/** Severity — drives icon/color in the feed and the email accent. */
export type NotificationSeverity = "info" | "success" | "warning" | "error";

/**
 * Delivery channel. `in_app` is the always-on dashboard feed (never emailed).
 * The engine only sends `email` today; the others are reserved for future
 * providers that plug in behind the same NotificationProvider interface.
 */
export type NotificationChannel =
  | "in_app"
  | "email"
  | "slack"
  | "discord"
  | "push"
  | "sms";

/** Delivery lifecycle for a NotificationDelivery row (audited per channel). */
export type DeliveryStatus =
  | "pending"
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced"
  | "suppressed";

/** Digest cadence. `instant` ⇒ send immediately; others roll into a digest. */
export type DigestFrequency = "instant" | "hourly" | "daily" | "weekly";

// Every event the engine knows how to generate. Adding an event = add a key
// here + a renderer in lib/notifications/templates + (optional) an emit call at
// the producing seam. The engine routes by category + preference flag.

export type NotificationEventKey =
  // Workflows
  | "workflow.completed"
  | "workflow.failed"
  | "workflow.cancelled"
  | "workflow.paused"
  | "workflow.resumed"
  | "workflow.retried"
  // AI
  | "ai.agent_completed"
  | "ai.approval_required"
  | "ai.self_healing_succeeded"
  | "ai.self_healing_failed"
  | "ai.memory_full"
  // Integrations
  | "integration.connected"
  | "integration.disconnected"
  | "integration.token_expired"
  | "integration.webhook_failed"
  | "integration.mcp_offline"
  // Billing
  | "billing.payment_successful"
  | "billing.payment_failed"
  | "billing.credits_below_threshold"
  | "billing.subscription_renewed"
  | "billing.trial_ending"
  // Security
  | "security.new_login"
  | "security.password_changed"
  | "security.api_key_created"
  | "security.suspicious_login"
  // System
  | "system.deployment_completed"
  | "system.maintenance_notice"
  | "system.new_feature_announcement";

/** Which preferences flag gates email for a category. */
export type PreferenceFlag =
  | "workflowEmails"
  | "aiEmails"
  | "billingEmails"
  | "securityEmails"
  | "integrationEmails"
  | "productUpdates";

/** Static metadata for an event — drives defaults + routing. Data-only. */
export interface NotificationEventMeta {
  category: NotificationCategory;
  severity: NotificationSeverity;
  /** Default title (templates may override with richer context). */
  title: string;
  /** Short description shown in the template registry UI. */
  description: string;
  /** Preference flag that gates the email channel for this event. */
  preferenceFlag: PreferenceFlag;
  /** Channels this event can be delivered through. */
  channels: NotificationChannel[];
}

/**
 * The full event registry. Single source of truth for event → meta routing.
 * Kept here (pure data) so the engine, the template registry, and the API can
 * all reference it without a runtime import cycle.
 */
export const NOTIFICATION_EVENTS: Record<NotificationEventKey, NotificationEventMeta> = {
  "workflow.completed": {
    category: "workflow", severity: "success", preferenceFlag: "workflowEmails",
    title: "Workflow completed", description: "A workflow run finished successfully.",
    channels: ["in_app", "email"],
  },
  "workflow.failed": {
    category: "workflow", severity: "error", preferenceFlag: "workflowEmails",
    title: "Workflow failed", description: "A workflow run failed to complete.",
    channels: ["in_app", "email"],
  },
  "workflow.cancelled": {
    category: "workflow", severity: "warning", preferenceFlag: "workflowEmails",
    title: "Workflow cancelled", description: "A workflow run was cancelled.",
    channels: ["in_app", "email"],
  },
  "workflow.paused": {
    category: "workflow", severity: "info", preferenceFlag: "workflowEmails",
    title: "Workflow paused", description: "A workflow run paused at a breakpoint.",
    channels: ["in_app", "email"],
  },
  "workflow.resumed": {
    category: "workflow", severity: "info", preferenceFlag: "workflowEmails",
    title: "Workflow resumed", description: "A paused workflow run was resumed.",
    channels: ["in_app", "email"],
  },
  "workflow.retried": {
    category: "workflow", severity: "warning", preferenceFlag: "workflowEmails",
    title: "Workflow retried", description: "A failed workflow run was retried.",
    channels: ["in_app", "email"],
  },
  "ai.agent_completed": {
    category: "ai", severity: "success", preferenceFlag: "aiEmails",
    title: "Agent completed", description: "An autonomous agent finished its run.",
    channels: ["in_app", "email"],
  },
  "ai.approval_required": {
    category: "ai", severity: "warning", preferenceFlag: "aiEmails",
    title: "Approval required", description: "An agent is waiting for human approval.",
    channels: ["in_app", "email"],
  },
  "ai.self_healing_succeeded": {
    category: "ai", severity: "success", preferenceFlag: "aiEmails",
    title: "Self-healing succeeded", description: "The runtime recovered a failing node automatically.",
    channels: ["in_app", "email"],
  },
  "ai.self_healing_failed": {
    category: "ai", severity: "error", preferenceFlag: "aiEmails",
    title: "Self-healing failed", description: "An automatic recovery attempt failed.",
    channels: ["in_app", "email"],
  },
  "ai.memory_full": {
    category: "ai", severity: "warning", preferenceFlag: "aiEmails",
    title: "Memory capacity reached", description: "The long-term memory store hit its capacity limit.",
    channels: ["in_app", "email"],
  },
  "integration.connected": {
    category: "integration", severity: "success", preferenceFlag: "integrationEmails",
    title: "Integration connected", description: "A third-party integration was connected.",
    channels: ["in_app", "email"],
  },
  "integration.disconnected": {
    category: "integration", severity: "warning", preferenceFlag: "integrationEmails",
    title: "Integration disconnected", description: "A third-party integration was disconnected.",
    channels: ["in_app", "email"],
  },
  "integration.token_expired": {
    category: "integration", severity: "warning", preferenceFlag: "integrationEmails",
    title: "Integration token expired", description: "An OAuth token expired and must be reconnected.",
    channels: ["in_app", "email"],
  },
  "integration.webhook_failed": {
    category: "integration", severity: "error", preferenceFlag: "integrationEmails",
    title: "Webhook failed", description: "An incoming webhook could not be processed.",
    channels: ["in_app", "email"],
  },
  "integration.mcp_offline": {
    category: "integration", severity: "error", preferenceFlag: "integrationEmails",
    title: "MCP server offline", description: "A registered MCP server is no longer reachable.",
    channels: ["in_app", "email"],
  },
  "billing.payment_successful": {
    category: "billing", severity: "success", preferenceFlag: "billingEmails",
    title: "Payment successful", description: "A payment was captured successfully.",
    channels: ["in_app", "email"],
  },
  "billing.payment_failed": {
    category: "billing", severity: "error", preferenceFlag: "billingEmails",
    title: "Payment failed", description: "A payment could not be captured.",
    channels: ["in_app", "email"],
  },
  "billing.credits_below_threshold": {
    category: "billing", severity: "warning", preferenceFlag: "billingEmails",
    title: "Credits running low", description: "AI credits dropped below the alert threshold.",
    channels: ["in_app", "email"],
  },
  "billing.subscription_renewed": {
    category: "billing", severity: "info", preferenceFlag: "billingEmails",
    title: "Subscription renewed", description: "A subscription was renewed for the next cycle.",
    channels: ["in_app", "email"],
  },
  "billing.trial_ending": {
    category: "billing", severity: "warning", preferenceFlag: "billingEmails",
    title: "Trial ending soon", description: "A free trial is about to expire.",
    channels: ["in_app", "email"],
  },
  "security.new_login": {
    category: "security", severity: "info", preferenceFlag: "securityEmails",
    title: "New login", description: "A new sign-in to your account was detected.",
    channels: ["in_app", "email"],
  },
  "security.password_changed": {
    category: "security", severity: "success", preferenceFlag: "securityEmails",
    title: "Password changed", description: "Your account password was changed.",
    channels: ["in_app", "email"],
  },
  "security.api_key_created": {
    category: "security", severity: "info", preferenceFlag: "securityEmails",
    title: "API key created", description: "A new API key was generated for your account.",
    channels: ["in_app", "email"],
  },
  "security.suspicious_login": {
    category: "security", severity: "error", preferenceFlag: "securityEmails",
    title: "Suspicious login attempt", description: "A sign-in attempt from an unusual location was blocked.",
    channels: ["in_app", "email"],
  },
  "system.deployment_completed": {
    category: "system", severity: "success", preferenceFlag: "productUpdates",
    title: "Deployment completed", description: "A platform deployment finished.",
    channels: ["in_app", "email"],
  },
  "system.maintenance_notice": {
    category: "system", severity: "warning", preferenceFlag: "productUpdates",
    title: "Maintenance notice", description: "Scheduled maintenance is planned.",
    channels: ["in_app", "email"],
  },
  "system.new_feature_announcement": {
    category: "system", severity: "info", preferenceFlag: "productUpdates",
    title: "New feature", description: "A new AgentFlow feature is available.",
    channels: ["in_app", "email"],
  },
};

/** Context every event payload may carry. All optional — events are flexible. */
export interface NotificationPayload {
  /** Human title override (falls back to the event meta title). */
  title?: string;
  /** Human body line for the feed + email preview. */
  body?: string;
  /** Related entity type/id (no FK — like MemoryMetadata). */
  entityType?: string;
  entityId?: string;
  /** In-app deep link. */
  link?: string;
  /** Severity override (falls back to the event meta severity). */
  severity?: NotificationSeverity;
  /** Event-specific data passed to the template renderer (amounts, names, …). */
  data?: Record<string, unknown>;
}

/** Result of an emit. */
export interface EmitResult {
  /** The created notification id (null if deduped/suppressed). */
  notificationId: string | null;
  /** Whether an email delivery was enqueued. */
  enqueued: boolean;
  /** Whether the notification was a duplicate that already existed. */
  deduplicated: boolean;
  /** Why no email was sent (preference / digest / quiet hours / suppressed). */
  reason?: string;
}

/** A normalized, provider-agnostic outbound message handed to a provider. */
export interface OutboundMessage {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
  /** The notification + delivery ids, for idempotency + audit. */
  notificationId: string;
  deliveryId: string;
  /** Provider-specific routing tags (e.g. Slack channel, SMS from-number). */
  meta?: Record<string, unknown>;
}

/** Result of a provider send. */
export interface SendResult {
  ok: boolean;
  /** Provider message id — stored on the delivery row for the audit trail. */
  messageId?: string;
  error?: string;
  /** Final delivery status to record. */
  status: DeliveryStatus;
}

/**
 * The single interface the engine talks to. Provider implementations live in
 * lib/notifications/providers/{email,slack,discord,push,sms}.ts. Adding a new
 * provider = one new file + one line in the factory. The engine never branches
 * on provider identity.
 */
export interface NotificationProvider {
  readonly id: string;
  readonly channel: NotificationChannel;
  /** True when the provider has the credentials/config it needs to run. */
  readonly configured: boolean;
  /** Send one message. Throw to fail the job (subject to retries/backoff). */
  send(message: OutboundMessage): Promise<SendResult>;
}

/** A rendered template. `html` is the responsive email body; `text` is the
 *  plain-text fallback (and the in-app body when richer than `payload.body`). */
export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

/** Context handed to a template renderer. */
export interface TemplateContext {
  user: { id: string; name: string | null; email: string | null };
  event: NotificationEventKey;
  payload: NotificationPayload;
  /** App URL root for building links (server-side). */
  appUrl: string;
  /** Unsubscribe / preferences link token (server-side). */
  unsubscribeToken?: string;
  locale?: string;
}

/** A single stat row in a digest summary. */
export interface DigestStat {
  label: string;
  value: string;
  /** Optional delta vs the prior period (e.g. "+12%"). */
  delta?: string;
  tone?: "positive" | "negative" | "neutral";
}

/** Charts-ready point for the weekly report (date + value series). */
export interface DigestChartPoint {
  date: string; // ISO day
  executions: number;
  success: number;
  failures: number;
  tokens: number;
  cost: number;
}

/** The digest payload — drives both the email and the NotificationDigest row. */
export interface DigestData {
  frequency: DigestFrequency;
  periodStart: string; // ISO
  periodEnd: string; // ISO
  greeting: string;
  stats: DigestStat[];
  highlights: { icon: string; text: string; tone: NotificationSeverity }[];
  chart?: DigestChartPoint[];
  topWorkflows?: { id: string; name: string; runs: number; successRate: number }[];
  notificationCount: number;
}

/** Client-safe notification row (never includes internal/dedup fields). */
export interface NotificationRecord {
  id: string;
  category: NotificationCategory;
  event: NotificationEventKey;
  severity: NotificationSeverity;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
  link?: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  /** Latest delivery per channel (audit/status for the UI). */
  deliveries?: DeliveryRecord[];
}

export interface DeliveryRecord {
  id: string;
  channel: NotificationChannel;
  provider: string;
  status: DeliveryStatus;
  attempts: number;
  error?: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
}

/** Client-safe preferences shape (matches the Settings → Notifications form). */
export interface NotificationPreferences {
  workflowEmails: boolean;
  aiEmails: boolean;
  billingEmails: boolean;
  securityEmails: boolean;
  integrationEmails: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;
  productUpdates: boolean;
  frequency: DigestFrequency;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string | null;
}

/** The default preferences applied when a user has no row yet. */
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  workflowEmails: true,
  aiEmails: true,
  billingEmails: true,
  securityEmails: true,
  integrationEmails: true,
  dailySummary: true,
  weeklySummary: true,
  productUpdates: true,
  frequency: "instant",
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: null,
};

/** The selectable frequencies in the settings UI. */
export const FREQUENCIES: { value: DigestFrequency; label: string; hint: string }[] = [
  { value: "instant", label: "Instant", hint: "Send each notification as it happens" },
  { value: "hourly", label: "Hourly", hint: "Bundle into an hourly digest" },
  { value: "daily", label: "Daily", hint: "One summary each morning" },
  { value: "weekly", label: "Weekly", hint: "A weekly report every Monday" },
];

/** The preference toggles shown in the settings UI (label → flag). */
export const PREFERENCE_TOGGLES: { flag: keyof NotificationPreferences; label: string; hint: string }[] = [
  { flag: "workflowEmails", label: "Workflow emails", hint: "Runs completed, failed, paused, retried" },
  { flag: "aiEmails", label: "AI agents", hint: "Agent runs, approvals, self-healing, memory" },
  { flag: "billingEmails", label: "Billing", hint: "Payments, credits, renewals, trials" },
  { flag: "securityEmails", label: "Security", hint: "Logins, password changes, API keys" },
  { flag: "integrationEmails", label: "Integrations", hint: "Gmail, MCP, webhooks, token expiry" },
  { flag: "dailySummary", label: "Daily summary", hint: "Yesterday's activity in one email" },
  { flag: "weeklySummary", label: "Weekly summary", hint: "A weekly report with charts" },
  { flag: "productUpdates", label: "Product updates", hint: "New features, deployments, maintenance" },
];