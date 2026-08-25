import "server-only";
import { sendEmail } from "@/lib/resend";
import type {
  NotificationProvider,
  OutboundMessage,
  SendResult,
} from "@/lib/notifications/types";

export class EmailProvider implements NotificationProvider {
  readonly id = "email";
  readonly channel = "email" as const;

  get configured(): boolean {
    // The transport in lib/resend is always usable: Resend when configured, the
    // dev file fallback otherwise. So email is always "configured" from the
    // engine's perspective — the dev fallback simply writes to disk.
    return true;
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    try {
      await sendEmail({
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      // lib/resend throws on a Resend API error, so reaching here = accepted.
      // We can't reliably distinguish "sent" from "delivered" without webhooks,
      // so we record `sent` (the provider accepted the message). A future
      // Resend webhook can promote `sent` → `delivered` / `bounced`.
      return {
        ok: true,
        status: "sent",
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : "email send failed";
      // Distinguish a hard bounce / suppressed address from a transient failure
      // so retries don't hammer an inbox that will never accept mail.
      const lower = error.toLowerCase();
      const bounced = /bounced|invalid.*email|does not exist|no such user/.test(lower);
      const suppressed = /suppressed|blacklisted|complaint/.test(lower);
      return {
        ok: false,
        error,
        status: bounced ? "bounced" : suppressed ? "suppressed" : "failed",
      };
    }
  }
}

/** Singleton — the EmailProvider holds no per-call state. */
let _instance: EmailProvider | null = null;
export function getEmailProvider(): EmailProvider {
  if (!_instance) _instance = new EmailProvider();
  return _instance;
}