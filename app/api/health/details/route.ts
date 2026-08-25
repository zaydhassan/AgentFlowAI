import { details, httpStatusFor } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const report = await details();
  return Response.json(report, {
    status: httpStatusFor(report),
    headers: { "cache-control": "no-store" },
  });
}