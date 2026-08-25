"use server";

import { sendEmail } from "@/lib/resend";
import { site } from "@/lib/site";

export type ContactState = { ok?: true; error?: string } | null;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function submitContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (name.length < 2) return { error: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address." };
  if (message.length < 10) return { error: "Please enter a message of at least 10 characters." };

  const text = [
    `New contact form submission`,
    ``,
    `Name:    ${name}`,
    `Email:   ${email}`,
    `Company: ${company || "—"}`,
    ``,
    message,
  ].join("\n");

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;color:#0b0d14;max-width:560px">
      <h2 style="margin:0 0 16px;font-size:18px">New contact form submission</h2>
      <table style="font-size:14px;border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;color:#525a72">Name</td><td>${escapeHtml(name)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#525a72">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#525a72">Company</td><td>${escapeHtml(company) || "—"}</td></tr>
      </table>
      <hr style="margin:16px 0;border:none;border-top:1px solid #e7eaf2" />
      <pre style="white-space:pre-wrap;font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;margin:0">${escapeHtml(message)}</pre>
    </div>`;

  try {
    await sendEmail({ to: site.email, subject: `New contact form submission from ${name}`, html, text });
    return { ok: true };
  } catch {
    return {
      error: `Sorry, we couldn't send your message right now. Please email us directly at ${site.email}.`,
    };
  }
}