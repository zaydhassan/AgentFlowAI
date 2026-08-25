import "server-only";
import { prisma } from "@/lib/db";

export type UsageDeltas = {
  executions?: number;
  aiCredits?: number;
  apiCalls?: number;
  storage?: number;
  tokenUsage?: number;
  compute?: number;
};

function calendarMonthWindow(now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Resolve (and create if missing) the current-period Usage row for a user.
 * Rolls a fresh row — zeroed counters — when the subscription's billing cycle
 * has advanced past the last recorded periodStart (i.e. the monthly reset).
 */
export async function getOrCreateCurrentUsage(userId: string) {
  const now = new Date();
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { currentPeriodStart: true, currentPeriodEnd: true },
  });

  let start: Date;
  let end: Date;
  if (sub?.currentPeriodStart && sub?.currentPeriodEnd && now < sub.currentPeriodEnd) {
    start = sub.currentPeriodStart;
    end = sub.currentPeriodEnd;
  } else {
    const win = calendarMonthWindow(now);
    start = win.start;
    end = win.end;
  }

  // Upsert on the unique [userId, periodStart] composite.
  return prisma.usage.upsert({
    where: { userId_periodStart: { userId, periodStart: start } },
    update: {}, // no-op if it exists
    create: { userId, periodStart: start, periodEnd: end, executions: 0, aiCredits: 0, apiCalls: 0, storage: 0, tokenUsage: 0, compute: 0 },
  });
}

/**
 * Increment usage counters for the current billing period. Only positive
 * deltas are applied. Call from workload/execution code paths.
 *
 * Example: `incrementUsage(userId, { aiCredits: 120, executions: 1, apiCalls: 3 })`
 */
export async function incrementUsage(userId: string, deltas: UsageDeltas) {
  const pos = (n: number | undefined) => (n && n > 0 ? n : 0);
  const current = await getOrCreateCurrentUsage(userId);
  await prisma.usage.update({
    where: { id: current.id },
    data: {
      executions: { increment: pos(deltas.executions) },
      aiCredits: { increment: pos(deltas.aiCredits) },
      apiCalls: { increment: pos(deltas.apiCalls) },
      storage: { increment: pos(deltas.storage) },
      tokenUsage: { increment: pos(deltas.tokenUsage) },
      compute: { increment: pos(deltas.compute) },
    },
  });
}

/**
 * Zero the current-period counters (e.g. manual reset). Keeps the row so
 * history queries by periodStart stay intact.
 */
export async function resetUsageForUser(userId: string) {
  const current = await getOrCreateCurrentUsage(userId);
  await prisma.usage.update({
    where: { id: current.id },
    data: { executions: 0, aiCredits: 0, apiCalls: 0, storage: 0, tokenUsage: 0, compute: 0 },
  });
}