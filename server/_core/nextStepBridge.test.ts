import { describe, it, expect } from "vitest";
import { resolveNextStep, additionalPageRefusalReason, type BridgeOutcome } from "./nextStepBridge";

// ─────────────────────────────────────────────────────────────────────────────
// THE MAGNET → FREE-EVENT BRIDGE. Pointer resolution and the additional-page guard.
//
// `nextStepUrl` has existed as a render-time seam in `leadMagnetRenderer.ts` since the tier-3 work
// (`c8a0bf5`) and NOTHING HAS EVER POPULATED IT. All three renderers accept it; every caller in
// `leadMagnetPublisher.ts` omits it. This is what fills it.
//
// 🔑 WHY THE POINTER IS EXPLICIT AND NEVER DERIVED — the same test applied twice.
// A kit-level pointer would force `publishLeadMagnet` to hop serviceId → first ICP for that service
// → kit, and that middle hop pairs by accident: right when there is one ICP, silently wrong when
// there are several. The column therefore lives on `hvcoTitles` and is read off a row already in
// hand. The WRITE side gets the identical treatment: `landingPages.generate` takes `hvcoId` as an
// explicit input and must never infer which magnet a page belongs to from the kit's or the
// service's currently-selected one. Same failure, mirrored — correct by accident with one magnet,
// silently wrong with several. The pairing is a CONTENT decision made at generation time, so the
// caller states it.
//
// ⚠️ A WRONG BRIDGE IS WORSE THAN NO BRIDGE, which is what makes silence the danger here rather
// than an error. A magnet linking to the wrong live page looks finished and reads as correct; the
// coach never finds out, and neither does the reader.
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveNextStep — three outcomes, and only one of them is a link", () => {
  it("NO POINTER → no url, and the caller is told which case it was", () => {
    for (const p of [null, undefined]) {
      const r = resolveNextStep(p, null);
      expect(r).toEqual({ url: null, outcome: "no-pointer" satisfies BridgeOutcome });
    }
  });

  it("POINTER SET, TARGET UNPUBLISHED → no url. The honest text card, not a dead anchor", () => {
    // The page exists and the pairing is recorded; it simply has no address yet. `publicUrl` is
    // written by `runLandingPagePublish` and is NULL until then. Rendering a button here would be
    // the dead `href="#"` the tier-3 work removed.
    for (const page of [{ publicUrl: null }, { publicUrl: "" }, { publicUrl: "   " }]) {
      expect(resolveNextStep(4321, page)).toEqual({ url: null, outcome: "target-unpublished" });
    }
  });

  it("POINTER SET, TARGET MISSING → target-unpublished, never a crash and never a guess", () => {
    // ON DELETE SET NULL means a deleted page nulls the pointer, so this is belt-and-braces: a row
    // that cannot be loaded resolves the same way as one that is not live. It must never throw and
    // must never fall back to some other page.
    expect(resolveNextStep(4321, null)).toEqual({ url: null, outcome: "target-unpublished" });
    expect(resolveNextStep(4321, undefined)).toEqual({ url: null, outcome: "target-unpublished" });
  });

  it("POINTER SET, TARGET PUBLISHED → the page's own publicUrl, passed through exactly", () => {
    const url = "https://zapcampaigns.com/p/career-reinvention-blueprint-231";
    expect(resolveNextStep(4321, { publicUrl: url })).toEqual({ url, outcome: "linked" });
  });

  it("A ZERO POINTER IS NOT A POINTER — 0 is falsy and must not be read as row 0", () => {
    expect(resolveNextStep(0, { publicUrl: "https://x" })).toEqual({ url: null, outcome: "no-pointer" });
  });
});

describe("additionalPageRefusalReason — the free-event page is never a kit's first or only page", () => {
  // 🔴 THE COMPLETENESS CONSTRAINT, ENFORCED SERVER-SIDE. `crownIfPrimary` skips `autoSelectBest`
  // for an additional page, which also skips the kit COMPLETENESS check — so a kit whose only
  // landing page were the free-event page would never flip draft → complete, because nothing else
  // would ever crown one. `validateCascadePrereqs` does NOT cover this: it requires offer,
  // mechanism, hvco, headlines and adCopy, and says nothing about a landing page.
  //
  // Server-side rather than a UI affordance, deliberately: a guarantee a caller can bypass is not
  // one, and the eventual automatic trigger is a caller too.
  it("REFUSES when the kit carries no selectedLandingPageId", () => {
    for (const kit of [{ selectedLandingPageId: null }, { selectedLandingPageId: 0 }]) {
      const reason = additionalPageRefusalReason(kit);
      expect(reason).toBeTruthy();
      expect(reason).toMatch(/primary|first|only/i);
    }
  });

  it("REFUSES when there is no kit at all", () => {
    expect(additionalPageRefusalReason(null)).toBeTruthy();
    expect(additionalPageRefusalReason(undefined)).toBeTruthy();
  });

  it("ALLOWS when the kit already has a primary landing page", () => {
    expect(additionalPageRefusalReason({ selectedLandingPageId: 77 })).toBeNull();
  });
});

