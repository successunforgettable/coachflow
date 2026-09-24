import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { TRPCError } from "@trpc/server";

// Trial paywall, option (b) — sprint 1. The Trail step gate and the push gate, exercised through the REAL tRPC
// procedures (createCaller) with a fake database and spies on the quota helpers. The Pro cases are the negative
// controls for the whole sprint: a Pro user must reach the job / the push without the gate ever consulting a kit,
// a quota, or a counter.

const { db, fakeDb, quota } = vi.hoisted(() => {
  const db = { kit: null as Record<string, unknown> | null, kitLookups: 0, jobInserts: 0, getDbCalls: 0 };
  const selectChain: any = {
    from: () => selectChain,
    where: () => selectChain,
    limit: async () => { db.kitLookups++; return db.kit ? [db.kit] : []; },
  };
  const fakeDb: any = {
    select: () => selectChain,
    execute: async () => [[{ count: 0 }]],
    insert: () => ({ values: async () => { db.jobInserts++; } }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  };
  const quota = {
    enforceQuota: vi.fn(async (..._a: unknown[]) => undefined),
    enforceTrialAdImageBatchLimit: vi.fn(async (..._a: unknown[]) => undefined),
    enforceTrialActive: vi.fn(async (..._a: unknown[]) => undefined),
    countTrialUsage: vi.fn(async (..._a: unknown[]) => undefined),
  };
  return { db, fakeDb, quota };
});
vi.mock("./db", () => ({ getDb: async () => { db.getDbCalls++; return fakeDb; } }));
vi.mock("./lib/quotaEnforcement", () => quota);
// No test may reach a paid model call.
vi.mock("./_core/llm", () => ({ invokeLLM: async () => { throw new Error("LLM_NOT_CALLED_IN_TESTS"); } }));

vi.mock("./_core/orchestration", () => {
  const names = ["offer", "mechanism", "hvco", "headlines", "adCopy", "landingPage", "emailSequence", "whatsappSequence", "adCreatives"];
  const fields: Record<string, string> = {
    offer: "selectedOfferId", mechanism: "selectedMechanismId", hvco: "selectedHvcoId", headlines: "selectedHeadlineId",
    adCopy: "selectedAdCopyId", landingPage: "selectedLandingPageId", emailSequence: "selectedEmailSequenceId",
    whatsappSequence: "selectedWhatsAppSequenceId", adCreatives: "selectedAdCreativeBatchId",
  };
  return {
    ORCHESTRATION_STEP_NAMES: names,
    kitFieldForStep: (n: string) => fields[n],
    runOrchestration: vi.fn(async () => undefined),
    runOrchestrationStep: vi.fn(async () => ({ skipped: true, generatedId: null, kitField: "x" })),
  };
});

import { autoModeRouter, TRIAL_STEP_QUOTA, trialStepPathAllowed } from "./routers/autoMode";
import { UsageLimitCause } from "./lib/tierAccess";

const PRO = { id: 1, role: "user", subscriptionTier: "pro" };
const AGENCY = { id: 2, role: "user", subscriptionTier: "agency" };
const ADMIN = { id: 3, role: "admin", subscriptionTier: "trial" };
const TRIAL = { id: 9, role: "user", subscriptionTier: "trial" };
const caller = (user: object) => autoModeRouter.createCaller({ user, req: {}, res: {} } as any);
const step = (user: object, s: string) => caller(user).orchestrateStep({ serviceId: 1, icpId: 1, step: s as any });

async function verdict(p: Promise<unknown>): Promise<string> {
  try { await p; return "passed"; } catch (e) {
    const c = (e as TRPCError).cause;
    if (e instanceof TRPCError && c instanceof UsageLimitCause) return c.kind;
    return `other:${(e as Error).message}`;
  }
}

beforeEach(() => {
  db.kit = null; db.kitLookups = 0; db.jobInserts = 0; db.getDbCalls = 0;
  Object.values(quota).forEach((f) => { f.mockReset(); f.mockResolvedValue(undefined); });
});

describe("orchestrateStep — Pro / agency / staff untouched (D5)", () => {
  it.each([["pro", PRO], ["agency", AGENCY], ["admin on a trial tier", ADMIN]])(
    "%s: job created, no kit lookup, no quota check, on every step and every kit path",
    async (_label, user) => {
      for (const s of Object.keys(TRIAL_STEP_QUOTA)) {
        db.kit = { path: "auto" }; // would refuse a trial user — must be irrelevant here
        expect(await verdict(step(user, s)), s).toBe("passed");
      }
      expect(db.jobInserts).toBe(9);
      expect(db.kitLookups).toBe(0);
      expect(quota.enforceQuota).not.toHaveBeenCalled();
      expect(quota.enforceTrialAdImageBatchLimit).not.toHaveBeenCalled();
    },
  );
});

describe("orchestrateStep — trial on the Trail (D1, D4)", () => {
  it("Auto Mode stays Pro-only: a trial user on an auto kit is refused BEFORE any job exists", async () => {
    db.kit = { path: "auto", selectedOfferId: null };
    expect(await verdict(step(TRIAL, "offer"))).toBe("pro_only");
    expect(db.jobInserts).toBe(0);
    expect(quota.enforceQuota).not.toHaveBeenCalled();
  });

  it("no kit, or a kit with no Trail path, is refused", async () => {
    db.kit = null;
    expect(await verdict(step(TRIAL, "offer"))).toBe("pro_only");
    db.kit = { path: null };
    expect(await verdict(step(TRIAL, "offer"))).toBe("pro_only");
    expect(db.jobInserts).toBe(0);
  });

  it.each(["manual", "has_assets"])("%s kit: each step checks its own quota, then the job runs", async (path) => {
    for (const [s, gen] of Object.entries(TRIAL_STEP_QUOTA)) {
      db.kit = { path };
      expect(await verdict(step(TRIAL, s)), s).toBe("passed");
      if (gen === "adCreatives") expect(quota.enforceTrialAdImageBatchLimit).toHaveBeenLastCalledWith(TRIAL.id, TRIAL.role);
      else expect(quota.enforceQuota).toHaveBeenLastCalledWith(TRIAL.id, gen, TRIAL.role);
    }
    expect(db.jobInserts).toBe(9);
  });

  it("a quota refusal stops the step BEFORE the job is created — no generation, no charge", async () => {
    const { usageLimitError } = await import("./lib/tierAccess");
    quota.enforceQuota.mockRejectedValueOnce(usageLimitError("quota_exceeded", "offers", 2));
    db.kit = { path: "manual", selectedOfferId: null };
    expect(await verdict(step(TRIAL, "offer"))).toBe("quota_exceeded");
    expect(db.jobInserts).toBe(0);
  });

  it("an already-filled node passes without a quota check (it will skip) — a trial coach can reopen a campaign", async () => {
    db.kit = { path: "manual", selectedOfferId: 55 };
    expect(await verdict(step(TRIAL, "offer"))).toBe("passed");
    expect(quota.enforceQuota).not.toHaveBeenCalled();
    // NEGATIVE CONTROL: the same step on an empty node IS checked.
    db.kit = { path: "manual", selectedOfferId: null };
    await step(TRIAL, "offer");
    expect(quota.enforceQuota).toHaveBeenCalledWith(TRIAL.id, "offers", TRIAL.role);
  });

  it("the path rule is exactly manual + has_assets", () => {
    expect(trialStepPathAllowed("manual")).toBe(true);
    expect(trialStepPathAllowed("has_assets")).toBe(true);
    expect(trialStepPathAllowed("auto")).toBe(false);
    expect(trialStepPathAllowed(null)).toBe(false);
    expect(trialStepPathAllowed(undefined)).toBe(false);
  });
});

describe("imports — trial allowed, rationed (D4); Pro untouched", () => {
  it("extraction checks the ICP quota for trial BEFORE any LLM call, and not at all for Pro", async () => {
    const { usageLimitError } = await import("./lib/tierAccess");
    quota.enforceQuota.mockRejectedValueOnce(usageLimitError("trial_expired", "icp"));
    expect(await verdict(caller(TRIAL).extractFromAssets({ rawText: "x".repeat(60) }))).toBe("trial_expired");
    expect(quota.enforceQuota).toHaveBeenCalledWith(TRIAL.id, "icp", TRIAL.role);
    quota.enforceQuota.mockClear();
    await verdict(caller(PRO).extractFromAssets({ rawText: "x".repeat(60) })); // the LLM call itself is not under test
    expect(quota.enforceQuota).not.toHaveBeenCalled();
  });
});

describe("D6 — push is Pro-only, at the server", () => {
  const metaInput = { headline: "h", body: "b", linkUrl: "https://example.com", campaignName: "c", objective: "OUTCOME_LEADS" as const };
  const assembledInput = { serviceId: 1, linkUrl: "https://example.com", campaignName: "c", objective: "OUTCOME_LEADS" as const };
  const pushes = async () => {
    const { metaRouter } = await import("./routers/meta");
    const { ghlRouter } = await import("./routers/ghl");
    const m = (u: object) => metaRouter.createCaller({ user: u, req: {}, res: {} } as any);
    const g = (u: object) => ghlRouter.createCaller({ user: u, req: {}, res: {} } as any);
    return {
      publishToMeta: (u: object) => m(u).publishToMeta(metaInput),
      publishAssembledAds: (u: object) => m(u).publishAssembledAds(assembledInput),
      pushCampaign: (u: object) => g(u).pushCampaign({ kitId: 1 }),
    };
  };

  it("trial is refused before the database is touched, on all three push procedures", async () => {
    const p = await pushes();
    for (const [name, fn] of Object.entries(p)) {
      db.getDbCalls = 0;
      expect(await verdict(fn(TRIAL)), name).toBe("pro_only");
      expect(db.getDbCalls, name).toBe(0);
    }
  });

  it("Pro gets past the push gate on all three (negative control)", async () => {
    const p = await pushes();
    for (const [name, fn] of Object.entries(p)) {
      const v = await verdict(fn(PRO));
      expect(v, name).not.toBe("pro_only");
      expect(["quota_exceeded", "trial_expired"], name).not.toContain(v);
    }
  });
});

describe("source pins — the wiring the unit tests above cannot see", () => {
  const read = (p: string) => readFileSync(join(__dirname, p), "utf8");

  it.each([
    ["routers/offers.ts", "offers"], ["routers/adCopy.ts", "adCopy"], ["routers/icps.ts", "icp"],
    ["routers/emailSequences.ts", "email"], ["routers/whatsappSequences.ts", "whatsapp"], ["routers/hvco.ts", "hvco"],
    ["routers/heroMechanisms.ts", "heroMechanisms"], ["routers/headlines.ts", "headlines"],
  ])("%s: trial takes enforceQuota, every other tier keeps its pre-sprint limit block, in both procedures", (file, gen) => {
    const src = read(file);
    const branch = new RegExp(
      `if \\(countsUsage\\((ctx\\.user|user)\\)\\) \\{\\n[^\\n]*\\n\\s+await enforceQuota\\(\\1\\.id, "${gen}", \\1\\.role\\);\\n\\s+\\} else if \\(\\1\\.role !== "superuser"\\) \\{`, "g");
    expect(src.match(branch)?.length).toBe(2);
    expect(src.match(/monthly limit of \$\{(limit|maxHeadlines)\}/g)?.length).toBe(2); // the old Pro/agency message, kept
  });

  it("headlines keep their old per-path Pro/agency numbers (6/20 sync, 20/50 async)", () => {
    const src = read("routers/headlines.ts");
    expect(src).toContain('const maxHeadlines = ctx.user.subscriptionTier === "agency" ? 20 : 6;');
    expect(src).toContain('const maxHeadlines = user.subscriptionTier === "agency" ? 50 : user.subscriptionTier === "pro" ? 20 : 6;');
  });

  it("landing pages keep their pre-sprint hardcoded table", () => {
    const src = read("routers/landingPages.ts");
    expect(src.match(/const quotaLimits = \{ trial: 2, pro: 50, agency: 500 \}/g)?.length).toBe(2);
  });

  it.each([
    ["offersGenerator.ts", "offers", "const offerId = insertResult[0].insertId;"],
    ["adCopyGenerator.ts", "adCopy", "await db.insert(adCopy).values(__g.kept as any);"],
    ["emailSequenceGenerator.ts", "email", "await db.insert(emailSequences).values("],
    ["whatsappSequenceGenerator.ts", "whatsapp", "await db.insert(whatsappSequences).values("],
  ])("%s counts trial usage AFTER its insert — the five never-incremented counters", (file, gen, insertMarker) => {
    const src = read(file);
    const ins = src.indexOf(insertMarker);
    const cnt = src.indexOf(`countTrialUsage(input.userId, "${gen}")`);
    expect(ins).toBeGreaterThan(-1);
    expect(cnt).toBeGreaterThan(ins);
  });

  it("ICP is counted in generate / generateAsync and NEVER in sharpenWithLadder", () => {
    const src = read("routers/icps.ts");
    const sharpen = src.indexOf("sharpenWithLadder: protectedProcedure");
    expect(sharpen).toBeGreaterThan(-1);
    const before = src.slice(0, sharpen);
    const after = src.slice(sharpen);
    expect(before.match(/await countTrialUsage\(ctx\.user\.id, "icp"\)/g)?.length).toBe(2);
    expect(after).not.toMatch(/countTrialUsage/);
  });

  it("the three db.ts counters count every tier, exactly as before (D5 as corrected)", () => {
    const src = read("db.ts");
    expect(src).not.toMatch(/trialUsageWhere/);
    for (const f of ["headlineGeneratedCount", "hvcoGeneratedCount", "heroMechanismGeneratedCount"]) {
      const i = src.indexOf(`.set({ ${f}: sql\``);
      expect(i, f).toBeGreaterThan(-1);
      expect(src.slice(i, i + 200), f).toMatch(/\.where\(eq\(users\.id, userId\)\);/);
    }
  });

  it("push gate is the FIRST statement of every push procedure", () => {
    for (const [file, proc] of [["routers/meta.ts", "publishToMeta"], ["routers/meta.ts", "publishAssembledAds"], ["routers/ghl.ts", "pushCampaign"]]) {
      const src = read(file);
      const at = src.indexOf(`  ${proc}: protectedProcedure`);
      const body = src.slice(src.indexOf(".mutation(async ({ ctx, input }) => {", at));
      const firstStatement = body.split("\n").slice(1).find((l) => l.trim() && !l.trim().startsWith("//"));
      expect(firstStatement?.trim(), proc).toBe("assertCanPush(ctx.user);");
    }
  });

  it("the Trail never loops on a limit: every orchestrateStep catch that records lastError halts on a usage limit first", () => {
    const src = read("../client/src/v2/V2Trail.tsx");
    const catches = src.match(/\} catch \((\w+)\) \{\n\s+if \(await haltOnUsageLimit\(\1[,)]/g) ?? [];
    const recordsLastError = src.match(/\} catch \((\w+)\) \{\n(?:\s+if \(await haltOnUsageLimit[^\n]*\n)?\s+lastError = \1 instanceof Error/g) ?? [];
    expect(recordsLastError.length).toBe(10);
    expect(catches.length).toBe(recordsLastError.length);
  });
});
