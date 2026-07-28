// =============================================================================
// Notification providers — provider-agnostic factory.
// =============================================================================
// The engine resolves a provider by channel via getProvider(channel). Today
// only "email" is implemented (EmailProvider). Adding a provider later requires
// ONLY:
//   1. a new file in this folder (e.g. slack.ts exporting SlackProvider), and
//   2. one line in the `providers` map below.
// Nothing else in the engine changes — that is the entire provider-abstraction
// contract. Future providers: gmail (resend-style), resend, ses, sendgrid,
// slack, discord, push, sms.
//
// Server-only.

import "server-only";
import type {
  NotificationChannel,
  NotificationProvider,
} from "@/lib/notifications/types";
import { getEmailProvider } from "./email";

export { EmailProvider, getEmailProvider } from "./email";

// Channel → provider factory. Memoized per channel so the singleton provider is
// reused. A channel with no implementation yet returns null — the engine treats
// that as "not configured" and skips delivery (never throws).
const _providers = new Map<NotificationChannel, NotificationProvider | null>();

function resolve(channel: NotificationChannel): NotificationProvider | null {
  const existing = _providers.get(channel);
  if (existing !== undefined) return existing;
  let p: NotificationProvider | null = null;
  switch (channel) {
    case "email":
      p = getEmailProvider();
      break;
    // ── Future providers — wire here when implemented ──
    // case "slack": p = getSlackProvider(); break;
    // case "discord": p = getDiscordProvider(); break;
    // case "push": p = getPushProvider(); break;
    // case "sms": p = getSmsProvider(); break;
    case "in_app":
      // in_app is the always-on feed — there is no outbound provider; the
      // Notification row itself IS the in-app delivery. No provider needed.
      p = null;
      break;
    default:
      p = null;
  }
  _providers.set(channel, p);
  return p;
}

/** Return the provider for a channel, or null when no provider is wired. */
export function getProvider(channel: NotificationChannel): NotificationProvider | null {
  return resolve(channel);
}

/** Whether a channel has a configured provider ready to send. */
export function providerConfigured(channel: NotificationChannel): boolean {
  const p = resolve(channel);
  return !!p && p.configured;
}

/** Reset the memoized providers — exposed for tests / env hot-reload. */
export function __resetProvidersForTests(): void {
  _providers.clear();
}