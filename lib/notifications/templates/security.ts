import {
  badge, divider, emailLayout, esc, row, textBody, SUBJECT_PREFIX,
} from "./components";
import type { NotificationEventKey, RenderedTemplate, TemplateContext } from "@/lib/notifications/types";

type SecurityEvent = Extract<NotificationEventKey, `security.${string}`>;

export function renderSecurity(ctx: TemplateContext): RenderedTemplate {
  const d = ctx.payload.data ?? {};
  const link = ctx.payload.link ?? `${ctx.appUrl}/settings`;

  switch (ctx.event as SecurityEvent) {
    case "security.new_login": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">We detected a new sign-in to your AgentFlow account.</p>
        ${badge("New login", "info")}
        ${divider()}
        ${d.ip ? row("IP address", String(d.ip)) : ""}
        ${d.location ? row("Location", String(d.location)) : ""}
        ${d.device ? row("Device", String(d.device)) : ""}
        ${d.time ? row("Time", String(d.time)) : ""}
        <p style="margin:14px 0 0;font-size:12px;">If this was you, no action is needed. If not, reset your password immediately.</p>`;
      return finish(ctx, "New login detected", body, "Review activity", link);
    }
    case "security.password_changed": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">Your AgentFlow password was changed${d.time ? ` on ${esc(String(d.time))}` : ""}.</p>
        ${badge("Password changed", "success")}
        ${divider()}
        ${d.ip ? row("IP address", String(d.ip)) : ""}
        ${d.time ? row("Time", String(d.time)) : ""}
        <p style="margin:14px 0 0;font-size:12px;">If you didn't make this change, reset your password and contact support immediately.</p>`;
      return finish(ctx, "Password changed", body, "Account settings", link);
    }
    case "security.api_key_created": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">A new API key${d.name ? ` <strong>${esc(String(d.name))}</strong>` : ""} was created on your account.</p>
        ${badge("API key", "info")}
        ${divider()}
        ${d.name ? row("Key name", String(d.name)) : ""}
        ${d.scope ? row("Scope", String(d.scope)) : ""}
        ${d.time ? row("Created", String(d.time)) : ""}
        <p style="margin:14px 0 0;font-size:12px;">Keep your API keys secret. Never share them or commit them to source control.</p>`;
      return finish(ctx, "API key created", body, "Manage keys", link);
    }
    case "security.suspicious_login": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">We blocked a sign-in attempt to your account from an unusual location.</p>
        ${badge("Blocked", "error")}
        ${divider()}
        ${d.ip ? row("IP address", String(d.ip)) : ""}
        ${d.location ? row("Location", String(d.location)) : ""}
        ${d.time ? row("Time", String(d.time)) : ""}
        <p style="margin:14px 0 0;font-size:12px;">Your account is safe. Review your security settings if you don't recognize this activity.</p>`;
      return finish(ctx, "Suspicious login blocked", body, "Security settings", link);
    }
    default:
      return finish(ctx, "Security alert", `<p style="margin:0;">A security update for your account.</p>`, "Security settings", link);
  }
}

function finish(ctx: TemplateContext, title: string, bodyHtml: string, ctaLabel: string, ctaHref: string): RenderedTemplate {
  const body = ctx.payload.body ?? title;
  return {
    subject: `${SUBJECT_PREFIX} · ${title}`,
    html: emailLayout({
      preheader: title,
      badge: { label: title, severity: ctx.payload.severity ?? "info" },
      bodyHtml,
      cta: { href: ctaHref, label: ctaLabel },
      appUrl: ctx.appUrl,
      unsubscribeToken: ctx.unsubscribeToken,
      year: new Date().getUTCFullYear(),
    }),
    text: textBody({ title, body, link: ctaHref, linkLabel: ctaLabel, appUrl: ctx.appUrl }),
  };
}

function firstName(ctx: TemplateContext): string {
  return ctx.user.name?.split(" ")[0] ?? "there";
}

export { renderSecurity as render };