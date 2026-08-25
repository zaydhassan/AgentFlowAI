/** Brand palette — matches the app gradient (brand → ai). */
export const PALETTE = {
  brand: "#7c5cff",
  brandEnd: "#22d3ee",
  bg: "#0b0b14",
  surface: "#14141f",
  surface2: "#1b1b29",
  border: "#232336",
  fg: "#e6e6f0",
  muted: "#a3a3b8",
  subtle: "#6b6b80",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  // Light-mode overrides (used when the client does NOT prefer dark). Most
  // modern clients default to light, so the light theme is the base and dark is
  // the override — the inverse of the app shell, but correct for email.
  lightBg: "#f6f7fb",
  lightSurface: "#ffffff",
  lightBorder: "#e7e8ef",
  lightFg: "#0f1020",
  lightMuted: "#5b5c70",
} as const;

const SEVERITY_ACCENT: Record<string, string> = {
  success: PALETTE.success,
  warning: PALETTE.warning,
  error: PALETTE.danger,
  info: PALETTE.info,
};

/** The compact AgentFlow Flow-Loop mark as an inline SVG (white on gradient). */
export function logoTile(size = 40): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td style="width:${size}px;height:${size}px;border-radius:10px;background:linear-gradient(135deg,${PALETTE.brand}, ${PALETTE.brandEnd});text-align:center;vertical-align:middle;">
        <svg width="${Math.round(size * 0.55)}" height="${Math.round(size * 0.55)}" viewBox="0 0 64 64" fill="none" style="display:inline-block;vertical-align:middle;">
          <path d="M24 30 L40 30 C40 22 37 15 32 13 C27 15 24 22 24 30 C19 36 12 43 12 53 C19 62 45 62 52 53 C52 43 45 36 40 30 L24 30 Z" stroke="#ffffff" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </td>
      <td style="padding-left:10px;vertical-align:middle;">
        <span style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:700;color:${PALETTE.lightFg};letter-spacing:-0.01em;">AgentFlow<span style="color:${PALETTE.brand};"> AI</span></span>
      </td>
    </tr>
  </table>`;
}

/** Escape text for safe HTML insertion. */
export function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A status badge — colored dot + label. */
export function badge(label: string, severity: "info" | "success" | "warning" | "error"): string {
  const color = SEVERITY_ACCENT[severity] ?? PALETTE.info;
  return `
  <span style="display:inline-block;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;color:${color};background:${color}1a;border:1px solid ${color}40;border-radius:999px;padding:3px 10px;">
    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle;"></span>${esc(label)}
  </span>`;
}

/** A primary CTA button (gradient) with a fallback link underneath. */
export function button(href: string, label: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:20px 0 8px;">
    <tr>
      <td style="border-radius:10px;background:linear-gradient(90deg,${PALETTE.brand}, ${PALETTE.brandEnd});">
        <a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(label)}</a>
      </td>
    </tr>
  </table>`;
}

/** A secondary text link. */
export function link(href: string, label: string): string {
  return `<a href="${esc(href)}" style="color:${PALETTE.brand};font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:13px;text-decoration:none;">${esc(label)}</a>`;
}

/** A horizontal divider. */
export function divider(): string {
  return `<div style="height:1px;background:${PALETTE.lightBorder};margin:22px 0;"></div>`;
}

/** A small key/value row (used in billing/security emails). */
export function row(label: string, value: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:6px 0;">
    <tr>
      <td style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:13px;color:${PALETTE.lightMuted};padding:4px 0;width:45%;">${esc(label)}</td>
      <td style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:13px;color:${PALETTE.lightFg};font-weight:600;text-align:right;padding:4px 0;">${esc(value)}</td>
    </tr>
  </table>`;
}

/** A stat tile for digests (label on top, big value below). */
export function statTile(label: string, value: string, delta?: string): string {
  const deltaColor = delta?.startsWith("-") ? PALETTE.danger : PALETTE.success;
  return `
  <td style="width:33.33%;padding:6px 4px;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:${PALETTE.lightBg};border:1px solid ${PALETTE.lightBorder};border-radius:12px;padding:14px;">
      <tr><td style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:11px;color:${PALETTE.lightMuted};text-transform:uppercase;letter-spacing:0.04em;">${esc(label)}</td></tr>
      <tr><td style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:22px;font-weight:700;color:${PALETTE.lightFg};letter-spacing:-0.02em;padding-top:4px;">${esc(value)}${delta ? `<span style="font-size:12px;font-weight:600;color:${deltaColor};margin-left:6px;">${esc(delta)}</span>` : ""}</td></tr>
    </table>
  </td>`;
}

/** A checkmark line for digest highlights. */
export function checkLine(text: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0;">
    <tr>
      <td style="width:22px;vertical-align:top;">
        <span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${PALETTE.success}1a;color:${PALETTE.success};text-align:center;line-height:18px;font-size:11px;font-weight:700;">✓</span>
      </td>
      <td style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:14px;color:${PALETTE.lightFg};line-height:1.5;">${text}</td>
    </tr>
  </table>`;
}

