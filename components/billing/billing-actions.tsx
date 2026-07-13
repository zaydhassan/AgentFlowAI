"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { openRazorpayCheckout, type RazorpayResponse } from "@/lib/payments/client";
import type { CheckoutSession, Interval, PlanId } from "@/lib/payments/client";

/** Shared checkout trigger — hits /api/payments/checkout and branches on the
 *  provider: Razorpay opens the checkout.js modal then verifies server-side;
 *  Stripe redirects to the hosted Checkout URL. */
async function startCheckout(plan: "pro" | "business", interval: Interval): Promise<void> {
  const res = await fetch("/api/payments/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, interval }),
  });
  const data = (await res.json()) as CheckoutSession & { error?: string };
  if (!res.ok || data.error) {
    // 401 means the server sees no valid session even though the client's
    // cached useSession said "authenticated" (stale/expired cookie). Send the
    // user to log in again instead of showing a cryptic error.
    if (res.status === 401) {
      const next = encodeURIComponent(`/pricing`);
      window.location.href = `/login?callbackUrl=${next}`;
      return;
    }
    toast.error(data.error ?? "Could not start checkout.");
    return;
  }

  if (data.provider === "razorpay") {
    if (!data.razorpayKeyId || !data.razorpayOrderId) {
      // Subscription created with no payment required (e.g. a zero-amount trial).
      toast.success("Subscription created.");
      window.location.href = "/settings/billing?success=1";
      return;
    }
    try {
      const response = await openRazorpayCheckout({
        key: data.razorpayKeyId,
        orderId: data.razorpayOrderId,
        subscriptionId: data.razorpaySubscriptionId,
        amount: data.amount,
        currency: data.currency,
        name: data.planName,
        description: data.description,
        prefill: { name: data.prefillName, email: data.prefillEmail },
        onDismiss: () => {
          window.location.href = "/settings/billing?canceled=1";
        },
      });
      await verifyRazorpayPayment(response, data.razorpaySubscriptionId);
    } catch (err) {
      // onDismiss handles the canceled redirect; other load failures toast.
      if (err instanceof Error && err.message !== "Checkout dismissed.") {
        toast.error(err.message || "Checkout failed.");
      }
    }
    return;
  }

  // Stripe — redirect to the hosted Checkout URL.
  if (!data.url) {
    toast.error("Could not start checkout.");
    return;
  }
  window.location.href = data.url;
}

/** Post the Razorpay payment response to the backend for signature verification
 *  and subscription activation. */
async function verifyRazorpayPayment(response: RazorpayResponse, subscriptionId?: string): Promise<void> {
  const res = await fetch("/api/payments/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,
      razorpay_subscription_id: subscriptionId,
    }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) {
    toast.error(data.error ?? "Payment verification failed.");
    return;
  }
  window.location.href = "/settings/billing?success=1";
}

function CheckoutButton({ plan }: { plan: "pro" | "business" }) {
  const [pending, startTransition] = useTransition();
  const [showInterval, setShowInterval] = useState(false);
  const [interval, setIntervalState] = useState<Interval>("monthly");

  const start = (intv: Interval) => {
    startTransition(() => startCheckout(plan, intv));
  };

  if (showInterval) {
    return (
      <div className="flex w-full items-center gap-1.5">
        <Button
          size="sm"
          variant={interval === "monthly" ? "ai" : "secondary"}
          className="flex-1"
          onClick={() => setIntervalState("monthly")}
        >
          Monthly
        </Button>
        <Button
          size="sm"
          variant={interval === "yearly" ? "ai" : "secondary"}
          className="flex-1"
          onClick={() => setIntervalState("yearly")}
        >
          Yearly
        </Button>
        <Button
          size="sm"
          variant="ai"
          className="flex-1"
          onClick={() => start(interval)}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? "…" : "Continue"}
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="ai"
      className="w-full"
      onClick={() => setShowInterval(true)}
    >
      <Icon name="Zap" className="h-3.5 w-3.5" /> Upgrade
    </Button>
  );
}

/**
 * Manage subscription via the provider's management session (Stripe Customer
 * Portal URL / Razorpay registration link). Only rendered for Stripe — Razorpay
 * has no hosted portal, so management is done via cancel/pause/resume/downgrade.
 */
