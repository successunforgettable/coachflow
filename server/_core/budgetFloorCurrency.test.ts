import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  checkDailyBudgetFloor, assertDailyBudgetFloor,
  MEASURED_DAILY_BUDGET_FLOORS, UNMEASURED_CURRENCY_FLOOR,
  MIN_DAILY_BUDGET_AED, PINNED_DAILY_BUDGET_AED,
} from "./metaSafety";

/**
 * CURRENCY-AWARE DAILY BUDGET FLOOR — safe-to-run item 2.
 *
 * THE DEFECT: `z.number().min(1)` on the coach-facing publish path assumes USD. The ad account
 * bills in AED, and `createAdSet` sends `Math.round(budget * 100)` minor units — so a coach
 * entering 1 sent AED 1.00 and Meta rejected it with a message about a number they never chose.
 * The floor logic already existed and was proven; it was simply never wired to the router.
 *
 * ⚠️ THE FLOOR CANNOT LIVE IN THE ZOD SCHEMA. Zod is synchronous and runs before the handler; the
 * account currency needs an async Graph read. The check therefore sits in the handler, before any
 * Meta write. Structural, not a preference.
 *
 * ⚠️ UNKNOWN CURRENCY FAILS OPEN, ON PURPOSE. Today there is no floor on this path at all, so
 * refusing a publish because a Graph lookup hiccuped would be a regression wearing a safety hat.
 */

describe("the AED path is unchanged — the harness must not move", () => {
  it("keeps the measured AED floor as the single source", () => {
    expect(MEASURED_DAILY_BUDGET_FLOORS.AED).toBe(MIN_DAILY_BUDGET_AED);
  });

  it("still throws below the floor, with the message the harness tests pin", () => {
    expect(() => assertDailyBudgetFloor(1)).toThrow(/must be more than AED3\.00/);
    expect(() => assertDailyBudgetFloor(3)).toThrow(/AED/);
  });

  it("still accepts the pinned harness budget", () => {
    expect(() => assertDailyBudgetFloor(PINNED_DAILY_BUDGET_AED)).not.toThrow();
    expect(checkDailyBudgetFloor(PINNED_DAILY_BUDGET_AED, "AED").ok).toBe(true);
  });

  it("accepts exactly at the floor and refuses just below it", () => {
    expect(checkDailyBudgetFloor(MIN_DAILY_BUDGET_AED, "AED").ok).toBe(true);
    expect(checkDailyBudgetFloor(MIN_DAILY_BUDGET_AED - 0.01, "AED").ok).toBe(false);
  });
});

describe("a measured currency reports its own floor", () => {
  it("names the currency and the number in the refusal", () => {
    const v = checkDailyBudgetFloor(1, "AED");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.message).toMatch(/AED/);
  });

  it("is case- and whitespace-insensitive about the currency code", () => {
    expect(checkDailyBudgetFloor(1, " aed ").ok).toBe(false);
    expect(checkDailyBudgetFloor(20, "aed").ok).toBe(true);
  });
});

/**
 * ⚠️ THE UNMEASURED FLOOR IS 1, AND THAT IS A DECISION, NOT A PLACEHOLDER (Arfeen, 2026-08-19).
 * Any number above 1 for a currency we have never measured would be INVENTED, and an invented
 * floor sitting above Meta's real one silently refuses budgets Meta would have accepted — which
 * on a coach-facing path reads as the product being broken. META REMAINS THE REAL GATE here. This
 * catches only obviously-broken sub-1 values, where no currency accepts the number anyway.
 *
 * The way to make an unmeasured currency stricter is to MEASURE it and add one line to
 * MEASURED_DAILY_BUDGET_FLOORS — never to raise this constant, which would spread one guess
 * across every currency at once.
 */
