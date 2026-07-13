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
  CancelButton,
  PauseButton,
  ResumeButton,
} from "@/components/billing/billing-actions";
import { PaymentMethodCard, type PaymentMethodData } from "@/components/billing/payment-method-card";
import { cn, formatCurrency, formatMoney } from "@/lib/utils";
import {
  activeProviderId,
  chargeCurrency,
  getPaymentProvider,
  paymentConfigured,
  PLAN_META,
  type Interval,
  type PlanId,
} from "@/lib/payments";

export const dynamic = "force-dynamic";

type SearchParams = {
  success?: string;
  canceled?: string;
};

export default async function BillingPage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  const user = await requireUser();

  const providerId = activeProviderId();
  const provider = getPaymentProvider();
  const configured = paymentConfigured();
  const currency = chargeCurrency();

  const [subscription, invoices, usage, userRow] = await Promise.all([
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
    prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true, razorpayCustomerId: true },
    }),
  ]);

  const plan = (subscription?.plan ?? "free") as PlanId;
  const status = subscription?.status ?? "active";
  const currentPeriodStart = subscription?.currentPeriodStart ?? null;
  const currentPeriodEnd = subscription?.currentPeriodEnd ?? null;
  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false;
  const paused = subscription?.paused ?? false;
  const interval = (subscription?.interval ?? "monthly") as Interval;

  const customerId = providerId === "razorpay" ? userRow?.razorpayCustomerId : userRow?.stripeCustomerId;
  const hasCustomer = Boolean(customerId && !customerId.startsWith("pending_"));
  const providerSubId =
    providerId === "razorpay" ? subscription?.razorpaySubscriptionId : subscription?.stripeSubscriptionId;

  // Live payment method from the provider (Stripe: customer's default card;
  // Razorpay: the card synced onto the Subscription row by the webhook), falling
  // back to the denormalized card fields.
  let paymentMethod: PaymentMethodData | null = null;
  if (configured) {
    try {
      paymentMethod = await provider.getPaymentMethod(user.id);
    } catch {
      paymentMethod = null;
    }
  }
  if (!paymentMethod?.last4 && subscription?.cardLast4) {
    paymentMethod = {
      brand: subscription.cardBrand,
      last4: subscription.cardLast4,
      expMonth: subscription.cardExpMonth,
      expYear: subscription.cardExpYear,
      country: null,
      address: null,
    };
  }

  // Plans table — Free/Pro/Business/Enterprise. Pro & Business pricing comes
  // from the shared PLAN_META so the cards and the provider plans stay in
  // sync. Enterprise is contact-sales (no self-serve checkout).
  const plans: Array<{
    id: "free" | "pro" | "business" | "enterprise";
    label: string;
    price: number | null;
    credits: string;
    features: string[];
  }> = [
    { id: "free", label: "Free", price: 0, credits: "1,000 / mo", features: ["3 active workflows", "Community templates", "Email support"] },
    { id: "pro", label: PLAN_META.pro.label, price: PLAN_META.pro.priceAmount.monthly, credits: PLAN_META.pro.credits, features: PLAN_META.pro.features },
    { id: "business", label: PLAN_META.business.label, price: PLAN_META.business.priceAmount.monthly, credits: PLAN_META.business.credits, features: PLAN_META.business.features },
    { id: "enterprise", label: "Enterprise", price: null, credits: "Custom", features: ["Self-hosted", "Dedicated support", "SLA + uptime", "SSO + audit logs"] },
  ];

  // Real usage counters (model is the source of truth; pipeline wiring TBD).
  const executions = usage?.executions ?? 0;
  const aiCreditsUsed = usage?.aiCredits ?? 0;
  const apiCalls = usage?.apiCalls ?? 0;
  const storage = usage?.storage ?? 0;
  const tokenUsage = usage?.tokenUsage ?? 0;
  const compute = usage?.compute ?? 0;

  const cap =
    plan === "free" ? 1000 : plan === "pro" ? 150_000 : plan === "business" ? 1_000_000 : 1_000_000;
  const creditsRemaining = Math.max(0, cap - aiCreditsUsed);
  const usedPct = cap > 0 ? Math.min(100, Math.round((aiCreditsUsed / cap) * 100)) : 0;

  // Monthly spend: sum of paid invoices in the current billing period.
  const periodStart = currentPeriodStart ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthlySpend = invoices
    .filter((inv) => inv.status === "paid" && inv.createdAt >= periodStart)
    .reduce((sum, inv) => sum + inv.amount, 0);

  const currentPrice =
    plan === "pro" || plan === "business"
      ? PLAN_META[plan].priceAmount[interval]
      : plan === "free"
        ? 0
        : null;

  const usageBreakdown = [
    { name: "AI credits", value: aiCreditsUsed, fmt: (n: number) => n.toLocaleString("en-US") },
    { name: "Workflow executions", value: executions, fmt: (n: number) => n.toLocaleString("en-US") },
    { name: "API calls", value: apiCalls, fmt: (n: number) => n.toLocaleString("en-US") },
    { name: "Token usage", value: tokenUsage, fmt: (n: number) => n.toLocaleString("en-US") },
    { name: "Storage", value: storage, fmt: (n: number) => `${(n / 1024).toFixed(1)} MB` },
    { name: "Compute", value: compute, fmt: (n: number) => `${(n / 1000).toFixed(1)}s` },
  ];

  const providerLabel = providerId === "razorpay" ? "Razorpay" : "Stripe";

  return (
    <div className="animate-float-up">
      <PageHeader
        title="Billing"
        description={`Subscription, credits, and invoices. Powered by ${providerLabel}.`}
      />

      {!configured ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <Icon name="AlertTriangle" className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">{providerLabel} is not configured</div>
            <div className="text-xs text-fg-muted">
              {providerId === "razorpay" ? (
                <>
                  Set <code className="rounded bg-surface-3 px-1">RAZORPAY_KEY_ID</code>,{" "}
                  <code className="rounded bg-surface-3 px-1">RAZORPAY_KEY_SECRET</code>,{" "}
                  <code className="rounded bg-surface-3 px-1">RAZORPAY_WEBHOOK_SECRET</code>,{" "}
                  <code className="rounded bg-surface-3 px-1">NEXT_PUBLIC_RAZORPAY_KEY_ID</code>, and{" "}
                  <code className="rounded bg-surface-3 px-1">PAYMENT_PROVIDER=razorpay</code> in your{" "}
                  <code className="rounded bg-surface-3 px-1">.env</code>. Until then, checkout returns a
                  not-configured error — no payments are processed.
                </>
              ) : (
                <>
                  Set <code className="rounded bg-surface-3 px-1">STRIPE_SECRET_KEY</code>,{" "}
                  <code className="rounded bg-surface-3 px-1">STRIPE_WEBHOOK_SECRET</code>, and{" "}
                  <code className="rounded bg-surface-3 px-1">PAYMENT_PROVIDER=stripe</code> in your{" "}
                  <code className="rounded bg-surface-3 px-1">.env</code>. Until then, checkout returns a
                  not-configured error — no payments are processed.
                </>
              )}
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
              : `${formatCurrency(currentPrice ?? 0)} / ${interval === "yearly" ? "mo · billed yearly" : "mo"}`}
            {status !== "active" && status !== "free" ? ` · ${status}` : ""}
            {cancelAtPeriodEnd ? " · cancels at period end" : ""}
            {paused ? " · paused" : ""}
          </div>
          {currentPeriodEnd ? (
            <div className="mt-1 text-[11px] text-fg-subtle">
              {cancelAtPeriodEnd ? "Access until" : "Renews"}{" "}
              {currentPeriodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {/* Razorpay has no hosted portal; management is via the buttons below. */}
            {providerId === "stripe" ? <ManageButton plan={plan as PlanId} hasCustomer={hasCustomer} /> : null}
            {plan !== "free" && providerSubId ? (
              cancelAtPeriodEnd ? (
                <span className="text-xs text-fg-muted">
                  Cancels on{" "}
                  {currentPeriodEnd
                    ? currentPeriodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "period end"}
                </span>
              ) : paused ? (
                <ResumeButton />
              ) : (
                <>
                  <CancelButton />
                  <PauseButton />
                </>
              )
            ) : null}
          </div>
        </Card>

        <Card className="xl:col-span-2 p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Credit usage this month</div>
            <span className="text-xs text-fg-subtle">
              resets {currentPeriodEnd ? currentPeriodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "next month"}
            </span>
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
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {usageBreakdown.map((u) => (
              <div key={u.name} className="rounded-lg border border-border bg-surface-2/40 p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-brand" />
                  <span className="text-[10px] text-fg-subtle">{u.name}</span>
                </div>
                <div className="mt-1 text-sm font-medium tabular-nums">{u.fmt(u.value)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Payment method + spend */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PaymentMethodCard method={paymentMethod} />
        </div>
        <Card className="p-5">
          <div className="text-sm font-semibold">This billing cycle</div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-semibold tabular-nums">{formatMoney(monthlySpend, currency)}</span>
            <span className="text-xs text-fg-subtle">spent</span>
          </div>
          <div className="mt-2 text-[11px] text-fg-subtle">
            {currentPeriodStart
              ? `Since ${currentPeriodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : "Current period"}
            {currentPeriodEnd ? ` · ends ${currentPeriodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
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
                    <a href="/contact" className="block">
                      <Button size="sm" variant="outline" className="w-full">Contact sales</Button>
                    </a>
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
          <CardDescription>Billing history · download PDFs</CardDescription>
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
                <div className="col-span-4 font-mono text-xs">{inv.number ?? inv.razorpayInvoiceId ?? inv.stripeInvoiceId}</div>
                <div className="col-span-3 text-fg-muted">{inv.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                <div className="col-span-3 tabular-nums">{formatMoney(inv.amount, inv.currency)}</div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <Badge tone={inv.status === "paid" ? "success" : inv.status === "uncollectible" ? "danger" : "warning"}>{inv.status}</Badge>
                  {inv.pdfUrl ? (
                    <a
                      className="grid h-7 w-7 place-items-center rounded-lg text-fg-subtle hover:bg-surface-3 hover:text-fg"
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label="Download invoice PDF"
                      title="Download PDF"
                    >
                      <Icon name="Download" className="h-3.5 w-3.5" />
                    </a>
                  ) : inv.hostedInvoiceUrl ? (
                    <a
                      className="grid h-7 w-7 place-items-center rounded-lg text-fg-subtle hover:bg-surface-3 hover:text-fg"
                      href={inv.hostedInvoiceUrl}
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
    </div>
  );
}