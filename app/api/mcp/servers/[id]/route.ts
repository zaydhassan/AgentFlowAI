import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { getServer, updateServer, deleteServer } from "@/lib/mcp";
import type { McpAuthScheme, McpCredentials } from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveId(params: Promise<{ id: string }>): Promise<string | null> {
  const { id } = await params;
  return typeof id === "string" && id ? id : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const id = await resolveId(params);
  if (!id) return NextResponse.json({ error: "Missing server id." }, { status: 400 });
  const server = await getServer(u.user.id, id);
  if (!server) return NextResponse.json({ error: "Server not found." }, { status: 404 });
  return NextResponse.json(server);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const id = await resolveId(params);
  if (!id) return NextResponse.json({ error: "Missing server id." }, { status: 400 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "transport", "endpoint", "command", "args", "env", "allowList", "denyList"]) {
    if (k in body) patch[k] = body[k];
  }
  if ("authScheme" in body) patch.authScheme = body.authScheme as McpAuthScheme | null;
  if ("credentials" in body) patch.credentials = body.credentials as McpCredentials | null;
  try {
    const server = await updateServer(u.user.id, id, patch);
    if (!server) return NextResponse.json({ error: "Server not found." }, { status: 404 });
    return NextResponse.json(server);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not update server.";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "A server with that name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const id = await resolveId(params);
  if (!id) return NextResponse.json({ error: "Missing server id." }, { status: 400 });
  await deleteServer(u.user.id, id);
  return NextResponse.json({ ok: true });
}