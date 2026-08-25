import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { repository } from "@/lib/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  const stats = await repository.stats(user.id);
  return NextResponse.json(stats);
}