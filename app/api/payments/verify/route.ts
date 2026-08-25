import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { repository } from "@/lib/payments/repository";
import { activeProviderId, getPaymentProvider } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_subscription_id?: string;
};

export async function POST(req: Request) {
  if (activeProviderId() !== "razorpay") {
    return NextResponse.json({ error: "Payment verification is only used for Razorpay." }, { status: 400 });
  }

  const u = await apiUser();
  if ("error" in u) return u.error;
  const user = u.user;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
    return NextResponse.json({ error: "Missing payment response fields." }, { status: 400 });
  }

  const provider = getPaymentProvider();
  if (!provider.configured) {
    return NextResponse.json(
      { error: "Payments are not configured on this environment." },
      { status: 503 },
    );
  }

  // Read the user's current subscription before verifying so we can cancel it
  // once the new one activates (avoids a double charge on plan changes).
  const current = await repository.subscriptions.findByUserId(user.id);
  const priorSubscriptionId = current?.razorpaySubscriptionId ?? null;

  const result = await provider.verifyPayment(
    {
      razorpayOrderId: body.razorpay_order_id,
      razorpayPaymentId: body.razorpay_payment_id,
      razorpaySignature: body.razorpay_signature,
      razorpaySubscriptionId: body.razorpay_subscription_id,
    },
    { userId: user.id, priorSubscriptionId },
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Verification failed." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}