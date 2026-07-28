// PATCH /api/user/profile — update the signed-in user's display name.
//
// Email and role are intentionally not editable here (email is identity, role is
// admin-gated). The name is the only mutable profile field on this route; the
// avatar has its own /api/user/avatar route (multipart upload), and the
// password has its own /api/user/password route (current-password verification).
//
// After a successful update we revalidate the layout so server-rendered
// surfaces (the topbar avatar/name, the user menu) reflect the new value
// without a full reload.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { UpdateProfileSchema } from "@/lib/validation/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name },
    select: { id: true, name: true, email: true, image: true },
  });

  // Refresh server-rendered surfaces (topbar/user-menu) for this user.
  revalidatePath("/", "layout");
  return NextResponse.json({ user: updated });
}