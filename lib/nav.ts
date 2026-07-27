// Shared navigation active-state helpers.
//
// The cardinal rule: exactly ONE nav item may be active at a time. Naive
// `pathname.startsWith(href)` matching breaks that whenever one item's href is
// a prefix of another's — e.g. on `/ai/rag` both `/ai` (AI Copilot) and
// `/ai/rag` (RAG Sources) would match. `pickActiveHref` fixes it by selecting
// the MOST SPECIFIC (longest) matching href, so only the deepest match wins.
//
// Use `isRouteActive` for a single boolean "does this route match the path"
// (prefix-aware), and `pickActiveHref` to choose the single winner across a set
// of candidates. Sidebars should derive `active = item.href === pickActiveHref(...)`.

/**
 * Does `href` match the current `pathname`?
 *
 * - "/" matches only "/" (never a prefix of everything).
 * - In-page anchors (`/#features`) are stripped before matching.
 * - Otherwise an exact match OR a segment-boundary prefix match
 *   (`/workflows` matches `/workflows/wf_123`, but NOT `/workflowz`).
 *
 * Note: this returns true for EVERY item whose href is a prefix of the path
 * (e.g. both `/ai` and `/ai/rag` on `/ai/rag`). To get a single active item,
 * use `pickActiveHref` over the full candidate set.
 */
export function isRouteActive(pathname: string, href: string): boolean {
  // Strip in-page anchors so "/#features" counts as the landing page.
  const clean = href.split("#")[0] || "/";
  if (clean === "/") return pathname === "/";
  return pathname === clean || pathname.startsWith(clean + "/");
}

/**
 * Pick the single most-specific matching href from `hrefs` for `pathname`.
 *
 * "Most specific" = the longest clean href that matches via `isRouteActive`.
 * This guarantees exactly one winner even when candidates are prefixes of each
 * other (e.g. on `/ai/memory`, returns `/ai/memory` — not `/ai`). Returns null
 * if nothing matches.
 */
export function pickActiveHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const h of hrefs) {
    if (!isRouteActive(pathname, h)) continue;
    const clean = h.split("#")[0] || "/";
    const bestClean = best ? (best.split("#")[0] || "/") : "";
    if (best === null || clean.length > bestClean.length) {
      best = h;
    }
  }
  return best;
}