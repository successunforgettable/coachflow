/**
 * In-memory sliding-window rate limiter for auth endpoints.
 *
 * Keyed by IP address. Each key tracks timestamps of recent attempts.
 * Expired entries are cleaned up on access and via a periodic sweep.
 *
 * Thresholds chosen to stop brute-force without blocking legitimate use:
 *   - Login: 10 attempts / 15 min (a real user fat-fingering won't hit this)
 *   - Register: 5 attempts / 15 min
 *   - Email-sending (forgot-password, magic-link): 5 / 15 min (prevents email bombing)
 */

const WINDOW_MS = 15 * 60 * 1000; // 15-minute sliding window
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // sweep every 5 minutes

const buckets = new Map<string, number[]>();

// Periodic cleanup of expired entries
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  buckets.forEach((timestamps: number[], key: string) => {
    const fresh = timestamps.filter((t: number) => t > cutoff);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  });
}, CLEANUP_INTERVAL_MS);

/**
 * Check rate limit and record the attempt. Returns true if BLOCKED.
 * @param key - unique key (e.g. `login:${ip}`)
 * @param maxAttempts - max attempts within the window
 */
export function isRateLimited(key: string, maxAttempts: number): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const timestamps = (buckets.get(key) || []).filter(t => t > cutoff);

  if (timestamps.length >= maxAttempts) {
    buckets.set(key, timestamps);
    return true; // blocked
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return false; // allowed
}

/** Extract client IP from Express request (respects X-Forwarded-For behind Railway proxy). */
export function getClientIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  // Express sets req.ip from X-Forwarded-For when trust proxy is enabled.
  // Fallback chain for various proxy configs.
  const forwarded = req.headers?.["x-forwarded-for"];
  const forwardedIp = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : undefined;
  return req.ip || forwardedIp || req.socket?.remoteAddress || "unknown";
}
