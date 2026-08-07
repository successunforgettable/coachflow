/**
 * pdafGate.test.ts — unit coverage for the distinctness gate's DECISION LOGIC.
 *
 * ⚠️ WHAT THIS SUITE IS AND IS NOT. These are fixtures. A green run here proves the
 * eviction, axis-priority, slack, echo and trim rules behave as specified — it does NOT
 * prove the gate works on a real deck, because no LLM, no DB and no generator runs here.
 * The gate is proven by a live cascade on production with the before/after collapse rates
 * measured off the stamped 0097 columns. This suite exists to stop a refactor silently
 * inverting a rule between those runs, which is exactly what happened to the image chapter
 * when a test pinned the defect instead of the fix.
 */

import { describe, it, expect } from "vitest";
import {
  planEvictions,
  chooseAxis,
  suggestAwarenessFromSlack,
  suggestLeastUsed,
  suggestReassignment,
  findDeckEchoes,
  trimToBand,
  partitionPopulation,
  contentWords,
  MOVABLE_AXES,
  DEFAULT_BUDGET_BAND,
  bandMax,
  type GateItem,
} from "./pdafGate";
import type { AwarenessStage } from "./conceptAxis";
import { comparePair } from "./pdafDistinctness";

const item = (
  id: string,
  labels: Partial<{ persona: string; desire: string; awareness: string; format: string }>,
  text = "",
  surface = "headline",
): GateItem<string> => ({
  id,
  surface,
  text,
  labels: {
    persona: labels.persona ?? "founders",
    desire: labels.desire ?? null,
    awareness: labels.awareness ?? null,
    format: labels.format ?? null,
  },
});

describe("population — link descriptions are excluded and cannot be re-admitted", () => {
  it("splits links out of the counted population", () => {
    const { population, excluded } = partitionPopulation([
      item("h1", {}, "", "headline"),
      item("b1", {}, "", "body"),
      item("l1", {}, "", "link"),
      item("l2", {}, "", "link_description"),
    ]);
    expect(population.map((p) => p.id)).toEqual(["h1", "b1"]);
    expect(excluded.map((p) => p.id)).toEqual(["l1", "l2"]);
  });

  it("two identical links never register as a collapse, because they are never counted", () => {
    const links = [
      item("l1", { desire: "same", awareness: "unaware", format: "link_description" }, "", "link"),
      item("l2", { desire: "same", awareness: "unaware", format: "link_description" }, "", "link"),
    ];
    const { population } = partitionPopulation(links);
    expect(planEvictions(population).evictions).toHaveLength(0);
  });
});

describe("eviction — max degree, reproducible ties", () => {
  it("evicts the piece that collides with the most others first", () => {
    // a collides with b, c and d (all share desire+awareness+format); e is separate.
    const items = [
      item("a", { desire: "d1", awareness: "unaware", format: "story" }),
      item("b", { desire: "d1", awareness: "unaware", format: "story" }),
      item("c", { desire: "d1", awareness: "unaware", format: "story" }),
      item("e", { desire: "d2", awareness: "problem_aware", format: "question" }),
    ];
    const { keep, evictions } = planEvictions(items);
    // Every survivor pair must clear 2-of-4.
    expect(planEvictions(keep).evictions).toHaveLength(0);
    expect(evictions.length).toBeGreaterThan(0);
    expect(keep.map((k) => k.id)).toContain("e");
  });

  it("is deterministic — same input, same survivors, every time", () => {
    const items = [
      item("a", { desire: "d1", awareness: "unaware", format: "story" }),
      item("b", { desire: "d1", awareness: "unaware", format: "story" }),
      item("c", { desire: "d1", awareness: "unaware", format: "urgency" }),
      item("d", { desire: "d2", awareness: "unaware", format: "story" }),
    ];
    const first = planEvictions(items).keep.map((k) => k.id);
    for (let i = 0; i < 5; i++) {
      expect(planEvictions(items).keep.map((k) => k.id)).toEqual(first);
    }
  });

  it("breaks a degree tie toward the LATER item, so earlier pieces are stable", () => {
    const items = [
      item("first", { desire: "d1", awareness: "unaware", format: "story" }),
      item("second", { desire: "d1", awareness: "unaware", format: "story" }),
    ];
    const { keep } = planEvictions(items);
    expect(keep.map((k) => k.id)).toEqual(["first"]);
  });

  it("leaves a fully distinct deck completely alone", () => {
    const items = [
      item("a", { desire: "d1", awareness: "unaware", format: "story" }),
      item("b", { desire: "d2", awareness: "problem_aware", format: "question" }),
      item("c", { desire: "d3", awareness: "solution_aware", format: "authority" }),
    ];
    expect(planEvictions(items).evictions).toHaveLength(0);
  });
});

