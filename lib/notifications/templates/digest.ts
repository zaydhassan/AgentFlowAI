// =============================================================================
// Digest email template — the daily / weekly summary report. Charts-ready data
// arrives as a DigestData payload (built by lib/notifications/scheduler.ts from
// real DB events). Lazy-loaded by the template registry in ./index.ts.
// =============================================================================
// Daily example (per the brief):
//   Yesterday
//   ✔ 27 workflows completed
//   ✔ 98.4% success rate
//   ✔ 12 AI agents executed
//   ✔ 82k tokens consumed
//   ✔ 4 integrations active
//   ✔ Credits remaining
// Weekly: the same summary + a 7-day chart (rendered as a lightweight inline-SVG
// sparkline so it renders in every email client without external assets).

import {
  checkLine, divider, emailLayout, esc, row, statTile, textBody, SUBJECT_PREFIX,
} from "./components";
import type { DigestData, RenderedTemplate, TemplateContext } from "@/lib/notifications/types";

export function renderDigest(ctx: TemplateContext & { digest: DigestData }): RenderedTemplate {
  const digest = ctx.digest;
  const isWeekly = digest.frequency === "weekly";
  const periodLabel = isWeekly ? "Last 7 days" : "Yesterday";
  const title = isWeekly ? "Your weekly report" : "Your daily summary";

  // ── stat tiles (3 per row) ──
  const stats = digest.stats.slice(0, 6);
  const rows: string[] = [];
  for (let i = 0; i < stats.length; i += 3) {
    const slice = stats.slice(i, i + 3);
    rows.push(`
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        <tr>${slice.map((s) => statTile(s.label, s.value, s.delta)).join("")}<td style="width:0;"></td></tr>
      </table>`);
  }
  const statsHtml = rows.join("");

  // ── highlight checkmarks ──
  const highlightsHtml = digest.highlights
    .map((h) => checkLine(`<strong style="color:${toneColor(h.tone)}">${esc(h.text)}</strong>`))
    .join("");

  // ── weekly chart (inline SVG sparkline of executions) ──
  const chartHtml = isWeekly && digest.chart && digest.chart.length > 1 ? renderSparkline(digest.chart) : "";

  // ── top workflows ──
  const topHtml = digest.topWorkflows && digest.topWorkflows.length > 0
    ? `<div style="margin-top:18px;">${divider()}` +
      `<p style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:600;color:${"#0f1020"};margin:0 0 8px;">Top workflows</p>` +
      digest.topWorkflows.map((w) => row(w.name, `${w.runs} runs · ${w.successRate}% success`)).join("") +
      `</div>`
    : "";

  const bodyHtml = `
    <p style="margin:0 0 6px;font-size:13px;color:${"#5b5c70"};text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">${esc(periodLabel)}</p>
    <p style="margin:0 0 16px;">Hi ${esc(digest.greeting)}, here's what happened in your AgentFlow workspace.</p>
    ${statsHtml}
    ${divider()}
    ${highlightsHtml}
    ${chartHtml}
    ${topHtml}`;

  const ctaHref = `${ctx.appUrl}/dashboard`;
  const subject = isWeekly
    ? `${SUBJECT_PREFIX} · Your weekly report — ${digest.notificationCount} notifications`
    : `${SUBJECT_PREFIX} · Your daily summary — ${digest.notificationCount} notifications`;

  return {
    subject,
    html: emailLayout({
      preheader: `${periodLabel}: ${digest.notificationCount} notifications, ${digest.stats[0]?.value ?? ""} ${digest.stats[0]?.label ?? ""}`.trim(),
      badge: { label: isWeekly ? "Weekly report" : "Daily summary", severity: "info" },
      bodyHtml,
      cta: { href: ctaHref, label: "Open dashboard" },
      appUrl: ctx.appUrl,
      unsubscribeToken: ctx.unsubscribeToken,
      year: new Date().getUTCFullYear(),
    }),
    text: textBody({
      title: `${title} — ${periodLabel}`,
      body: [
        digest.greeting + ",",
        "",
        ...digest.highlights.map((h) => `✔ ${h.text}`),
        "",
        ...digest.stats.map((s) => `${s.label}: ${s.value}${s.delta ? ` (${s.delta})` : ""}`),
        digest.notificationCount ? `\n${digest.notificationCount} notifications this period.` : "",
      ].filter(Boolean).join("\n"),
      link: ctaHref,
      linkLabel: "Open dashboard",
    }),
  };
}

/** Render a 7-day executions sparkline as inline SVG (no external assets). */
function renderSparkline(chart: { date: string; executions: number; success: number; failures: number }[]): string {
  const w = 460;
  const h = 90;
  const pad = 8;
  const max = Math.max(1, ...chart.map((c) => c.executions));
  const step = (w - pad * 2) / Math.max(1, chart.length - 1);
  const pts = chart.map((c, i) => {
    const x = pad + i * step;
    const y = h - pad - (c.executions / max) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `M${pts[0]} L${pts.join(" L")} L${(pad + (chart.length - 1) * step).toFixed(1)},${h - pad} L${pad},${h - pad} Z`;
  return `
  <div style="margin:18px 0 6px;">
    <p style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:600;color:${"#0f1020"};margin:0 0 8px;">Executions · last 7 days</p>
    <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;max-width:100%;border-radius:10px;background:${"#f6f7fb"};border:1px solid ${"#e7e8ef"};">
      <defs><linearGradient id="af-spark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c5cff" stop-opacity="0.35"/><stop offset="1" stop-color="#7c5cff" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#af-spark)" stroke="none"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="#7c5cff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${chart.map((c, i) => `<circle cx="${(pad + i * step).toFixed(1)}" cy="${(h - pad - (c.executions / max) * (h - pad * 2)).toFixed(1)}" r="2.5" fill="#22d3ee"/>`).join("")}
    </svg>
  </div>`;
}

function toneColor(tone: "info" | "success" | "warning" | "error"): string {
  return tone === "success" ? "#16a34a" : tone === "warning" ? "#d97706" : tone === "error" ? "#dc2626" : "#2563eb";
}

export { renderDigest as render };