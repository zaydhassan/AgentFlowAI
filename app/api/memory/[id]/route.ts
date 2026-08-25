import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { repository } from "@/lib/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id } = await params;

  const m = await repository.findById(id);
  if (!m || m.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  await repository.deleteMemory(id);
  return NextResponse.json({ ok: true });
}