function ManageButton({ plan, hasCustomer }: { plan: PlanId; hasCustomer: boolean }) {
  const [pending, startTransition] = useTransition();
  if (plan === "free") return null;
  if (!hasCustomer) {
    return (
      <Button size="sm" variant="secondary" disabled>
        Manage
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await fetch("/api/payments/payment-method", { method: "POST" });
          const data = (await res.json()) as { url?: string; error?: string };
          if (!res.ok || !data.url) {
            toast.error(data.error ?? "Could not open billing management.");
            return;
          }
          window.location.href = data.url;
        })
      }
    >
      {pending ? "Opening…" : "Manage"}
    </Button>
  );
}

function DowngradeButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      className="w-full"
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await fetch("/api/payments/subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "cancel" }),
          });
          const data = (await res.json()) as { ok?: boolean; error?: string };
          if (res.status === 400 || res.status === 503) {
            // No subscription / provider not configured — nothing to downgrade.
            window.location.reload();
            return;
          }
          if (!res.ok || !data.ok) {
            toast.error(data.error ?? "Could not downgrade.");
            return;
          }
          toast.success("Downgrade scheduled — access continues until period end.");
          window.location.reload();
        })
      }
    >
      {pending ? "…" : "Downgrade to Free"}
    </Button>
  );
}

/** Cancel the active subscription at the end of the current period (final). */
function CancelButton({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending || disabled}
      aria-busy={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await fetch("/api/payments/subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "cancel" }),
          });
          const data = (await res.json()) as { ok?: boolean; error?: string };
          if (!res.ok || !data.ok) {
            toast.error(data.error ?? "Could not cancel the subscription.");
            return;
          }
          toast.success("Subscription will cancel at period end.");
          window.location.reload();
        })
      }
    >
      <Icon name="Ban" className="h-3.5 w-3.5" />
      {pending ? "…" : "Cancel subscription"}
    </Button>
  );
}

/** Pause an active subscription (Resume un-pauses it). */
function PauseButton({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending || disabled}
      aria-busy={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await fetch("/api/payments/subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "pause" }),
          });
          const data = (await res.json()) as { ok?: boolean; error?: string };
          if (!res.ok || !data.ok) {
            toast.error(data.error ?? "Could not pause the subscription.");
            return;
          }
          toast.success("Subscription paused.");
          window.location.reload();
        })
      }
    >
      <Icon name="Pause" className="h-3.5 w-3.5" />
      {pending ? "…" : "Pause"}
    </Button>
  );
}

/** Resume a paused subscription (un-pause). */
function ResumeButton({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ai"
      disabled={pending || disabled}
      aria-busy={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await fetch("/api/payments/subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "resume" }),
          });
          const data = (await res.json()) as { ok?: boolean; error?: string };
          if (!res.ok || !data.ok) {
            toast.error(data.error ?? "Could not resume the subscription.");
            return;
          }
          toast.success("Subscription resumed.");
          window.location.reload();
        })
      }
    >
      <Icon name="RotateCcw" className="h-3.5 w-3.5" />
      {pending ? "…" : "Resume subscription"}
    </Button>
  );
}

/**
 * Pricing-page CTA. Authenticated users start checkout directly; anonymous users
 * are sent to signup with the chosen plan+interval as a query string so the
 * intent survives account creation.
 */
function PricingCheckoutButton({
  plan,
  interval,
  label,
  variant = "secondary",
}: {
  plan: "pro" | "business";
  interval: Interval;
  label: string;
  variant?: "ai" | "secondary";
}) {
  const { status } = useSession();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const authed = status === "authenticated";

  const onClick = () => {
    if (!authed) {
      router.push(`/signup?plan=${plan}&interval=${interval}`);
      return;
    }
    startTransition(() => startCheckout(plan, interval));
  };

  return (
    <Button
      size="md"
      variant={variant}
      className="w-full"
      disabled={pending}
      aria-busy={pending}
      onClick={onClick}
    >
      {pending ? "Redirecting…" : label}
    </Button>
  );
}

export { CheckoutButton, ManageButton, DowngradeButton, CancelButton, PauseButton, ResumeButton, PricingCheckoutButton };