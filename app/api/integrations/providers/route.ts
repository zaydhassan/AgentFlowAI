import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { listProviders } from "@/lib/integrations";
import { encryptionConfigured } from "@/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  const providers = await listProviders(user.id);
  return NextResponse.json({ providers, encryptionConfigured: encryptionConfigured() });
}