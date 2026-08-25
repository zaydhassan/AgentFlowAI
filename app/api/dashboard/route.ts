import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { cached } from "@/lib/cache";
import { buildDashboard } from "@/lib/dashboard/aggregations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  const payload = await cached(`dashboard:${user.id}`, 60, () => buildDashboard(user.id));
  return NextResponse.json(payload);
}