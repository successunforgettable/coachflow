/**
 * tierAccess.ts — who is rationed, who may push, and how a limit is reported.
 *
 * THE RULE (Arfeen, 2026-09-24, decisions D1-D6 in docs/handovers/TRIAL_PAYWALL_OPTION_B_PROPOSAL_2026-09-24.md):
 *   - Quotas apply to TRIAL users only. Pro, agency, admin and superuser are never counted and never refused (D5).
 *   - Trial users may generate and preview, rationed by quotaLimits.ts, until `trialEndsAt` passes.
 *   - Pushing to Meta or GoHighLevel is Pro-only (D6).
 *   - Auto Mode ("Build it all for me") is Pro-only and unchanged (autoMode.ts isAutoModeTierAllowed).
 *
 * Dependency-light on purpose (drizzle schema + tRPC error only) so db.ts, the routers and the tRPC error formatter
 * can all import it without a cycle.
 */
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, notInArray, or, type SQL } from "drizzle-orm";
import { users } from "../../drizzle/schema";

type TierUser = { role?: string | null; subscriptionTier?: string | null };

const STAFF_ROLES = ["admin", "superuser"] as const;

/** Paid tier or staff role. Mirrors autoMode.isAutoModeTierAllowed exactly. */
export function isPaidOrStaff(user: TierUser): boolean {
  if (user.role === "admin" || user.role === "superuser") return true;
  return user.subscriptionTier === "pro" || user.subscriptionTier === "agency";
}

/** True only for the users quotas apply to: trial (or a missing tier, which the schema defaults to trial), non-staff. */
export function countsUsage(user: TierUser): boolean {
  return !isPaidOrStaff(user);
}

/**
 * WHERE clause that matches the user only if their usage counts. Every counter increment goes through this, so a
 * Pro user's counters never move — enforced in the SQL itself rather than by a read-then-decide in each caller.
 */
export function trialUsageWhere(userId: number): SQL {
  return and(
    eq(users.id, userId),
    or(eq(users.subscriptionTier, "trial"), isNull(users.subscriptionTier)),
    notInArray(users.role, [...STAFF_ROLES]),
  )!;
}

/** A trial user's allotment of ad-image batches. One batch (5 variations) is what one campaign needs (D3). */
export const TRIAL_AD_IMAGE_BATCH_LIMIT = 1;

export type UsageLimitKind = "quota_exceeded" | "trial_expired" | "pro_only";

/**
 * Carried as the TRPCError `cause` and surfaced by the tRPC error formatter as `data.usageLimit`, so a client can
 * recognise a limit without parsing the message text. The message itself is always plain English for the coach.
 */
export class UsageLimitCause extends Error {
  constructor(public readonly kind: UsageLimitKind, public readonly generator: string) {
    super(`${kind}:${generator}`);
    this.name = "UsageLimitCause";
  }
}

const LABELS: Record<string, string> = {
  headlines: "headline sets",
  hvco: "lead magnet title sets",
  heroMechanisms: "method sets",
  icp: "customer profiles",
  adCopy: "ad copy sets",
  email: "email sequences",
  whatsapp: "WhatsApp sequences",
  landingPages: "landing pages",
  offers: "offers",
  adCreatives: "ad image sets",
};

export function usageLabel(generator: string): string {
  return LABELS[generator] ?? "generations";
}

export function usageLimitError(kind: UsageLimitKind, generator: string, limit?: number): TRPCError {
  const message =
    kind === "quota_exceeded"
      ? limit === 1
        ? `You've used the free ${usageLabel(generator).replace(/s$/, "")} included in the free trial.`
        : `You've used all ${limit} free ${usageLabel(generator)} included in the free trial.`
      : kind === "trial_expired"
        ? "Your 14-day free trial has ended, so new generations are paused."
        : generator === "push"
          ? "Pushing to Meta and GoHighLevel is a Pro feature. On the free trial you can generate and preview your campaign."
          : "Auto Mode is a Pro feature. Upgrade your subscription to unlock the 1-click campaign builder.";
  return new TRPCError({ code: "FORBIDDEN", message, cause: new UsageLimitCause(kind, generator) });
}

/** D6: pushing to Meta or GoHighLevel is Pro-only. Call at the top of every push procedure. */
export function assertCanPush(user: TierUser): void {
  if (!isPaidOrStaff(user)) throw usageLimitError("pro_only", "push");
}
