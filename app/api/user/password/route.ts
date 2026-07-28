// GET  /api/user/password — whether the signed-in user has a password set.
// PATCH /api/user/password — change (or, for OAuth-only users, set) the password.
//
// Behaviour:
//   - If the user already has a passwordHash (credential sign-in), the current
//     password is required and verified with bcrypt before the new one is set.
//   - If the user has no passwordHash (OAuth-only — Google/GitHub), they may set
//     an initial password here without a current password. This lets them also
//     sign in with email + password while keeping their OAuth provider.
//
// The JWT session is not invalidated on change (strategy is JWT, maxAge 7d).
// Password strength matches the signup/reset rules (≥12, letter + number).

import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { ChangePasswordSchema } from "@/lib/validation/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  return NextResponse.json({ hasPassword: Boolean(record?.passwordHash) });
}

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
  const parsed = ChangePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { currentPassword, newPassword } = parsed.data;

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  // Existing password → verify the current one. OAuth-only → skip this gate.
  if (record.passwordHash) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Enter your current password.", fieldErrors: { currentPassword: ["Required."] } },
        { status: 400 },
      );
    }
    const ok = await verifyPassword(currentPassword, record.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Your current password is incorrect.", fieldErrors: { currentPassword: ["Incorrect password."] } },
        { status: 400 },
      );
    }
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
}