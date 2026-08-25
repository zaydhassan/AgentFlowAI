import {
  badge, divider, emailLayout, esc, row, textBody, SUBJECT_PREFIX,
} from "./components";
import type { NotificationEventKey, RenderedTemplate, TemplateContext } from "@/lib/notifications/types";

type IntegrationEvent = Extract<NotificationEventKey, `integration.${string}`>;

export function renderIntegration(ctx: TemplateContext): RenderedTemplate {
  const d = ctx.payload.data ?? {};
  const provider = String(d.provider ?? "the integration");
  const link = ctx.payload.link ?? `${ctx.appUrl}/settings/integrations`;

  switch (ctx.event as IntegrationEvent) {
    case "integration.connected": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">You connected <strong>${esc(provider)}</strong> to your AgentFlow workspace${d.account ? ` (${esc(String(d.account))})` : ""}.</p>
        ${badge("Connected", "success")}
        ${divider()}
        ${row("Integration", provider)}
        ${d.account ? row("Account", String(d.account)) : ""}
        ${d.scopes ? row("Scopes", Array.isArray(d.scopes) ? (d.scopes as string[]).join(", ") : String(d.scopes)) : ""}`;
      return finish(ctx, "Integration connected", body, "Manage integrations", link);
    }
    case "integration.disconnected": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">You disconnected <strong>${esc(provider)}</strong>${d.account ? ` (${esc(String(d.account))})` : ""}. Workflows using it may need to be updated.</p>
        ${badge("Disconnected", "warning")}
        ${divider()}
        ${row("Integration", provider)}
        ${d.account ? row("Account", String(d.account)) : ""}`;
      return finish(ctx, "Integration disconnected", body, "Manage integrations", link);
    }
    case "integration.token_expired": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">The access token for <strong>${esc(provider)}</strong>${d.account ? ` (${esc(String(d.account))})` : ""} has expired. Reconnect to keep your workflows running.</p>
        ${badge("Token expired", "warning")}
        ${divider()}
        ${row("Integration", provider)}
        ${d.account ? row("Account", String(d.account)) : ""}`;
      return finish(ctx, "Integration token expired", body, "Reconnect", link);
    }
    case "integration.webhook_failed": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">An incoming webhook from <strong>${esc(provider)}</strong> could not be processed.</p>
        ${badge("Webhook failed", "error")}
        ${divider()}
        ${row("Integration", provider)}
        ${d.reason ? row("Reason", String(d.reason)) : ""}
        ${d.time ? row("Time", String(d.time)) : ""}`;
      return finish(ctx, "Webhook failed", body, "Manage integrations", link);
    }
    case "integration.mcp_offline": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">Your MCP server <strong>${esc(String(d.serverName ?? provider))}</strong> is no longer reachable. Tools and resources from it are unavailable until it reconnects.</p>
        ${badge("Offline", "error")}
        ${divider()}
        ${row("Server", String(d.serverName ?? provider))}
        ${d.endpoint ? row("Endpoint", String(d.endpoint)) : ""}
        ${d.error ? row("Error", String(d.error)) : ""}`;
      return finish(ctx, "MCP server offline", body, "Manage MCP servers", link);
    }
    default:
      return finish(ctx, "Integration update", `<p style="margin:0;">An update for <strong>${esc(provider)}</strong>.</p>`, "Manage integrations", link);
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

export { renderIntegration as render };