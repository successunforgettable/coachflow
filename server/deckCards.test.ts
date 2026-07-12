import { describe, it, expect } from "vitest";
import { pickHvcoLongTitles, flattenHeadlineGroups, resolveDeckSourceId } from "../shared/deckCards";

// Guards the two Manual-wizard deck contract points that silently broke:
// hvco tabType "long" (not "long_titles"), and headlines' grouped-object shape.

describe("trail deck-card transforms", () => {
  it("pickHvcoLongTitles keeps only tabType 'long' — the DB enum value, not the old 'long_titles' bug", () => {
    const rows = [
      { id: 1, tabType: "long" },
      { id: 2, tabType: "short" },
      { id: 3, tabType: "long" },
      { id: 4, tabType: "beast_mode" },
      { id: 5, tabType: "subheadlines" },
    ];
    // Correct value keeps the two long titles...
    expect(pickHvcoLongTitles(rows).map((r) => r.id)).toEqual([1, 3]);
    // ...and the old invalid value would have matched nothing (regression guard).
    expect(rows.filter((r) => r.tabType === "long_titles")).toEqual([]);
    // Tolerates empty / missing input without throwing.
    expect(pickHvcoLongTitles([])).toEqual([]);
  });

  it("resolveDeckSourceId falls back to the committed selected id when the job was skipped (generatedId null)", () => {
    expect(resolveDeckSourceId(5289, 195)).toBe(5289);        // fresh generation wins
    expect(resolveDeckSourceId(null, 195)).toBe(195);         // skipped → render existing content
    expect(resolveDeckSourceId(undefined, 195)).toBe(195);
    expect(resolveDeckSourceId("5289", undefined)).toBe(5289); // numeric coercion
    expect(resolveDeckSourceId(null, null)).toBe(null);       // nothing to show
  });

  it("flattenHeadlineGroups reads the grouped object (first per formula), never iterates it as an array", () => {
    const res = {
      headlineSetId: "set-1",
      headlines: {
        story: [{ id: 1, headline: "A" }, { id: 2, headline: "A2" }],
        eyebrow: [{ id: 3, headline: "B" }],
        question: [] as { id: number; headline: string }[],
        authority: [{ id: 4, headline: "D" }],
        urgency: [{ id: 5, headline: "E" }],
      },
    };
    // One card per formula, in order, skipping the empty group.
    expect(flattenHeadlineGroups(res).map((h) => h.id)).toEqual([1, 3, 4, 5]);
    // A grouped object with no groups yields [] rather than throwing (old for..of crashed here).
    expect(flattenHeadlineGroups({ headlines: {} })).toEqual([]);
    expect(flattenHeadlineGroups(null)).toEqual([]);
  });
});
