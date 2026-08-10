/**
 * publishCopySource.test.ts — the resolver that decides what copy a published ad ships.
 *
 * ⚠️ WHY THIS SUITE EXISTS. This module exists to close the gap traced on 2026-08-09: the
 * gated copy engine's output reached NOTHING live. Its single most important property is
 * NEGATIVE — it must REFUSE ungated or unscreened rows rather than falling back to them,
 * because a silent fallback is indistinguishable from the defect being removed. A refusal is
 * only provable by a test that supplies ungated rows and checks nothing came back.
 *
 * Step 1 shipped with zero tests (568 before, 568 after) and step 4's assembly builds
 * directly on this resolver, so it is closed here before anything is layered on top.
 *
 * The fake db RECORDS the scope it is handed, so the ownership assertions are about what the
 * resolver actually asks the database for — not about what its comments claim. That is the
 * same pattern `adCreativeTeardown.test.ts` uses, and for the same reason.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// `and(eq(...), ...)` is opaque at runtime, so the columns are stubbed to produce a scope
// object the fake db can read. This mirrors the real call shape exactly.
vi.mock("drizzle-orm", () => ({
  and: (...parts: any[]) => Object.assign({}, ...parts),
  eq: (col: any, val: any) => ({ [`__${col.__name}`]: val }),
  desc: (col: any) => ({ __orderBy: col.__name }),
  isNotNull: (col: any) => ({ [`__notNull_${col.__name}`]: true }),
}));
vi.mock("../../drizzle/schema", () => ({
  adCopy: {
    id: { __name: "id" }, userId: { __name: "userId" }, serviceId: { __name: "serviceId" },
    adSetId: { __name: "adSetId" }, content: { __name: "content" },
    contentType: { __name: "contentType" }, persona: { __name: "persona" },
    desire: { __name: "desire" }, awareness: { __name: "awareness" }, format: { __name: "format" },
    conceptId: { __name: "conceptId" }, complianceCheckedAt: { __name: "complianceCheckedAt" },
    complianceScore: { __name: "complianceScore" }, complianceVersion: { __name: "complianceVersion" },
    selectionScore: { __name: "selectionScore" },
  },
}));

// The width rule has its own suite against the real font (measureHeadlineFit.test.ts). Here it
// is driven deterministically so the SELECTION logic is what is under test.
const fitCalls: Array<{ text: string; width: number; zone: string }> = [];
let doesNotFit: (text: string) => boolean = () => false;
vi.mock("./compositeHeadline", () => ({
  measureHeadlineFit: (text: string, width: number, zone: string) => {
    fitCalls.push({ text, width, zone });
    const bad = doesNotFit(text);
    return { fits: !bad, truncated: bad, lines: bad ? [`${text.slice(0, 10)}…`] : [text],
             fontSize: 40, widestLine: 100, maxWidth: 200 };
  },
}));

import { resolveGatedPublishCopy } from "./publishCopySource";

const CHECKED = new Date("2026-08-09T10:00:00Z");

type RowIn = Partial<{
  id: number; content: string; contentType: string; persona: string | null; desire: string | null;
  awareness: string | null; format: string | null; conceptId: number | null;
  complianceCheckedAt: Date | null; selectionScore: string | null;
}>;

/** A fully gated row unless a test deliberately removes what makes it gated. */
const row = (r: RowIn) => ({
  id: 1, content: "text", contentType: "headline", persona: "p", desire: "d",
  awareness: "problem_aware", format: "pain_agitation", conceptId: 11,
  complianceCheckedAt: CHECKED, complianceScore: 90, complianceVersion: "v1",
  selectionScore: "0.5", ...r,
});

/**
 * Drizzle-shaped fake. The resolver makes two different queries and the fake answers them by
 * the SCOPE it is given — the ad-set lookup is scoped by serviceId, the row fetch by adSetId
 * — rather than by call order, so a test cannot pass because the calls happened to be
 * sequenced the way it assumed.
 */
function fakeDb(opts: { recentAdSetId?: string | null; rows?: any[] }) {
  const scopes: any[] = [];
  const thenable = (rs: any[]): any => {
    const arr: any = [...rs];
    arr.orderBy = () => thenable(rs);
    arr.limit = (n: number) => thenable(rs.slice(0, n));
    return arr;
  };
  const db: any = {
    select: () => ({
      from: () => ({
        where: (scope: any) => {
          scopes.push(scope);
          if (scope.__adSetId !== undefined) {
            const rows = (opts.rows ?? []).filter(() => scope.__userId !== undefined);
            return thenable(rows);
          }
          return thenable(opts.recentAdSetId ? [{ adSetId: opts.recentAdSetId }] : []);
        },
      }),
    }),
  };
  return { db, scopes };
}

