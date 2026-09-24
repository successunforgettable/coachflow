/**
 * usageLimit.ts — the client half of the trial paywall (option (b), Arfeen D1-D6, 2026-09-24).
 *
 * The server marks every trial limit (quota used, trial ended, Pro-only) with `data.usageLimit`
 * (server/_core/trpc.ts errorFormatter). Its message is already plain English for the coach, so a screen only has
 * to recognise it and show it — never retry it, never wrap it in "that one fizzled".
 */

export type UsageLimitKind = "quota_exceeded" | "trial_expired" | "pro_only";
export type UsageLimit = { kind: UsageLimitKind; generator: string; message: string };

/** The limit an error carries, or null for any other error. */
export function usageLimitOf(err: unknown): UsageLimit | null {
  const data = (err as { data?: { usageLimit?: { kind?: unknown; generator?: unknown } } } | null)?.data;
  const u = data?.usageLimit;
  if (!u || typeof u.kind !== "string") return null;
  return {
    kind: u.kind as UsageLimitKind,
    generator: String(u.generator ?? ""),
    message: err instanceof Error ? err.message : String(err),
  };
}

type TierUser = { role?: string | null; subscriptionTier?: string | null } | null | undefined;

/**
 * Mirrors server/lib/tierAccess.isPaidOrStaff exactly: pro, agency, admin and superuser are not on the trial.
 * A missing user is treated as trial. Display only — the server gates remain the ground truth.
 */
export function isTrialUser(user: TierUser): boolean {
  if (!user) return true;
  if (user.role === "admin" || user.role === "superuser") return false;
  return user.subscriptionTier !== "pro" && user.subscriptionTier !== "agency";
}

/** D6 copy for a trial user wherever Push would be. */
export const PUSH_PRO_ONLY_NOTE =
  "Pushing to Meta and GoHighLevel is a Pro feature. On your free trial you can build, preview and download your whole campaign.";
