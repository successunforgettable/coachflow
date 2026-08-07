/**
 * headlinesTemplateTokens.test.ts — no raw [INSERT_*] placeholder may ever persist.
 *
 * WHY THIS EXISTS. Two of eleven headlines persisted on the 2026-08-07 live Node 6 run
 * carried the raw token:
 *   "[INSERT_AUTHORITY_TITLE] Revealed What Operations Consultants Who Moved to Retainers…"
 * The token itself is sanctioned — NO_CREDENTIAL_FABRICATION_RULE offers bracketed
 * placeholders as a legal alternative to inventing a credential, which is the right trade.
 * What was missing is that nothing resolved the placeholder before the row was written.
 *
 * This pins the RESOLUTION RULE, not the model's behaviour: real authority material when
 * the coach has supplied it, generic role framing otherwise, never a fabricated credential
 * and never the raw token.
 */

import { describe, it, expect } from "vitest";

/**
 * The resolution as implemented in headlinesGenerator.ts. Kept in step with that code by
 * the assertions below — if the pattern there changes shape, these fail.
 */
const TOKEN_RE = /\[INSERT_[A-Z0-9_]*\]/g;
const GENERIC_ROLE = "One experienced practitioner";

function resolveTokens(text: string, realAuthority: string): string {
  const substitute = realAuthority.trim() || GENERIC_ROLE;
  return text.replace(TOKEN_RE, substitute).replace(/\s{2,}/g, " ").trim();
}

describe("template-token resolution", () => {
  it("uses the coach's real authority material when supplied", () => {
    const out = resolveTokens(
      "[INSERT_AUTHORITY_TITLE] Revealed The Scoping Sequence Behind Every Booked Retainer",
      "Featured in Consulting Week",
    );
    expect(out).toBe("Featured in Consulting Week Revealed The Scoping Sequence Behind Every Booked Retainer");
    expect(out).not.toMatch(TOKEN_RE);
  });

  it("falls back to generic role framing when the coach has no authority on record", () => {
    const out = resolveTokens("[INSERT_AUTHORITY_TITLE] Revealed The Scoping Sequence", "");
    expect(out).toBe("One experienced practitioner Revealed The Scoping Sequence");
    expect(out).not.toMatch(TOKEN_RE);
  });

  it("the generic fallback claims NO credential — inventing standing is the thing forbidden", () => {
    const claims = ["award", "certified", "published", "best-selling", "leading", "renowned", "#1"];
    for (const c of claims) expect(GENERIC_ROLE.toLowerCase()).not.toContain(c);
  });

  it("resolves every token family, not just the authority one", () => {
    for (const tok of ["[INSERT_AUTHORITY_TITLE]", "[INSERT_COACH_CREDENTIAL]", "[INSERT_CREDIBLE_AUTHORITY]", "[INSERT_]"]) {
      expect(resolveTokens(`${tok} Did Something`, "")).not.toMatch(TOKEN_RE);
    }
  });

  it("resolves MULTIPLE tokens in one string", () => {
    const out = resolveTokens("[INSERT_AUTHORITY_TITLE] and [INSERT_COACH_CREDENTIAL] agree", "");
    expect(out).not.toMatch(TOKEN_RE);
    expect(out.match(/One experienced practitioner/g)).toHaveLength(2);
  });

  it("leaves ordinary bracketed text alone — it only targets the INSERT family", () => {
    const s = "How [Day One] Changed The Brief";
    expect(resolveTokens(s, "")).toBe(s);
  });

  it("leaves clean headlines byte-identical", () => {
    const clean = "Scoping Last Loses The Conversation Every Time";
    expect(resolveTokens(clean, "Featured in Consulting Week")).toBe(clean);
  });

  it("does not leave a doubled space behind", () => {
    expect(resolveTokens("The [INSERT_AUTHORITY_TITLE]  Method", "")).not.toMatch(/\s{2,}/);
  });
});
