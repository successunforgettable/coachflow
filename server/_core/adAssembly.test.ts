/**
 * adAssembly.test.ts — one concept → one ad.
 *
 * ⚠️ WHAT THESE PIN. Every rule in this suite is one where the WRONG behaviour would look
 * perfectly fine in a finished ad and be invisible afterwards:
 *
 *   · a mispaired concept produces a plausible ad that is internally incoherent;
 *   · a reused body ships the identical primary text on two ads, which is a 100% duplication
 *     rate on one of the three surfaces Meta fuses — today's live behaviour;
 *   · a stage-mismatched pair is exactly what the first published ad shipped
 *     (solution_aware headline, problem_aware body) and reads fine to a human;
 *   · a NULL concept treated as a default silently attributes an editorial picture to a
 *     concept it never came from.
 *
 * None of these is caught by looking at the output. They are caught by ids, which is why the
 * fixtures are built from ids and the assertions are about ids.
 *
 * ⚠️ NO NETWORK, NO META, NO WRITES. This module only reads.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("drizzle-orm", () => ({
  and: (...parts: any[]) => Object.assign({}, ...parts),
  eq: (col: any, val: any) => ({ [`__${col.__name}`]: val }),
  desc: (col: any) => ({ __orderBy: col.__name }),
  isNotNull: (col: any) => ({ [`__notNull_${col.__name}`]: true }),
  inArray: (col: any, vals: any[]) => ({ [`__in_${col.__name}`]: vals }),
}));
vi.mock("../../drizzle/schema", () => {
  const cols = (names: string[]) =>
    Object.fromEntries(names.map((n) => [n, { __name: n }])) as any;
  return {
    adCopy: cols(["id", "userId", "serviceId", "adSetId", "content", "contentType", "persona",
      "desire", "awareness", "format", "conceptId", "complianceCheckedAt", "complianceScore",
      "complianceVersion", "selectionScore"]),
    adCreatives: cols(["id", "userId", "serviceId", "conceptId", "headlineAdCopyId",
      "hookAdCopyId", "imageUrl", "verticalImageUrl", "variationNumber", "batchId"]),
  };
});

/** The gated pool is supplied per test; the resolver has its own suite. */
let gatedResult: any;
vi.mock("./publishCopySource", () => ({
  resolveGatedPublishCopy: async () => gatedResult,
}));

import { assembleConceptAds, describeAssembly } from "./adAssembly";

const piece = (r: Partial<any>) => ({
  id: 1, text: "t", contentType: "headline", persona: "p", desire: "d",
  awareness: "problem_aware", format: "f", conceptId: 11,
  complianceCheckedAt: new Date(), complianceScore: 90, complianceVersion: "v1",
  selectionScore: "0.5", ...r,
});

const creative = (r: Partial<any>) => ({
  id: 100, conceptId: 11, headlineAdCopyId: 1, hookAdCopyId: null,
  imageUrl: "https://img/1.png", verticalImageUrl: null, variationNumber: 1, batchId: "batch-A", ...r,
});

function gated(headlines: any[], bodies: any[], extra: Partial<any> = {}) {
  return {
    adSetId: "set-1",
    headline: headlines[0] ?? null,
    body: bodies[0] ?? null,
    headlineCandidates: headlines,
    bodyCandidates: bodies,
    rejectedForWidth: [],
    unavailableReason: null,
    ...extra,
  };
}

/** Drizzle-shaped fake answering the creative query and the hook-row query by their scope. */
function fakeDb(creatives: any[], hookRows: any[] = []) {
  const thenable = (rs: any[]): any => {
    const arr: any = [...rs];
    arr.orderBy = () => thenable(rs);
    arr.limit = (n: number) => thenable(rs.slice(0, n));
    return arr;
  };
  return {
    select: () => ({
      from: () => ({
        where: (scope: any) => {
          if (scope.__in_id) {
            const want = new Set(scope.__in_id.map(Number));
            return thenable(hookRows.filter((h) => want.has(Number(h.id))));
          }
          return thenable(creatives);
        },
      }),
    }),
  } as any;
}

beforeEach(() => {
  gatedResult = gated([], []);
});

