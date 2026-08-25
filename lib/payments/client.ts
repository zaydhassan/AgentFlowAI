"use client";

import type {
  CheckoutSession,
  Interval,
  PaymentVerification,
  PlanId,
  VerificationResult,
} from "@/lib/payments/types";

export type { CheckoutSession, Interval, PaymentVerification, PlanId, VerificationResult };

/** The fields checkout.js hands back to the success handler. */
export type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

/** Minimal window.Razorpay shape we call. */
type RazorpayStatic = {
  new (options: RazorpayOptions): {
    open: () => void;
    on?: (event: string, handler: () => void) => void;
  };
};
interface RazorpayOptions {
  key: string;
  order_id?: string;
  subscription_id?: string;
  amount?: number;
  currency?: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void; escape?: boolean; backdropclose?: boolean };
  theme?: { color?: string };
}

declare global {
  interface Window {
    Razorpay?: RazorpayStatic;
  }
}

let sdkPromise: Promise<RazorpayStatic> | null = null;

/** Inject checkout.js once and resolve window.Razorpay. */
export function loadRazorpaySdk(): Promise<RazorpayStatic> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<RazorpayStatic>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Razorpay SDK can only be loaded in the browser."));
      return;
    }
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Razorpay SDK failed to initialize."));
    };
    script.onerror = () => reject(new Error("Could not load the Razorpay checkout script."));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

/** Open the Razorpay checkout modal. Resolves with the payment response. */
export async function openRazorpayCheckout(opts: {
  key: string;
  orderId?: string;
  subscriptionId?: string;
  amount?: number;
  currency?: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  onDismiss?: () => void;
}): Promise<RazorpayResponse> {
  const Rz = await loadRazorpaySdk();
  return new Promise<RazorpayResponse>((resolve, reject) => {
    const instance = new Rz({
      key: opts.key,
      order_id: opts.orderId,
      subscription_id: opts.subscriptionId,
      amount: opts.amount,
      currency: opts.currency,
      name: opts.name,
      description: opts.description,
      prefill: opts.prefill,
      notes: opts.notes,
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => (opts.onDismiss ? opts.onDismiss() : reject(new Error("Checkout dismissed."))),
        escape: true,
        backdropclose: false,
      },
    });
    instance.open();
  });
}