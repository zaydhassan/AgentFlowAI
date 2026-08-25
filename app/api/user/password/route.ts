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