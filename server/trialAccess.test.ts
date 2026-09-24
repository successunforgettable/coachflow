import { describe, it, expect, vi, beforeEach } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { TRPCError } from "@trpc/server";

// Trial paywall, option (b), and the quota-table sprint (Arfeen, 2026-09-24): the limits table is the single source
// of truth for every tier; the trial additionally has its expiry gate and the Trail rationing. These tests run the real enforcement code against a fake database so the
// verdicts are the code's own, and every "allowed" case has a negative control that is refused.

// ── fake database ─────────────────────────────────────────────────────────────────────────────────
const state: { user: Record<string, unknown> | null; batches: number; updates: Array<{ set: unknown; where: unknown }>; resetDue: boolean; resets: number } = {
  user: null,
  batches: 0,
  updates: [],
  resetDue: false,
  resets: 0,
};
const chain: any = {
  from: () => chain,
  where: () => chain,
  limit: async () => (state.user ? [state.user] : []),
  then: (resolve: (v: unknown) => void) => resolve([{ n: state.batches }]), // awaited without .limit(): the batch count
};
const fakeDb = {
  select: () => chain,
  update: () => ({ set: (set: unknown) => ({ where: async (where: unknown) => { state.updates.push({ set, where }); } }) }),
};
vi.mock("./db", () => ({ getDb: async () => fakeDb }));
// The monthly reset: when due, it zeroes every counter — so a check that runs AFTER it reads 0, and one that runs
// before it reads last month's number.
vi.mock("./quotaReset", () => ({
  checkAndResetQuotaIfNeeded: async () => {
    state.resets++;
    if (state.resetDue && state.user) {
      for (const k of Object.keys(state.user)) if (k.endsWith("GeneratedCount")) state.user[k] = 0;
      state.resetDue = false;
    }
  },
}));

import {
  isPaidOrStaff, countsUsage, trialUsageWhere, usageLimitError, assertCanPush, UsageLimitCause, TRIAL_AD_IMAGE_BATCH_LIMIT,
} from "./lib/tierAccess";
import {
  enforceQuota, enforceTrialActive, enforceTrialAdImageBatchLimit, countTrialUsage, countUsage, incrementQuotaCount,
} from "./lib/quotaEnforcement";
import { QUOTA_LIMITS, getQuotaCountField, type GeneratorType } from "./quotaLimits";

const FUTURE = new Date(Date.now() + 7 * 864e5);
const PAST = new Date(Date.now() - 864e5);
const trialUser = (over: Record<string, unknown> = {}) => ({
  id: 7, role: "user", subscriptionTier: "trial", trialEndsAt: FUTURE,
  offerGeneratedCount: 0, adCopyGeneratedCount: 0, icpGeneratedCount: 0, emailSeqGeneratedCount: 0,
  whatsappSeqGeneratedCount: 0, landingPageGeneratedCount: 0, headlineGeneratedCount: 0, ...over,
});

/** Resolve a promise to its usage-limit kind, "passed", or rethrow anything else. */
async function verdict(p: Promise<unknown>): Promise<string> {
  try { await p; return "passed"; } catch (e) {
    const c = (e as TRPCError).cause;
    if (e instanceof TRPCError && c instanceof UsageLimitCause) return c.kind;
    throw e;
  }
}

beforeEach(() => { state.user = null; state.batches = 0; state.updates = []; state.resetDue = false; state.resets = 0; });

