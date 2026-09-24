/**
 * ghlToken.ts — the ONE place a GoHighLevel access token is obtained (GHL_DELIVERY_RELIABILITY_PROPOSAL §A).
 *
 * Before this, ZAP stored GHL's renewal key and never used it, so every connection died ~24 h after it was made.
 * Every reader (Settings status, the snapshot check, the push) now calls getGhlAccess, which renews on read.
 *
 * GHL's rules (official docs): an access token lives ~24 h; the renewal key is SINGLE-USE — renewing returns a new
 * one and retires the old — and an unused key stays valid a year. Two renewals with the same key inside 30 s get
 * the same new key.
 *
 * Failure classes — never silent:
 *   - GHL REJECTS the key (4xx), or no key is stored → the row is marked reconnect-required (migration 0112) and
 *     the caller gets kind "reconnect_required". Only the coach can fix this.
 *   - GHL is DOWN (5xx, network) → nothing is marked; kind "unavailable" ("try again in a minute").
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { ghlAccessTokens } from "../../drizzle/schema";
import { encryptToken, decryptToken } from "./tokenCrypto";

export const GHL_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";
/** Renew when the access token has less than this left, so a push never starts on a token about to lapse. */
export const RENEW_MARGIN_MS = 5 * 60 * 1000;

export type GhlConnectionKind = "not_connected" | "reconnect_required" | "unavailable";

/**
 * The connection problem a caller surfaces. Carried as a TRPCError cause and turned into `data.ghlConnection` by the
 * tRPC error formatter, so the client can show the right message and button without parsing text.
 */
export class GhlConnectionCause extends Error {
  constructor(public readonly kind: GhlConnectionKind, detail?: string) {
    super(detail ? `${kind}: ${detail}` : kind);
    this.name = "GhlConnectionCause";
  }
}

/** The coach-facing sentence for each kind. Plain English, never GHL's raw error. */
export function ghlConnectionMessage(kind: GhlConnectionKind): string {
  switch (kind) {
    case "not_connected": return "GoHighLevel isn't connected yet — connect GoHighLevel in Settings.";
    case "reconnect_required": return "Your GoHighLevel connection has ended — reconnect GoHighLevel.";
    case "unavailable": return "GoHighLevel didn't respond — try again in a minute.";
  }
}

export type GhlAccess = {
  accessToken: string;
  locationId: string | null;
  locationName: string | null;
  companyId: string | null;
  connectedAt: Date | null;
  tokenExpiresAt: Date;
};

type Row = typeof ghlAccessTokens.$inferSelect;

function toAccess(row: Row, accessToken: string): GhlAccess {
  return {
    accessToken,
    locationId: row.locationId ?? null,
    locationName: row.locationName ?? null,
    companyId: row.companyId ?? null,
    connectedAt: row.connectedAt ?? null,
    tokenExpiresAt: new Date(row.tokenExpiresAt),
  };
}

async function loadRow(userId: number): Promise<Row | null> {
  const db = await getDb();
  if (!db) throw new GhlConnectionCause("unavailable", "database unavailable");
  const [row] = await db.select().from(ghlAccessTokens).where(eq(ghlAccessTokens.userId, userId)).limit(1);
  return row ?? null;
}

/** Record that the coach must reconnect. Only for a REJECTED key — never for GHL being down. */
export async function markReconnectRequired(userId: number, reason: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(ghlAccessTokens)
    .set({ reconnectRequiredAt: new Date(), lastRenewalError: reason.slice(0, 512) } as any)
    .where(eq(ghlAccessTokens.userId, userId));
}

/** Renewals already in flight in THIS process, per user — two readers at the same moment share one request. */
const inFlight = new Map<number, Promise<GhlAccess>>();

/**
 * One renewal. The save is a compare-and-set on the renewal key that was READ: it only lands if that key is still
 * the one stored. If another renewal (another process, or GHL's 30-second window) got there first, this one writes
 * nothing and returns what the winner stored — a live key can never be overwritten by a retired one.
 */
