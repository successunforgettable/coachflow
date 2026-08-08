/**
 * pdafGatePerSurface.test.ts — distinctness is judged WITHIN a surface.
 *
 * ⚠️ THIS SUITE IS ADDITIVE. `pdafGate.test.ts` keeps its 32 cases unchanged: they pin the
 * pure helpers — eviction by max degree, axis priority, awareness slack, least-used
 * selection, the fall-through that tests the OUTCOME rather than the pool, deck-wide
 * anti-echo, and trim-to-band. Those helpers still mean exactly what they meant; the
 * per-surface change is about how the ORCHESTRATOR groups items before handing them to
 * those helpers. Nothing there was rewritten to match new behaviour.
 *
 * WHAT CHANGED AND WHY (settled by Arfeen 2026-08-08). Meta collapses whole ADS, and an ad
 * is the fused triple of image text / headline / body. Two headlines competing is a real
 * delivery signal; a headline "colliding" with the body it will only ever ship ALONGSIDE is
 * not. Under one shared band of 12, three surfaces fought over the same supply of distinct
 * (desire × awareness × format) cells — and on the live run of 2026-08-08 the deck came out
 * 6 headlines / 5 hooks / 1 BODY, with 15 of ~17 bodies dropped at the cap. A deck with one
 * body cannot ship.
 */

import { describe, it, expect } from "vitest";
import {
  runDistinctnessGate,
  findDeckEchoes,
  type GateItem,
  type AxisPools,
} from "./pdafGate";

type Labels = { persona: string; desire: string; awareness: string; format: string };

const item = (
  id: string,
  surface: string,
  labels: Partial<Labels> = {},
  text = `text-${id}`,
): GateItem<string> => ({
  id,
  surface,
  text,
  partnerId: null,
  labels: {
    persona: "one-icp",
    desire: "freedom",
    awareness: "unaware",
    format: "story",
    ...labels,
  } as any,
});

const POOLS: AxisPools = {
  desires: ["freedom", "relief", "status", "security"],
  awarenessPlan: ["unaware", "problem_aware", "solution_aware", "product_aware"] as any,
  formats: ["story", "authority", "urgency", "comparison"],
};

/** A regenerate that always succeeds, applying the gate's proposed moves verbatim. */
const applyMoves = async ({ item: it, moves }: any): Promise<GateItem<string>> => {
  const labels = { ...it.labels };
  for (const { dimension, value } of moves) labels[dimension] = value;
  return { ...it, labels };
};

/** A regenerate that always fails, so drops are forced and nothing is recovered. */
const neverRecovers = async (): Promise<GateItem<string> | null> => null;

describe("surfaces are judged independently — the cross-surface comparison is gone", () => {
  it("a headline and a body with IDENTICAL labels do not collide", async () => {
    // Under the shared band these two differed on ZERO axes and one would have been
    // evicted. They are two surfaces of one ad and are meant to be coherent.
    const items = [item("h1", "headline"), item("b1", "body")];
    const res = await runDistinctnessGate<string>({
      node: "test", items, pools: POOLS, regenerate: neverRecovers,
    });

    expect(res.ledger.evicted).toHaveLength(0);
    expect(res.ledger.collapsingPairsBefore).toBe(0);
    expect(res.kept).toHaveLength(2);
  });

  it("two HEADLINES with identical labels still collide — the rule is intact within a surface", async () => {
    const items = [item("h1", "headline"), item("h2", "headline")];
    const res = await runDistinctnessGate<string>({
      node: "test", items, pools: POOLS, regenerate: neverRecovers,
    });

    expect(res.ledger.collapsingPairsBefore).toBe(1);
    expect(res.ledger.evicted.length).toBeGreaterThan(0);
  });

  it("counts collapse per surface and sums it — never across surfaces", async () => {
    const items = [
      item("h1", "headline"), item("h2", "headline"),   // 1 colliding pair
      item("b1", "body"), item("b2", "body"),           // 1 colliding pair
    ];
    const res = await runDistinctnessGate<string>({
      node: "test", items, pools: POOLS, regenerate: neverRecovers, skipTrim: true,
    });

    // 4 identical items would be 6 colliding pairs if compared across surfaces.
    expect(res.ledger.collapsingPairsBefore).toBe(2);
    expect(res.ledger.bySurface.headline.collapsingPairsBefore).toBe(1);
    expect(res.ledger.bySurface.body.collapsingPairsBefore).toBe(1);
  });
});