describe("the gated pool must be usable at all", () => {
  it("assembles nothing and carries the resolver's reason forward when there is no gated copy", async () => {
    gatedResult = { ...gated([], []), unavailableReason: "no GATED ad copy exists for service 500" };
    const out = await assembleConceptAds(fakeDb([creative({})]), 1, 500);
    expect(out.ads).toEqual([]);
    expect(out.ledger.unavailableReason).toContain("no GATED ad copy");
  });

  it("assembles nothing when the service has creatives but no bodies", async () => {
    gatedResult = gated([piece({ id: 1 })], []);
    const out = await assembleConceptAds(fakeDb([creative({})]), 1, 500);
    expect(out.ads).toEqual([]);
    expect(out.ledger.unavailableReason).toBeTruthy();
  });

  it("assembles nothing when the deck is empty", async () => {
    gatedResult = gated([piece({ id: 1 })], [piece({ id: 2, contentType: "body" })]);
    const out = await assembleConceptAds(fakeDb([]), 1, 500);
    expect(out.ads).toEqual([]);
    expect(out.ledger.unavailableReason).toContain("no ad creatives");
  });
});

describe("pairing is by id, and a stamp disagreement is a defect", () => {
  it("assembles a complete ad, pairing the picture to its headline by headlineAdCopyId", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11, awareness: "problem_aware", text: "H1" })],
      [piece({ id: 2, contentType: "body", conceptId: 11, awareness: "problem_aware", text: "B1" })],
    );
    const out = await assembleConceptAds(fakeDb([creative({ id: 100, conceptId: 11, headlineAdCopyId: 1 })]), 1, 500);
    expect(out.ads).toHaveLength(1);
    const ad = out.ads[0];
    expect(ad.conceptId).toBe(11);
    expect(ad.headline.id).toBe(1);
    expect(ad.body.id).toBe(2);
    expect(ad.creative.id).toBe(100);
    expect(ad.awareness).toBe("problem_aware");
    expect(out.ledger.conceptStampMismatches).toEqual([]);
  });

  it("DROPS the ad and reports a defect when the creative's concept is not its headline's", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11 })],
      [piece({ id: 2, contentType: "body", conceptId: 11 })],
    );
    // The creative claims concept 99 while adCopy 1 says 11 — never reconciled either way.
    const out = await assembleConceptAds(fakeDb([creative({ id: 100, conceptId: 99, headlineAdCopyId: 1 })]), 1, 500);
    expect(out.ads).toEqual([]);
    expect(out.ledger.conceptStampMismatches).toEqual([
      { creativeId: 100, creativeConceptId: 99, headlineConceptId: 11 },
    ]);
    expect(out.ledger.drops.some((d) => d.reason === "concept_stamp_mismatch")).toBe(true);
  });

  it("drops a creative whose headline row is not in the gated pool rather than substituting one", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11 })],
      [piece({ id: 2, contentType: "body", conceptId: 11 })],
    );
    const out = await assembleConceptAds(fakeDb([creative({ id: 100, conceptId: 11, headlineAdCopyId: 777 })]), 1, 500);
    expect(out.ads).toEqual([]);
    expect(out.ledger.drops[0].reason).toBe("headline_row_not_gated");
  });

  it("drops a creative whose baked headline would truncate on the canvas", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11 })],
      [piece({ id: 2, contentType: "body", conceptId: 11 })],
      { rejectedForWidth: [{ id: 1, text: "H1", lines: ["H…"] }] },
    );
    const out = await assembleConceptAds(fakeDb([creative({ headlineAdCopyId: 1 })]), 1, 500);
    expect(out.ads).toEqual([]);
    expect(out.ledger.drops[0].reason).toBe("headline_would_truncate");
  });
});

