// PATCH /api/notifications/:id  — { read: boolean }  mark read/unread
// GET   /api/notifications/:id  — fetch one (with delivery audit rows)
// DELETE /api/notifications/:id — delete (ownership-checked)
//
// Per-user; every operation is ownership-checked against userId.

import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth/api";
import { getNotification, markRead, deleteNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({ read: z.boolean() });

export async function GET(_req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id } = await params;
  const row = await getNotification(user.id, id);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected { read: boolean }." }, { status: 400 });
  }

  const ok = await markRead(user.id, id, parsed.data.read);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id } = await params;
  const ok = await deleteNotification(user.id, id);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}