describe("bodies are no longer starved by the other surfaces", () => {
  it("keeps bodies even when headlines and hooks are plentiful", async () => {
    // The live failure shape: many headlines and hooks, a handful of bodies. Under one
    // shared band the bodies lost the race for cells and finished at 1.
    const items = [
      ...Array.from({ length: 8 }, (_, i) =>
        item(`h${i}`, "headline", { awareness: POOLS.awarenessPlan[i % 4] as any, format: POOLS.formats[i % 4] })),
      ...Array.from({ length: 8 }, (_, i) =>
        item(`k${i}`, "image_hook", { awareness: POOLS.awarenessPlan[i % 4] as any, desire: POOLS.desires[i % 4] })),
      ...Array.from({ length: 4 }, (_, i) =>
        item(`b${i}`, "body", { awareness: POOLS.awarenessPlan[i % 4] as any, format: POOLS.formats[i % 4] })),
    ];
    const res = await runDistinctnessGate<string>({
      node: "test", items, pools: POOLS, regenerate: applyMoves,
    });

    const bodies = res.kept.filter((k) => k.surface === "body");
    expect(bodies.length).toBe(4);
    expect(res.ledger.bySurface.body.kept).toBe(4);
    expect(res.ledger.bySurface.body.dropped).toBe(0);
  });

  it("a surface below its floor is reported, not silently shipped", async () => {
    const items = [item("b1", "body"), item("b2", "body"), item("b3", "body")];
    const res = await runDistinctnessGate<string>({
      node: "test", items, pools: POOLS, regenerate: neverRecovers,
      surfaceBands: { body: { min: 3, max: 12 } },
    });

    // Two of the three collapse and cannot recover, so the surface finishes under floor.
    expect(res.ledger.bySurface.body.kept).toBeLessThan(3);
    expect(res.ledger.bySurface.body.meetsFloor).toBe(false);
    expect(res.ledger.surfacesBelowFloor).toContain("body");
  });

  it("reports an empty below-floor list when every surface is healthy", async () => {
    const items = [
      ...Array.from({ length: 4 }, (_, i) =>
        item(`h${i}`, "headline", { awareness: POOLS.awarenessPlan[i] as any, format: POOLS.formats[i] })),
    ];
    const res = await runDistinctnessGate<string>({
      node: "test", items, pools: POOLS, regenerate: applyMoves,
      surfaceBands: { headline: { min: 1, max: 12 } },
    });

    expect(res.ledger.surfacesBelowFloor).toEqual([]);
    expect(res.ledger.bySurface.headline.meetsFloor).toBe(true);
  });
});

describe("per-surface bands — no surface can spend another's slots", () => {
  it("trims each surface to its OWN ceiling", async () => {
    const items = [
      ...Array.from({ length: 4 }, (_, i) =>
        item(`h${i}`, "headline", { awareness: POOLS.awarenessPlan[i] as any })),
      ...Array.from({ length: 4 }, (_, i) =>
        item(`k${i}`, "image_hook", { awareness: POOLS.awarenessPlan[i] as any })),
    ];
    const res = await runDistinctnessGate<string>({
      node: "test", items, pools: POOLS, regenerate: applyMoves,
      surfaceBands: { headline: { max: 2 }, image_hook: { max: 3 } },
    });

    expect(res.kept.filter((k) => k.surface === "headline")).toHaveLength(2);
    expect(res.kept.filter((k) => k.surface === "image_hook")).toHaveLength(3);
  });

  it("an unlisted surface falls back to the global band", async () => {
    const items = Array.from({ length: 4 }, (_, i) =>
      item(`b${i}`, "body", { awareness: POOLS.awarenessPlan[i] as any }));
    const res = await runDistinctnessGate<string>({
      node: "test", items, pools: POOLS, regenerate: applyMoves,
      surfaceBands: { headline: { max: 1 } },
    });

    // band "small" max is 12, so nothing is trimmed.
    expect(res.kept.filter((k) => k.surface === "body")).toHaveLength(4);
    expect(res.ledger.bySurface.body.bandMax).toBe(12);
  });

  it("capping image_hook does not reduce what other surfaces keep", async () => {
    const items = [
      ...Array.from({ length: 4 }, (_, i) =>
        item(`h${i}`, "headline", { awareness: POOLS.awarenessPlan[i] as any })),
      ...Array.from({ length: 4 }, (_, i) =>
        item(`k${i}`, "image_hook", { awareness: POOLS.awarenessPlan[i] as any })),
    ];
    const res = await runDistinctnessGate<string>({
      node: "test", items, pools: POOLS, regenerate: applyMoves,
      surfaceBands: { image_hook: { max: 1 } },
    });

    expect(res.kept.filter((k) => k.surface === "image_hook")).toHaveLength(1);
    expect(res.kept.filter((k) => k.surface === "headline")).toHaveLength(4);
  });
});