describe("a NULL concept stamp is skipped, never defaulted", () => {
  it("skips an editorial creative carrying no concept and says so in the ledger", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11 })],
      [piece({ id: 2, contentType: "body", conceptId: 11 })],
    );
    const out = await assembleConceptAds(
      fakeDb([creative({ id: 100, conceptId: null, headlineAdCopyId: null })]), 1, 500);
    expect(out.ads).toEqual([]);
    expect(out.ledger.drops[0].reason).toBe("creative_not_concept_keyed");
    expect(out.ledger.creativesEligible).toBe(0);
  });

  it("skips a concept-stamped creative that does not record which headline it baked", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11 })],
      [piece({ id: 2, contentType: "body", conceptId: 11 })],
    );
    const out = await assembleConceptAds(
      fakeDb([creative({ id: 100, conceptId: 11, headlineAdCopyId: null })]), 1, 500);
    expect(out.ledger.drops[0].reason).toBe("creative_headline_not_recorded");
  });

  it("assembles the concept-keyed creatives and skips the NULL ones in the same deck", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11 })],
      [piece({ id: 2, contentType: "body", conceptId: 11 })],
    );
    const out = await assembleConceptAds(fakeDb([
      creative({ id: 100, conceptId: 11, headlineAdCopyId: 1 }),
      creative({ id: 101, conceptId: null, headlineAdCopyId: null }),
    ]), 1, 500);
    expect(out.ads).toHaveLength(1);
    expect(out.ledger.creativesSeen).toBe(2);
    expect(out.ledger.creativesEligible).toBe(1);
  });
});

describe("awareness coherence — judged row to row on the live stamps", () => {
  it("refuses to pair a solution_aware headline with a problem_aware body of the same concept", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11, awareness: "solution_aware" })],
      [piece({ id: 2, contentType: "body", conceptId: 11, awareness: "problem_aware" })],
    );
    const out = await assembleConceptAds(fakeDb([creative({ headlineAdCopyId: 1, conceptId: 11 })]), 1, 500);
    expect(out.ads).toEqual([]);
    const drop = out.ledger.drops.find((d) => d.reason === "no_body_agrees_on_awareness")!;
    expect(drop.detail).toContain("solution_aware");
  });

  it("ships a gate-MOVED row when it still agrees with its partner — there is no moved-row rule", async () => {
    // Both rows carry concept 11 while the gate moved them to a stage the concept was not
    // written at. They agree with each other, so the ad is coherent and ships.
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11, awareness: "most_aware" })],
      [piece({ id: 2, contentType: "body", conceptId: 11, awareness: "most_aware" })],
    );
    const out = await assembleConceptAds(fakeDb([creative({ headlineAdCopyId: 1, conceptId: 11 })]), 1, 500);
    expect(out.ads).toHaveLength(1);
    expect(out.ads[0].awareness).toBe("most_aware");
  });

  it("picks the body that AGREES rather than the strongest one that does not", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11, awareness: "unaware" })],
      [
        piece({ id: 2, contentType: "body", conceptId: 11, awareness: "product_aware", selectionScore: "0.99" }),
        piece({ id: 3, contentType: "body", conceptId: 11, awareness: "unaware", selectionScore: "0.10" }),
      ],
    );
    const out = await assembleConceptAds(fakeDb([creative({ headlineAdCopyId: 1, conceptId: 11 })]), 1, 500);
    expect(out.ads[0].body.id).toBe(3);
  });

  it("tries another creative of the same concept when the first headline's stage has no body", async () => {
    gatedResult = gated(
      [
        piece({ id: 1, conceptId: 11, awareness: "unaware", selectionScore: "0.9" }),
        piece({ id: 2, conceptId: 11, awareness: "problem_aware", selectionScore: "0.1" }),
      ],
      [piece({ id: 3, contentType: "body", conceptId: 11, awareness: "problem_aware" })],
    );
    const out = await assembleConceptAds(fakeDb([
      creative({ id: 100, conceptId: 11, headlineAdCopyId: 1 }),
      creative({ id: 101, conceptId: 11, headlineAdCopyId: 2 }),
    ]), 1, 500);
    expect(out.ads).toHaveLength(1);
    expect(out.ads[0].headline.id).toBe(2);
    expect(out.ads[0].creative.id).toBe(101);
  });
});

