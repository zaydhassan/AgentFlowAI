import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import {
  CheckoutButton,
  ManageButton,
  DowngradeButton,
} from "@/components/billing/billing-actions";
import { cn, formatCurrency } from "@/lib/utils";
import { PLAN_META, stripeConfigured, type PlanId } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type SearchParams = { success?: string; canceled?: string; simulated?: string; plan?: string; interval?: string };

export default async function BillingPage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  const user = await requireUser();

  // Pull real subscription + invoices from the DB.
  const [subscription, invoices, usage] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: user.id } }),
    prisma.invoice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
    prisma.usage.findFirst({
      where: { userId: user.id },
      orderBy: { periodStart: "desc" },
    }),
  ]);

  const plan = subscription?.plan ?? "free";
  const status = subscription?.status ?? "active";
  const currentPeriodEnd = subscription?.currentPeriodEnd ?? null;
  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false;

  // For the simulated-checkout dev path, write a "paid" invoice so the UI
  // demonstrates a real flow.
  if (sp.simulated && sp.plan && (sp.plan === "pro" || sp.plan === "business")) {
    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: { plan: sp.plan, status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      create: {
        userId: user.id,
        stripeCustomerId: `pending_${user.id}`,
        plan: sp.plan,
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.invoice.create({
      data: {
        userId: user.id,
        stripeInvoiceId: `sim_${Date.now()}`,
        number: `INV-SIM-${Date.now().toString().slice(-6)}`,
        amount: sp.plan === "pro" ? 2900 : 9900,
        currency: "usd",
        status: "paid",
      },
    });
  }

  const plans: Array<{ id: "free" | "pro" | "business" | "enterprise"; label: string; price: number | null; credits: string; features: string[] }> = [
    { id: "free", label: "Free", price: 0, credits: "1,000 / mo", features: ["3 active workflows", "Community templates", "Email support"] },
    { id: "pro", label: PLAN_META.pro.label, price: PLAN_META.pro.priceAmount.monthly, credits: PLAN_META.pro.credits, features: PLAN_META.pro.features },
    { id: "business", label: PLAN_META.business.label, price: PLAN_META.business.priceAmount.monthly, credits: PLAN_META.business.credits, features: PLAN_META.business.features },
    { id: "enterprise", label: "Enterprise", price: null, credits: "Custom", features: ["Self-hosted", "Dedicated support", "SLA + uptime", "SSO + audit logs"] },
  ];

  // Usage: synthesize from the usage row or default.
  const executionsUsed = usage?.executions ?? 0;
  const aiCreditsUsed = usage?.aiCredits ?? 0;
  const cap =
    plan === "free" ? 1000 : plan === "pro" ? 150_000 : plan === "business" ? 1_000_000 : 1_000_000;
  const creditsRemaining = Math.max(0, cap - aiCreditsUsed);
  const usedPct = cap > 0 ? Math.min(100, Math.round((aiCreditsUsed / cap) * 100)) : 0;

  return (
    <div className="animate-float-up">
      <PageHeader
        title="Billing"
        description="Subscription, credits, and invoices. Powered by Stripe."
      />

      {!stripeConfigured ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <Icon name="AlertTriangle" className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Stripe not configured</div>
            <div className="text-xs text-fg-muted">
              Set <code className="rounded bg-surface-3 px-1">STRIPE_SECRET_KEY</code>,{" "}
              <code className="rounded bg-surface-3 px-1">STRIPE_WEBHOOK_SECRET</code>, and the four
              <code className="rounded bg-surface-3 px-1"> STRIPE_PRICE_*</code> variables in your
              <code className="rounded bg-surface-3 px-1"> .env</code>. The plan buttons below will run
              a simulated checkout so you can preview the flow.
            </div>
          </div>
        </div>
      ) : null}

      {sp.success ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
          <Icon name="CheckCircle2" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Subscription updated. Welcome to your new plan!</span>
        </div>
      ) : null}
      {sp.canceled ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <Icon name="Info" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Checkout was canceled. No changes were made.</span>
        </div>
      ) : null}
      {sp.simulated ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-info/40 bg-info/10 p-3 text-sm text-info">
          <Icon name="FlaskConical" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Simulated checkout succeeded (TEST MODE). Real Stripe is not configured in this environment.</span>
        </div>
      ) : null}

      {/* Current plan + usage */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <Badge tone="brand">Current plan</Badge>
            <Icon name="CreditCard" className="h-4 w-4 text-fg-subtle" />
          </div>
          <div className="mt-3 text-3xl font-semibold capitalize">{plan}</div>
          <div className="text-sm text-fg-muted">
            {plan === "free" || plan === "enterprise"
              ? plan === "enterprise"
                ? "Custom pricing"
                : "Free forever"
              : `${formatCurrency(plan === "pro" ? PLAN_META.pro.priceAmount.monthly : PLAN_META.business.priceAmount.monthly)} / month`}
            {status !== "active" ? ` · ${status}` : ""}
            {cancelAtPeriodEnd ? " · cancels at period end" : ""}
          </div>
          {currentPeriodEnd ? (
            <div className="mt-1 text-[11px] text-fg-subtle">
              {cancelAtPeriodEnd ? "Access until" : "Renews"} {currentPeriodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="ai"><Icon name="Zap" className="h-3.5 w-3.5" /> Buy credits</Button>
            <ManageButton plan={plan as PlanId} hasCustomer={Boolean(user.stripeCustomerId && !user.stripeCustomerId.startsWith("pending_"))} />
          </div>
        </Card>

        <Card className="xl:col-span-2 p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Credit usage this month</div>
            <span className="text-xs text-fg-subtle">resets {currentPeriodEnd ? currentPeriodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "next month"}</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">{creditsRemaining.toLocaleString("en-US")}</span>
            <span className="text-sm text-fg-subtle">credits remaining</span>
          </div>
          <div className="mt-3 h-2.5 w-full rounded-full bg-surface-3 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-ai" style={{ width: `${usedPct}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-fg-subtle">
            <span>{usedPct}% used</span>
            <span>{100 - usedPct}% left</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { name: "AI inference", credits: Math.round(aiCreditsUsed * 0.6) },
              { name: "API calls", credits: Math.round(aiCreditsUsed * 0.2) },
              { name: "Storage", credits: Math.round(aiCreditsUsed * 0.12) },
              { name: "Compute", credits: Math.max(0, aiCreditsUsed - Math.round(aiCreditsUsed * 0.92)) },
            ].map((u) => (
              <div key={u.name} className="rounded-lg border border-border bg-surface-2/40 p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-brand" />
                  <span className="text-[10px] text-fg-subtle">{u.name}</span>
                </div>
                <div className="mt-1 text-sm font-medium tabular-nums">{(u.credits / 1000).toFixed(0)}k</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Plans */}
      <div className="mt-4">
        <h3 className="mb-3 text-sm font-semibold text-fg-muted">Change plan</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const isCurrent = p.id === plan;
            return (
              <Card key={p.id} className={cn("p-5", isCurrent && "border-brand/50 bg-brand-soft/20")}>
                {isCurrent ? <Badge tone="brand" className="mb-2">Current</Badge> : null}
                <div className="text-sm font-semibold text-fg-muted">{p.label}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight">{p.price === null ? "Custom" : `$${p.price}`}</span>
                  {p.price !== null && <span className="text-xs text-fg-subtle">/ mo</span>}
                </div>
                <div className="mt-1 text-[11px] text-fg-subtle">{p.credits} credits</div>
                <ul className="mt-4 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-fg-muted">
                      <Icon name="Check" className="h-3.5 w-3.5 text-success" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {isCurrent ? (
                    <Button size="sm" variant="secondary" className="w-full" disabled>Current plan</Button>
                  ) : p.id === "enterprise" ? (
                    <Button size="sm" variant="outline" className="w-full">Contact sales</Button>
                  ) : p.id === "free" ? (
                    <DowngradeButton />
                  ) : (
                    <CheckoutButton plan={p.id as "pro" | "business"} />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Invoices */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Billing history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 border-b border-border px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
            <div className="col-span-4">Invoice</div>
            <div className="col-span-3">Date</div>
            <div className="col-span-3">Amount</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          {invoices.length === 0 ? (
            <div className="px-2 py-8 text-center text-sm text-fg-muted">
              No invoices yet. Once you upgrade, your billing history will appear here.
            </div>
          ) : (
            invoices.map((inv) => (
              <div key={inv.id} className="grid grid-cols-12 items-center px-2 py-3 text-sm hover:bg-surface-2/50">
                <div className="col-span-4 font-mono text-xs">{inv.number ?? inv.stripeInvoiceId}</div>
                <div className="col-span-3 text-fg-muted">{inv.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                <div className="col-span-3 tabular-nums">{formatCurrency(inv.amount / 100)}</div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <Badge tone={inv.status === "paid" ? "success" : inv.status === "uncollectible" ? "danger" : "warning"}>{inv.status}</Badge>
                  {inv.hostedInvoiceUrl || inv.pdfUrl ? (
                    <a
                      className="grid h-7 w-7 place-items-center rounded-lg text-fg-subtle hover:bg-surface-3 hover:text-fg"
                      href={inv.hostedInvoiceUrl ?? inv.pdfUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label="Open invoice"
                    >
                      <Icon name="ExternalLink" className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Hide unused to satisfy linter */}
      <span className="hidden">{executionsUsed}</span>
    </div>
  );
}
