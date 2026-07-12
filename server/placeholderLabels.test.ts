import { describe, it, expect } from "vitest";
import { humanizeUnresolvedTokens, labelForToken } from "../shared/placeholderLabels";

// Guards the trail placeholder-leak fix: any [INSERT_*] token still unfilled
// after resolution is shown as a human label, never as raw brackets.

describe("placeholder humanizer", () => {
  it("replaces raw [INSERT_*] tokens with human labels (owner-locked + Title-Cased fallback)", () => {
    // owner-locked label
    expect(humanizeUnresolvedTokens("As an [INSERT_COACH_CREDENTIAL], I help you win"))
      .toBe("As an Your Qualification, I help you win");
    // unknown token → Title-Cased fallback, never raw brackets
    expect(humanizeUnresolvedTokens("Join [INSERT_SOME_NEW_THING] today"))
      .toBe("Join Some New Thing today");
    // multiple tokens in one string
    expect(humanizeUnresolvedTokens("[INSERT_PRICE] for [INSERT_LEAD_MAGNET_NAME]"))
      .toBe("Price for Lead Magnet Name");
    expect(labelForToken("[INSERT_COACH_CREDENTIAL]")).toBe("Your Qualification");
    expect(labelForToken("[INSERT_UNKNOWN_TOKEN]")).toBe("Unknown Token");
  });

  it("leaves token-free / empty / non-string input untouched", () => {
    expect(humanizeUnresolvedTokens("A clean headline")).toBe("A clean headline");
    expect(humanizeUnresolvedTokens("")).toBe("");
    expect(humanizeUnresolvedTokens(null as unknown as string)).toBe(null);
  });
});