beforeEach(() => {
  fitCalls.length = 0;
  doesNotFit = () => false;
});

describe("resolveGatedPublishCopy — it REFUSES rather than falling back", () => {
  it("returns nothing and explains why when the service has no gated ad set at all", async () => {
    const { db } = fakeDb({ recentAdSetId: null });
    const out = await resolveGatedPublishCopy(db, 1, 500);
    expect(out.headline).toBeNull();
    expect(out.body).toBeNull();
    expect(out.headlineCandidates).toEqual([]);
    expect(out.bodyCandidates).toEqual([]);
    expect(out.unavailableReason).toContain("no GATED ad copy");
  });

  it("excludes a row with NO awareness stamp — migration 0097's columns are the gate", async () => {
    const { db } = fakeDb({
      recentAdSetId: "set-1",
      rows: [
        row({ id: 1, contentType: "headline", awareness: null }),
        row({ id: 2, contentType: "headline" }),
        row({ id: 3, contentType: "body" }),
      ],
    });
    const out = await resolveGatedPublishCopy(db, 1, 500);
    expect(out.headlineCandidates.map((c) => c.id)).toEqual([2]);
  });

  it("excludes a row that was never compliance-checked, even with a full axis stamp", async () => {
    const { db } = fakeDb({
      recentAdSetId: "set-1",
      rows: [
        row({ id: 1, contentType: "headline", complianceCheckedAt: null }),
        row({ id: 2, contentType: "headline" }),
        row({ id: 3, contentType: "body" }),
      ],
    });
    const out = await resolveGatedPublishCopy(db, 1, 500);
    expect(out.headlineCandidates.map((c) => c.id)).toEqual([2]);
  });

  it("treats an empty-string awareness as ungated, not as a stamp", async () => {
    const { db } = fakeDb({
      recentAdSetId: "set-1",
      rows: [row({ id: 1, contentType: "headline", awareness: "" }), row({ id: 3, contentType: "body" })],
    });
    const out = await resolveGatedPublishCopy(db, 1, 500);
    expect(out.headlineCandidates).toEqual([]);
    expect(out.unavailableReason).toContain("both surfaces are required");
  });

  it("requires BOTH surfaces — gated headlines with no gated body resolve to nothing", async () => {
    const { db } = fakeDb({
      recentAdSetId: "set-1",
      rows: [row({ id: 1, contentType: "headline" }), row({ id: 2, contentType: "headline" })],
    });
    const out = await resolveGatedPublishCopy(db, 1, 500);
    expect(out.headline).toBeNull();
    expect(out.body).toBeNull();
    expect(out.unavailableReason).toContain("2 gated headline(s)");
    expect(out.unavailableReason).toContain("0 gated body(ies)");
    // The candidates still come back, so a caller can show WHY rather than a blank refusal.
    expect(out.headlineCandidates).toHaveLength(2);
    expect(out.adSetId).toBe("set-1");
  });
});

describe("resolveGatedPublishCopy — selection", () => {
  it("orders candidates strongest first, breaking ties by id so runs are reproducible", async () => {
    const { db } = fakeDb({
      recentAdSetId: "set-1",
      rows: [
        row({ id: 7, contentType: "headline", selectionScore: "0.5" }),
        row({ id: 3, contentType: "headline", selectionScore: "0.9" }),
        row({ id: 5, contentType: "headline", selectionScore: "0.5" }),
        row({ id: 9, contentType: "headline", selectionScore: null }),
        row({ id: 2, contentType: "body", selectionScore: "0.1" }),
        row({ id: 4, contentType: "body", selectionScore: "0.8" }),
      ],
    });
    const out = await resolveGatedPublishCopy(db, 1, 500);
    expect(out.headlineCandidates.map((c) => c.id)).toEqual([3, 5, 7, 9]);
    expect(out.headline?.id).toBe(3);
    expect(out.body?.id).toBe(4);
  });

  it("skips a headline that would truncate, records it, and takes the next one", async () => {
    doesNotFit = (t) => t === "would-ellipsis";
    const { db } = fakeDb({
      recentAdSetId: "set-1",
      rows: [
        row({ id: 1, contentType: "headline", content: "would-ellipsis", selectionScore: "0.9" }),
        row({ id: 2, contentType: "headline", content: "fits fine", selectionScore: "0.4" }),
        row({ id: 3, contentType: "body" }),
      ],
    });
    const out = await resolveGatedPublishCopy(db, 1, 500);
    expect(out.headline?.id).toBe(2);
    expect(out.rejectedForWidth.map((r) => r.id)).toEqual([1]);
    expect(out.unavailableReason).toBeNull();
  });

  it("refuses when EVERY gated headline would truncate — a truncated headline never ships", async () => {
    doesNotFit = () => true;
    const { db } = fakeDb({
      recentAdSetId: "set-1",
      rows: [
        row({ id: 1, contentType: "headline" }),
        row({ id: 2, contentType: "headline" }),
        row({ id: 3, contentType: "body" }),
      ],
    });
    const out = await resolveGatedPublishCopy(db, 1, 500);
    expect(out.headline).toBeNull();
    expect(out.rejectedForWidth).toHaveLength(2);
    expect(out.unavailableReason).toContain("896px");
  });

  it("measures against 896 by default — the NARROWER canvas, so the choice fits either renderer", async () => {
    const { db } = fakeDb({
      recentAdSetId: "set-1",
      rows: [row({ id: 1, contentType: "headline" }), row({ id: 2, contentType: "body" })],
    });
    await resolveGatedPublishCopy(db, 1, 500);
    expect(fitCalls[0].width).toBe(896);
    expect(fitCalls[0].zone).toBe("lower");
  });

  it("honours an explicit canvasWidth", async () => {
    const { db } = fakeDb({
      recentAdSetId: "set-1",
      rows: [row({ id: 1, contentType: "headline" }), row({ id: 2, contentType: "body" })],
    });
    await resolveGatedPublishCopy(db, 1, 500, { canvasWidth: 1024 });
    expect(fitCalls[0].width).toBe(1024);
  });
});

