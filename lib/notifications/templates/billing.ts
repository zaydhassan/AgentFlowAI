// =============================================================================
// Billing email templates — events: billing.{payment_successful,payment_failed,
// credits_below_threshold,subscription_renewed,trial_ending}. Lazy-loaded by
// the template registry in ./index.ts.

import {
  badge, divider, emailLayout, esc, row, textBody, SUBJECT_PREFIX,
} from "./components";
import type { NotificationEventKey, RenderedTemplate, TemplateContext } from "@/lib/notifications/types";

type BillingEvent = Extract<NotificationEventKey, `billing.${string}`>;

export function renderBilling(ctx: TemplateContext): RenderedTemplate {
  const d = ctx.payload.data ?? {};
  const amount = d.amount != null ? Number(d.amount) : null;
  const currency = String(d.currency ?? "usd").toUpperCase();
  const plan = String(d.plan ?? "");
  const link = ctx.payload.link ?? `${ctx.appUrl}/settings/billing`;

  switch (ctx.event as BillingEvent) {
    case "billing.payment_successful": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">Your payment of <strong>${fmtMoney(amount, currency)}</strong> for the <strong>${esc(plan)}</strong> plan was successful. A receipt has been attached to your account.</p>
        ${badge("Paid", "success")}
        ${divider()}
        ${row("Amount", fmtMoney(amount, currency))}
        ${plan ? row("Plan", plan) : ""}
        ${d.invoiceUrl ? row("Receipt", String(d.invoiceUrl)) : ""}`;
      return finish(ctx, "Payment successful", body, "View billing", link);
    }
    case "billing.payment_failed": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">We couldn't process your payment of <strong>${fmtMoney(amount, currency)}</strong> for the <strong>${esc(plan)}</strong> plan. Please update your payment method to keep your subscription active.</p>
        ${badge("Failed", "error")}
        ${divider()}
        ${row("Amount", fmtMoney(amount, currency))}
        ${plan ? row("Plan", plan) : ""}
        ${d.reason ? row("Reason", String(d.reason)) : ""}`;
      return finish(ctx, "Payment failed", body, "Update payment method", link);
    }
    case "billing.credits_below_threshold": {
      const remaining = d.remaining != null ? Number(d.remaining) : null;
      const threshold = d.threshold != null ? Number(d.threshold) : null;
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">Your AI credits are running low${remaining != null ? ` — <strong>${remaining.toLocaleString()} remaining</strong>` : ""}. Top up to avoid interrupted runs.</p>
        ${badge("Low credits", "warning")}
        ${divider()}
        ${remaining != null ? row("Credits remaining", remaining.toLocaleString()) : ""}
        ${threshold != null ? row("Alert threshold", threshold.toLocaleString()) : ""}`;
      return finish(ctx, "Credits running low", body, "Buy credits", link);
    }
    case "billing.subscription_renewed": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">Your <strong>${esc(plan)}</strong> subscription was renewed for the next billing cycle. Thanks for being with AgentFlow.</p>
        ${badge("Renewed", "info")}
        ${divider()}
        ${plan ? row("Plan", plan) : ""}
        ${d.periodEnd ? row("Next renewal", String(d.periodEnd)) : ""}`;
      return finish(ctx, "Subscription renewed", body, "Manage subscription", link);
    }
    case "billing.trial_ending": {
      const days = d.daysLeft != null ? Number(d.daysLeft) : null;
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">Your free trial${days != null ? ` ends in <strong>${days} day${days === 1 ? "" : "s"}</strong>` : " is ending soon"}. Add a payment method to keep your workspace running when it ends.</p>
        ${badge("Trial ending", "warning")}
        ${divider()}
        ${plan ? row("Trial plan", plan) : ""}
        ${d.endDate ? row("Trial ends", String(d.endDate)) : ""}`;
      return finish(ctx, "Trial ending soon", body, "Add payment method", link);
    }
    default:
      return finish(ctx, "Billing update", `<p style="margin:0;">A billing update for your account.</p>`, "View billing", link);
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
    text: textBody({ title, body, link: ctaHref, linkLabel: ctaLabel }),
  };
}

function firstName(ctx: TemplateContext): string {
  return ctx.user.name?.split(" ")[0] ?? "there";
}

function fmtMoney(amount: number | null, currency: string): string {
  if (amount == null) return "—";
  // amount is in the smallest currency unit (cents/paise) from the billing layer.
  const major = amount / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

export { renderBilling as render };