/** Field names that indicate a secret value. Case-insensitive, word-ish match. */
const SENSITIVE_KEY =
  /(^(|.*[_-])(pass(word|phrase)?|pwd|secret|token|apikey|api[_-]?key|authorization|auth|accesstoken|access[_-]?token|refreshtoken|refresh[_-]?token|client[_-]?secret|webhook[_-]?secret|private[_-]?key|signing[_-]?secret|session|cookie|credential|card|cvv|cvc|ssn|sin|iban|account[_-]?number|routing(_|-)?number|iban|otp|one[_-]?time[_-]?pass)(|[_-].*)$)/i;

/** Field names that hold PII we must not exfiltrate. */
const PII_KEY = /(^|.*[_-])(email|e[_-]?mail|phone|mobile|ssn|passport|dob|date[_-]?of[_-]?birth|first[_-]?name|last[_-]?name|full[_-]?name|national[_-]?id|aadhaar|pancard|pan[_-]?number)([_-].*|$)/i;

/** String values that look like leaked credentials. */
const SECRET_VALUE = [
  /(^|\s)Bearer\s+[A-Za-z0-9._\-]+/i, // Bearer tokens
  /^sk-[A-Za-z0-9_-]{16,}$/, // OpenAI-style secret keys
  /^rk-[A-Za-z0-9_-]{16,}$/, // restricted keys
  /^pk_[A-Za-z0-9_-]{16,}$/, // publishable-ish
  /^gh[pousr]_[A-Za-z0-9]{16,}$/, // GitHub tokens (ghp_/gho_/ghu_/ghs_/ghr_)
  /^github_pat_[A-Za-z0-9_]+$/, // GitHub fine-grained PATs
  /^xox[bpoa]-[A-Za-z0-9-]+$/, // Slack tokens
  /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, // JWTs (eyJ…)
  /^ya29\.[A-Za-z0-9_-]+$/, // Google OAuth access tokens
];

/** Credit-card number (13–19 digits, optional spaces/dashes). */
const CARD_NUMBER = /\b(?:\d[ -]*?){13,19}\b/;

const FILTERED = "[Filtered]";

function looksLikeSecretValue(value: string): boolean {
  if (value.length > 2048) return true; // oversized blob — treat as secret
  if (CARD_NUMBER.test(value)) return true;
  for (const re of SECRET_VALUE) {
    if (re.test(value)) return true;
  }
  return false;
}

/**
 * Deep-clone + scrub a value. Returns a sanitized copy. Cycles are broken by
 * tracking seen objects (the cloned path is preserved; back-references become
 * "[Circular]"). The original is never mutated.
 */
export function scrubSensitive<T>(input: T): T {
  return scrub(input, new WeakMap<object, unknown>());
}

function scrub<T>(input: T, seen: WeakMap<object, unknown>): T {
  if (input === null || typeof input !== "object") {
    if (typeof input === "string") return (looksLikeSecretValue(input) ? FILTERED : input) as T;
    return input;
  }
  if (seen.has(input as object)) return "[Circular]" as unknown as T;

  if (Array.isArray(input)) {
    const arr: unknown[] = [];
    seen.set(input as object, arr);
    for (const item of input) arr.push(scrub(item, seen));
    return arr as unknown as T;
  }

  const obj: Record<string, unknown> = {};
  seen.set(input as object, obj);
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key) || PII_KEY.test(key)) {
      obj[key] = FILTERED;
      continue;
    }
    obj[key] = scrub(raw, seen);
  }
  return obj as unknown as T;
}