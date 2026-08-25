export interface SSEHandlers {
  onMessage?: (data: unknown) => void;
  // named events: "done" | "error" | custom
  onEvent?: (name: string, data: unknown) => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
}

export interface SSEHandle {
  abort: () => void;
  done: Promise<void>;
}

export function streamSSE(url: string, body: unknown, handlers: SSEHandlers = {}): SSEHandle {
  const controller = new AbortController();

  const done = (async () => {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (!controller.signal.aborted) handlers.onError?.(err instanceof Error ? err : new Error("network error"));
      return;
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      handlers.onError?.(new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let eventName = "";

    const dispatch = (raw: string) => {
      if (!raw.trim()) return;
      const payload = raw.startsWith("data:") ? raw.slice(5).trim() : null;
      if (payload == null) {
        if (raw.startsWith("event:")) eventName = raw.slice(6).trim();
        return;
      }
      let data: unknown = payload;
      try {
        data = JSON.parse(payload);
      } catch {
        /* leave as string */
      }
      if (eventName && eventName !== "message") handlers.onEvent?.(eventName, data);
      else handlers.onMessage?.(data);
      eventName = "";
    };

    try {
      for (;;) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) dispatch(line);
      }
      if (buf.trim()) dispatch(buf);
    } catch (err) {
      if (!controller.signal.aborted) handlers.onError?.(err instanceof Error ? err : new Error("stream error"));
    } finally {
      handlers.onClose?.();
    }
  })();

  return {
    abort: () => controller.abort(),
    done,
  };
}