async function renew(userId: number, row: Row): Promise<GhlAccess> {
  if (!row.refreshToken) {
    await markReconnectRequired(userId, "no renewal key stored");
    throw new GhlConnectionCause("reconnect_required", "no renewal key stored");
  }
  const clientId = process.env.GHL_CLIENT_ID;
  const clientSecret = process.env.GHL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new GhlConnectionCause("unavailable", "GHL client credentials not configured");

  let res: Response;
  try {
    res = await fetch(GHL_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: decryptToken(row.refreshToken),
        user_type: "Location",
      }),
    });
  } catch (e) {
    throw new GhlConnectionCause("unavailable", `network: ${String(e).slice(0, 200)}`);
  }

  if (res.status >= 500 || res.status === 429) {
    throw new GhlConnectionCause("unavailable", `token endpoint ${res.status}`);
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 300);
    // Another renewal may have rotated the key between our read and this call — if so, use its result.
    const fresh = await loadRow(userId);
    if (fresh && fresh.refreshToken !== row.refreshToken && new Date(fresh.tokenExpiresAt).getTime() - Date.now() > RENEW_MARGIN_MS) {
      return toAccess(fresh, decryptToken(fresh.accessToken));
    }
    await markReconnectRequired(userId, `token endpoint ${res.status}: ${body}`);
    throw new GhlConnectionCause("reconnect_required", `token endpoint ${res.status}`);
  }

  const data = (await res.json().catch(() => null)) as { access_token?: string; refresh_token?: string; expires_in?: number } | null;
  if (!data?.access_token) throw new GhlConnectionCause("unavailable", "token endpoint returned no access_token");
  const expiresAt = new Date(Date.now() + (Number(data.expires_in) || 86400) * 1000);

  const db = await getDb();
  if (!db) throw new GhlConnectionCause("unavailable", "database unavailable");
  const result: any = await db.update(ghlAccessTokens)
    .set({
      accessToken: encryptToken(data.access_token),
      // GHL rotates the key on every renewal; keep the old one only if (unexpectedly) none came back.
      refreshToken: data.refresh_token ? encryptToken(data.refresh_token) : row.refreshToken,
      tokenExpiresAt: expiresAt,
      reconnectRequiredAt: null,
      lastRenewalError: null,
    } as any)
    .where(and(eq(ghlAccessTokens.userId, userId), eq(ghlAccessTokens.refreshToken, row.refreshToken)));
  const affected = Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? 0);
  if (affected === 1) {
    return toAccess({ ...row, tokenExpiresAt: expiresAt }, data.access_token);
  }
  // Lost the race: someone else's renewal is stored. Use theirs.
  const winner = await loadRow(userId);
  if (winner && new Date(winner.tokenExpiresAt).getTime() - Date.now() > RENEW_MARGIN_MS) {
    return toAccess(winner, decryptToken(winner.accessToken));
  }
  throw new GhlConnectionCause("unavailable", "renewal race lost and no fresh token stored");
}

/**
 * A usable GHL access token for this user, renewing if it has (nearly) lapsed.
 * `forceRenew`: renew even if the stored token looks valid — for a 401 on a token we believed was good.
 * Throws GhlConnectionCause.
 */
export async function getGhlAccess(userId: number, opts: { forceRenew?: boolean } = {}): Promise<GhlAccess> {
  const row = await loadRow(userId);
  if (!row) throw new GhlConnectionCause("not_connected");
  if ((row as any).reconnectRequiredAt) throw new GhlConnectionCause("reconnect_required", "marked");

  const remaining = new Date(row.tokenExpiresAt).getTime() - Date.now();
  if (!opts.forceRenew && remaining > RENEW_MARGIN_MS) {
    return toAccess(row, decryptToken(row.accessToken));
  }

  const pending = inFlight.get(userId);
  if (pending) return pending;
  const p = renew(userId, row).finally(() => inFlight.delete(userId));
  inFlight.set(userId, p);
  return p;
}