describe("every piece is consumed once — ship fewer, never reuse", () => {
  it("never gives two ads the same body: the second concept ships nothing", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11 }), piece({ id: 2, conceptId: 22 })],
      [piece({ id: 3, contentType: "body", conceptId: 11 })],
    );
    const out = await assembleConceptAds(fakeDb([
      creative({ id: 100, conceptId: 11, headlineAdCopyId: 1 }),
      creative({ id: 101, conceptId: 22, headlineAdCopyId: 2 }),
    ]), 1, 500);
    expect(out.ads).toHaveLength(1);
    expect(out.ads[0].conceptId).toBe(11);
    expect(out.ledger.drops.some((d) => d.reason === "no_body_for_concept" && d.conceptId === 22)).toBe(true);
    expect(out.ledger.coherenceYield).toEqual({ conceptsWithAd: 1, conceptsWithoutAd: 1 });
  });

  it("gives each of two concepts its own body and picture when both are available", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11 }), piece({ id: 2, conceptId: 22 })],
      [
        piece({ id: 3, contentType: "body", conceptId: 11 }),
        piece({ id: 4, contentType: "body", conceptId: 22 }),
      ],
    );
    const out = await assembleConceptAds(fakeDb([
      creative({ id: 100, conceptId: 11, headlineAdCopyId: 1 }),
      creative({ id: 101, conceptId: 22, headlineAdCopyId: 2 }),
    ]), 1, 500);
    expect(out.ads).toHaveLength(2);
    expect(new Set(out.ads.map((a) => a.body.id)).size).toBe(2);
    expect(new Set(out.ads.map((a) => a.creative.id)).size).toBe(2);
    expect(out.ledger.gatedPool.bodiesConsumed).toBe(2);
  });

  it("ships ONE ad per concept even when the concept has several eligible pictures", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11 }), piece({ id: 2, conceptId: 11 })],
      [
        piece({ id: 3, contentType: "body", conceptId: 11 }),
        piece({ id: 4, contentType: "body", conceptId: 11 }),
      ],
    );
    const out = await assembleConceptAds(fakeDb([
      creative({ id: 100, conceptId: 11, headlineAdCopyId: 1 }),
      creative({ id: 101, conceptId: 11, headlineAdCopyId: 2 }),
    ]), 1, 500);
    expect(out.ads).toHaveLength(1);
    expect(out.ledger.drops.some((d) => d.reason === "concept_already_shipped")).toBe(true);
  });

  it("drops a second ad whose picture bakes a DUPLICATE hook line", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11 }), piece({ id: 2, conceptId: 22 })],
      [
        piece({ id: 3, contentType: "body", conceptId: 11 }),
        piece({ id: 4, contentType: "body", conceptId: 22 }),
      ],
    );
    // adCopy 6044 baked onto two slots — the real 2026-08-10 defect shape.
    const hooks = [{ id: 6044, conceptId: 11, content: "The same line twice" }];
    const out = await assembleConceptAds(fakeDb([
      creative({ id: 100, conceptId: 11, headlineAdCopyId: 1, hookAdCopyId: 6044 }),
      creative({ id: 101, conceptId: 22, headlineAdCopyId: 2, hookAdCopyId: 6044 }),
    ], hooks), 1, 500);
    expect(out.ads).toHaveLength(1);
    expect(out.ledger.drops.some((d) => d.reason === "duplicate_hook_text")).toBe(true);
  });
});

