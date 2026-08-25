import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { listServers, createServer } from "@/lib/mcp";
import { MCP_TRANSPORTS } from "@/lib/mcp";
import type { McpTransportId, McpAuthScheme, McpCredentials } from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const servers = await listServers(u.user.id);
  return NextResponse.json({ servers });
}

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const transport = body.transport as McpTransportId;
  if (!MCP_TRANSPORTS.includes(transport)) {
    return NextResponse.json({ error: `transport must be one of: ${MCP_TRANSPORTS.join(", ")}` }, { status: 400 });
  }
  if (transport === "stdio" && typeof body.command !== "string") {
    return NextResponse.json({ error: "stdio transport requires a command" }, { status: 400 });
  }
  if ((transport === "http" || transport === "sse") && typeof body.endpoint !== "string") {
    return NextResponse.json({ error: `${transport} transport requires an endpoint URL` }, { status: 400 });
  }
  try {
    const server = await createServer(u.user.id, {
      name: body.name.trim(),
      transport,
      endpoint: typeof body.endpoint === "string" ? body.endpoint : null,
      command: typeof body.command === "string" ? body.command : null,
      args: Array.isArray(body.args) ? (body.args as string[]) : [],
      env: body.env && typeof body.env === "object" && !Array.isArray(body.env)
        ? (body.env as Record<string, string>)
        : null,
      authScheme: (body.authScheme as McpAuthScheme | undefined) ?? null,
      credentials: body.credentials && typeof body.credentials === "object" ? (body.credentials as McpCredentials) : null,
      allowList: Array.isArray(body.allowList) ? (body.allowList as string[]) : [],
      denyList: Array.isArray(body.denyList) ? (body.denyList as string[]) : [],
    });
    return NextResponse.json(server, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create server.";
    // Prisma unique-constraint violation on (ownerId, name).
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "A server with that name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}