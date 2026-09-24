import { describe, it, expect, vi, beforeEach } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { TRPCError } from "@trpc/server";

// Trial paywall, option (b) — sprint 1 (Arfeen D1-D6, 2026-09-24). Quotas ration TRIAL users only; Pro, agency and
// staff are never counted or refused. These tests run the real enforcement code against a fake database so the
// verdicts are the code's own, and every "allowed" case has a negative control that is refused.

// ── fake database ─────────────────────────────────────────────────────────────────────────────────
const state: { user: Record<string, unknown> | null; batches: number; updates: Array<{ set: unknown; where: unknown }> } = {
  user: null,
  batches: 0,
  updates: [],
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
vi.mock("./quotaReset", () => ({ checkAndResetQuotaIfNeeded: async () => undefined }));

import {
  isPaidOrStaff, countsUsage, trialUsageWhere, usageLimitError, assertCanPush, UsageLimitCause, TRIAL_AD_IMAGE_BATCH_LIMIT,
} from "./lib/tierAccess";
import {
  enforceQuota, enforceTrialActive, enforceTrialAdImageBatchLimit, countTrialUsage,
} from "./lib/quotaEnforcement";

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

beforeEach(() => { state.user = null; state.batches = 0; state.updates = []; });

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

describe("enforceQuota — trial rationed, Pro never refused", () => {
  it("trial under quota passes; at quota is refused with quota_exceeded", async () => {
    state.user = trialUser({ offerGeneratedCount: 1 });
    expect(await verdict(enforceQuota(7, "offers"))).toBe("passed");
    state.user = trialUser({ offerGeneratedCount: 2 });
    expect(await verdict(enforceQuota(7, "offers"))).toBe("quota_exceeded");
  });

  it("an ended trial is refused on EVERY generator, not only landing pages — even an unlimited one", async () => {
    for (const g of ["offers", "adCopy", "email", "whatsapp", "icp", "landingPages", "headlines", "hvco", "heroMechanisms"] as const) {
      state.user = trialUser({ trialEndsAt: PAST });
      expect(await verdict(enforceQuota(7, g)), g).toBe("trial_expired");
    }
    state.user = trialUser({ trialEndsAt: PAST });
    expect(await verdict(enforceTrialActive(7, "user", "import"))).toBe("trial_expired");
  });

  it("D2: trial headlines are unlimited", async () => {
    state.user = trialUser({ headlineGeneratedCount: 500 });
    expect(await verdict(enforceQuota(7, "headlines"))).toBe("passed");
  });

  it("PRO IS NEVER REFUSED: far over every trial limit, on every generator", async () => {
    for (const tier of ["pro", "agency"]) {
      for (const g of ["offers", "adCopy", "email", "whatsapp", "icp", "landingPages", "headlines", "hvco", "heroMechanisms"] as const) {
        state.user = trialUser({
          subscriptionTier: tier, trialEndsAt: PAST, // an old trial date on a paid account must not matter
          offerGeneratedCount: 9999, adCopyGeneratedCount: 9999, icpGeneratedCount: 9999, emailSeqGeneratedCount: 9999,
          whatsappSeqGeneratedCount: 9999, landingPageGeneratedCount: 9999, headlineGeneratedCount: 9999,
        });
        expect(await verdict(enforceQuota(7, g)), `${tier} ${g}`).toBe("passed");
      }
    }
  });

  it("staff on a trial tier are never refused", async () => {
    state.user = trialUser({ role: "admin", offerGeneratedCount: 99, trialEndsAt: PAST });
    expect(await verdict(enforceQuota(7, "offers"))).toBe("passed");
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

describe("countTrialUsage — atomic, trial-only", () => {
  it("writes `+ 1` through the trial-only WHERE clause", async () => {
    await countTrialUsage(7, "offers");
    expect(state.updates).toHaveLength(1);
    const d = new MySqlDialect();
    const set = state.updates[0].set as Record<string, any>;
    expect(Object.keys(set)).toEqual(["offerGeneratedCount"]);
    expect(d.sqlToQuery(set.offerGeneratedCount).sql).toBe("`users`.`offerGeneratedCount` + 1");
    expect(d.sqlToQuery(state.updates[0].where as any)).toEqual(d.sqlToQuery(trialUsageWhere(7)));
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
