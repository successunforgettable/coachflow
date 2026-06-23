import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { sql } from "drizzle-orm";

// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
  /** Token version for session revocation. Missing = 0 (pre-migration compat). */
  tv?: number;
};

class SDKServer {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string; tokenVersion?: number } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
        tv: options.tokenVersion ?? 0,
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
      tv: payload.tv ?? 0,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string; tv: number } | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name, tv } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
        // Pre-migration JWTs have no tv field → treat as 0.
        // This matches the DB default (0) so existing sessions remain valid.
        // FOLLOW-UP: retire this fallback after 30 days post-deploy (all live
        // tokens will carry explicit tv by then). Target: 2026-07-25.
        tv: typeof tv === "number" ? tv : 0,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  /**
   * Read tokenVersion from the users table via raw SQL.
   * NOT in the Drizzle schema to avoid breaking `select().from(users)` if
   * the migration hasn't run yet. Returns 0 if the column doesn't exist
   * (pre-migration) or on any query error — fail-open so a missing column
   * doesn't lock out all users.
   */
  private async getTokenVersion(userId: number): Promise<number> {
    try {
      const database = await db.getDb();
      if (!database) return 0;
      const result: any = await database.execute(
        sql`SELECT tokenVersion FROM users WHERE id = ${userId} LIMIT 1`
      );
      const row = result?.[0]?.[0] ?? result?.[0];
      return typeof row?.tokenVersion === "number" ? row.tokenVersion : 0;
    } catch {
      // Column doesn't exist yet (pre-migration) or other DB error → fail-open
      return 0;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const sessionUserId = session.openId;
    const signedInAt = new Date();
    const user = await db.getUserByOpenId(sessionUserId);

    if (!user) {
      throw ForbiddenError("User not found");
    }

    // Token version check: compare JWT's tv against the DB value.
    // If they differ, the session has been revoked (password reset, etc.).
    const dbVersion = await this.getTokenVersion(user.id);
    if (session.tv !== dbVersion) {
      throw ForbiddenError("Session revoked");
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

    return user;
  }
}

export const sdk = new SDKServer();
