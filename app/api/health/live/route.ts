import { liveness } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(liveness(), {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}