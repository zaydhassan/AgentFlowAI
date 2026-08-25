import { appUrl } from "@/lib/resend";

const STYLES = `
  body { margin: 0; background: #0b0b14; color: #e6e6f0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 32px 24px; }
  .card { background: #14141f; border: 1px solid #1f1f2e; border-radius: 16px; padding: 32px; }
  h1 { font-size: 22px; margin: 0 0 12px; letter-spacing: -0.01em; }
  p { color: #a3a3b8; line-height: 1.55; margin: 0 0 16px; font-size: 14px; }
  .btn { display: inline-block; background: linear-gradient(90deg,#7c5cff,#22d3ee); color: white; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: 600; font-size: 14px; }
  .muted { color: #6b6b80; font-size: 12px; }
  .footer { margin-top: 24px; }
  a { color: #7c5cff; }
`;

export function emailVerificationEmail(args: { name?: string | null; token: string }) {
  const link = appUrl(`/verify-email?token=${args.token}`);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${STYLES}</style></head>
<body><div class="wrap"><div class="card">
<h1>Welcome to AgentFlow${args.name ? `, ${escapeHtml(args.name)}` : ""}</h1>
<p>Confirm your email to unlock your workspace. This link expires in 24 hours.</p>
<p><a class="btn" href="${link}">Verify email</a></p>
<p class="muted">Or paste this link into your browser:<br><a href="${link}">${link}</a></p>
<div class="footer"><p class="muted">If you didn't sign up, you can ignore this email.</p></div>
</div></div></body></html>`;
  return {
    subject: "Verify your AgentFlow email",
    html,
    text: `Welcome to AgentFlow.\n\nVerify your email: ${link}\n\nThis link expires in 24 hours.`,
  };
}

export function passwordResetEmail(args: { name?: string | null; token: string }) {
  const link = appUrl(`/reset-password?token=${args.token}`);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${STYLES}</style></head>
<body><div class="wrap"><div class="card">
<h1>Reset your password</h1>
<p>Hi${args.name ? ` ${escapeHtml(args.name)}` : ""}, we received a request to reset your AgentFlow password. The link expires in 60 minutes.</p>
<p><a class="btn" href="${link}">Set a new password</a></p>
<p class="muted">Or paste this link into your browser:<br><a href="${link}">${link}</a></p>
<div class="footer"><p class="muted">If you didn't request this, you can safely ignore this email — your password won't change.</p></div>
</div></div></body></html>`;
  return {
    subject: "Reset your AgentFlow password",
    html,
    text: `Reset your AgentFlow password: ${link}\n\nThis link expires in 60 minutes.`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
