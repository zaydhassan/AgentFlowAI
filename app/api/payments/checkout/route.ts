import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { getPaymentProvider, trialDays, type Interval } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { plan: "pro" | "business"; interval: Interval; trialDays?: number };

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const user = u.user;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { plan, interval } = body;
  if (plan !== "pro" && plan !== "business") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  if (interval !== "monthly" && interval !== "yearly") {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }

  const provider = getPaymentProvider();
  if (!provider.configured) {
    return NextResponse.json(
      { error: "Payments are not configured on this environment. Set the provider keys in .env." },
      { status: 503 },
    );
  }

  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const session = await provider.createCheckout({
      userId: user.id,
      userEmail: existing.email,
      userName: existing.name,
      plan,
      interval,
      trialDays: Number.isFinite(body.trialDays) && (body.trialDays ?? 0) > 0 ? (body.trialDays as number) : trialDays(),
      returnUrl: req.url,
    });
    return NextResponse.json(session);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not start checkout.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}