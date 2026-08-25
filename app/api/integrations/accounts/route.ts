import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { listAccounts } from "@/lib/integrations";
import type { IntegrationProviderId } from "@/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") as IntegrationProviderId | null;
  const accounts = await listAccounts(user.id, provider ?? undefined);
  return NextResponse.json({ accounts });
}