"use client";

// Displays the customer's default payment method (card) and billing address,
// with an "Update card" action that opens the provider's management session
// (Stripe Customer Portal URL / Razorpay registration link).
//
// Card data is fetched server-side in the billing page and passed in as props;
// this component only owns the management redirect + the empty state.

import { useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export type PaymentMethodData = {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  country: string | null;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
};

const BRAND_ICON: Record<string, string> = {
  visa: "CreditCard",
  mastercard: "CreditCard",
  amex: "CreditCard",
  american_express: "CreditCard",
  discover: "CreditCard",
  diners: "CreditCard",
  jcb: "CreditCard",
  unionpay: "CreditCard",
};

function brandLabel(brand: string | null): string {
  if (!brand) return "Card";
  return brand
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function PaymentMethodCard({ method }: { method: PaymentMethodData | null }) {
  const [pending, startTransition] = useTransition();

  const updateCard = () =>
    startTransition(async () => {
      const res = await fetch("/api/payments/payment-method", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Could not open billing management.");
        return;
      }
      window.location.href = data.url;
    });

  const address = method?.address;
  const addressLines = address
    ? [
        address.line1,
        address.line2,
        [address.city, address.state, address.postalCode].filter(Boolean).join(", "),
        address.country,
      ].filter(Boolean)
    : [];

  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Payment method</div>
        <Button size="sm" variant="secondary" disabled={pending} aria-busy={pending} onClick={updateCard}>
          <Icon name="CreditCard" className="h-3.5 w-3.5" />
          {pending ? "Opening…" : "Update card"}
        </Button>
      </div>

      {!method || !method.last4 ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-xs text-fg-muted">
          <Icon name="Info" className="h-3.5 w-3.5" />
          No card on file. Add one via billing management or start a plan to be prompted at checkout.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-12 place-items-center rounded-md bg-surface-3 text-fg-subtle">
              <Icon name={BRAND_ICON[method.brand ?? ""] ?? "CreditCard"} className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-medium">
                {brandLabel(method.brand)} ···· {method.last4}
              </div>
              {method.expMonth && method.expYear && (
                <div className="text-[11px] text-fg-subtle">
                  Expires {String(method.expMonth).padStart(2, "0")}/{String(method.expYear).slice(-2)}
                </div>
              )}
            </div>
            {method.country && (
              <span className="ml-auto rounded-md border border-border bg-surface-3 px-2 py-0.5 text-[10px] text-fg-muted">
                {method.country}
              </span>
            )}
          </div>

          {addressLines.length > 0 && (
            <div className="border-t border-border pt-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                Billing address
              </div>
              <div className="mt-1 text-xs text-fg-muted">
                {addressLines.map((line, i) => (
                  <div key={i} className={cn(i === addressLines.length - 1 && "text-fg-subtle")}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}