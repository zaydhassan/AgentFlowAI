import { httpStatusFor, readiness } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const report = await readiness();
  return Response.json(report, {
    status: httpStatusFor(report),
    headers: { "cache-control": "no-store" },
  });
}