describe("axis choice — persona is never movable, priority is desire → awareness → format", () => {
  it("never offers persona", () => {
    expect(MOVABLE_AXES).not.toContain("persona");
    const a = item("a", { desire: "d1", awareness: "unaware", format: "story" }).labels;
    const b = item("b", { desire: "d1", awareness: "unaware", format: "story" }).labels;
    expect(chooseAxis(a, [b])).not.toBe("persona");
  });

  it("prefers desire when desire is one of the matching axes", () => {
    const a = item("a", { desire: "same", awareness: "unaware", format: "story" }).labels;
    const b = item("b", { desire: "same", awareness: "unaware", format: "story" }).labels;
    expect(chooseAxis(a, [b])).toBe("desire");
  });

  it("falls to awareness when desire already differs", () => {
    const a = item("a", { desire: "d1", awareness: "unaware", format: "story" }).labels;
    const b = item("b", { desire: "d2", awareness: "unaware", format: "story" }).labels;
    // differs on desire only (1 axis) → collapses; desire already differs so awareness is next
    expect(chooseAxis(a, [b])).toBe("awareness");
  });

  it("falls to format when desire and awareness both already differ", () => {
    const a = item("a", { desire: "d1", awareness: "unaware", format: "story" }).labels;
    // desire and awareness already differ, so format is the only movable axis left that
    // still MATCHES — moving an axis that already differs cannot fix a collapse.
    const c = item("c", { desire: "dX", awareness: "problem_aware", format: "story" }).labels;
    expect(chooseAxis(a, [c])).toBe("format");
  });
});

describe("awareness reassignment draws from the PLAN'S SLACK, so cold weighting survives", () => {
  const plan: AwarenessStage[] = [
    "unaware", "unaware", "unaware",
    "problem_aware", "problem_aware", "problem_aware",
    "solution_aware", "product_aware",
  ];

  it("picks the most under-represented planned stage", () => {
    // three unaware already used, nothing else — problem_aware has the most slack
    const current = ["unaware", "unaware", "unaware"];
    expect(suggestAwarenessFromSlack(plan, current)).toBe("problem_aware");
  });

  it("never introduces a stage the plan gives zero slots — most_aware stays out of a cold deck", () => {
    const saturated = [
      "unaware", "unaware", "unaware",
      "problem_aware", "problem_aware", "problem_aware",
      "solution_aware", "product_aware",
    ];
    expect(suggestAwarenessFromSlack(plan, saturated)).not.toBe("most_aware");
  });

  it("breaks ties toward the colder stage", () => {
    expect(suggestAwarenessFromSlack(plan, [])).toBe("unaware");
  });

  it("respects the avoid set, so a piece is never reassigned to the value it already had", () => {
    const got = suggestAwarenessFromSlack(plan, [], new Set(["unaware"]));
    expect(got).not.toBe("unaware");
    expect(got).toBe("problem_aware");
  });
});

describe("least-used selection for desire and format", () => {
  it("picks the value used fewest times", () => {
    expect(suggestLeastUsed(["a", "b", "c"], ["a", "a", "b"])).toBe("c");
  });

  it("returns null when every candidate is excluded", () => {
    expect(suggestLeastUsed(["a"], [], new Set(["a"]))).toBeNull();
  });
});

