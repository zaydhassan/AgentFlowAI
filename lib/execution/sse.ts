import "server-only";
import type { ExecutionEvent } from "./engine";

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Disable proxy buffering (Fly/nginx) so events flush immediately.
  "X-Accel-Buffering": "no",
};

function frame(data: unknown, event?: string): string {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  return event ? `event: ${event}\n${payload}` : payload;
}

export function sseStream<T>(
  gen: AsyncGenerator<T, unknown, unknown>,
  opts?: { onDone?: () => Promise<void> | void },
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // controller already closed (client disconnected).
        }
      };

      try {
        for await (const evt of gen) {
          send(frame(evt));
        }
        send(frame({ type: "done" }, "done"));
      } catch (err) {
        console.error("[sse] stream error", err);
        send(frame({ type: "error", error: err instanceof Error ? err.message : "stream error" }, "error"));
      } finally {
        try {
          await opts?.onDone?.();
        } catch {
          // ignore cleanup errors
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

export function sseTokenStream(gen: AsyncGenerator<string, unknown, unknown>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* closed */
        }
      };
      try {
        for await (const token of gen) send(frame({ type: "token", token }));
        send(frame({ type: "done" }, "done"));
      } catch (err) {
        console.error("[sse] token stream error", err);
        send(frame({ type: "error", error: err instanceof Error ? err.message : "stream error" }, "error"));
      } finally {
        try {
          controller.close();
        } catch {
          /* closed */
        }
      }
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

export type { ExecutionEvent };