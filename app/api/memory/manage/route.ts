// POST /api/memory/manage — run the maintenance pass (dedup/merge/expire/promote)
// for the authenticated user. Time-budgeted inside the engine. Returns
// { merged, expired, promoted }.

import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { memoryEngine } from "@/lib/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  const result = await memoryEngine.manage(user.id);
  return NextResponse.json(result);
}