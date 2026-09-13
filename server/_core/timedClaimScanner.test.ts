import { describe, it, expect } from "vitest";
import {
  scanTimedClaims,
  scanTimedClaimsInString,
  timedClaimFailContext,
} from "./timedClaimScanner";
import { LIVE_VIOLATIONS, LIVE_EXEMPT, LIVE_QUOTED_OUTCOME_FIGURES } from "./__fixtures__/timedClaimCorpus";

/**
 * THE SCANNER IS CALIBRATED BEFORE IT IS TRUSTED (§15c, §15k).
 *
 * Every assertion here is a POSITIVE artefact: a named clock, found, in a named field — never the
 * absence of one. "Nothing found" is not a result; "found this specific claim" is. A scanner whose
 * only evidence was a zero could not be told apart from a broken regex.
 */

describe("A · the real violations that were live on production are all detected", () => {
  // 🔴 THE NEGATIVE CONTROL. Without it, every clean read elsewhere is worthless.
  for (const [key, text] of Object.entries(LIVE_VIOLATIONS)) {
    it(`flags ${key}`, () => {
      const { violations } = scanTimedClaimsInString(text, "promise");
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].path).toBe("promise");
      expect(violations[0].line.length).toBeGreaterThan(0); // it can say WHERE, not just that
    });
  }

  it("names the specific clock in each of the three originally-scoped pages", () => {
    expect(scanTimedClaimsInString(LIVE_VIOLATIONS.v33).violations.map((v) => v.match))
      .toEqual(expect.arrayContaining(["in 48 hours", "today"]));
    expect(scanTimedClaimsInString(LIVE_VIOLATIONS.v42).violations.map((v) => v.match)).toContain("by day 7");
    expect(scanTimedClaimsInString(LIVE_VIOLATIONS.v43a).violations.map((v) => v.match)).toContain("today");
  });
});

describe("B · quoted speech is exempt — scene-setting prose is not a promise (§14b)", () => {
  for (const [key, text] of Object.entries(LIVE_EXEMPT)) {
    it(`exempts ${key}, and says why`, () => {
      const { violations, exempt } = scanTimedClaimsInString(text, "tools.0.content");
      // POSITIVE artefact of the negative result: the clock was SEEN and then classified.
      expect(exempt.length).toBeGreaterThan(0);
      expect(exempt.every((e) => e.exemptReason === "quoted-speech")).toBe(true);
      expect(violations).toEqual([]);
    });
  }

  // The two hardest real lines, called out because a naive implementation gets both wrong.
  it("handles a double-quoted passage with a single-quoted phrase nested inside it", () => {
    // Sequential pairing across all delimiters puts the clock BETWEEN two spans and reports a
    // false violation. Pairing each quote kind separately reads it correctly.
    const r = scanTimedClaimsInString(LIVE_EXEMPT.x35a);
    expect(r.violations).toEqual([]);
    expect(r.exempt.map((e) => e.match)).toContain("today");
  });

  it("handles a single-quoted passage containing contractions and a nested quote", () => {
    const r = scanTimedClaimsInString(LIVE_EXEMPT.x44);
    expect(r.violations).toEqual([]);
    expect(r.exempt.map((e) => e.match)).toContain("today");
  });
});

describe("C · the exemption does not leak — a quote on the line cannot launder a claim beside it", () => {
  // 🔴 THE SHARPEST TEST IN THE FILE. bonus-44's real promise line carries BOTH a quoted fragment
  // ('are you sure yet?') and, outside it, "ready to use today". An exemption keyed on "this line
  // contains a quote" would pass the whole line and leave the claim live.
  it("flags the clock outside the quote on bonus-44's real promise line", () => {
    const r = scanTimedClaimsInString(LIVE_VIOLATIONS.v44);
    expect(r.violations.map((v) => v.match)).toContain("today");
  });

  it("a synthetic version of the same shape, stated plainly", () => {
    const r = scanTimedClaimsInString(`She asks "is it ready?" and you will hold the finished draft by day 3.`);
    expect(r.violations.map((v) => v.match)).toEqual(["by day 3"]);
  });
});

describe("C2 · the shapes that got through the first version — regression controls", () => {
  // 🔴 REAL MISSES, not invented cases. Both of these are text the scanner ITSELF approved for
  // publication on 2026-09-12: a spelled-out numeral and a bare "Day N". They are kept here as the
  // permanent controls for the two blind spots.
  it("catches a spelled-out numeral — bonus-35's published promise", () => {
    const r = scanTimedClaimsInString(
      "Use these scripts to stop a writing freeze in its tracks and get words on the page in the next ten minutes.",
    );
    expect(r.violations.map((v) => v.match)).toContain("in the next ten minutes");
  });

  it("catches a bare Day N used as an outcome marker — bonus-42's published promise", () => {
    const r = scanTimedClaimsInString(
      "You leave Day 7 holding three ranked, evidence-backed directions — not a longer list of possibilities.",
    );
    expect(r.violations.map((v) => v.match)).toContain("leave day 7");
  });

  it("still catches the digit and by-day forms the first version did", () => {
    expect(scanTimedClaimsInString("draft in 48 hours").violations.map((v) => v.match)).toContain("in 48 hours");
    expect(scanTimedClaimsInString("By Day 7, you will hold").violations.map((v) => v.match)).toContain("by day 7");
  });
});

