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
