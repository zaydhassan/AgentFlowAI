// Streaming workflow explanation. SSE token stream.
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { explainWorkflow } from "@/lib/ai/provider";
import { normalizeGraph } from "@/lib/workflow/graph";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  void user;

  let body: { graph?: unknown } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }
  const graph = normalizeGraph(body.graph) as { nodes: WorkflowNode[]; edges: WorkflowEdge[] };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown, event?: string) => {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(event ? `event: ${event}\n${payload}` : payload));
        } catch {
          /* closed */
        }
      };
      try {
        for await (const token of explainWorkflow(graph)) send({ type: "token", token });
        send({ type: "done" }, "done");
      } catch (err) {
        console.error("[ai/explain] error", err);
        send({ type: "error", error: err instanceof Error ? err.message : "explain failed" }, "error");
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