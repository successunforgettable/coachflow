/**
 * PII Encryption — AES-256-GCM at rest for captured-lead PII (email, name).
 *
 * Same proven algorithm and wire format as server/_core/tokenCrypto.ts, but a
 * SEPARATE key (PII_ENCRYPTION_KEY) for blast-radius separation: a compromise of
 * OAuth-token crypto must not expose lead PII and vice-versa. Stored format:
 *
 *   enc:1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 *
 * hashEmail/hashIp produce a keyed one-way HMAC (never reversible): emailHash is
 * used ONLY for dedup/lookup because the encrypted email is not queryable; ipHash
 * is stored instead of a raw IP for abuse/audit.
 *
 * Key: PII_ENCRYPTION_KEY env var — 32-byte hex (64 hex chars), independent of
 * TOKEN_ENCRYPTION_KEY. Generate via `openssl rand -hex 32`. Fails fast if missing.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHmac } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = "enc:1:";

let _key: Buffer | null = null;

function getKey(): Buffer {
  if (_key) return _key;
  const hex = process.env.PII_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("PII_ENCRYPTION_KEY env var is required. Generate with: openssl rand -hex 32");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("PII_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Generate with: openssl rand -hex 32");
  }
  _key = Buffer.from(hex, "hex");
  return _key;
}

/** Encrypt a plaintext PII value for DB storage. */
export function encryptPii(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypt a stored PII value. Plaintext (non-prefixed) values pass through. */
export function decryptPii(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const key = getKey();
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted PII: expected enc:1:<iv>:<tag>:<ciphertext>");
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"), { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Normalize an email for consistent hashing/dedup (trim + lowercase). */
export function normalizeEmail(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}

/** Keyed one-way HMAC of a normalized email — dedup/lookup only, never reversible. */
export function hashEmail(email: string): string {
  return createHmac("sha256", getKey()).update(normalizeEmail(email)).digest("hex");
}

/** Keyed one-way HMAC of an IP — stored instead of the raw IP for abuse/audit. */
export function hashIp(ip: string): string {
  return createHmac("sha256", getKey()).update(String(ip ?? "")).digest("hex");
}
