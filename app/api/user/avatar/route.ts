// POST   /api/user/avatar — upload (multipart) a profile photo.
// DELETE /api/user/avatar — remove the current profile photo.
//
// Storage: the filesystem under public/uploads/avatars/. This is the pragmatic
// default for the self-hosted monolith (no object store is configured today).
// Files are served as static assets at /uploads/avatars/<name>. For a
// horizontally-scaled / read-only-filesystem deployment, swap the read/write
// here for an object store (S3/R2) — the route is the only seam that changes.
//
// Validation: JPEG/PNG/WebP only, ≤ 2 MB. The previous upload (if it was ours)
// is deleted on replace and on remove so orphaned files don't accumulate.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AVATAR_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const PUBLIC_PREFIX = "/uploads/avatars/";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

/** Delete a previously-uploaded avatar file, but only if the URL is one of ours. */
async function deleteIfOwned(url: string | null): Promise<void> {
  if (!url || !url.startsWith(PUBLIC_PREFIX)) return;
  const file = path.join(AVATAR_DIR, path.basename(url));
  await fs.rm(file, { force: true }).catch(() => {
    /* best-effort — a missing file is fine */
  });
}

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 2 MB or smaller." }, { status: 413 });
  }
  const ext = ALLOWED.get(file.type);
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported format. Use JPEG, PNG, or WebP." },
      { status: 415 },
    );
  }

  await fs.mkdir(AVATAR_DIR, { recursive: true });

  // Remove the previous upload (if it was ours) to avoid orphaned files.
  const prev = await prisma.user.findUnique({
    where: { id: user.id },
    select: { image: true },
  });
  await deleteIfOwned(prev?.image ?? null);

  const filename = `${user.id}-${randomBytes(6).toString("hex")}.${ext}`;
  const dest = path.join(AVATAR_DIR, filename);
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(dest, bytes);

  const imageUrl = `${PUBLIC_PREFIX}${filename}`;
  await prisma.user.update({
    where: { id: user.id },
    data: { image: imageUrl },
    select: { id: true, image: true },
  });

  revalidatePath("/", "layout");
  return NextResponse.json({ image: imageUrl });
}

export async function DELETE() {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  const prev = await prisma.user.findUnique({
    where: { id: user.id },
    select: { image: true },
  });
  await deleteIfOwned(prev?.image ?? null);
  await prisma.user.update({
    where: { id: user.id },
    data: { image: null },
    select: { id: true, image: true },
  });

  revalidatePath("/", "layout");
  return NextResponse.json({ image: null });
}