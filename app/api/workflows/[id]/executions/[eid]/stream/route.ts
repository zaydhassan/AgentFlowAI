import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { getRun } from "@/lib/execution/engine";
import { executionBus } from "@/lib/execution/event-bus";
import { sseStream } from "@/lib/execution/sse";
import type { ExecutionEvent } from "@/lib/execution/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; eid: string }> };

// Minimal async queue: the bus pushes events, the generator drains them.
class AsyncQueue<T> {
  private items: T[] = [];
  private waiters: Array<(v: IteratorResult<T>) => void> = [];
  private closed = false;
  push(v: T) {
    if (this.closed) return;
    const w = this.waiters.shift();
    if (w) w({ value: v, done: false });
    else this.items.push(v);
  }
  close() {
    this.closed = true;
    while (this.waiters.length) this.waiters.shift()!({ value: undefined, done: true });
  }
  next(): Promise<IteratorResult<T>> {
    if (this.items.length) return Promise.resolve({ value: this.items.shift()!, done: false });
    if (this.closed) return Promise.resolve({ value: undefined, done: true });
    return new Promise((resolve) => this.waiters.push(resolve));
  }
}

export async function GET(_req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id, eid } = await params;

  // Ownership + existence check.
  const wf = await prisma.workflow.findUnique({ where: { id }, select: { ownerId: true } });
  if (!wf || wf.ownerId !== user.id) return new Response(JSON.stringify({ error: "Not found." }), { status: 404, headers: { "Content-Type": "application/json" } });
  const execution = await prisma.execution.findUnique({ where: { id: eid }, select: { workflowId: true } });
  if (!execution || execution.workflowId !== id) return new Response(JSON.stringify({ error: "Execution not found." }), { status: 404, headers: { "Content-Type": "application/json" } });

  // Not in flight → short terminal stream. The client falls back to the
  // persisted [eid] timeline for finished runs.
  if (!getRun(eid)) {
    return sseStream((async function* () {
      yield { type: "not-live" };
    })());
  }

  const queue = new AsyncQueue<ExecutionEvent>();
  const unsubscribe = executionBus.subscribe(eid, (ev) => queue.push(ev));

  const gen = (async function* () {
    try {
      while (true) {
        const { value, done } = await queue.next();
        if (done) break;
        yield value;
        if (value.type === "complete") break;
      }
    } finally {
      unsubscribe();
    }
  })();

  return sseStream(gen);
}