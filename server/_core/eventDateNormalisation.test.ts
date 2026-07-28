import { describe, it, expect } from "vitest";
import { normalizeEventDateToISO, resolveSequenceLength } from "./orchestration";

// Add-only. Pins the date-parsing half of F3: real coach-typed dates must
// normalise to ISO, and a supplied-but-unreadable date must be distinguishable
// from no date at all (both previously produced a silent 3).
const inDays = (n: number) => {
  const d = new Date(Date.now() + n * 86_400_000);
  return d.toISOString().slice(0, 10);
};

describe("normalizeEventDateToISO", () => {
  it("reads UK slash order day-first — the shape that silently failed in prod", () => {
    expect(normalizeEventDateToISO("27/09/2026")).toBe("2026-09-27");
    // Unambiguous: 27 cannot be a month.
    expect(normalizeEventDateToISO("1/12/2026")).toBe("2026-12-01");
  });

  it("reads ordinal words — the other shape that silently failed", () => {
    expect(normalizeEventDateToISO("28th august 2026")).toBe("2026-08-28");
    expect(normalizeEventDateToISO("August 28th, 2026")).toBe("2026-08-28");
  });

  it("passes through ISO", () => {
    expect(normalizeEventDateToISO("2026-09-27")).toBe("2026-09-27");
  });

  it("rejects impossible dates rather than rolling them over", () => {
    expect(normalizeEventDateToISO("31/02/2026")).toBeNull();
  });

  it("returns null for genuinely unreadable input", () => {
    expect(normalizeEventDateToISO("sometime next month")).toBeNull();
    expect(normalizeEventDateToISO("")).toBeNull();
    expect(normalizeEventDateToISO(null)).toBeNull();
  });
});

describe("resolveSequenceLength — no-date and unparseable are NOT the same", () => {
  it("no date supplied is a legitimate 3", () => {
    expect(resolveSequenceLength(null)).toEqual({ length: 3, status: "no-date" });
    expect(resolveSequenceLength("")).toEqual({ length: 3, status: "no-date" });
  });

  it("supplied-but-unreadable is flagged, not silently defaulted", () => {
    const r = resolveSequenceLength("sometime next month");
    expect(r.length).toBe(3);
    expect(r.status).toBe("unparseable");
  });

  it("a UK-format date now drives real runway instead of falling back to 3", () => {
    const d = new Date(Date.now() + 40 * 86_400_000);
    const uk = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    const r = resolveSequenceLength(uk);
    expect(r.status).toBe("parsed");
    expect(r.length).toBe(7);
  });

  it("still bands by proximity", () => {
    expect(resolveSequenceLength(inDays(3)).length).toBe(3);
    expect(resolveSequenceLength(inDays(15)).length).toBe(5);
    expect(resolveSequenceLength(inDays(40)).length).toBe(7);
  });
});
