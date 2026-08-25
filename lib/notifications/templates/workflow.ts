import {
  badge, divider, emailLayout, esc, row, textBody, SUBJECT_PREFIX,
} from "./components";
import type { NotificationEventKey, RenderedTemplate, TemplateContext } from "@/lib/notifications/types";

type WorkflowEvent = Extract<NotificationEventKey, `workflow.${string}`>;

export function renderWorkflow(ctx: TemplateContext): RenderedTemplate {
  const d = ctx.payload.data ?? {};
  const workflowName = esc(String(d.workflowName ?? "your workflow"));
  const executionId = String(d.executionId ?? "");
  const durationMs = Number(d.durationMs ?? 0);
  const tokens = Number(d.tokens ?? 0);
  const cost = Number(d.cost ?? 0);
  const error = d.error ? String(d.error) : null;
  const runLink = ctx.payload.link ?? (d.workflowId ? `${ctx.appUrl}/workflows/${d.workflowId}` : ctx.appUrl);

  const duration = durationMs > 0 ? formatDuration(durationMs) : null;

  switch (ctx.event as WorkflowEvent) {
    case "workflow.completed": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">Your workflow <strong>${workflowName}</strong> finished successfully${duration ? ` in ${duration}` : ""}.</p>
        ${badge("Completed", "success")}
        ${divider()}
        ${row("Workflow", String(d.workflowName ?? "—"))}
        ${executionId ? row("Execution", executionId) : ""}
        ${duration ? row("Duration", duration) : ""}
        ${tokens ? row("Tokens", tokens.toLocaleString()) : ""}
        ${cost ? row("Cost", `$${cost.toFixed(4)}`) : ""}`;
      return finish(ctx, "Workflow completed", body, "View run", runLink);
    }
    case "workflow.failed": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">Your workflow <strong>${workflowName}</strong> failed to complete.</p>
        ${badge("Failed", "error")}
        ${divider()}
        ${row("Workflow", String(d.workflowName ?? "—"))}
        ${executionId ? row("Execution", executionId) : ""}
        ${error ? `<p style="margin:12px 0 0;font-size:13px;color:${"#ef4444"};background:${"#ef44441a"};border:1px solid ${"#ef444440"};border-radius:10px;padding:10px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${esc(error)}</p>` : ""}`;
      return finish(ctx, "Workflow failed", body, "View run", runLink);
    }
    case "workflow.cancelled": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">Your workflow <strong>${workflowName}</strong> was cancelled.</p>
        ${badge("Cancelled", "warning")}
        ${divider()}
        ${row("Workflow", String(d.workflowName ?? "—"))}
        ${executionId ? row("Execution", executionId) : ""}`;
      return finish(ctx, "Workflow cancelled", body, "View workflow", runLink);
    }
    case "workflow.paused": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">Your workflow <strong>${workflowName}</strong> paused at a breakpoint and is waiting for you to resume.</p>
        ${badge("Paused", "info")}
        ${divider()}
        ${row("Workflow", String(d.workflowName ?? "—"))}
        ${executionId ? row("Execution", executionId) : ""}`;
      return finish(ctx, "Workflow paused", body, "Resume run", runLink);
    }
    case "workflow.resumed": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">Your workflow <strong>${workflowName}</strong> was resumed and is continuing.</p>
        ${badge("Resumed", "info")}
        ${divider()}
        ${row("Workflow", String(d.workflowName ?? "—"))}
        ${executionId ? row("Execution", executionId) : ""}`;
      return finish(ctx, "Workflow resumed", body, "View run", runLink);
    }
    case "workflow.retried": {
      const body = `
        <p style="margin:0 0 14px;">Hi ${esc(firstName(ctx))},</p>
        <p style="margin:0 0 14px;">A failed run of <strong>${workflowName}</strong> was retried${d.attempt ? ` (attempt ${d.attempt})` : ""}.</p>
        ${badge("Retried", "warning")}
        ${divider()}
        ${row("Workflow", String(d.workflowName ?? "—"))}
        ${executionId ? row("Execution", executionId) : ""}`;
      return finish(ctx, "Workflow retried", body, "View run", runLink);
    }
    default: {
      return finish(ctx, "Workflow update", `<p style="margin:0;">An update on <strong>${workflowName}</strong>.</p>`, "View workflow", runLink);
    }
  }
}

function finish(
  ctx: TemplateContext,
  title: string,
  bodyHtml: string,
  ctaLabel: string,
  ctaHref: string,
): RenderedTemplate {
  const body = ctx.payload.body ?? title;
  return {
    subject: `${SUBJECT_PREFIX} · ${title}: ${ctx.payload.data?.workflowName ?? ""}`.trim(),
    html: emailLayout({
      preheader: `${title} — ${ctx.payload.data?.workflowName ?? "your workflow"}`,
      badge: { label: title.replace("Workflow ", ""), severity: ctx.payload.severity ?? "info" },
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s % 60);
  return `${m}m ${rs}s`;
}

// Re-export so the lazy registry can resolve the category module.
export { renderWorkflow as render };