describe("the pairing is DECLARED by the caller, never derived — pinned in source", () => {
  it("generate takes hvcoId explicitly and writes the pointer from THAT, not from a selection", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../routers/landingPages.ts", import.meta.url), "utf8");
    // The input exists and the write reads it.
    expect(/nextStepForHvcoId/.test(src)).toBe(true);
    expect(/nextStepLandingPageId/.test(src)).toBe(true);
    // 🔴 THE GUARD THAT MATTERS: this file must never reach for the kit's or the service's
    // currently-selected magnet to decide which magnet a page belongs to. `selectedHvcoId` appearing
    // here at all would mean the pairing had become derivable, which is the failure this whole
    // design exists to refuse.
    expect(src.match(/selectedHvcoId/g) ?? []).toHaveLength(0);
  });

  it("ON DELETE SET NULL is declared in BOTH the migration and the schema", async () => {
    // ⚠️ PINNED BY DECLARATION, NOT EXERCISED. Migration 0105 is written and NOT APPLIED, so no
    // test here can observe the database actually nulling the pointer. What is checkable is that
    // both representations agree — and they are the pair most likely to drift.
    //
    // SET NULL is right for a LIVE POINTER and would be wrong for provenance: 0103's note records
    // that erasing provenance destroys the record of what was baked into an artefact that still
    // exists. Here the opposite holds — a deleted page must drop the magnet to the honest text
    // card, never leave it pointing at a row that is gone.
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(new URL("../../drizzle/0105_hvco_next_step_landing_page.sql", import.meta.url), "utf8");
    expect(/ON DELETE SET NULL/i.test(sql)).toBe(true);
    expect(/nextStepLandingPageId/.test(sql)).toBe(true);

    const schema = readFileSync(new URL("../../drizzle/schema.ts", import.meta.url), "utf8");
    expect(/nextStepLandingPageId:\s*int\("nextStepLandingPageId"\)[\s\S]{0,160}?onDelete:\s*"set null"/.test(schema)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE CASCADE TRIGGER — the free-event page generated automatically at step 6.
// Tests 1-4 and 6 of the approved plan. Tests 5 and 7 need a live cascade run.
// ─────────────────────────────────────────────────────────────────────────────
describe("TEST 1 — the skip path: all three event facts, or nothing is generated", () => {
  const f = (es: any) => ({ eventSchedule: es });
  it("ALL THREE present → proceed", async () => {
    const { hasAllEventFacts } = await import("./nextStepBridge");
    expect(hasAllEventFacts(f({ date: "March 14", time: "2pm", timezone: "GMT" }))).toBe(true);
  });
  it("ANY ONE missing, empty or whitespace → SKIP. Two of three is not 'mostly ready'", async () => {
    const { hasAllEventFacts } = await import("./nextStepBridge");
    const cases = [
      { date: "March 14", time: "2pm" },
      { date: "March 14", timezone: "GMT" },
      { time: "2pm", timezone: "GMT" },
      { date: "March 14", time: "2pm", timezone: "" },
      { date: "March 14", time: "   ", timezone: "GMT" },
      { date: null, time: "2pm", timezone: "GMT" },
      {},
    ];
    for (const c of cases) expect(hasAllEventFacts(f(c))).toBe(false);
    expect(hasAllEventFacts(null)).toBe(false);
    expect(hasAllEventFacts(undefined)).toBe(false);
    expect(hasAllEventFacts({} as any)).toBe(false);
  });
});

describe("TEST 2 — the trigger runs for lead_magnet campaigns and no other", () => {
  it("the block is gated on campaignType === 'lead_magnet', and the gate is the only entry", async () => {
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(new URL("./orchestration.ts", import.meta.url), "utf8");
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // Exactly one gate, and the free-step work sits inside it.
    expect(src.match(/input\.campaignType === "lead_magnet"/g) ?? []).toHaveLength(1);
    expect(/input\.campaignType === "lead_magnet"[\s\S]{0,4000}?LP_FRAMING_FREE_NEXT_STEP/.test(src)).toBe(true);
    // The other six campaign types reach no free-step code: the framing constant appears once.
    expect(src.match(/LP_FRAMING_FREE_NEXT_STEP/g) ?? []).toHaveLength(2); // import + single use
  });
  it("the generated page is ALWAYS additional — it can never crown the kit", async () => {
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(new URL("./orchestration.ts", import.meta.url), "utf8");
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(/pageType: "webinar_registration"[\s\S]{0,400}?pageRole: "additional"/.test(src)).toBe(true);
  });
});

describe("TEST 3 — the additional page does not consume quota", () => {
  it("primary consumes, additional does not, and the default is primary", async () => {
    const { consumesLandingPageQuota } = await import("./nextStepBridge");
    expect(consumesLandingPageQuota("primary")).toBe(true);
    expect(consumesLandingPageQuota(undefined)).toBe(true);   // every existing caller
    expect(consumesLandingPageQuota("additional")).toBe(false);
  });
  it("the generator gates its ONE increment on that predicate", async () => {
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(new URL("../landingPageGenerator.ts", import.meta.url), "utf8");
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(/if \(consumesLandingPageQuota\(input\.pageRole\)\) \{\s*await incrementQuotaCount\(/.test(src)).toBe(true);
    expect(src.match(/await incrementQuotaCount\(/g) ?? []).toHaveLength(1);
  });
});

describe("TEST 4 — the pointer is written from the kit's OWN selected magnet, never derived", () => {
  it("the trigger writes hvcoTitles.nextStepLandingPageId scoped by magnet id AND owner", async () => {
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(new URL("./orchestration.ts", import.meta.url), "utf8");
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // magnetId comes from kit.selectedHvcoId — the kit's own crowned selection, not a lookup.
    expect(/const magnetId = kit\.selectedHvcoId/.test(src)).toBe(true);
    // The write is owner-scoped in the predicate, not only checked beforehand.
    expect(/nextStepLandingPageId: freeStepPageId[\s\S]{0,220}?eq\(hvcoTitles\.userId, input\.userId\)/.test(src)).toBe(true);
    // No selection is inferred from the service — the pair-by-accident shape stays refused.
    expect(/hvcoTitles\.serviceId[\s\S]{0,80}?limit\(1\)[\s\S]{0,80}?nextStepLandingPageId/.test(src)).toBe(false);
  });
  it("no magnet selected → the block skips rather than guessing one", async () => {
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(new URL("./orchestration.ts", import.meta.url), "utf8");
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(/if \(!haveAllThree \|\| !magnetId\)/.test(src)).toBe(true);
  });
});

describe("TEST 6 — the renderer stamp", () => {
  it("returns NULL when no build identifier exists — it never guesses", async () => {
    const { currentBuildSha } = await import("./buildStamp");
    const saved = { b: process.env.BUILD_SHA, r: process.env.RAILWAY_GIT_COMMIT_SHA, s: process.env.SOURCE_COMMIT };
    delete process.env.BUILD_SHA; delete process.env.RAILWAY_GIT_COMMIT_SHA; delete process.env.SOURCE_COMMIT;
    expect(currentBuildSha()).toBeNull();
    process.env.BUILD_SHA = "  ";
    expect(currentBuildSha()).toBeNull();          // blank is absent, not a stamp
    process.env.BUILD_SHA = "2cb6491abc";
    expect(currentBuildSha()).toBe("2cb6491abc");
    process.env.BUILD_SHA = "x".repeat(80);
    expect(currentBuildSha()!.length).toBe(40);    // varchar(40) — truncate, never fail a publish
    if (saved.b === undefined) delete process.env.BUILD_SHA; else process.env.BUILD_SHA = saved.b;
    if (saved.r !== undefined) process.env.RAILWAY_GIT_COMMIT_SHA = saved.r;
    if (saved.s !== undefined) process.env.SOURCE_COMMIT = saved.s;
  });
  it("both publishers stamp, and the LP also records the event facts it was given", async () => {
    const { readFileSync } = await import("node:fs");
    const lp = readFileSync(new URL("../landingPagePublisher.ts", import.meta.url), "utf8");
    const mg = readFileSync(new URL("../leadMagnetPublisher.ts", import.meta.url), "utf8");
    expect(/renderedBuild: currentBuildSha\(\)/.test(lp)).toBe(true);
    expect(/renderedBuild: (currentBuildSha|quizBuildSha)\(\)/.test(mg)).toBe(true);
    // Event facts are DECLARED by the caller — the publisher never joins its way to them.
    expect(/input\.eventFacts/.test(lp)).toBe(true);
    expect(/idealCustomerProfiles/.test(lp)).toBe(false);
  });
});
