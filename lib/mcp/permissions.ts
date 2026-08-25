/** True if `name` matches `pattern` (trailing "*" = prefix wildcard). */
export function matchesPattern(name: string, pattern: string): boolean {
  if (!pattern) return false;
  if (pattern === "*") return true;
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return name.startsWith(prefix);
  }
  return name === pattern;
}

/** Deny-first allow/deny decision. */
export function isAllowed(
  name: string,
  allowList: readonly string[] = [],
  denyList: readonly string[] = [],
): boolean {
  for (const d of denyList) {
    if (matchesPattern(name, d)) return false;
  }
  if (allowList.length === 0) return true; // empty allow = allow all (deny-list still wins)
  for (const a of allowList) {
    if (matchesPattern(name, a)) return true;
  }
  return false;
}

/** Filter a list of named items through an allow/deny policy. */
export function filterAllowed<T extends { name: string }>(
  items: readonly T[],
  allowList: readonly string[] = [],
  denyList: readonly string[] = [],
): T[] {
  return items.filter((item) => isAllowed(item.name, allowList, denyList));
}