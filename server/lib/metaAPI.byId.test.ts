/**
 * metaAPI.byId.test.ts — the by-id read-back fetchers.
 *
 * ⚠️ WHY THIS SUITE EXISTS. These functions are how this product PROVES what Meta stored.
 * The step-1 publish proof read the ad back by id rather than trusting our own request, and
 * the module's own docblock records what went wrong before they existed: a failed READ was
 * reported as a failed WRITE, "which is a different thing and must never be reported as the
 * same thing". Step 4c's multi-ad proof rests entirely on these — it has to show that N ads
 * share ONE `adset_id`, read from Meta — so the error semantics are pinned here first.
 *
 * ⚠️ NO NETWORK. `fetch` is replaced wholesale; every test asserts on the request that WOULD
 * have gone out. Nothing in this suite can reach Meta, by construction.
 *
 * The load-bearing distinction under test: a DELETED object (400 / code 100) is an ANSWER —
 * "gone" — and returns null, while a transport fault THROWS. Collapsing those two would make
 * an outage read as a successful deletion check.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const dbRows: any[] = [];
vi.mock("../db", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({ where: () => ({ limit: () => dbRows }) }),
    }),
  }),
}));
vi.mock("../_core/tokenCrypto", () => ({ decryptToken: (t: string) => `decrypted:${t}` }));
vi.mock("../../drizzle/schema", () => ({ metaAccessTokens: { userId: { __name: "userId" } } }));
vi.mock("drizzle-orm", () => ({ eq: (col: any, val: any) => ({ [`__${col.__name}`]: val }) }));

import { getAdById, getAdSetById, getCampaignById, getAdCreativeById } from "./metaAPI";

const FUTURE = new Date(Date.now() + 60 * 24 * 3600 * 1000);
const PAST = new Date(Date.now() - 1000);

const fetchMock = vi.fn();
(globalThis as any).fetch = fetchMock;

function respond(status: number, body: any) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  dbRows.length = 0;
  dbRows.push({ accessToken: "enc", tokenExpiresAt: FUTURE });
});

describe("token handling — nothing is requested without a live token", () => {
  it("returns null and makes NO request when the user has no token row", async () => {
    dbRows.length = 0;
    expect(await getCampaignById(1, "c1")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null and makes NO request when the stored token has expired", async () => {
    dbRows[0].tokenExpiresAt = PAST;
    expect(await getAdById(1, "a1")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the DECRYPTED token, and sends it as a query parameter", async () => {
    respond(200, { id: "c1" });
    await getCampaignById(1, "c1");
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("access_token")).toBe("decrypted:enc");
  });
});

describe("graphGetById — a missing object is an ANSWER, a fault is an ERROR", () => {
  it("returns null on 400 with error code 100 (the object is gone)", async () => {
    respond(400, { error: { code: 100, message: "Unsupported get request" } });
    expect(await getCampaignById(1, "deleted-campaign")).toBeNull();
  });

  it("returns null on 400 with error code 803 (the object is not visible)", async () => {
    respond(400, { error: { code: 803, message: "Some of the aliases you requested do not exist" } });
    expect(await getAdById(1, "gone-ad")).toBeNull();
  });

  it("THROWS on a 400 with any other error code — that is not a deletion", async () => {
    respond(400, { error: { code: 190, message: "Invalid OAuth access token" } });
    await expect(getCampaignById(1, "c1")).rejects.toThrow(/getCampaignById/);
  });

  it("THROWS on a 500 — a transport fault must never read as 'the object is absent'", async () => {
    respond(500, "upstream exploded");
    await expect(getAdSetById(1, "s1")).rejects.toThrow(/HTTP 500/);
  });

  it("names the failing call in the error, so which of the four calls broke is unambiguous", async () => {
    respond(500, "boom");
    await expect(getAdById(1, "a1")).rejects.toThrow(/getAdById/);
  });

  it("returns null rather than throwing when the body is empty on a 200", async () => {
    respond(200, "");
    expect(await getCampaignById(1, "c1")).toBeNull();
  });

  it("throws with the response body included, so the Graph message is not lost", async () => {
    respond(400, { error: { code: 190, message: "Invalid OAuth access token" } });
    await expect(getCampaignById(1, "c1")).rejects.toThrow(/Invalid OAuth access token/);
  });
});

describe("what each fetcher asks Meta for", () => {
  it("getAdById requests adset_id — the field 4c's one-ad-set proof depends on", async () => {
    respond(200, { id: "a1", adset_id: "s1" });
    await getAdById(1, "a1");
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toContain("/a1");
    expect(url.searchParams.get("fields")).toContain("adset_id");
  });

  it("getAdSetById requests the status that proves an ad set is PAUSED, not our request", async () => {
    respond(200, { id: "s1", status: "PAUSED" });
    await getAdSetById(1, "s1");
    const fields = new URL(fetchMock.mock.calls[0][0]).searchParams.get("fields")!;
    expect(fields).toContain("status");
    expect(fields).toContain("daily_budget");
    expect(fields).toContain("campaign_id");
  });

  it("targets the object id in the path on the pinned Graph version", async () => {
    respond(200, { id: "c1" });
    await getCampaignById(1, "c1");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v21.0/c1");
  });
});

describe("getAdCreativeById — the authoritative read of stored copy", () => {
  it("prefers the top-level title/body as the effective surfaces", async () => {
    respond(200, { id: "cr1", title: "top title", body: "top body" });
    const c = await getAdCreativeById(1, "cr1");
    expect(c!.effectiveTitle).toBe("top title");
    expect(c!.effectiveBody).toBe("top body");
  });

  it("falls back to object_story_spec.link_data when the creative was built from a link spec", async () => {
    respond(200, {
      id: "cr1",
      object_story_spec: { link_data: { name: "spec headline", message: "spec primary text" } },
    });
    const c = await getAdCreativeById(1, "cr1");
    expect(c!.effectiveTitle).toBe("spec headline");
    expect(c!.effectiveBody).toBe("spec primary text");
  });

  it("returns empty strings rather than undefined when neither shape carries copy", async () => {
    respond(200, { id: "cr1" });
    const c = await getAdCreativeById(1, "cr1");
    expect(c!.effectiveTitle).toBe("");
    expect(c!.effectiveBody).toBe("");
  });

  it("returns null for a creative that is gone", async () => {
    respond(400, { error: { code: 100 } });
    expect(await getAdCreativeById(1, "cr1")).toBeNull();
  });

  it("keeps the raw object_story_spec so a read-back can inspect what Meta actually stored", async () => {
    const spec = { link_data: { name: "n", message: "m", link: "https://example.com" } };
    respond(200, { id: "cr1", object_story_spec: spec });
    const c = await getAdCreativeById(1, "cr1");
    expect((c as any).objectStorySpec).toEqual(spec);
  });
});
