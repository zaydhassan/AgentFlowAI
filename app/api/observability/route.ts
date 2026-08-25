import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { getObservabilitySummary } from "@/lib/observability/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await apiUser();
  if ("error" in u) return u.error;
  return NextResponse.json(await getObservabilitySummary(u.user.id));
}