describe("resolveGatedPublishCopy — identity and scope", () => {
  it("carries conceptId as a NUMBER and preserves NULL, never deriving it from desire text", async () => {
    const { db } = fakeDb({
      recentAdSetId: "set-1",
      rows: [
        row({ id: 1, contentType: "headline", conceptId: 42 as any }),
        row({ id: 2, contentType: "headline", conceptId: null }),
        row({ id: 3, contentType: "body", conceptId: "77" as any }),
      ],
    });
    const out = await resolveGatedPublishCopy(db, 1, 500);
    const byId = new Map(out.headlineCandidates.map((c) => [c.id, c.conceptId]));
    expect(byId.get(1)).toBe(42);
    expect(byId.get(2)).toBeNull();
    // A string id from the driver becomes a number — assembly joins on integers.
    expect(out.bodyCandidates[0].conceptId).toBe(77);
    expect(typeof out.bodyCandidates[0].conceptId).toBe("number");
  });

  it("scopes BOTH queries by userId — a serviceId alone is not an ownership claim", async () => {
    const { db, scopes } = fakeDb({
      recentAdSetId: "set-1",
      rows: [row({ id: 1, contentType: "headline" }), row({ id: 2, contentType: "body" })],
    });
    await resolveGatedPublishCopy(db, 117174, 500);
    expect(scopes).toHaveLength(2);
    expect(scopes[0].__userId).toBe(117174);
    expect(scopes[0].__serviceId).toBe(500);
    expect(scopes[0].__notNull_awareness).toBe(true);
    expect(scopes[1].__userId).toBe(117174);
    expect(scopes[1].__adSetId).toBe("set-1");
  });

  it("uses a supplied adSetId directly and skips the lookup query", async () => {
    const { db, scopes } = fakeDb({
      recentAdSetId: null, // proves the lookup was not consulted
      rows: [row({ id: 1, contentType: "headline" }), row({ id: 2, contentType: "body" })],
    });
    const out = await resolveGatedPublishCopy(db, 1, 500, { adSetId: "given-set" });
    expect(scopes).toHaveLength(1);
    expect(scopes[0].__adSetId).toBe("given-set");
    expect(out.adSetId).toBe("given-set");
    expect(out.headline?.id).toBe(1);
  });

  it("passes the four P.D.A.F. axes and the compliance provenance through unchanged", async () => {
    const { db } = fakeDb({
      recentAdSetId: "set-1",
      rows: [
        row({ id: 1, contentType: "headline", persona: "postpartum-coach", desire: "sleep",
              awareness: "solution_aware", format: "curiosity" }),
        row({ id: 2, contentType: "body" }),
      ],
    });
    const out = await resolveGatedPublishCopy(db, 1, 500);
    const h = out.headline!;
    expect(h.persona).toBe("postpartum-coach");
    expect(h.desire).toBe("sleep");
    expect(h.awareness).toBe("solution_aware");
    expect(h.format).toBe("curiosity");
    expect(h.complianceCheckedAt).toBe(CHECKED);
    expect(h.complianceVersion).toBe("v1");
  });
});
