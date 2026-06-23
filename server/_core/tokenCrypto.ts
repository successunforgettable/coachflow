/**
 * OAuth Token Encryption — AES-256-GCM at rest.
 *
 * Encrypts Meta and GHL OAuth tokens before DB storage; decrypts on read.
 * Each token gets a unique random 12-byte IV. Stored format:
 *
 *   enc:1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 *
 * The `enc:1:` prefix is a version marker that distinguishes encrypted
 * values from plaintext tokens. This is more robust than checking for
 * colons alone — GHL tokens are JWTs (contain dots/colons) and Meta
 * tokens are base64-ish. The prefix is unambiguous: no OAuth token from
 * any provider starts with "enc:1:".
 *
 * Key: TOKEN_ENCRYPTION_KEY env var — 32-byte hex string (64 hex chars).
 * Independent of JWT_SECRET (separate concerns: session signing vs data
 * encryption). Generated via `openssl rand -hex 32`.
 *
 * Fails fast at boot if the key is missing or malformed.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16; // 128 bits
const PREFIX = "enc:1:";

let _key: Buffer | null = null;

function getKey(): Buffer {
  if (_key) return _key;
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY env var is required. Generate with: openssl rand -hex 32"
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Generate with: openssl rand -hex 32"
    );
  }
  _key = Buffer.from(hex, "hex");
  return _key;
}

/**
 * Encrypt a plaintext token for DB storage.
 * Returns: "enc:1:<iv>:<authTag>:<ciphertext>" (all hex-encoded).
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a token from DB storage.
 *
 * Handles both encrypted ("enc:1:...") and plaintext values. During the
 * rollout window (after code deploys, before the backfill script runs),
 * existing plaintext tokens pass through unchanged. After backfill,
 * all tokens are encrypted and the plaintext path is a safety net only.
 */
export function decryptToken(stored: string): string {
  // Plaintext fallback: if the value doesn't start with the encrypted
  // prefix, treat it as a plaintext token (pre-encryption era).
  if (!stored.startsWith(PREFIX)) {
    return stored;
  }

  const key = getKey();
  const withoutPrefix = stored.slice(PREFIX.length);
  const parts = withoutPrefix.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted token: expected enc:1:<iv>:<tag>:<ciphertext>");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Check if a stored value is already encrypted (starts with the prefix).
 * Used by the backfill script to skip already-encrypted rows.
 */
export function isEncrypted(stored: string): boolean {
  return stored.startsWith(PREFIX);
}
