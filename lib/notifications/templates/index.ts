import "server-only";
import {
  badge, divider, emailLayout, esc, row, textBody, SUBJECT_PREFIX,
} from "./components";
import type {
  DigestData,
  NotificationEventKey,
  RenderedTemplate,
  TemplateContext,
} from "@/lib/notifications/types";

export { PALETTE, logoTile, emailLayout } from "./components";

type CategoryRenderer = (ctx: TemplateContext) => RenderedTemplate;
const _modules = new Map<string, CategoryRenderer>();

/** Lazily resolve the renderer for an event's category. */
async function resolveRenderer(event: NotificationEventKey): Promise<CategoryRenderer> {
  const category = event.split(".")[0];
  if (category === "workflow" || category === "billing" || category === "security" || category === "integration") {
    const cached = _modules.get(category);
    if (cached) return cached;
    const mod = await import(`./${category}`);
    const fn = (mod as { render: CategoryRenderer }).render;
    _modules.set(category, fn);
    return fn;
  }
  // ai + system → generic renderer (no dynamic import needed).
  return renderGeneric;
}

/**
 * Render an event email. Lazy-loads the category module on first use.
 * Throws only if the event is unknown (should never happen — the engine
 * validates against NOTIFICATION_EVENTS before calling).
 */
export async function renderEvent(ctx: TemplateContext): Promise<RenderedTemplate> {
  const render = await resolveRenderer(ctx.event);
  return render(ctx);
}

/** Render a digest email. */
export { renderDigest } from "./digest";
export async function renderDigestEmail(ctx: TemplateContext & { digest: DigestData }): Promise<RenderedTemplate> {
  const { renderDigest } = await import("./digest");
  return renderDigest(ctx);
}

/** A clean, professional default for events without a dedicated category module. */
export function renderGeneric(ctx: TemplateContext): RenderedTemplate {
  const d = ctx.payload.data ?? {};
  const title = ctx.payload.title ?? "AgentFlow update";
  const body = ctx.payload.body ?? "You have a new update in your AgentFlow workspace.";
  const ctaHref = ctx.payload.link ?? `${ctx.appUrl}/dashboard`;
  const ctaLabel = String(d.ctaLabel ?? "Open AgentFlow");

  const rowsHtml = Object.entries(d)
    .filter(([k]) => !["ctaLabel"].includes(k))
    .slice(0, 6)
    .map(([k, v]) => row(prettify(k), formatVal(v)))
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hi ${esc(ctx.user.name?.split(" ")[0] ?? "there")},</p>
    <p style="margin:0 0 14px;">${esc(body)}</p>
    ${ctx.payload.severity ? badge(title, ctx.payload.severity) : ""}
    ${rowsHtml ? divider() + rowsHtml : ""}`;

  return {
    subject: `${SUBJECT_PREFIX} · ${title}`,
    html: emailLayout({
      preheader: body,
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

function prettify(k: string): string {
  return k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}
function formatVal(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString();
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}