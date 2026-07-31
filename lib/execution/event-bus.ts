// In-process pub/sub for live execution events.
//
// The run route already streams events to the one client that started the run
// (the workflow builder). The Debugger needs the same live event stream to be
// consumable from a *second* client — e.g. the executions/[id] page opened
// mid-run, or a future observability view — without re-triggering the run.
// There is no Redis pub/sub in this app, so we mirror the existing in-memory
// run-registry pattern (lib/execution/engine.ts `runs` Map): a process-local
// subscriber registry keyed by executionId.
//
// Single-process dev server only — same documented limitation as the run
// registry. The run route publishes every event; the live-stream SSE route
// subscribes. When a run is not in flight, the stream route closes immediately
// (there is nothing live to tail; persisted history lives in the [eid] API).
//
// `Date.now()` is fine — server module.

import "server-only";
import type { ExecutionEvent } from "./engine";

export type EventSink = (event: ExecutionEvent) => void;

class ExecutionEventBus {
  private subscribers = new Map<string, Set<EventSink>>();

  /** Subscribe to live events for an execution. Returns an unsubscribe fn. */
  subscribe(executionId: string, sink: EventSink): () => void {
    let set = this.subscribers.get(executionId);
    if (!set) {
      set = new Set();
      this.subscribers.set(executionId, set);
    }
    set.add(sink);
    return () => {
      const s = this.subscribers.get(executionId);
      if (!s) return;
      s.delete(sink);
      if (s.size === 0) this.subscribers.delete(executionId);
    };
  }

  /** Publish an event to all live subscribers for an execution. Best-effort:
   *  a throwing sink is isolated so one bad subscriber can't break the run. */
  publish(executionId: string, event: ExecutionEvent): void {
    const set = this.subscribers.get(executionId);
    if (!set || set.size === 0) return;
    for (const sink of set) {
      try {
        sink(event);
      } catch {
        /* isolate a failing subscriber */
      }
    }
  }

  /** Whether any client is currently subscribed (used by the stream route to
   *  short-circuit when there's no live audience). */
  hasSubscribers(executionId: string): boolean {
    const s = this.subscribers.get(executionId);
    return !!s && s.size > 0;
  }
}

// Single shared instance — the run route publishes here, the stream route
// subscribes. Module-scoped, like the engine's `runs` Map.
export const executionBus = new ExecutionEventBus();