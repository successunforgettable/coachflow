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

describe("D3 — every ad-image generation route carries the trial cap", () => {
  it("generate, generateAsync, regenerateSingle and makeVertical all call the gate as their first statement", () => {
    const src = readFileSync(join(__dirname, "routers/adCreatives.ts"), "utf8");
    for (const proc of ["generate", "generateAsync", "regenerateSingle", "makeVertical"]) {
      const at = src.indexOf(`  ${proc}: protectedProcedure`);
      expect(at, proc).toBeGreaterThan(-1);
      const m = src.slice(at).match(/\.mutation\(async \(\{[^}]*\}\) => \{\n/);
      const body = src.slice(at + (m!.index ?? 0) + m![0].length);
      const first = body.split("\n").find((l) => l.trim() && !l.trim().startsWith("//"));
      expect(first?.trim(), proc).toBe("await enforceFreeTierAdImageGate(ctx.user.id, ctx.user.subscriptionTier, ctx.user.role);");
    }
  });
});

describe("the remaining AI routes — an ended trial is blocked, expiry only (confirmed 2026-09-24)", () => {
  it.each([
    ["services", "extractFromText"], ["services", "expandProfile"], ["icps", "sharpenWithLadder"],
    ["icpAngleSuggestions", "generate"], ["icpAngleSuggestions", "generateICPs"], ["videoScripts", "generate"],
    ["videoScripts", "generateAsync"], ["whatsappSequences", "retoneSequence"], ["compliance", "rewordForAdvisory"],
    ["sourceOfTruth", "generate"],
  ])("%s.%s checks the trial is live as its FIRST statement, and adds no quota", (router, proc) => {
    const src = readFileSync(join(__dirname, `routers/${router}.ts`), "utf8");
    const at = src.indexOf(`\n  ${proc}: protectedProcedure`);
    expect(at).toBeGreaterThan(-1);
    const nextProc = src.slice(at + 5).search(/\n  [a-zA-Z]+: (protectedProcedure|publicProcedure|adminProcedure)/);
    const proc_body = nextProc === -1 ? src.slice(at) : src.slice(at, at + 5 + nextProc);
    const m = proc_body.match(/\.mutation\(async \(\{[^}]*\}[^)]*\) => \{\n/);
    const body = proc_body.slice((m!.index ?? 0) + m![0].length);
    const first = body.split("\n").find((l) => l.trim() && !l.trim().startsWith("//"));
    expect(first?.trim()).toMatch(/^await enforceTrialActive\(ctx\.user\.id, ctx\.user\.role, "[a-zA-Z]+"\);$/);
    expect(proc_body).not.toMatch(/enforceQuota|countUsage|countTrialUsage/); // expiry only — no new quota
  });

  it("through the real procedure: an ended trial is refused before the model is called; Pro reaches the model call", async () => {
    const { servicesRouter } = await import("./routers/services");
    const { usageLimitError } = await import("./lib/tierAccess");
    const svc = (u: object) => servicesRouter.createCaller({ user: u, req: {}, res: {} } as any);
    // ≥ 120 characters: the procedure's own input minimum — a shorter text is refused by validation before any gate,
    // which would make this test prove nothing.
    const rawText = "I help women who left professional careers to raise their children get back into work they love, with a clear six week plan and weekly calls.";
    expect(rawText.length).toBeGreaterThanOrEqual(120);
    quota.enforceTrialActive.mockRejectedValueOnce(usageLimitError("trial_expired", "intake"));
    expect(await verdict(svc(TRIAL).extractFromText({ rawText }))).toBe("trial_expired");
    expect(quota.enforceTrialActive).toHaveBeenCalledWith(TRIAL.id, TRIAL.role, "intake");
    // Pro: the (real, in trialAccess) check passes for paid plans; here the spy lets it through and the procedure goes
    // on to the model — whose mock throws, proving the call was reached and nothing before it refused.
    for (const u of [PRO, AGENCY, ADMIN]) {
      quota.enforceTrialActive.mockClear();
      const v = await verdict(svc(u).extractFromText({ rawText }));
      expect(v).toContain("LLM_NOT_CALLED_IN_TESTS"); // it reached the model call — nothing before it refused
      expect(v).not.toBe("trial_expired");
      expect(quota.enforceTrialActive).toHaveBeenCalledTimes(1);
    }
  });
});

describe("Tweak / regenerate — behaviour through the real procedure", () => {
  it("an ended trial is refused before the database is touched; the check also runs for Pro (and passes there)", async () => {
    const { headlinesRouter } = await import("./routers/headlines");
    const { usageLimitError } = await import("./lib/tierAccess");
    const h = (u: object) => headlinesRouter.createCaller({ user: u, req: {}, res: {} } as any);
    quota.enforceTrialActive.mockRejectedValueOnce(usageLimitError("trial_expired", "headlines"));
    db.getDbCalls = 0;
    expect(await verdict(h(TRIAL).regenerateSingle({ id: 1 }))).toBe("trial_expired");
    expect(db.getDbCalls).toBe(0);
    expect(quota.enforceTrialActive).toHaveBeenCalledWith(TRIAL.id, TRIAL.role, "headlines");
    quota.enforceTrialActive.mockClear();
    const v = await verdict(h(PRO).regenerateSingle({ id: 1 }));
    expect(v).not.toBe("trial_expired");
    expect(quota.enforceTrialActive).toHaveBeenCalledWith(PRO.id, PRO.role, "headlines");
  });
});

describe("source pins — the wiring the unit tests above cannot see", () => {
  const read = (p: string) => readFileSync(join(__dirname, p), "utf8");

  it.each([
    ["routers/offers.ts", "offers"], ["routers/adCopy.ts", "adCopy"], ["routers/icps.ts", "icp"],
    ["routers/emailSequences.ts", "email"], ["routers/whatsappSequences.ts", "whatsapp"], ["routers/hvco.ts", "hvco"],
    ["routers/heroMechanisms.ts", "heroMechanisms"], ["routers/headlines.ts", "headlines"],
  ])("%s: both generate procedures enforce the table for every tier — no inline or hardcoded limit left", (file, gen) => {
    const src = read(file);
    expect(src.match(new RegExp(`await enforceQuota\\((ctx\\.user|user)\\.id, "${gen}", (ctx\\.user|user)\\.role\\)`, "g"))?.length).toBe(2);
    expect(src).not.toMatch(/GeneratedCount >= /);
    expect(src).not.toMatch(/maxHeadlines/);
    expect(src).not.toMatch(/countsUsage/);
    expect(src).not.toMatch(/getQuotaLimit\(/);
  });

  it("landing pages: the table only — no router table, no check-before-reset", () => {
    const src = read("routers/landingPages.ts");
    expect(src).not.toMatch(/quotaLimits = \{/);
    expect(src).not.toMatch(/checkAndResetQuotaIfNeeded/);
    expect(src.match(/await enforceQuota\(ctx\.user\.id, "landingPages"\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    ["videos", "regenerateSingle"], ["icps", "regenerateSection"], ["adCopy", "regenerateSingle"],
    ["complianceRewrites", "generateMore"], ["headlines", "regenerateSingle"], ["offers", "regenerateSection"],
    ["emailSequences", "regenerateSingle"], ["hvco", "regenerateQuiz"], ["hvco", "regenerateSingle"],
    ["heroMechanisms", "regenerateSingle"], ["whatsappSequences", "regenerateSingle"],
  ])("Tweak / regenerate %s.%s checks the trial is live as its FIRST statement", (router, proc) => {
    const src = read(`routers/${router}.ts`);
    const at = src.indexOf(`  ${proc}: protectedProcedure`);
    expect(at).toBeGreaterThan(-1);
    const m = src.slice(at).match(/\.mutation\(async \(\{[^}]*\}\) => \{\n/);
    const body = src.slice(at + (m!.index ?? 0) + m![0].length);
    const first = body.split("\n").find((l) => l.trim() && !l.trim().startsWith("//"));
    expect(first?.trim()).toMatch(/^await enforceTrialActive\(ctx\.user\.id, ctx\.user\.role, "[a-zA-Z]+"\);$/);
  });

  it.each([
    ["offersGenerator.ts", "offers", "const offerId = insertResult[0].insertId;"],
    ["adCopyGenerator.ts", "adCopy", "await db.insert(adCopy).values(__g.kept as any);"],
    ["emailSequenceGenerator.ts", "email", "await db.insert(emailSequences).values("],
    ["whatsappSequenceGenerator.ts", "whatsapp", "await db.insert(whatsappSequences).values("],
  ])("%s counts usage (every tier) AFTER its insert — the five formerly uncounted counters", (file, gen, insertMarker) => {
    const src = read(file);
    const ins = src.indexOf(insertMarker);
    const cnt = src.indexOf(`countUsage(input.userId, "${gen}")`);
    expect(src).not.toMatch(/countTrialUsage/);
    expect(ins).toBeGreaterThan(-1);
    expect(cnt).toBeGreaterThan(ins);
  });

  it("ICP is counted in generate / generateAsync and NEVER in sharpenWithLadder", () => {
    const src = read("routers/icps.ts");
    const sharpen = src.indexOf("sharpenWithLadder: protectedProcedure");
    expect(sharpen).toBeGreaterThan(-1);
    const before = src.slice(0, sharpen);
    const after = src.slice(sharpen);
    expect(before.match(/await countUsage\(ctx\.user\.id, "icp"\)/g)?.length).toBe(2);
    expect(after).not.toMatch(/countUsage|countTrialUsage/);
  });

  it("the three db.ts counters count every tier", () => {
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
