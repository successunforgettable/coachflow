import { describe, it, expect } from "vitest";
import { deriveLengthFromDate, factsToTokenAnswers } from "./orchestration";

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

describe("deriveLengthFromDate — WhatsApp/email length from event-date proximity", () => {
  it("close event (≤7 days) → 3 (short & punchy)", () => {
    expect(deriveLengthFromDate(inDays(3))).toBe(3);
    expect(deriveLengthFromDate(inDays(7))).toBe(3);
  });
  it("mid (8–21 days) → 5", () => {
    expect(deriveLengthFromDate(inDays(15))).toBe(5);
  });
  it("far (>21 days) → 7 (longer nurture)", () => {
    expect(deriveLengthFromDate(inDays(40))).toBe(7);
  });
  it("unknown / unparseable date → 3 (the prior safe default)", () => {
    expect(deriveLengthFromDate(undefined)).toBe(3);
    expect(deriveLengthFromDate(null)).toBe(3);
    expect(deriveLengthFromDate("")).toBe(3);
    expect(deriveLengthFromDate("sometime next month")).toBe(3);
  });
});

describe("factsToTokenAnswers — kit facts → (token, value) answers for the LP", () => {
  it("maps eventSchedule + price to their canonical tokens; skips empty", () => {
    expect(
      factsToTokenAnswers({ eventSchedule: { date: "12 Oct 2026", time: "11am", timezone: "GST", venue: "IN5 Dubai" }, price: { amount: "500" } }),
    ).toEqual([
      { token: "[INSERT_EVENT_DATE]", value: "12 Oct 2026" },
      { token: "[INSERT_EVENT_TIME]", value: "11am" },
      { token: "[INSERT_EVENT_TIMEZONE]", value: "GST" },
      { token: "[INSERT_EVENT_VENUE]", value: "IN5 Dubai" },
      { token: "[INSERT_PRICE]", value: "500" },
    ]);
  });
  it("carries N/A sentinels through as the value (they resolve downstream)", () => {
    expect(factsToTokenAnswers({ eventSchedule: { venue: "__ONLINE__" }, price: { amount: "__FREE__" } })).toEqual([
      { token: "[INSERT_EVENT_VENUE]", value: "__ONLINE__" },
      { token: "[INSERT_PRICE]", value: "__FREE__" },
    ]);
  });
  it("empty / absent facts → no answers", () => {
    expect(factsToTokenAnswers(null)).toEqual([]);
    expect(factsToTokenAnswers({})).toEqual([]);
    expect(factsToTokenAnswers({ eventSchedule: { date: "  " } })).toEqual([]);
  });
});
