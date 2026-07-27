// Lightweight subsequence fuzzy matcher with scoring — no deps, client-safe.
//
// Used by the command palette to rank results the way Linear/Cursor/VS Code
// do: exact substring beats subsequence; prefix and word-start matches beat
// mid-word; contiguous runs beat scattered; shorter targets edge out longer
// ones on ties. Returns a numeric score (higher = better) or `null` when the
// query can't be matched as a subsequence of the target.
//
// Example: fuzzyMatch("gmail", "Gmail Integration") > fuzzyMatch("gm", "Programs")
// because the first is a prefix-of-token substring and the second is a sparse
// subsequence.

/**
 * Score how well `query` matches `target`. `null` = no match.
 */
export function fuzzyMatch(query: string, target: string): number | null {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (!q) return 0;
  if (!t) return null;

  // Exact (or near-exact) substring — strongest signal.
  const subIdx = t.indexOf(q);
  if (subIdx !== -1) {
    const prefixBonus = subIdx === 0 ? 60 : 0;
    // Earlier substring位置 is better.
    const posBonus = Math.max(0, 40 - subIdx * 3);
    // Whole-token match (bounded by non-word char or string edge) beats partial.
    const leftOk = subIdx === 0 || /[\s/_.\-]/.test(t[subIdx - 1]);
    const rightOk = subIdx + q.length === t.length || /[\s/_.\-]/.test(t[subIdx + q.length]);
    const tokenBonus = leftOk && rightOk ? 30 : 0;
    return 200 + prefixBonus + posBonus + tokenBonus - t.length * 0.2;
  }

  // Subsequence match — walk the query through the target, rewarding
  // contiguous runs and matches at word starts.
  let qi = 0;
  let score = 0;
  let prevMatchIdx = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      const contiguous = ti === prevMatchIdx + 1 ? 6 : 0;
      const wordStart = ti === 0 || /[\s/_.\-]/.test(t[ti - 1]) ? 10 : 0;
      score += 1 + contiguous + wordStart;
      prevMatchIdx = ti;
      qi++;
    }
  }
  if (qi !== q.length) return null; // not every query char was placed
  // Mild length penalty so "cat" matches "Category" ahead of "concatenate".
  score -= t.length * 0.1;
  return score;
}

/**
 * Best score across several searchable fields (title, description, keywords).
 * `null` if none of the fields match.
 */
export function fuzzyMatchFields(query: string, fields: string[]): number | null {
  let best: number | null = null;
  for (const f of fields) {
    const s = fuzzyMatch(query, f);
    if (s !== null && (best === null || s > best)) best = s;
  }
  return best;
}