describe("the hook is recorded, and preferred, but never decided here", () => {
  it("records a matching hook as match", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11 })],
      [piece({ id: 2, contentType: "body", conceptId: 11 })],
    );
    const out = await assembleConceptAds(
      fakeDb([creative({ headlineAdCopyId: 1, conceptId: 11, hookAdCopyId: 50 })],
             [{ id: 50, conceptId: 11, content: "hook line" }]), 1, 500);
    expect(out.ads[0].hook.agreement).toBe("match");
    expect(out.ads[0].hook.adCopyId).toBe(50);
    expect(out.ledger.hookAgreement.match).toBe(1);
  });

  it("SHIPS an ad whose hook belongs to another concept, and records the mismatch", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11 })],
      [piece({ id: 2, contentType: "body", conceptId: 11 })],
    );
    const out = await assembleConceptAds(
      fakeDb([creative({ headlineAdCopyId: 1, conceptId: 11, hookAdCopyId: 50 })],
             [{ id: 50, conceptId: 99, content: "someone else's hook" }]), 1, 500);
    expect(out.ads).toHaveLength(1);
    expect(out.ads[0].hook.agreement).toBe("mismatch");
    expect(out.ledger.hookAgreement.mismatch).toBe(1);
  });

  it("records a picture with no hook identity as unknown, and still ships it", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11 })],
      [piece({ id: 2, contentType: "body", conceptId: 11 })],
    );
    const out = await assembleConceptAds(
      fakeDb([creative({ headlineAdCopyId: 1, conceptId: 11, hookAdCopyId: null })]), 1, 500);
    expect(out.ads[0].hook.agreement).toBe("unknown");
    expect(out.ads[0].hook.text).toBeNull();
  });

  it("PREFERS the creative whose hook agrees when a concept offers more than one", async () => {
    gatedResult = gated(
      [
        piece({ id: 1, conceptId: 11, selectionScore: "0.99" }), // stronger, hook disagrees
        piece({ id: 2, conceptId: 11, selectionScore: "0.10" }), // weaker, hook agrees
      ],
      [piece({ id: 3, contentType: "body", conceptId: 11 })],
    );
    const out = await assembleConceptAds(fakeDb(
      [
        creative({ id: 100, conceptId: 11, headlineAdCopyId: 1, hookAdCopyId: 50 }),
        creative({ id: 101, conceptId: 11, headlineAdCopyId: 2, hookAdCopyId: 51 }),
      ],
      [{ id: 50, conceptId: 99, content: "wrong concept" }, { id: 51, conceptId: 11, content: "right concept" }],
    ), 1, 500);
    expect(out.ads[0].creative.id).toBe(101);
    expect(out.ads[0].hook.agreement).toBe("match");
  });
});

describe("determinism and reporting", () => {
  it("produces the same plan twice for the same inputs", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 22 }), piece({ id: 2, conceptId: 11 })],
      [
        piece({ id: 3, contentType: "body", conceptId: 11 }),
        piece({ id: 4, contentType: "body", conceptId: 22 }),
      ],
    );
    const rows = [
      creative({ id: 100, conceptId: 22, headlineAdCopyId: 1 }),
      creative({ id: 101, conceptId: 11, headlineAdCopyId: 2 }),
    ];
    const a = await assembleConceptAds(fakeDb(rows), 1, 500);
    const b = await assembleConceptAds(fakeDb(rows), 1, 500);
    expect(b.ads.map((x) => [x.conceptId, x.headline.id, x.body.id]))
      .toEqual(a.ads.map((x) => [x.conceptId, x.headline.id, x.body.id]));
    // Concepts are walked in ascending id order, so the plan does not depend on row order.
    expect(a.ads.map((x) => x.conceptId)).toEqual([11, 22]);
  });

  it("assembles only the most recent batch when no batchId is given", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11 }), piece({ id: 2, conceptId: 22 })],
      [
        piece({ id: 3, contentType: "body", conceptId: 11 }),
        piece({ id: 4, contentType: "body", conceptId: 22 }),
      ],
    );
    // Newest first, as the query orders them.
    const out = await assembleConceptAds(fakeDb([
      creative({ id: 200, conceptId: 11, headlineAdCopyId: 1, batchId: "batch-NEW" }),
      creative({ id: 100, conceptId: 22, headlineAdCopyId: 2, batchId: "batch-OLD" }),
    ]), 1, 500);
    expect(out.ledger.creativesSeen).toBe(1);
    expect(out.ads).toHaveLength(1);
    expect(out.ads[0].creative.batchId).toBe("batch-NEW");
  });

  it("summarises the ledger in one line without hiding a short set", async () => {
    gatedResult = gated(
      [piece({ id: 1, conceptId: 11 }), piece({ id: 2, conceptId: 22 })],
      [piece({ id: 3, contentType: "body", conceptId: 11 })],
    );
    const out = await assembleConceptAds(fakeDb([
      creative({ id: 100, conceptId: 11, headlineAdCopyId: 1 }),
      creative({ id: 101, conceptId: 22, headlineAdCopyId: 2 }),
    ]), 1, 500);
    const line = describeAssembly(out.ledger);
    expect(line).toContain("ADS 1");
    expect(line).toContain("coherence 1 with / 1 without");
  });
});
