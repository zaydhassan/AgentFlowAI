import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { appUrl, getPaymentProvider } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;

  const provider = getPaymentProvider();
  if (!provider.configured) {
    return NextResponse.json(
      { error: "Payments are not configured on this environment." },
      { status: 503 },
    );
  }

  try {
    const session = await provider.createManagementSession(u.user.id, `${appUrl(req.url)}/settings/billing`);
    if (!session.url) {
      return NextResponse.json({ error: "Could not open billing management." }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not open billing management.";
    const status = /not configured|No .+ (customer|subscription)|hosted card-update|does not expose/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}