/**
 * headlineItemsGuard.test.ts — Node 6 must not die on an off-shape model response.
 *
 * THE LIVE FAILURE THIS PINS. On 2026-08-09 a Node 6 run threw
 * `TypeError: parsed.headlines.forEach is not a function` at headlinesGenerator.ts:579,
 * AFTER it had already resolved 8 desires and its stage plan. The formula loop runs inside
 * a `Promise.all` over five formulas, so one off-shape response killed all five and the
 * whole deck. It is in DEPLOYED code: a real coach hits it whenever the model answers oddly.
 *
 * A JSON schema is a REQUEST, not a guarantee. These cases assert the container guard
 * degrades — returns an empty array so the formula contributes nothing and the rest of the
 * deck lands — rather than throwing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { headlineItemsFrom, structuredHeadlineFields } from "./headlinesGenerator";

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => { errorSpy = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { errorSpy.mockRestore(); });

describe("headlineItemsFrom — the container guard", () => {
  it("passes a well-formed array straight through, unchanged", () => {
    const items = ["Scope moved. Client went quiet.", "Retainer booked in two weeks."];
    expect(headlineItemsFrom({ headlines: items }, "story")).toBe(items);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("🔴 THE LIVE SHAPE — an object where an array was requested degrades, never throws", () => {
    // What a model returns when it "helpfully" keys the headlines by formula.
    const bad = { headlines: { story: ["a"], question: ["b"] } };
    expect(() => headlineItemsFrom(bad, "story")).not.toThrow();
    expect(headlineItemsFrom(bad, "story")).toEqual([]);
  });

  it("degrades on a single string instead of an array", () => {
    expect(headlineItemsFrom({ headlines: "Scope moved. Client went quiet." }, "question")).toEqual([]);
  });

  it("degrades on null, undefined and a missing key", () => {
    expect(headlineItemsFrom({ headlines: null }, "urgency")).toEqual([]);
    expect(headlineItemsFrom({ headlines: undefined }, "urgency")).toEqual([]);
    expect(headlineItemsFrom({}, "urgency")).toEqual([]);
  });

  it("degrades when the whole payload is not an object", () => {
    for (const junk of [null, undefined, "text", 42, true]) {
      expect(() => headlineItemsFrom(junk, "story")).not.toThrow();
      expect(headlineItemsFrom(junk, "story")).toEqual([]);
    }
  });

  it("an empty array is a legitimate answer, not a fault", () => {
    expect(headlineItemsFrom({ headlines: [] }, "story")).toEqual([]);
    // No error is logged: the model answered in the right SHAPE with nothing in it.
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs loudly on every degrade, so a short deck is never silent", () => {
    headlineItemsFrom({ headlines: { nested: true } }, "story");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const msg = String(errorSpy.mock.calls[0][0]);
    expect(msg).toContain("story");
    expect(msg).toContain("contributing 0 headlines");
  });

  it("does NOT filter items inside a valid array — that judgement belongs to the call sites", () => {
    // The three branches read different item shapes (bare string, {eyebrow,main,sub},
    // {main,sub}), so only the CONTAINER is guarded here — which is what threw.
    const mixed = ["ok", { main: "m", sub: "s" }, null];
    expect(headlineItemsFrom({ headlines: mixed }, "authority")).toBe(mixed);
  });
});

describe("the degrade contract the call site depends on", () => {
  it("returns something .forEach can always be called on", () => {
    for (const junk of [{ headlines: "x" }, { headlines: 1 }, {}, null]) {
      const items = headlineItemsFrom(junk, "story");
      expect(Array.isArray(items)).toBe(true);
      expect(() => items.forEach(() => {})).not.toThrow();
    }
  });

  it("length 0 is the signal the call site skips on", () => {
    // headlinesGenerator does `if (items.length === 0) return;` — this formula contributes
    // nothing and the other four still land, instead of Promise.all rejecting.
    expect(headlineItemsFrom({ headlines: { a: 1 } }, "story").length).toBe(0);
  });
});

/**
 * ─── The container guard applies to ALL THREE branches ──────────────────────
 *
 * `story`/`question`/`urgency` read bare strings; `eyebrow` reads
 * {eyebrow,main,sub}; `authority` reads {main,sub}. All three called
 * `parsed.headlines.forEach` unguarded, and because the formulas run in one batch, ANY of
 * them throwing used to zero the whole deck — so guarding one closed nothing on its own.
 */
