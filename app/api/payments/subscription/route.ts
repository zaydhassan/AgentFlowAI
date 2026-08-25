import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { repository } from "@/lib/payments/repository";
import { activeProviderId, getPaymentProvider } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "cancel" | "pause" | "resume";
type Result = { ok: boolean } | { error: string };

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const user = u.user;

  let body: { action: Action };
  try {
    body = (await req.json()) as { action: Action };
  } catch {
    return NextResponse.json<Result>({ error: "Invalid body" }, { status: 400 });
  }
  if (body.action !== "cancel" && body.action !== "pause" && body.action !== "resume") {
    return NextResponse.json<Result>({ error: "Invalid action" }, { status: 400 });
  }

  const provider = getPaymentProvider();
  if (!provider.configured) {
    return NextResponse.json<Result>(
      { error: "Payments are not configured on this environment." },
      { status: 503 },
    );
  }

  const providerId = activeProviderId();
  const sub = await repository.subscriptions.findByUserId(user.id);
  const providerSubId =
    providerId === "razorpay" ? sub?.razorpaySubscriptionId : sub?.stripeSubscriptionId;
  if (!providerSubId) {
    return NextResponse.json<Result>({ error: "No subscription to manage." }, { status: 400 });
  }

  // Ownership guard: the subscription's provider customer must match the user's.
  // Select both columns once so the result type is stable regardless of provider.
  const userRow = await prisma.user.findUnique({
    where: { id: user.id },
    select: { razorpayCustomerId: true, stripeCustomerId: true },
  });
  const userCustomerId =
    providerId === "razorpay" ? userRow?.razorpayCustomerId : userRow?.stripeCustomerId;
  const subCustomerId =
    providerId === "razorpay" ? sub?.razorpayCustomerId : sub?.stripeCustomerId;
  if (!userCustomerId || userCustomerId !== subCustomerId) {
    return NextResponse.json<Result>(
      { error: "Subscription does not belong to this account." },
      { status: 403 },
    );
  }

  try {
    if (body.action === "cancel") {
      await provider.cancelAtPeriodEnd(providerSubId);
      await repository.subscriptions.setCancelAtPeriodEnd(user.id, true);
    } else if (body.action === "pause") {
      await provider.pause(providerSubId);
      await repository.subscriptions.setPaused(user.id, true);
    } else {
      await provider.resume(providerSubId);
      await repository.subscriptions.setPaused(user.id, false);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Provider request failed";
    return NextResponse.json<Result>({ error: msg }, { status: 502 });
  }

  return NextResponse.json<Result>({ ok: true });
}