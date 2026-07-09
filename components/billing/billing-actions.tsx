"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { PlanId } from "@/lib/stripe";

function CheckoutButton({ plan }: { plan: "pro" | "business" }) {
  const [pending, startTransition] = useTransition();
  const [showInterval, setShowInterval] = useState(false);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  const start = (intv: "monthly" | "yearly") => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, interval: intv }),
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          toast.error(data.error ?? "Could not start checkout.");
          return;
        }
        window.location.href = data.url;
      } catch (err) {
        toast.error("Network error. Please try again.");
      }
    });
  };

  if (showInterval) {
    return (
      <div className="flex w-full items-center gap-1.5">
        <Button
          size="sm"
          variant={interval === "monthly" ? "ai" : "secondary"}
          className="flex-1"
          onClick={() => setInterval("monthly")}
        >
          Monthly
        </Button>
        <Button
          size="sm"
          variant={interval === "yearly" ? "ai" : "secondary"}
          className="flex-1"
          onClick={() => setInterval("yearly")}
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
          const res = await fetch("/api/stripe/portal", { method: "POST" });
          const data = (await res.json()) as { url?: string; error?: string };
          if (!res.ok || !data.url) {
            toast.error(data.error ?? "Could not open billing portal.");
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
          // In a real app, this would call a downgrade API that cancels at
          // period end. The Stripe Customer Portal already supports this; we
          // just open it. If no customer exists (pure free user), we just
          // refresh the page to show the current Free state.
          const res = await fetch("/api/stripe/portal", { method: "POST" });
          const data = (await res.json()) as { url?: string; error?: string };
          if (res.status === 400 || res.status === 503) {
            // No Stripe customer; nothing to do.
            window.location.reload();
            return;
          }
          if (data.url) {
            window.location.href = data.url;
          } else {
            toast.error(data.error ?? "Could not open billing portal.");
          }
        })
      }
    >
      {pending ? "…" : "Downgrade to Free"}
    </Button>
  );
}

export { CheckoutButton, ManageButton, DowngradeButton };