describe("the container guard covers every formula branch", () => {
  for (const formula of ["story", "question", "urgency", "eyebrow", "authority"]) {
    it(`${formula}: an object where an array was requested degrades to []`, () => {
      expect(() => headlineItemsFrom({ headlines: { nested: true } }, formula)).not.toThrow();
      expect(headlineItemsFrom({ headlines: { nested: true } }, formula)).toEqual([]);
    });

    it(`${formula}: a string where an array was requested degrades to []`, () => {
      // The shape actually observed live on 2026-08-09, on the `story` formula.
      expect(headlineItemsFrom({ headlines: "one headline" }, formula)).toEqual([]);
    });
  }
});

describe("VALID shapes pass through unchanged — the guards do not perturb a normal deck", () => {
  it("story/question/urgency: an array of strings is returned as-is", () => {
    const items = ["Scope moved. Client went quiet.", "Retainer booked in two weeks."];
    expect(headlineItemsFrom({ headlines: items }, "story")).toBe(items);
  });

  it("eyebrow: a well-formed element keeps eyebrow, main and sub verbatim", () => {
    const el = { eyebrow: "FOR CONSULTANTS", main: "Scope first, then the number", sub: "How the sequence runs" };
    expect(structuredHeadlineFields(el, "eyebrow", 0)).toEqual({
      eyebrow: "FOR CONSULTANTS", main: "Scope first, then the number", sub: "How the sequence runs",
    });
  });

  it("authority: a well-formed element keeps main and sub, with eyebrow null", () => {
    const el = { main: "Built for retainer conversations", sub: "Ten years of engagement design" };
    expect(structuredHeadlineFields(el, "authority", 0)).toEqual({
      main: "Built for retainer conversations", sub: "Ten years of engagement design", eyebrow: null,
    });
  });

  it("a full valid array survives the container guard AND the per-item guard intact", () => {
    const parsed = { headlines: [
      { main: "A", sub: "a", eyebrow: "E1" },
      { main: "B", sub: "b", eyebrow: "E2" },
    ] };
    const items = headlineItemsFrom(parsed, "eyebrow");
    expect(items).toHaveLength(2);
    const mapped = items.map((raw, i) => structuredHeadlineFields(raw, "eyebrow", i));
    expect(mapped.every((m) => m !== null)).toBe(true);
    expect(mapped.map((m) => m!.main)).toEqual(["A", "B"]);
  });
});

describe("structuredHeadlineFields — one bad element must not take its siblings down", () => {
  it("drops an element with no usable `main`, since headline is NOT NULL", () => {
    expect(structuredHeadlineFields({ sub: "only a sub" }, "authority", 1)).toBeNull();
    expect(structuredHeadlineFields({ main: "   " }, "authority", 1)).toBeNull();
    expect(structuredHeadlineFields({ main: 42 }, "authority", 1)).toBeNull();
  });

  it("drops a non-object element without throwing", () => {
    for (const junk of [null, undefined, "a string", 7, true]) {
      expect(() => structuredHeadlineFields(junk, "eyebrow", 0)).not.toThrow();
      expect(structuredHeadlineFields(junk, "eyebrow", 0)).toBeNull();
    }
  });

  it("KEEPS an element whose optional fields are missing — sub and eyebrow are nullable", () => {
    // Discarding an otherwise good headline for a missing optional would lose real output.
    expect(structuredHeadlineFields({ main: "Stands on its own" }, "eyebrow", 0))
      .toEqual({ main: "Stands on its own", sub: null, eyebrow: null });
  });

  it("a mixed array yields exactly the usable elements, siblings unharmed", () => {
    const items = headlineItemsFrom({ headlines: [
      { main: "keeps me", sub: "s" },
      null,
      { sub: "no main" },
      { main: "keeps me too" },
    ] }, "authority");
    const kept = items.map((raw, i) => structuredHeadlineFields(raw, "authority", i)).filter(Boolean);
    expect(kept).toHaveLength(2);
    expect(kept.map((k) => k!.main)).toEqual(["keeps me", "keeps me too"]);
  });

  it("logs on every dropped element, so a short deck is never silent", () => {
    structuredHeadlineFields({ sub: "x" }, "authority", 3);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain("authority[3]");
  });
});
