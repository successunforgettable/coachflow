import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { checkOutput } from "./_core/complianceAxis";
import { buildCoachCorpus, buildProofSupplied } from "./_core/groundingCorpus";

/**
 * Locks the two live defects fixed on 2026-08-04. Both were silent: neither threw, neither failed a
 * test, and both made the gate report a clean pass it had not actually earned.
 */

const service: any = { name: "Career pivot coaching", category: "coaching" };
const grounding = {
  corpus: buildCoachCorpus({ service, groundingMeta: null }),
  supplied: buildProofSupplied(service),
};

// Invented proof for a coach who supplied nothing — this MUST be caught whenever the
// fabrication half actually runs.
const INVENTED = "94% of my clients land a role within 90 days.";
const fields = [{ location: "body", text: INVENTED, role: "body" as const }];

describe("DEFECT (a) — fail CLOSED when the coach's material cannot be loaded", () => {
  it("REGRESSION GUARD: without grounding the fabrication half does not run at all", () => {
    // This is the defect, preserved as a fact rather than a bug: compliance still runs, but no
    // fabrication hit is produced, because there is nothing to check the claim against.
    const res = checkOutput(fields, undefined);
    expect(res.blocking.some((h) => h.classId === "invented_statistic")).toBe(false);
  });

  it("silently reported a CLEAN PASS before the fix — the exact failure mode", () => {
    const res = checkOutput(fields, undefined);
    expect(res.ok).toBe(true); // "could not check" was indistinguishable from "passed"
  });

  it("now BLOCKS when the caller requires grounding", () => {
    const res = checkOutput(fields, undefined, { requireGrounding: true });
    expect(res.ok).toBe(false);
    expect(res.blocking.some((h) => h.classId === "fabrication_check_unavailable")).toBe(true);
  });

  it("gives the retry a reason it can act on", () => {
    const res = checkOutput(fields, undefined, { requireGrounding: true });
    expect(res.failContext).toMatch(/could not be checked against it/i);
  });

  it("stays OPT-IN — callers that legitimately pass no grounding are unaffected", () => {
    // Landing-page generation, the compliance router's single-row check and the unit tests all
    // pass no grounding by design. A global change would break them for no safety gain.
    const res = checkOutput(fields, undefined);
    expect(res.blocking.some((h) => h.classId === "fabrication_check_unavailable")).toBe(false);
  });

  it("does not fire when grounding IS usable — the check runs normally", () => {
    const res = checkOutput(fields, grounding, { requireGrounding: true });
    expect(res.blocking.some((h) => h.classId === "fabrication_check_unavailable")).toBe(false);
    expect(res.blocking.some((h) => h.classId === "invented_statistic")).toBe(true);
  });

  it("does not fire on a half-built grounding object", () => {
    const partial = { corpus: grounding.corpus, supplied: undefined } as any;
    const res = checkOutput(fields, partial, { requireGrounding: true });
    expect(res.blocking.some((h) => h.classId === "fabrication_check_unavailable")).toBe(true);
  });

  it("does not fire on empty copy — nothing to check is not an unverified claim", () => {
    const empty = [{ location: "body", text: "   ", role: "body" as const }];
    const res = checkOutput(empty, undefined, { requireGrounding: true });
    expect(res.blocking.some((h) => h.classId === "fabrication_check_unavailable")).toBe(false);
  });
});

describe("DEFECT (b) — scripts adjudicate against the same ground truth as concepts", () => {
  // conceptScriptGenerator passed `groundingMeta: null` while conceptGenerator and adCopyGenerator
  // passed the real value. groundingMeta carries the coach's VERBATIM ladder answers, which feed
  // corpus.text — the haystack claimIsGrounded() searches. Dropping it did not merely weaken
  // detection: a figure the coach ACTUALLY stated became unfindable and read as invented.
  const svc: any = {
    name: "Sleep coaching",
    category: "coaching",
    coachBackground: "Independent sleep consultant.",
  };
  const ladder = { ladderAnswers: { clients: "I have worked with 38 families since 2021." } };

  it("ladder answers reach the corpus the validator searches", () => {
    const withMeta = buildCoachCorpus({ service: svc, groundingMeta: ladder });
    expect(withMeta.text).toContain("38");
  });

  it("REGRESSION GUARD: dropping groundingMeta loses the coach's own words", () => {
    const withoutMeta = buildCoachCorpus({ service: svc, groundingMeta: null });
    expect(withoutMeta.text).not.toContain("38");
  });

  it("the dropped material is what made honest copy look invented", () => {
    const withMeta = buildCoachCorpus({ service: svc, groundingMeta: ladder });
    const withoutMeta = buildCoachCorpus({ service: svc, groundingMeta: null });
    // Strictly more ground truth with the ladder answers — so strictly fewer false positives.
    expect(withMeta.words).toBeGreaterThan(withoutMeta.words);
  });

  it("a real supplied figure is NOT flagged once the ladder answers are present", () => {
    const g = {
      corpus: buildCoachCorpus({ service: svc, groundingMeta: ladder }),
      supplied: buildProofSupplied(svc),
    };
    const res = checkOutput(
      [{ location: "body", text: "I have worked with 38 families since 2021.", role: "body" as const }],
      g,
      { requireGrounding: true },
    );
    expect(res.blocking.some((h) => String(h.classId).startsWith("invented"))).toBe(false);
  });
});

describe("wiring guards — the defects were one-token mistakes no behavioural test caught", () => {
  // Both defects lived in how a generator CALLED the gate, not in the gate itself. A behavioural
  // test of buildCoachCorpus/checkOutput passes either way, which is precisely why these shipped.
  // These read the call sites directly.
  const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

  it("conceptScriptGenerator passes the REAL groundingMeta, never a null literal", () => {
    const src = read("./conceptScriptGenerator.ts");
    expect(src).toMatch(/groundingMeta:\s*gateIcp\?\.groundingMeta/);
    expect(src).not.toMatch(/buildCoachCorpus\(\{\s*service:\s*gateService,\s*groundingMeta:\s*null\s*\}\)/);
  });

  it("both Andromeda generators require grounding — they feed live ads", () => {
    for (const f of ["./conceptGenerator.ts", "./conceptScriptGenerator.ts"]) {
      expect(read(f)).toMatch(/requireGrounding:\s*true/);
    }
  });

  it("the Meta publish gate requires grounding — the last boundary before a live ad", () => {
    const src = read("./routers/meta.ts");
    expect(src).toMatch(/requireGrounding:\s*true/);
    // The old shape skipped BOTH compliance and fabrication when the service row was missing.
    expect(src).not.toMatch(/const gate = svc \? checkOutput\(/);
  });
});
