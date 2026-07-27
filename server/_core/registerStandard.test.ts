import { describe, it, expect } from "vitest";
import { REGISTER_STANDARD, registerPersonGuidance, physicalSubjectGuidance } from "./copywritingRules";

/**
 * Register standard (2026-07-27). These lock the two properties the standard has to
 * hold to do its job, both of which are easy to lose in a later prompt edit:
 *
 *  1. POSITIVE FRAMING (§14) — it describes the register the copy IS. Naming failure
 *     shapes primes the model to emit them; that is the documented Sprint-B cause.
 *  2. THE THIRD-PERSON GATE — the no-proof branch must never put a client story in
 *     front of a coach who has no client, because inventing one is the exact
 *     fabrication the copy rules prohibit.
 */
describe("REGISTER_STANDARD", () => {
  it("is positive-framed — states what the copy is, with no banned-phrase list", () => {
    const negativeMarkers = [/\bnever write\b/i, /\bdo not write\b/i, /\bbanned\b/i, /\bforbidden\b/i, /\bWrong:/i];
    for (const m of negativeMarkers) expect(REGISTER_STANDARD).not.toMatch(m);
  });

  it("names the advertiser's own side as the vantage point", () => {
    expect(REGISTER_STANDARD).toMatch(/advertiser's side/i);
    expect(REGISTER_STANDARD).toMatch(/coach has lived/i);
  });

  it("preserves emotional force explicitly — intensity is not the banned thing", () => {
    expect(REGISTER_STANDARD).toMatch(/intensity/i);
    expect(REGISTER_STANDARD).toMatch(/Specificity is what makes copy land/i);
  });

  it("points second-person usage at the offer, which is Meta's stated remedy", () => {
    expect(REGISTER_STANDARD).toMatch(/speaks about the offer and what\s+it does/i);
  });

  it("routes the enumerated attribute classes to the coach's own experience", () => {
    expect(REGISTER_STANDARD).toMatch(/health, body, mental state, financial standing/i);
    expect(REGISTER_STANDARD).toMatch(/never things the copy states or implies about the\s+person reading it/i);
  });
});

describe("registerPersonGuidance", () => {
  it("offers third person ONLY when real client material is supplied", () => {
    expect(registerPersonGuidance(true)).toMatch(/third-person/i);
    expect(registerPersonGuidance(true)).toMatch(/ONLY from the supplied material/i);
  });

  it("never mentions a client story on the no-proof branch", () => {
    const g = registerPersonGuidance(false);
    for (const m of [/client story/i, /case study/i, /testimonial/i]) expect(g).not.toMatch(m);
  });

  it("gives the no-proof branch a complete positive brief rather than a restriction", () => {
    const g = registerPersonGuidance(false);
    expect(g).toMatch(/First person throughout/i);
    expect(g).toMatch(/the moment they remember/i);
    expect(g).toMatch(/the shift the method creates/i);
  });

  it("holds every figure to the supplied material on both branches", () => {
    expect(registerPersonGuidance(false)).toMatch(/appears in the supplied material/i);
    expect(registerPersonGuidance(true)).toMatch(/appear there/i);
  });
});

/**
 * Physical-subject guidance. NOT a niche band: it never classifies the service and
 * never persists anything. It reads the generation context already being sent, and
 * only fires when the offer's own words put the body in the subject position.
 *
 * The behaviour it exists to prevent was observed live (2026-07-27): a service record
 * written as "lose weight fast and get back to their pre-pregnancy body" pulled the
 * generated copy onto the reader's body — "The clothes still don't fit… You avoid the
 * camera… the mirror is a daily reminder" — despite the register standard being present.
 */
describe("physicalSubjectGuidance", () => {
  it("stays silent for offers that have nothing to do with the body", () => {
    for (const ctx of [
      "An 8-week cohort for freelance UX designers moving from projects to retainers",
      "A live mastermind teaching how cryptocurrency and blockchain actually work",
      "Helping people restarting their working lives launch an AI consultancy",
      "",
    ]) {
      expect(physicalSubjectGuidance(ctx)).toBe("");
    }
  });

  it("fires on the prod postpartum weight-loss wording that caused the leak", () => {
    const g = physicalSubjectGuidance(
      "Helping postpartum women lose weight fast and get back to their pre-pregnancy body and confidence.",
    );
    expect(g).not.toBe("");
    expect(g).toMatch(/PHYSICAL SUBJECT/);
  });

  it("fires on fitness and body-composition wording generally, case-insensitively", () => {
    for (const ctx of ["Weight Loss coaching", "get toned", "drop a DRESS SIZE", "body recomposition"]) {
      expect(physicalSubjectGuidance(ctx)).not.toBe("");
    }
  });

  it("redirects the subject to capability rather than appearance", () => {
    const g = physicalSubjectGuidance("weight loss");
    expect(g).toMatch(/CAPABILITY/);
    expect(g).toMatch(/lifting, climbing stairs, carrying a\s+child/);
    expect(g).toMatch(/The reader's body is never the subject of a sentence/);
  });

  it("closes the coach's-own-account loophole for appearance comparisons", () => {
    expect(physicalSubjectGuidance("weight loss")).toMatch(/including as the coach's own\s+account/);
  });

  it("is positive-framed like the rest of the standard", () => {
    const g = physicalSubjectGuidance("weight loss");
    for (const m of [/\bnever write\b/i, /\bdo not write\b/i, /Wrong:/i]) expect(g).not.toMatch(m);
  });
});
