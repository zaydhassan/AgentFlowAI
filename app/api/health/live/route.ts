// Liveness probe — the process is up. No dependency checks (cheap, always 200).
// Platforms use this to decide whether to restart the instance.
// Unauthenticated (platforms poll without credentials). Not cached.

import { liveness } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(liveness(), {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}