import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import body5686 from "./_core/__fixtures__/lead-magnets/hvco-5686.json";
import body7173 from "./_core/__fixtures__/lead-magnets/hvco-7173.json";
import body7233 from "./_core/__fixtures__/lead-magnets/hvco-7233.json";
import body7293 from "./_core/__fixtures__/lead-magnets/hvco-7293.json";
import { findLeftoverOperatorTokens } from "./_core/leftoverOperatorTokens";

/**
 * The shared leftover-token gate, proven on the four lead magnets that were live on production on
 * 2026-09-10 — their stored bodies verbatim, rendered by the REAL renderer. Only I/O is mocked.
 * 7293 went live carrying [INSERT_OFFER_LINK] on both public pages and in its PDF; the other
 * three are clean.
 */
const m = vi.hoisted(() => ({
  writeKvPage: vi.fn(async (_ns: string, _slug: string, _html: string) => {}),
  renderPdfFromUrl: vi.fn(async () => Buffer.from("PDF-BYTES")),
  ensureKvNamespace: vi.fn(async () => "NS_ID"),
  storagePut: vi.fn(async (key: string) => ({ url: `https://cdn.example/${key}` })),
  getDb: vi.fn(),
}));
vi.mock("./lib/cloudflare", () => ({ writeKvPage: m.writeKvPage, renderPdfFromUrl: m.renderPdfFromUrl, ensureKvNamespace: m.ensureKvNamespace }));
vi.mock("./storage", () => ({ storagePut: m.storagePut }));
vi.mock("./db", () => ({ getDb: m.getDb }));
vi.mock("./lib/coachLogo", () => ({ getCoachLogoUrl: vi.fn(async () => null) }));

const clone = (x: unknown): any => JSON.parse(JSON.stringify(x));

// Same drizzle-ish mock as leadMagnetPublisher.test.ts, plus a count of update() calls, so a held
// publish can be shown to have written NOTHING to the row.
function makeDb(queue: any[][]) {
  const state = { updates: 0 };
  const q = () => {
    const c: any = {
      from: () => c, where: () => c, set: () => c,
      limit: () => Promise.resolve(queue.shift() ?? []),
      then: (res: any) => res(queue.shift() ?? []),
    };
    return c;
  };
  const db = { select: () => q(), update: () => { state.updates++; return q(); }, insert: () => q(), delete: () => q() };
  return { state, db };
}

// Production shape: user 1, and services 315–318 carry an EMPTY name, so the slug base is "magnet".
function rowQueue(id: number, body: any, pointer: number | null = null): any[][] {
  const queue: any[][] = [
    [{ id, userId: 1, serviceId: 318, title: body.title, assetBody: body, nextStepLandingPageId: pointer }],
    [{ name: "" }],
  ];
  if (pointer) queue.push([{ publicUrl: null }]); // page 240 today: taken down, no public URL
  return queue;
}

const writtenHtml = () => m.writeKvPage.mock.calls.map((c) => c[2] as string);

beforeEach(() => vi.clearAllMocks());

describe("findLeftoverOperatorTokens — the one definition of a leftover token", () => {
  it("returns each distinct token once, in order of first appearance", () => {
    expect(findLeftoverOperatorTokens("a [INSERT_PRICE] b [INSERT_OFFER_LINK] c [INSERT_PRICE]"))
      .toEqual(["[INSERT_PRICE]", "[INSERT_OFFER_LINK]"]);
  });

  it("does not match a reader's fill-in cells or other bracketed text", () => {
    expect(findLeftoverOperatorTokens("[NAME] [DATE] [NUMBER] [e.g. Former colleague] [BRACKETED] [insert_price]")).toEqual([]);
  });

  it("gives the same answer on repeated calls (no regex state carried between calls)", () => {
    const s = "x [INSERT_HOST_NAME] y";
    expect(findLeftoverOperatorTokens(s)).toEqual(["[INSERT_HOST_NAME]"]);
    expect(findLeftoverOperatorTokens(s)).toEqual(["[INSERT_HOST_NAME]"]);
  });

  it("finds exactly [INSERT_OFFER_LINK] in 7293's body — and skips the reader blanks that body also carries", () => {
    const json = JSON.stringify(body7293);
    // Control: the body really does carry reader-facing blanks, so their absence below is a finding.
    expect(json).toContain("[DATE]");
    expect(json).toContain("[NAME]");
    expect(findLeftoverOperatorTokens(json)).toEqual(["[INSERT_OFFER_LINK]"]);
  });

  it("finds nothing in the other three production bodies", () => {
    for (const b of [body5686, body7173, body7233]) expect(findLeftoverOperatorTokens(JSON.stringify(b))).toEqual([]);
  });
});

