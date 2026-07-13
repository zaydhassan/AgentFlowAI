// POST /api/mcp/invoke — stream a tool invocation over SSE.
// Body: { serverId, toolName, arguments?, timeoutMs?, workflowId?, nodeId? }
// Streams `progress` events as they arrive; terminal `result` or `error` event.

import { apiUser } from "@/lib/auth/api";
import { invokeToolStream } from "@/lib/mcp";
import { sseStream } from "@/lib/execution/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.serverId !== "string" || typeof body.toolName !== "string") {
    return new Response(JSON.stringify({ error: "serverId and toolName are required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Tie the stream's lifecycle to the client connection.
  const ac = new AbortController();
  if (req.signal) {
    if (req.signal.aborted) ac.abort();
    else req.signal.addEventListener("abort", () => ac.abort(), { once: true });
  }

  const gen = invokeToolStream(
    u.user.id,
    {
      serverId: body.serverId,
      toolName: body.toolName,
      arguments:
        body.arguments && typeof body.arguments === "object" && !Array.isArray(body.arguments)
          ? (body.arguments as Record<string, unknown>)
          : undefined,
      timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
      workflowId: typeof body.workflowId === "string" ? body.workflowId : null,
      nodeId: typeof body.nodeId === "string" ? body.nodeId : null,
    },
    ac.signal,
  );

  return sseStream(gen);
}