describe("per-surface pools — a hook's format is its surface", () => {
  it("never proposes a format move for image_hook when format is off its movable axes", async () => {
    const proposed: string[] = [];
    const items = [
      item("k1", "image_hook", { desire: "freedom", awareness: "unaware" }),
      item("k2", "image_hook", { desire: "freedom", awareness: "unaware" }),
    ];
    await runDistinctnessGate<string>({
      node: "test", items, pools: POOLS,
      surfacePools: { image_hook: { movable: ["desire", "awareness"] } },
      regenerate: async (a: any) => {
        for (const m of a.moves) proposed.push(m.dimension);
        return applyMoves(a);
      },
    });

    expect(proposed.length).toBeGreaterThan(0);
    expect(proposed).not.toContain("format");
  });

  it("still allows format moves on a surface that did not opt out", async () => {
    const proposed: string[] = [];
    // Same desire and awareness on both, so the only axis that can separate them is format.
    const items = [
      item("b1", "body", { desire: "freedom", awareness: "unaware", format: "story" }),
      item("b2", "body", { desire: "freedom", awareness: "unaware", format: "story" }),
    ];
    await runDistinctnessGate<string>({
      node: "test", items, pools: POOLS,
      surfacePools: { image_hook: { movable: ["desire", "awareness"] } },
      regenerate: async (a: any) => {
        for (const m of a.moves) proposed.push(m.dimension);
        return applyMoves(a);
      },
    });

    expect(proposed.length).toBeGreaterThan(0);
  });
});

describe("the deck-wide anti-echo stays CROSS-surface — unchanged by any of this", () => {
  it("still catches a body opening that echoes a headline", () => {
    const findings = findDeckEchoes([
      { id: "b1", role: "body", text: "scope first sequence changes the call entirely", partnerId: null },
      { id: "h1", role: "headline", text: "the scope first sequence", partnerId: null },
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe("b1");
    expect(findings[0].againstRole).toBe("headline");
  });

  it("🔴 NEW — catches a HOOK opening that echoes another piece, which used to be invisible", () => {
    // `openingRoles` defaulted to ["body"], so hooks could only ever be the thing echoed.
    // Two hooks both opening on the mechanism name were structurally undetectable.
    const findings = findDeckEchoes(
      [
        { id: "k1", role: "image_hook", text: "the scope first sequence books the call", partnerId: null },
        { id: "k2", role: "image_hook", text: "the scope first sequence built to land", partnerId: null },
      ],
      { openingRoles: ["body", "image_hook"], targetRoles: ["headline", "image_hook"] },
    );

    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].role).toBe("image_hook");
  });

  it("hook openings are NOT sources under the old defaults — pinning what changed", () => {
    const findings = findDeckEchoes([
      { id: "k1", role: "image_hook", text: "the scope first sequence books the call", partnerId: null },
      { id: "k2", role: "image_hook", text: "the scope first sequence built to land", partnerId: null },
    ]);

    expect(findings).toHaveLength(0);
  });
});

describe("the ledger reports per surface", () => {
  it("carries a row per surface with its band and counts", async () => {
    const items = [
      item("h1", "headline"), item("b1", "body"), item("k1", "image_hook"),
    ];
    const res = await runDistinctnessGate<string>({
      node: "test", items, pools: POOLS, regenerate: applyMoves,
      surfaceBands: { image_hook: { min: 1, max: 4 } },
    });

    expect(Object.keys(res.ledger.bySurface).sort()).toEqual(["body", "headline", "image_hook"]);
    expect(res.ledger.bySurface.image_hook.bandMax).toBe(4);
    expect(res.ledger.bySurface.headline.populationSize).toBe(1);
    expect(res.ledger.keptCount).toBe(3);
  });

  it("excludes link surfaces from every per-surface row", async () => {
    const items = [item("h1", "headline"), item("l1", "link"), item("l2", "link_description")];
    const res = await runDistinctnessGate<string>({
      node: "test", items, pools: POOLS, regenerate: applyMoves,
    });

    expect(res.ledger.bySurface.link).toBeUndefined();
    expect(res.ledger.bySurface.link_description).toBeUndefined();
    expect(res.ledger.excludedCount).toBe(2);
  });
});