describe("suggestReassignment — falls through the axes rather than dropping early", () => {
  const pools = {
    desires: ["d1", "d2"],
    awarenessPlan: ["unaware", "problem_aware"] as AwarenessStage[],
    formats: ["story", "question"],
  };

  it("moves on desire when a desire move alone actually clears the rule", () => {
    // a vs b differ on nothing; moving desire gives 1 axis — NOT enough. Moving desire
    // when awareness ALSO already differs gives 2, which is. This survivor differs on
    // awareness already, so a single desire move clears it.
    const it0 = item("a", { desire: "d1", awareness: "unaware", format: "story" });
    const got = suggestReassignment(
      { id: "a", collisions: 1, against: ["b"], axis: "desire" },
      it0,
      [item("b", { desire: "d1", awareness: "problem_aware", format: "story" })],
      pools,
    );
    expect(got).toEqual({ moves: [{ dimension: "desire", value: "d2" }] });
  });

  it("🔴 REGRESSION — moves TWO axes when one cannot separate the pair", () => {
    // This is the live defect: a and b match on ALL FOUR. Moving desire alone yields one
    // differing axis, which still collapses — the old code retried desire until the cap
    // and dropped the piece. 12 of 19 evictions died this way on 2026-08-07.
    const it0 = item("a", { desire: "d1", awareness: "unaware", format: "story" });
    const survivor = item("b", { desire: "d1", awareness: "unaware", format: "story" });
    const got = suggestReassignment(
      { id: "a", collisions: 1, against: ["b"], axis: "desire" },
      it0,
      [survivor],
      pools,
    );
    expect(got).not.toBeNull();
    expect(got!.moves.length).toBeGreaterThanOrEqual(2);
    // and the result must genuinely clear 2-of-4
    const after = { ...it0.labels } as any;
    for (const m of got!.moves) after[m.dimension] = m.value;
    expect(comparePair(after, survivor.labels).distinct).toBe(true);
  });

  it("never proposes an axis the node declared unmovable (Node 6 and format)", () => {
    const it0 = item("a", { desire: "d1", awareness: "unaware", format: "story" });
    const survivor = item("b", { desire: "d1", awareness: "unaware", format: "story" });
    const got = suggestReassignment(
      { id: "a", collisions: 1, against: ["b"], axis: "desire" },
      it0,
      [survivor],
      { ...pools, movable: ["desire", "awareness"] },
    );
    if (got) expect(got.moves.map((m) => m.dimension)).not.toContain("format");
  });

  it("returns null — an honest drop — when no combination can clear the rule", () => {
    // One desire, one stage, one format, and format is unmovable: nowhere to go.
    const nowhere = {
      desires: ["d1"],
      awarenessPlan: ["unaware"] as AwarenessStage[],
      formats: ["story"],
      movable: ["desire", "awareness"] as const,
    };
    const it0 = item("a", { desire: "d1", awareness: "unaware", format: "story" });
    const got = suggestReassignment(
      { id: "a", collisions: 1, against: ["b"], axis: "desire" },
      it0,
      [item("b", { desire: "d1", awareness: "unaware", format: "story" })],
      nowhere as any,
    );
    expect(got).toBeNull();
  });

  it("never proposes a move that fixes one collision while creating another", () => {
    // Moving a's desire to d2 would clear b but collide with c. The only correct answer
    // clears BOTH, or is null.
    const it0 = item("a", { desire: "d1", awareness: "unaware", format: "story" });
    const b = item("b", { desire: "d1", awareness: "unaware", format: "story" });
    const c = item("c", { desire: "d2", awareness: "unaware", format: "story" });
    const got = suggestReassignment(
      { id: "a", collisions: 2, against: ["b", "c"], axis: "desire" },
      it0, [b, c], pools,
    );
    if (got) {
      const after = { ...it0.labels } as any;
      for (const m of got.moves) after[m.dimension] = m.value;
      expect(comparePair(after, b.labels).distinct).toBe(true);
      expect(comparePair(after, c.labels).distinct).toBe(true);
    }
  });
});