describe("tierAccess — who is rationed", () => {
  it("pro, agency, admin and superuser are paid-or-staff; trial and a missing tier are not", () => {
    expect(isPaidOrStaff({ role: "user", subscriptionTier: "pro" })).toBe(true);
    expect(isPaidOrStaff({ role: "user", subscriptionTier: "agency" })).toBe(true);
    expect(isPaidOrStaff({ role: "admin", subscriptionTier: "trial" })).toBe(true);
    expect(isPaidOrStaff({ role: "superuser", subscriptionTier: null })).toBe(true);
    expect(isPaidOrStaff({ role: "user", subscriptionTier: "trial" })).toBe(false);
    expect(isPaidOrStaff({ role: "user", subscriptionTier: null })).toBe(false);
    expect(countsUsage({ role: "user", subscriptionTier: "trial" })).toBe(true);
    expect(countsUsage({ role: "user", subscriptionTier: "pro" })).toBe(false);
  });

  it("the counter WHERE clause matches trial (or no tier) and excludes staff — Pro can never be counted", () => {
    const q = new MySqlDialect().sqlToQuery(trialUsageWhere(42));
    expect(q.sql).toMatch(/`users`\.`id` = \?/);
    expect(q.sql).toMatch(/`users`\.`subscriptionTier` = \?/);
    expect(q.sql).toMatch(/`users`\.`subscriptionTier` is null/);
    expect(q.sql).toMatch(/`users`\.`role` not in \(\?, \?\)/);
    expect(q.params).toEqual([42, "trial", "admin", "superuser"]);
    // NEGATIVE CONTROL: neither paid tier appears as an allowed value anywhere in the clause.
    expect(q.params).not.toContain("pro");
    expect(q.params).not.toContain("agency");
  });

  it("a limit error is FORBIDDEN, plain English, and carries a machine-readable cause", () => {
    const e = usageLimitError("quota_exceeded", "offers", 2);
    expect(e.code).toBe("FORBIDDEN");
    expect(e.message).toBe("You've used all 2 free offers included in the free trial.");
    expect(e.message).not.toMatch(/[{}"]/); // never raw JSON on screen
    expect((e.cause as UsageLimitCause).kind).toBe("quota_exceeded");
    expect((e.cause as UsageLimitCause).generator).toBe("offers");
    expect(usageLimitError("quota_exceeded", "adCreatives", 1).message).toBe("You've used the free ad image set included in the free trial.");
    expect(usageLimitError("trial_expired", "email").message).toMatch(/free trial has ended/);
  });

  it("D6: push is refused for trial and allowed for pro / agency / staff", async () => {
    expect(await verdict(Promise.resolve().then(() => assertCanPush({ role: "user", subscriptionTier: "trial" })))).toBe("pro_only");
    expect(await verdict(Promise.resolve().then(() => assertCanPush({ role: "user", subscriptionTier: null })))).toBe("pro_only");
    for (const u of [{ role: "user", subscriptionTier: "pro" }, { role: "user", subscriptionTier: "agency" }, { role: "admin", subscriptionTier: "trial" }]) {
      expect(await verdict(Promise.resolve().then(() => assertCanPush(u)))).toBe("passed");
    }
  });
});

const GENERATORS: GeneratorType[] = ["headlines", "hvco", "heroMechanisms", "icp", "adCopy", "email", "whatsapp", "landingPages", "offers"];

describe("enforceQuota — the limits table is the single source of truth, for every tier", () => {
  // For every tier × generator: one under the table's cap passes, exactly at the cap is refused — no more, no less.
  // Unlimited entries (Infinity, and the table's 999 sentinel) are never refused.
  it.each(["trial", "pro", "agency"] as const)("%s hits exactly the table's limit on every generator", async (tier) => {
    for (const g of GENERATORS) {
      const cap = QUOTA_LIMITS[tier][g];
      const field = getQuotaCountField(g);
      if (cap === Infinity || cap >= 999) {
        for (const n of [0, 998, 999, 5000]) {
          state.user = trialUser({ subscriptionTier: tier, [field]: n });
          expect(await verdict(enforceQuota(7, g)), `${tier} ${g} @${n}`).toBe("passed");
        }
        continue;
      }
      state.user = trialUser({ subscriptionTier: tier, [field]: cap - 1 });
      expect(await verdict(enforceQuota(7, g)), `${tier} ${g} @${cap - 1}`).toBe("passed");
      state.user = trialUser({ subscriptionTier: tier, [field]: cap });
      expect(await verdict(enforceQuota(7, g)), `${tier} ${g} @${cap}`).toBe("quota_exceeded");
    }
  });

  it("the caps the old code overrode are now the table's: Pro headlines 50 (was 6 / 20), Pro landing pages 50, agency landing pages unlimited (was 500)", async () => {
    state.user = trialUser({ subscriptionTier: "pro", headlineGeneratedCount: 49 });
    expect(await verdict(enforceQuota(7, "headlines"))).toBe("passed");
    state.user = trialUser({ subscriptionTier: "pro", headlineGeneratedCount: 50 });
    expect(await verdict(enforceQuota(7, "headlines"))).toBe("quota_exceeded");
    state.user = trialUser({ subscriptionTier: "agency", landingPageGeneratedCount: 600 });
    expect(await verdict(enforceQuota(7, "landingPages"))).toBe("passed");
  });

  it("wording: a paid plan gets the plan message, a trial user the trial message", async () => {
    state.user = trialUser({ subscriptionTier: "pro", offerGeneratedCount: 50 });
    const pro = await enforceQuota(7, "offers").then(() => null, (e) => e);
    expect(pro.message).toBe("You've reached your monthly limit of 50 offers. Upgrade to generate more.");
    state.user = trialUser({ offerGeneratedCount: 2 });
    const trial = await enforceQuota(7, "offers").then(() => null, (e) => e);
    expect(trial.message).toBe("You've used all 2 free offers included in the free trial.");
  });

  it.each(["trial", "pro", "agency"] as const)("%s: the monthly reset runs BEFORE the check", async (tier) => {
    const g: GeneratorType = "offers";
    const cap = QUOTA_LIMITS[tier][g];
    const over = cap >= 999 ? 0 : cap;
    state.user = trialUser({ subscriptionTier: tier, offerGeneratedCount: over });
    state.resetDue = true; // last month's count is at the cap; this month's is 0
    expect(await verdict(enforceQuota(7, g))).toBe("passed");
    expect(state.resets).toBe(1);
    if (cap < 999) {
      // NEGATIVE CONTROL: with no reset due, the same count is refused.
      state.user = trialUser({ subscriptionTier: tier, offerGeneratedCount: over });
      expect(await verdict(enforceQuota(7, g))).toBe("quota_exceeded");
    }
  });

  it("an ended trial is refused on EVERY generator, even an unlimited one; a paid plan with an old trial date is not", async () => {
    for (const g of GENERATORS) {
      state.user = trialUser({ trialEndsAt: PAST });
      expect(await verdict(enforceQuota(7, g)), g).toBe("trial_expired");
      state.user = trialUser({ subscriptionTier: "pro", trialEndsAt: PAST });
      expect(await verdict(enforceQuota(7, g)), `pro ${g}`).toBe("passed");
    }
  });

  it("Tweak / regenerate: an ended trial is refused, a live trial and every paid plan pass", async () => {
    state.user = trialUser({ trialEndsAt: PAST });
    expect(await verdict(enforceTrialActive(7, "user", "headlines"))).toBe("trial_expired");
    state.user = trialUser();
    expect(await verdict(enforceTrialActive(7, "user", "headlines"))).toBe("passed");
    for (const tier of ["pro", "agency"]) {
      state.user = trialUser({ subscriptionTier: tier, trialEndsAt: PAST });
      expect(await verdict(enforceTrialActive(7, "user", "headlines")), tier).toBe("passed");
    }
    // Staff on a trial tier with an ended trial: never blocked.
    for (const role of ["admin", "superuser"]) {
      state.user = trialUser({ role, trialEndsAt: PAST });
      expect(await verdict(enforceTrialActive(7, role, "intake")), role).toBe("passed");
    }
    // The expiry check adds no quota: a live trial far over every counter still passes it.
    state.user = trialUser({ offerGeneratedCount: 999, icpGeneratedCount: 999, headlineGeneratedCount: 999 });
    expect(await verdict(enforceTrialActive(7, "user", "intake"))).toBe("passed");
  });

  it("an admin on a trial tier: expiry-exempt, table-limited (as before)", async () => {
    state.user = trialUser({ role: "admin", offerGeneratedCount: 1, trialEndsAt: PAST });
    expect(await verdict(enforceQuota(7, "offers"))).toBe("passed");
    state.user = trialUser({ role: "admin", offerGeneratedCount: 2, trialEndsAt: PAST });
    expect(await verdict(enforceQuota(7, "offers"))).toBe("quota_exceeded");
  });
});

describe("D3: ad images — one campaign's batch for trial", () => {
  it(`trial with no batch passes; with ${TRIAL_AD_IMAGE_BATCH_LIMIT} batch is refused`, async () => {
    state.user = trialUser();
    state.batches = 0;
    expect(await verdict(enforceTrialAdImageBatchLimit(7))).toBe("passed");
    state.batches = 1;
    expect(await verdict(enforceTrialAdImageBatchLimit(7))).toBe("quota_exceeded");
  });
  it("Pro with many batches passes", async () => {
    state.user = trialUser({ subscriptionTier: "pro" });
    state.batches = 50;
    expect(await verdict(enforceTrialAdImageBatchLimit(7))).toBe("passed");
  });
});

describe("counting — generations count for every tier; imports count for trial only", () => {
  const d = new MySqlDialect();
  it("countUsage writes an atomic `+ 1` keyed on the user id alone — Pro and agency count", async () => {
    await countUsage(7, "offers");
    const set = state.updates[0].set as Record<string, any>;
    expect(Object.keys(set)).toEqual(["offerGeneratedCount"]);
    expect(d.sqlToQuery(set.offerGeneratedCount).sql).toBe("`users`.`offerGeneratedCount` + 1");
    expect(d.sqlToQuery(state.updates[0].where as any).sql).toBe("`users`.`id` = ?");
  });
  it("countTrialUsage (imports) goes through the trial-only WHERE clause (negative control for the above)", async () => {
    await countTrialUsage(7, "offers");
    expect(d.sqlToQuery(state.updates[0].where as any)).toEqual(d.sqlToQuery(trialUsageWhere(7)));
  });
  it("incrementQuotaCount (landing pages) counts every tier, atomically", async () => {
    await incrementQuotaCount(7, "landingPages");
    const set = state.updates[0].set as Record<string, any>;
    expect(d.sqlToQuery(set.landingPageGeneratedCount).sql).toBe("`users`.`landingPageGeneratedCount` + 1");
    expect(d.sqlToQuery(state.updates[0].where as any).sql).toBe("`users`.`id` = ?");
  });
});

describe("tRPC error formatter — data.usageLimit reaches the client", () => {
  it("a limit error carries data.usageLimit; an ordinary FORBIDDEN does not (negative control)", async () => {
    const { router, publicProcedure } = await import("./_core/trpc");
    const { fetchRequestHandler } = await import("@trpc/server/adapters/fetch");
    const r = router({
      limited: publicProcedure.mutation(() => { throw usageLimitError("quota_exceeded", "offers", 2); }),
      plain: publicProcedure.mutation(() => { throw new TRPCError({ code: "FORBIDDEN", message: "nope" }); }),
    });
    const call = async (path: string) => {
      const res = await fetchRequestHandler({
        endpoint: "/trpc", router: r, createContext: () => ({ user: null } as any),
        req: new Request(`http://x/trpc/${path}`, { method: "POST", body: JSON.stringify({ json: null }), headers: { "content-type": "application/json" } }),
      });
      return (await res.json()).error.json;
    };
    const limited = await call("limited");
    expect(limited.message).toBe("You've used all 2 free offers included in the free trial.");
    expect(limited.data.usageLimit).toEqual({ kind: "quota_exceeded", generator: "offers" });
    const plain = await call("plain");
    expect(plain.message).toBe("nope");
    expect(plain.data.usageLimit).toBeUndefined();
  });
});
