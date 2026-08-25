import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { repository } from "@/lib/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  const collections = await repository.listCollections(user.id);
  return NextResponse.json({ collections });
}

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  let body: { name?: string; description?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  try {
    const collection = await repository.createCollection(user.id, body.name.trim(), body.description);
    return NextResponse.json(collection);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create collection.";
    const status = /unique/i.test(msg) ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}