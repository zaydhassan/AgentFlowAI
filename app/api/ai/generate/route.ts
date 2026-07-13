// NL → streaming workflow plan + graph. SSE: {type:"token"/"text", text...} then {type:"plan", plan}.
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { generateWorkflow, type GenChunk } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  void user;

  let body: { prompt?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }
  const prompt = body.prompt?.trim().slice(0, 2000) ?? "";
  if (!prompt) return NextResponse.json({ error: "Describe the workflow you want." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: GenChunk) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* closed */
        }
      };
      try {
        for await (const chunk of generateWorkflow(prompt)) send(chunk);
        controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ type: "done" })}\n\n`));
      } catch (err) {
        console.error("[ai/generate] error", err);
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ type: "error", error: err instanceof Error ? err.message : "generate failed" })}\n\n`),
        );
      } finally {
        try {
          controller.close();
        } catch {
          /* closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}