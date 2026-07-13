// AES-256-GCM encryption for OAuth tokens at rest. The IntegrationAccount
// accessToken/refreshToken columns hold the JSON ciphertext produced here —
// never plaintext. The key comes from INTEGRATIONS_ENCRYPTION_KEY (32 bytes).
//
// Server-only: the key and the decrypt path must never reach the client. The
// repository is the only caller; it encrypts before write and decrypts on read
// into the in-memory StoredIntegrationAccount (never serialized to a response).

import "server-only";
import crypto from "node:crypto";

const KEY_ENV = "INTEGRATIONS_ENCRYPTION_KEY";
const SCHEME_VERSION = 1;

interface CipherBlob {
  v: number;
  iv: string; // base64
  ct: string; // base64
  tag: string; // base64 (GCM auth tag)
}

// Cache the derived key per-process keyed by the raw env value, so we don't
// re-derive on every call but do pick up env changes across a reload.
let cachedKeyRaw: string | null = null;
let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  const raw = process.env[KEY_ENV];
  if (!raw) {
    throw new Error(
      "INTEGRATIONS_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and add it to .env before connecting any integration.",
    );
  }
  if (cachedKeyRaw === raw && cachedKey) return cachedKey;

  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    // 32-byte hex.
    key = Buffer.from(raw, "hex");
  } else {
    // base64 (the `openssl rand -base64 32` output) — 32 bytes when decoded.
    const decoded = Buffer.from(raw, "base64");
    key = decoded.length === 32 ? decoded : Buffer.from(raw, "utf-8");
  }
  if (key.length !== 32) {
    throw new Error(
      "INTEGRATIONS_ENCRYPTION_KEY must decode to 32 bytes. Run `openssl rand -base64 32` and paste the output verbatim.",
    );
  }
  cachedKeyRaw = raw;
  cachedKey = key;
  return key;
}

/** Encrypt a plaintext string to a self-describing JSON ciphertext blob. */
export function encryptToken(plaintext: string): string {
  if (!plaintext) {
    // Empty tokens are never stored; callers must skip blanks. Guard anyway.
    throw new Error("encryptToken: refusing to encrypt an empty value");
  }
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit nonce is the GCM recommendation
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob: CipherBlob = {
    v: SCHEME_VERSION,
    iv: iv.toString("base64"),
    ct: ct.toString("base64"),
    tag: tag.toString("base64"),
  };
  return JSON.stringify(blob);
}

/** Decrypt a ciphertext blob back to plaintext. Throws on tampering/version mismatch. */
export function decryptToken(ciphertext: string): string {
  if (!ciphertext) return "";
  let blob: CipherBlob;
  try {
    blob = JSON.parse(ciphertext) as CipherBlob;
  } catch {
    throw new Error("decryptToken: malformed token ciphertext (not JSON)");
  }
  if (blob.v !== SCHEME_VERSION) {
    throw new Error(`decryptToken: unsupported ciphertext version ${blob.v}`);
  }
  const key = getKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(blob.ct, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

/** Whether the encryption key is configured (so the UI can show a clear notice). */
export function encryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}