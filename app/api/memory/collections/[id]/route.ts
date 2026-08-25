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

  const c = await repository.findCollection(user.id, id);
  if (!c) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await repository.deleteCollection(id);
  return NextResponse.json({ ok: true });
}