describe("C3 · quoted speech that claims a figure as a result is NOT exempt (Arfeen, 2026-09-13)", () => {
  // 🔴 THE REAL MISS. The first exemption read this as scene-setting: `0 violations, 1 exempt`.
  it("flags bonus-44's live 'three paying clients within 90 days' line, inside a first-person quote", () => {
    const r = scanTimedClaimsInString(LIVE_QUOTED_OUTCOME_FIGURES.q44, "tools.2.content");
    expect(r.violations.map((v) => v.match)).toContain("within 90 days");
    expect(r.violations[0].quotedFigure).toBe(true);
    expect(r.exempt).toEqual([]);
  });

  it("a quantified clock in speech is a figure on its own", () => {
    for (const [line, clock] of [
      [`She says "I'll have my first client within a week."`, "within a week"],
      [`'I finished it in one sitting.'`, "one sitting"],
      [`"I was booked by day 10."`, "by day 10"],
    ]) {
      const r = scanTimedClaimsInString(line);
      expect(r.violations.map((v) => v.match)).toContain(clock);
    }
  });

  it("a passing time word beside a figure in the same spoken line is flagged", () => {
    const r = scanTimedClaimsInString(`"I signed three paying clients today."`);
    expect(r.violations.map((v) => v.match)).toEqual(["today"]);
    expect(r.violations[0].quotedFigure).toBe(true);
  });

  it("control: the same passing time word with no figure in the spoken line stays exempt", () => {
    const r = scanTimedClaimsInString(`"I finally said it out loud today."`);
    expect(r.violations).toEqual([]);
    expect(r.exempt.map((e) => e.exemptReason)).toEqual(["quoted-speech"]);
  });

  it("a figure OUTSIDE the innermost quote does not strip the exemption — bonus-35's nested line", () => {
    // The outer double quote mentions "a 25% open rate"; the clock sits in the inner single quote.
    const r = scanTimedClaimsInString(LIVE_EXEMPT.x35a);
    expect(r.violations).toEqual([]);
    expect(r.exempt.map((e) => e.match)).toContain("today");
  });

  it("a scheduled event in speech stays exempt — bonus-34's live anchor, 'launch is in four days'", () => {
    const r = scanTimedClaimsInString(LIVE_EXEMPT.x34);
    expect(r.violations).toEqual([]);
    expect(r.exempt.map((e) => e.match)).toEqual(["in four days"]);
  });

  it("control: the event carve-out does not survive a figure in the same clause", () => {
    const r = scanTimedClaimsInString(`"Launch is in four days and I will have three clients booked."`);
    expect(r.violations.map((v) => v.match)).toEqual(["in four days"]);
  });

  it("the fail-context tells the model the spoken line itself must change", () => {
    const fc = timedClaimFailContext(scanTimedClaimsInString(LIVE_QUOTED_OUTCOME_FIGURES.q44, "tools.2.content").violations);
    expect(fc).toContain("within 90 days");
    expect(fc).toContain("spoken line still names a figure");
  });
});

describe("D · what §14b allows passes", () => {
  it("a description of the asset carries no violation", () => {
    for (const ok of [
      "A one-page checklist with eight lines to fill in.",
      "Five steps and one fill-in template.",
      "A single script you can read aloud.",
    ]) expect(scanTimedClaimsInString(ok).violations).toEqual([]);
  });

  it("a refund window is a promise about money, not about the reader", () => {
    const r = scanTimedClaimsInString("A full refund within 30 days of purchase.");
    expect(r.violations).toEqual([]);
    expect(r.exempt.map((e) => e.exemptReason)).toContain("money-window");
  });

  it("control: the same window with no money nearby IS a claim about the reader", () => {
    expect(scanTimedClaimsInString("You will be sleeping through the night within 30 days.").violations.length)
      .toBeGreaterThan(0);
  });
});

describe("E · the walker names the field, so a fail-context can be specific", () => {
  const body = {
    format: "checklist",
    promise: "A one-page checklist.",
    items: [
      { label: "Clean", detail: "Nothing timed here." },
      { label: "Send", detail: "You will have it out the door by day 5." },
    ],
    nextStep: { heading: "What now?", body: "Ask yourself the harder question." },
  };

  it("finds the violation at its dotted path", () => {
    const { violations } = scanTimedClaims(body);
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("items.1.detail");
    expect(violations[0].match).toBe("by day 5");
  });

  it("a clean body yields no violation — asserted only because the walker is proven above", () => {
    expect(scanTimedClaims({ ...body, items: [body.items[0]] }).violations).toEqual([]);
  });
});

describe("F · the corrective fail-context is post-hoc and specific (§14a)", () => {
  const { violations } = scanTimedClaims({ items: [{ detail: "You will hold the draft by day 7." }] });
  const fc = timedClaimFailContext(violations);

  it("quotes the model's own field and clock back at it", () => {
    expect(fc).toContain("items.0.detail");
    expect(fc).toContain("by day 7");
  });

  it("offers the positive alternative — describing the asset", () => {
    expect(fc).toContain("what the asset IS");
    expect(fc).toMatch(/one-page checklist|eight prompts|five steps/);
  });

  it("preserves the quoted-speech allowance so a retry does not strip scene-setting prose", () => {
    expect(fc.toLowerCase()).toContain("quoted speech");
  });
});
