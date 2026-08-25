import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { getExecution } from "@/lib/executions/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;

  const { id } = await params;
  const detail = await getExecution(u.user.id, id);
  if (!detail) return NextResponse.json({ error: "Execution not found." }, { status: 404 });

  return NextResponse.json(detail);
}