/** A plain-text line for the text fallback (no HTML). */
export function textLine(s: string): string {
  return s;
}

/** Subject line prefix for consistent inbox recognition. */
export const SUBJECT_PREFIX = "AgentFlow";

/**
 * The full email document. Wraps a body with the logo header, accent badge, the
 * body content, optional CTA, and a footer with unsubscribe + preferences links.
 * `accent` drives the top border + badge color.
 */
export function emailLayout(args: {
  preheader: string;
  badge?: { label: string; severity: "info" | "success" | "warning" | "error" };
  bodyHtml: string;
  cta?: { href: string; label: string };
  appUrl: string;
  unsubscribeToken?: string;
  year: number;
}): string {
  const accent = args.badge ? SEVERITY_ACCENT[args.badge.severity] : PALETTE.brand;
  const prefsHref = args.unsubscribeToken
    ? `${args.appUrl}/notifications/preferences?token=${encodeURIComponent(args.unsubscribeToken)}`
    : `${args.appUrl}/settings/notifications`;
  const unsubHref = `${args.appUrl}/api/notifications/unsubscribe?token=${encodeURIComponent(args.unsubscribeToken ?? "")}`;
  const ctaHtml = args.cta ? button(args.cta.href, args.cta.label) : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
  <title>${esc(args.preheader)}</title>
  <style>
    /* Client reset + dark-mode overrides. Base = light; dark via media query. */
    body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; }
    table { border-collapse:collapse !important; }
    img { border:0; line-height:100%; outline:none; text-decoration:none; }
    a { text-decoration:none; }
    .af-card { background:${PALETTE.lightSurface}; border:1px solid ${PALETTE.lightBorder}; }
    .af-fg { color:${PALETTE.lightFg}; }
    .af-muted { color:${PALETTE.lightMuted}; }
    .af-border { background:${PALETTE.lightBorder}; }
    .af-soft { background:${PALETTE.lightBg}; }
    .af-wordmark { color:${PALETTE.lightFg}; }
    @media (prefers-color-scheme: dark) {
      .af-shell { background:${PALETTE.bg} !important; }
      .af-card { background:${PALETTE.surface} !important; border-color:${PALETTE.border} !important; }
      .af-fg { color:${PALETTE.fg} !important; }
      .af-muted { color:${PALETTE.muted} !important; }
      .af-border { background:${PALETTE.border} !important; }
      .af-soft { background:${PALETTE.surface2} !important; }
      .af-wordmark { color:${PALETTE.fg} !important; }
      .af-row td { color:${PALETTE.muted} !important; }
      .af-row-val td { color:${PALETTE.fg} !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${PALETTE.lightBg};">
  <!-- preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PALETTE.lightBg};">${esc(args.preheader)}</div>

  <table role="presentation" class="af-shell" width="100%" cellpadding="0" cellspacing="0" style="background:${PALETTE.lightBg};padding:28px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" class="af-card" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:${PALETTE.lightSurface};border:1px solid ${PALETTE.lightBorder};border-radius:16px;">
          <!-- accent bar -->
          <tr><td style="height:4px;background:linear-gradient(90deg,${accent}, ${PALETTE.brandEnd});border-radius:16px 16px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              ${logoTile(40)}
            </td>
          </tr>
          ${args.badge ? `<tr><td style="padding:6px 32px 0;">${args.badge.label ? badge(args.badge.label, args.badge.severity) : ""}</td></tr>` : ""}
          <tr>
            <td class="af-fg" style="padding:18px 32px 8px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:${PALETTE.lightFg};line-height:1.55;font-size:14px;">
              ${args.bodyHtml}
              ${ctaHtml}
            </td>
          </tr>
          <!-- footer -->
          <tr><td><div class="af-border" style="height:1px;background:${PALETTE.lightBorder};margin:24px 32px 0;"></div></td></tr>
          <tr>
            <td class="af-muted" style="padding:16px 32px 28px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:${PALETTE.lightMuted};font-size:12px;line-height:1.6;">
              You received this email because of your AgentFlow notification settings.<br>
              ${link(prefsHref, "Notification preferences")} &nbsp;·&nbsp; ${link(unsubHref, "Unsubscribe")}<br>
              <span style="color:${PALETTE.subtle};">© ${args.year} AgentFlow AI · The AI-Native Automation Platform</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Build a plain-text fallback from a title, body, and optional link. */
export function textBody(args: {
  title: string;
  body: string;
  link?: string;
  linkLabel?: string;
  appUrl: string;
}): string {
  const parts = [args.title, "", args.body];
  if (args.link) parts.push("", `${args.linkLabel ?? "Open"}: ${args.link}`);
  parts.push("", "— AgentFlow AI", `Manage notifications: ${args.appUrl}/settings/notifications`);
  return parts.join("\n");
}