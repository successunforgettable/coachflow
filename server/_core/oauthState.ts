/**
 * OAuth State Token — HMAC-signed state parameter for Meta and GHL OAuth.
 *
 * Replaces the plaintext userId that was previously passed as the `state`
 * parameter. The old pattern (`state = String(userId)`) was trivially
 * forgeable — an attacker could craft a callback URL with any userId and
 * bind their OAuth token to a victim's account.
 *
 * New pattern: state = `${userId}.${hmacHex}` where hmacHex is an HMAC-SHA256
 * of the userId string, keyed with JWT_SECRET. The callback verifies the
 * signature before trusting the userId. No DB table, no expiry tracking —
 * the HMAC is stateless and deterministic.
 *
 * The 5-minute window is enforced by including a timestamp bucket in the
 * signed payload, preventing replay of very old state tokens.
 */
import { createHmac } from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000; // 10-minute validity window

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required for OAuth state signing");
  return secret;
}

/** Sign a userId into a tamper-proof state token. */
export function signOAuthState(userId: number): string {
  const bucket = Math.floor(Date.now() / STATE_TTL_MS);
  const payload = `${userId}.${bucket}`;
  const hmac = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${userId}.${bucket}.${hmac}`;
}

/** Verify and extract userId from a state token. Returns null if invalid. */
export function verifyOAuthState(state: string): number | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;

  const [userIdStr, bucketStr, providedHmac] = parts;
  const userId = parseInt(userIdStr, 10);
  if (isNaN(userId)) return null;

  const bucket = parseInt(bucketStr, 10);
  if (isNaN(bucket)) return null;

  // Verify the HMAC
  const payload = `${userId}.${bucket}`;
  const expectedHmac = createHmac("sha256", getSecret()).update(payload).digest("hex");

  // Constant-time comparison to prevent timing attacks
  if (providedHmac.length !== expectedHmac.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expectedHmac.length; i++) {
    mismatch |= providedHmac.charCodeAt(i) ^ expectedHmac.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  // Check the time bucket is current or one bucket ago (covers the boundary)
  const currentBucket = Math.floor(Date.now() / STATE_TTL_MS);
  if (bucket !== currentBucket && bucket !== currentBucket - 1) return null;

  return userId;
}