describe("publishLeadMagnet — the gate on the four magnets live on 2026-09-10", () => {
  it("REFUSES 7293: a named held result listing the token, and nothing written anywhere", async () => {
    const { state, db } = makeDb(rowQueue(7293, clone(body7293)));
    m.getDb.mockResolvedValue(db);
    const { publishLeadMagnet } = await import("./leadMagnetPublisher");
    const res = await publishLeadMagnet({ hvcoId: 7293 });

    expect(res).toEqual({ status: "held", reason: "leftover_operator_tokens", tokens: ["[INSERT_OFFER_LINK]"] });
    expect(m.writeKvPage).not.toHaveBeenCalled();
    expect(m.renderPdfFromUrl).not.toHaveBeenCalled();
    expect(m.storagePut).not.toHaveBeenCalled();
    expect(state.updates).toBe(0);
  });

  it.each([
    [5686, body5686, null, "no-pointer"],
    [7173, body7173, null, "no-pointer"],
    [7233, body7233, 240, "target-unpublished"],
  ])("still PUBLISHES %i — both pages written, token-free, row persisted", async (id, body, pointer, bridge) => {
    const { state, db } = makeDb(rowQueue(id as number, clone(body), pointer as number | null));
    m.getDb.mockResolvedValue(db);
    const { publishLeadMagnet, isPublishHeld } = await import("./leadMagnetPublisher");
    const res: any = await publishLeadMagnet({ hvcoId: id as number });

    expect(isPublishHeld(res)).toBe(false);
    expect(res).toMatchObject({
      deliverableUrl: `https://zapcampaigns.com/p/magnet-magnet-${id}`,
      optInUrl: `https://zapcampaigns.com/p/magnet-get-${id}`,
      bridge,
    });
    expect(m.writeKvPage.mock.calls.map((c) => c[1])).toEqual([`magnet-magnet-${id}`, `magnet-get-${id}`]);
    for (const html of writtenHtml()) {
      expect(html.length).toBeGreaterThan(5000); // a real render, not an empty string passing vacuously
      expect(findLeftoverOperatorTokens(html)).toEqual([]);
    }
    expect(state.updates).toBe(1);
  });

  it("the refusal is caused by the TOKEN, not by which magnet it is", async () => {
    const { publishLeadMagnet } = await import("./leadMagnetPublisher");

    // A clean magnet with a token planted in its next step is refused…
    const planted = clone(body7233);
    planted.nextStep.body += " Reserve your place at [INSERT_OFFER_LINK].";
    m.getDb.mockResolvedValue(makeDb(rowQueue(7233, planted)).db);
    expect(await publishLeadMagnet({ hvcoId: 7233 })).toMatchObject({ status: "held", tokens: ["[INSERT_OFFER_LINK]"] });
    expect(m.writeKvPage).not.toHaveBeenCalled();

    // …and 7293 with its one token removed publishes.
    const stripped = JSON.parse(JSON.stringify(body7293).split("[INSERT_OFFER_LINK]").join("the link below"));
    m.getDb.mockResolvedValue(makeDb(rowQueue(7293, stripped)).db);
    const res: any = await publishLeadMagnet({ hvcoId: 7293 });
    expect(res.deliverableUrl).toBe("https://zapcampaigns.com/p/magnet-magnet-7293");
    expect(m.writeKvPage).toHaveBeenCalledTimes(2);
  });
});

describe("publishDeliverableBody — the bonus path is covered too", () => {
  it("REFUSES a body whose rendered page carries a token, before any write", async () => {
    const { publishDeliverableBody } = await import("./leadMagnetPublisher");
    const res = await publishDeliverableBody(clone(body7293), { userId: 1, slug: "bonus-x", storageKey: "bonuses/1/x.pdf", coachLogoUrl: null });
    expect(res).toEqual({ status: "held", reason: "leftover_operator_tokens", tokens: ["[INSERT_OFFER_LINK]"] });
    expect(m.ensureKvNamespace).not.toHaveBeenCalled();
    expect(m.writeKvPage).not.toHaveBeenCalled();
    expect(m.renderPdfFromUrl).not.toHaveBeenCalled();
  });

  it("publishes a clean body", async () => {
    const { publishDeliverableBody } = await import("./leadMagnetPublisher");
    const res = await publishDeliverableBody(clone(body7173), { userId: 1, slug: "bonus-y", storageKey: "bonuses/1/y.pdf", coachLogoUrl: null });
    expect(res).toEqual({ deliverableUrl: "https://zapcampaigns.com/p/bonus-y", pdfUrl: "https://cdn.example/bonuses/1/y.pdf" });
    expect(m.writeKvPage).toHaveBeenCalledTimes(1);
  });
});

describe("one definition — both publish gates call the shared function", () => {
  const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const INLINE_TOKEN_REGEX = /\/\\\[INSERT_/;

  it("the regex literal lives in exactly one place", () => {
    expect(src("./_core/leftoverOperatorTokens.ts").match(new RegExp(INLINE_TOKEN_REGEX.source, "g"))).toHaveLength(1);
  });

  it.each(["./landingPagePublisher.ts", "./leadMagnetPublisher.ts"])("%s uses findLeftoverOperatorTokens and carries no inline copy", (p) => {
    const s = src(p);
    expect(s).toContain("findLeftoverOperatorTokens");
    expect(s).not.toMatch(INLINE_TOKEN_REGEX);
  });
});