describe("an unmeasured currency is deliberately permissive", () => {
  it("is set to 1 — permissive by decision", () => {
    expect(UNMEASURED_CURRENCY_FLOOR).toBe(1);
  });

  it("ACCEPTS a budget of 1 in an unmeasured currency rather than inventing a floor", () => {
    expect(checkDailyBudgetFloor(1, "USD").ok).toBe(true);
    expect(checkDailyBudgetFloor(1, "GBP").ok).toBe(true);
    expect(checkDailyBudgetFloor(1, "INR").ok).toBe(true);
  });

  it("accepts anything at or above the floor", () => {
    expect(checkDailyBudgetFloor(UNMEASURED_CURRENCY_FLOOR, "GBP").ok).toBe(true);
    expect(checkDailyBudgetFloor(2, "USD").ok).toBe(true);
    expect(checkDailyBudgetFloor(50, "EUR").ok).toBe(true);
  });

  it("refuses only obviously-broken sub-1 values, and names the currency", () => {
    for (const bad of [0, 0.5, -1]) {
      const v = checkDailyBudgetFloor(bad, "USD");
      expect(v.ok, `budget ${bad}`).toBe(false);
      if (!v.ok) expect(v.message).toMatch(/USD/);
    }
  });

  it("says Meta is still the real gate rather than claiming our number is the limit", () => {
    const v = checkDailyBudgetFloor(0, "USD");
    if (!v.ok) {
      expect(v.message).toMatch(/Meta also enforces/i);
      expect(v.message).toMatch(/have not measured/i);
    }
  });

  it("does NOT claim a measured number for a currency nobody measured", () => {
    const v = checkDailyBudgetFloor(0, "INR");
    if (!v.ok) expect(v.message).not.toMatch(/measured on this account/);
  });

  it("keeps the AED floor ABOVE the unmeasured default — a measurement outranks a default", () => {
    expect(MEASURED_DAILY_BUDGET_FLOORS.AED).toBeGreaterThan(UNMEASURED_CURRENCY_FLOOR);
    // The case that motivated the whole item: 1 is fine in an unmeasured currency, not in AED.
    expect(checkDailyBudgetFloor(1, "USD").ok).toBe(true);
    expect(checkDailyBudgetFloor(1, "AED").ok).toBe(false);
  });
});

describe("an unknown currency fails OPEN", () => {
  for (const c of [null, undefined, "", "   "]) {
    it(`allows the publish when currency is ${JSON.stringify(c)}`, () => {
      expect(checkDailyBudgetFloor(1, c).ok).toBe(true);
    });
  }

  it("still rejects a non-finite budget regardless of currency", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(checkDailyBudgetFloor(bad, null).ok, String(bad)).toBe(false);
      expect(checkDailyBudgetFloor(bad, "AED").ok, String(bad)).toBe(false);
    }
  });
});

describe("the floor table stays honest and the router stays thin", () => {
  it("carries only currencies we actually measured", () => {
    // One entry today. If this fails someone added a currency — make sure it was MEASURED,
    // not copied from Meta's help centre, and cite the account it came from.
    expect(Object.keys(MEASURED_DAILY_BUDGET_FLOORS)).toEqual(["AED"]);
  });

  it("keeps every threshold out of the router — metaSafety is the single source", () => {
    const src = readFileSync("server/routers/meta.ts", "utf8");
    expect(src).toMatch(/assertDailyBudgetForAccount/);
    expect(src).toMatch(/checkDailyBudgetFloor/);
    // The router must not restate a floor of its own.
    expect(src).not.toMatch(/MIN_DAILY_BUDGET_AED\s*=/);
    expect(src).not.toMatch(/UNMEASURED_CURRENCY_FLOOR\s*=/);
  });

  it("checks the floor at all three budget-carrying mutations", () => {
    const src = readFileSync("server/routers/meta.ts", "utf8");
    const calls = src.match(/await assertDailyBudgetForAccount\(/g) ?? [];
    expect(calls.length, "publishAssembledAds, publishToMeta and updateCampaign").toBe(3);
  });
});
