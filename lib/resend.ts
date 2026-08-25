import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Resend } from "resend";
import { requireEnv } from "@/lib/env";

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export function appUrl(path: string): string {
  const base = requireEnv("APP_URL", "http://localhost:3000");
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const from = requireEnv("RESEND_FROM", "AgentFlow AI <noreply@agentflow.ai>");
  if (resend) {
    const { error } = await resend.emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
    if (error) {
      throw new Error(`Resend send failed: ${error.message ?? "unknown error"}`);
    }
    return;
  }

  // Dev fallback: write to tmp/emails and log a clickable URL when the email
  // contains one. Does not block the request.
  const dir = join(process.cwd(), "tmp", "emails");
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const filename = `${Date.now()}-${payload.to.replace(/[^a-z0-9]/gi, "_")}.json`;
  await writeFile(
    join(dir, filename),
    JSON.stringify({ ...payload, from }, null, 2),
    "utf8",
  );
  // Surface the dev URL for verification/reset links (we tag them in the subject).
  const linkMatch = payload.html.match(/https?:\/\/[^"'\s<>]+/);
  // eslint-disable-next-line no-console
  console.log(
    `[email:dev] to=${payload.to} subject=${payload.subject}` +
      (linkMatch ? ` → ${linkMatch[0]}` : ""),
  );
}