describe("anti-echo is DECK-WIDE — the case pairwise checking misses", () => {
  it("flags a body echoing a headline it was NOT generated beside", () => {
    // b1's generation partner is h1. It echoes h2 instead — pairwise would pass this.
    const surfaces = [
      { id: "h1", role: "headline", text: "Pricing conversations that stop going sideways" },
      { id: "h2", role: "headline", text: "The follow-up call decides the whole month" },
      { id: "b1", role: "body", text: "The follow-up call decides the whole month for most consultants I work with." },
    ];
    const findings = findDeckEchoes(surfaces);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe("b1");
    expect(findings[0].againstId).toBe("h2");
  });

  it("does not flag a body that merely shares function words", () => {
    const surfaces = [
      { id: "h1", role: "headline", text: "How to get the most out of your first quarter" },
      { id: "b1", role: "body", text: "How to get the pipeline moving when nobody replies to anything." },
    ];
    expect(findDeckEchoes(surfaces)).toHaveLength(0);
  });

  it("only inspects the OPENING of the body — a late repeat is not an opening echo", () => {
    const surfaces = [
      { id: "h1", role: "headline", text: "Referral engine built on second conversations" },
      {
        id: "b1",
        role: "body",
        text:
          "Consultants lose most revenue between the pitch and the paperwork, which nobody warns " +
          "anyone about early enough in a career, and that gap is where a referral engine built on " +
          "second conversations actually earns its keep.",
      },
    ];
    expect(findDeckEchoes(surfaces)).toHaveLength(0);
  });

  it("EXTENDS TO THE IMAGE HOOK WITH NO CODE CHANGE — image_hook is already a target role", () => {
    // This is the image sprint's whole integration, exercised today: nothing emits
    // image_hook yet, so the rule is inert until something does.
    const surfaces = [
      { id: "img1", role: "image_hook", text: "Wake up without the Sunday dread" },
      { id: "b1", role: "body", text: "Wake up without the Sunday dread and the week looks different." },
    ];
    const findings = findDeckEchoes(surfaces);
    expect(findings).toHaveLength(1);
    expect(findings[0].againstRole).toBe("image_hook");
  });

  it("the run length is a knob, not an authority — raising it relaxes the check", () => {
    const surfaces = [
      { id: "h1", role: "headline", text: "Pricing calls that convert" },
      { id: "b1", role: "body", text: "Pricing calls that convert start before anyone opens a deck." },
    ];
    expect(findDeckEchoes(surfaces, { minRun: 3 })).toHaveLength(1);
    expect(findDeckEchoes(surfaces, { minRun: 9 })).toHaveLength(0);
  });

  it("strips punctuation without shredding accented words", () => {
    expect(contentWords("Café — résumé, done!")).toEqual(["café", "résumé", "done"]);
  });
});

describe("trim to the band", () => {
  it("keeps the most-separated pieces and drops the one closest to a collision", () => {
    const items = [
      item("a", { desire: "d1", awareness: "unaware", format: "story" }),
      item("b", { desire: "d2", awareness: "problem_aware", format: "question" }),
      // c differs from a on exactly 2 — the weakest link in the set
      item("c", { desire: "d3", awareness: "unaware", format: "story" }),
    ];
    const { keep, trimmed } = trimToBand(items, 2);
    expect(keep).toHaveLength(2);
    expect(trimmed).toHaveLength(1);
  });

  it("🔴 REGRESSION — is SURFACE-AWARE and does not strip the deck of bodies", () => {
    // The live failure: separation-only trimming kept 11 headlines and 1 body, which is
    // safe under 2-of-4 and completely unshippable. 12 headlines + 12 bodies, band 12 →
    // must come back 6 and 6, not 12 and 0.
    const items = [
      ...Array.from({ length: 12 }, (_, i) =>
        item(`h${i}`, { desire: `d${i}`, awareness: "unaware", format: `f${i}` }, "", "headline")),
      ...Array.from({ length: 12 }, (_, i) =>
        item(`b${i}`, { desire: `d${i}`, awareness: "problem_aware", format: `g${i}` }, "", "body")),
    ];
    const { keep } = trimToBand(items, 12);
    const heads = keep.filter((k) => k.surface === "headline").length;
    const bodies = keep.filter((k) => k.surface === "body").length;
    expect(keep).toHaveLength(12);
    expect(heads).toBe(6);
    expect(bodies).toBe(6);
  });

  it("lets one surface take the slack when the other is short, rather than shipping under band", () => {
    const items = [
      ...Array.from({ length: 10 }, (_, i) =>
        item(`h${i}`, { desire: `d${i}`, awareness: "unaware", format: `f${i}` }, "", "headline")),
      item("b0", { desire: "dx", awareness: "problem_aware", format: "g0" }, "", "body"),
    ];
    const { keep } = trimToBand(items, 8);
    expect(keep).toHaveLength(8);
    expect(keep.filter((k) => k.surface === "body")).toHaveLength(1);
    expect(keep.filter((k) => k.surface === "headline")).toHaveLength(7);
  });

  it("is a no-op when the set already fits", () => {
    const items = [item("a", { desire: "d1" }), item("b", { desire: "d2" })];
    expect(trimToBand(items, 12).trimmed).toHaveLength(0);
  });

  it("defaults to the small band — Arfeen's decision, 8-12", () => {
    expect(DEFAULT_BUDGET_BAND).toBe("small");
    expect(bandMax("small")).toBe(12);
  });
});
