// DELETE /api/memory/collections/[id] — delete a collection. Owner-only;
// a collection belonging to another user is reported as 404. Memories in it
// are kept (their collectionId is set to null via onDelete: SetNull).

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