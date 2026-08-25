import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth/api";
import {
  listNotifications,
  countUnread,
  markAllRead,
  type ListFilter,
} from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = ["workflow", "ai", "integration", "billing", "security", "system"] as const;
const SEVERITIES = ["info", "success", "warning", "error"] as const;

export async function GET(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  const url = new URL(req.url);
  const sp = url.searchParams;

  if (sp.get("unread") === "1") {
    const unread = await countUnread(user.id);
    return NextResponse.json({ unread });
  }

  const category = sp.get("category");
  const severity = sp.get("severity");
  const readParam = sp.get("read");
  const filter: ListFilter = {
    ...(category && (CATEGORIES as readonly string[]).includes(category)
      ? { category: category as ListFilter["category"] }
      : {}),
    ...(severity && (SEVERITIES as readonly string[]).includes(severity)
      ? { severity: severity as ListFilter["severity"] }
      : {}),
    ...(readParam === "true" ? { read: true } : readParam === "false" ? { read: false } : {}),
    ...(sp.get("q") ? { query: sp.get("q")! } : {}),
    ...(sp.get("since") ? { since: sp.get("since")! } : {}),
    ...(sp.get("until") ? { until: sp.get("until")! } : {}),
    ...(sp.get("limit") ? { limit: Number(sp.get("limit")) } : {}),
    ...(sp.get("cursor") ? { cursor: sp.get("cursor")! } : {}),
  };

  const [{ items, nextCursor, total }, unread] = await Promise.all([
    listNotifications(user.id, filter),
    countUnread(user.id),
  ]);

  return NextResponse.json({ items, nextCursor, total, unread });
}

const markAllSchema = z.object({
  action: z.literal("markAllRead"),
  category: z.enum(CATEGORIES).optional(),
});

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = markAllSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unsupported action.", details: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await markAllRead(user.id, parsed.data.category ? { category: parsed.data.category } : undefined);
  return NextResponse.json({ updated });
}