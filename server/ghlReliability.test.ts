import { describe, it, expect, vi, beforeEach } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { readFileSync } from "fs";
import { join } from "path";
import { TRPCError } from "@trpc/server";

// GHL delivery reliability (GHL_DELIVERY_RELIABILITY_PROPOSAL_2026-09-24). No real GHL call is ever made: `fetch` is
// replaced by a fake GHL, and the database by a fake that enforces the compare-and-set for real (the renewal's WHERE
// clause is rendered and its parameters honoured), so the race tests exercise the actual guard.

const { db, calls } = vi.hoisted(() => {
  const db = {
    row: null as Record<string, any> | null,
    marks: 0,
  };
  const calls = { fetch: [] as Array<{ url: string; method: string; body?: string }> };
  return { db, calls };
});

const dialect = new MySqlDialect();
const fakeDb: any = {
  select: () => ({ from: () => ({ where: () => ({ limit: async () => (db.row ? [{ ...db.row }] : []) }) }) }),
  update: () => ({
    set: (v: Record<string, any>) => ({
      where: async (w: any) => {
        const params = dialect.sqlToQuery(w).params;
        if (!db.row) return [{ affectedRows: 0 }];
        // Compare-and-set: [userId, refreshToken]. Plain: [userId].
        if (params.length === 2 && db.row.refreshToken !== params[1]) return [{ affectedRows: 0 }];
        if (v.reconnectRequiredAt) db.marks++;
        db.row = { ...db.row, ...v };
        return [{ affectedRows: 1 }];
      },
    }),
  }),
  delete: () => ({ where: async () => undefined }),
  insert: () => ({ values: async () => undefined }),
};
vi.mock("./db", () => ({ getDb: async () => fakeDb }));
vi.mock("./_core/tokenCrypto", () => ({
  encryptToken: (v: string) => `enc:${v}`,
  decryptToken: (v: string) => String(v).replace(/^enc:/, ""),
}));

import { getGhlAccess, GhlConnectionCause, RENEW_MARGIN_MS } from "./_core/ghlToken";
import { GhlPushSession, GhlListError, ghlRouter, clearWorkflowStatusCache } from "./routers/ghl";

const HOUR = 3600_000;
const future = (ms = 20 * HOUR) => new Date(Date.now() + ms);
const past = () => new Date(Date.now() - HOUR);
const baseRow = (over: Record<string, any> = {}) => ({
  id: 1, userId: 7, accessToken: "enc:A1", refreshToken: "enc:K1", tokenExpiresAt: future(),
  locationId: "LOC", locationName: "The Incredible You Management", companyId: "CO", connectedAt: new Date(),
  reconnectRequiredAt: null, lastRenewalError: null, ...over,
});

type Handler = (url: string, init: RequestInit) => Promise<Response> | Response;
let handler: Handler;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
  calls.fetch.push({ url: String(url), method: String(init.method ?? "GET"), body: typeof init.body === "string" ? init.body : init.body?.toString() });
  return handler(String(url), init);
});
const tokenCalls = () => calls.fetch.filter((c) => c.url.endsWith("/oauth/token"));

async function kindOf(p: Promise<unknown>): Promise<string> {
  try { await p; return "ok"; } catch (e) {
    if (e instanceof GhlConnectionCause) return e.kind;
    const c = (e as TRPCError).cause;
    if (c instanceof GhlConnectionCause) return c.kind;
    throw e;
  }
}

beforeEach(() => {
  db.row = null; db.marks = 0; calls.fetch = [];
  process.env.GHL_CLIENT_ID = "cid"; process.env.GHL_CLIENT_SECRET = "csecret";
  handler = () => { throw new Error("unexpected fetch"); };
  clearWorkflowStatusCache(7);
});

// ═══════════════════════════════════════════ A. RENEWAL ═══════════════════════════════════════════════════════════
describe("A — GHL login renewal (getGhlAccess)", () => {
  it("NEGATIVE CONTROL: a valid token is returned with NO renewal call", async () => {
    db.row = baseRow();
    expect((await getGhlAccess(7)).accessToken).toBe("A1");
    expect(tokenCalls()).toHaveLength(0);
  });

  it("an expired token is renewed: the stored key is sent, and BOTH tokens are replaced (GHL rotates the key)", async () => {
    db.row = baseRow({ tokenExpiresAt: past() });
    handler = () => json(200, { access_token: "A2", refresh_token: "K2", expires_in: 86399 });
    const access = await getGhlAccess(7);
    expect(access.accessToken).toBe("A2");
    const sent = new URLSearchParams(tokenCalls()[0].body);
    expect(sent.get("grant_type")).toBe("refresh_token");
    expect(sent.get("refresh_token")).toBe("K1");
    expect(sent.get("client_id")).toBe("cid");
    expect(db.row!.accessToken).toBe("enc:A2");
    expect(db.row!.refreshToken).toBe("enc:K2");
    expect(new Date(db.row!.tokenExpiresAt).getTime()).toBeGreaterThan(Date.now() + 23 * HOUR);
  });

  it("a token inside the 5-minute margin is renewed before use", async () => {
    db.row = baseRow({ tokenExpiresAt: future(RENEW_MARGIN_MS - 1000) });
    handler = () => json(200, { access_token: "A2", refresh_token: "K2", expires_in: 86399 });
    expect((await getGhlAccess(7)).accessToken).toBe("A2");
  });

  it("REJECTED key (400 invalid_grant): marked reconnect-required, with GHL's reason recorded", async () => {
    db.row = baseRow({ tokenExpiresAt: past() });
    handler = () => json(400, { error: "invalid_grant", error_description: "Invalid refresh token" });
    expect(await kindOf(getGhlAccess(7))).toBe("reconnect_required");
    expect(db.row!.reconnectRequiredAt).toBeInstanceOf(Date);
    expect(db.row!.lastRenewalError).toMatch(/400.*invalid_grant/);
    // …and it stays marked: the next read refuses without calling GHL again.
    calls.fetch = [];
    expect(await kindOf(getGhlAccess(7))).toBe("reconnect_required");
    expect(tokenCalls()).toHaveLength(0);
  });

  it("no renewal key stored: reconnect-required, no GHL call", async () => {
    db.row = baseRow({ tokenExpiresAt: past(), refreshToken: null });
    expect(await kindOf(getGhlAccess(7))).toBe("reconnect_required");
    expect(tokenCalls()).toHaveLength(0);
    expect(db.marks).toBe(1);
  });

  it.each([
    ["GHL 503", () => json(503, { message: "down" })],
    ["GHL 429", () => json(429, { message: "slow down" })],
    ["network error", () => { throw new TypeError("fetch failed"); }],
  ])("GHL DOWN (%s): 'unavailable', and NOTHING is marked or changed", async (_label, h) => {
    db.row = baseRow({ tokenExpiresAt: past() });
    const before = { ...db.row };
    handler = h as Handler;
    expect(await kindOf(getGhlAccess(7))).toBe("unavailable");
    expect(db.marks).toBe(0);
    expect(db.row).toEqual(before);
  });

  it("not connected at all: 'not_connected', no GHL call", async () => {
    expect(await kindOf(getGhlAccess(7))).toBe("not_connected");
    expect(calls.fetch).toHaveLength(0);
  });

  it("CONCURRENT renewal in one process: two readers at once make ONE renewal call and get the same token", async () => {
    db.row = baseRow({ tokenExpiresAt: past() });
    let resolve!: (r: Response) => void;
    handler = () => new Promise<Response>((r) => { resolve = r; });
    const a = getGhlAccess(7);
    const b = getGhlAccess(7);
    await new Promise((r) => setTimeout(r, 10));
    resolve(json(200, { access_token: "A2", refresh_token: "K2", expires_in: 86399 }));
    expect((await a).accessToken).toBe("A2");
    expect((await b).accessToken).toBe("A2");
    expect(tokenCalls()).toHaveLength(1);
  });

  it("CONCURRENT renewal across processes: the loser writes NOTHING and uses the winner's token — a live key is never overwritten", async () => {
    db.row = baseRow({ tokenExpiresAt: past() });
    handler = () => {
      // Another process renews first and stores K2 while our request is in flight.
      db.row = { ...db.row!, accessToken: "enc:A-winner", refreshToken: "enc:K-winner", tokenExpiresAt: future() };
      return json(200, { access_token: "A-loser", refresh_token: "K-loser", expires_in: 86399 });
    };
    const access = await getGhlAccess(7);
    expect(access.accessToken).toBe("A-winner");
    expect(db.row!.refreshToken).toBe("enc:K-winner"); // NOT overwritten with the loser's key
  });

  it("a rejection that raced a successful renewal elsewhere is NOT marked — the fresh token is used", async () => {
    db.row = baseRow({ tokenExpiresAt: past() });
    handler = () => {
      db.row = { ...db.row!, accessToken: "enc:A-other", refreshToken: "enc:K-other", tokenExpiresAt: future() };
      return json(400, { error: "invalid_grant" });
    };
    expect((await getGhlAccess(7)).accessToken).toBe("A-other");
    expect(db.marks).toBe(0);
  });
});

// ═══════════════════════════════════════ A. THE THREE READERS ══════════════════════════════════════════════════════
describe("A — Settings status and the snapshot check use the same helper and report distinct states", () => {
  const caller = () => ghlRouter.createCaller({ user: { id: 7, role: "user", subscriptionTier: "pro" }, req: {}, res: {} } as any);
  const workflows = (n: number) => json(200, { workflows: Array.from({ length: n }, (_, i) => ({ id: `w${i}`, name: `ZAP - Flow ${i}` })) });

  it("connection status: connected (renewing on read) · reconnect_required · unreachable · not_connected", async () => {
    db.row = baseRow({ tokenExpiresAt: past() });
    handler = () => json(200, { access_token: "A2", refresh_token: "K2", expires_in: 86399 });
    expect(await caller().getConnectionStatus()).toMatchObject({ connected: true, state: "connected", locationName: "The Incredible You Management" });

    db.row = baseRow({ reconnectRequiredAt: new Date() });
    expect(await caller().getConnectionStatus()).toMatchObject({ connected: false, state: "reconnect_required", message: "Your GoHighLevel connection has ended — reconnect GoHighLevel." });

    db.row = baseRow({ tokenExpiresAt: past() });
    handler = () => json(503, {});
    expect(await caller().getConnectionStatus()).toMatchObject({ connected: false, state: "unreachable", message: "GoHighLevel didn't respond — try again in a minute." });

    db.row = null;
    expect(await caller().getConnectionStatus()).toMatchObject({ connected: false, state: "not_connected" });
  });

  it("snapshot check: 'can't check' (unreachable) is its OWN state — never 'Snapshot not applied'", async () => {
    db.row = baseRow();
    handler = () => json(503, { message: "down" });
    const r = await caller().getWorkflowStatus({ force: true });
    expect(r.state).toBe("unreachable");
    // NEGATIVE CONTROL: a real answer of zero ZAP workflows IS "missing".
    handler = () => workflows(0);
    expect((await caller().getWorkflowStatus({ force: true })).state).toBe("missing");
    handler = () => workflows(12);
    expect((await caller().getWorkflowStatus({ force: true })).state).toBe("installed");
  });

  it("snapshot check: a 401 on a token we believed valid renews ONCE and retries ONCE", async () => {
    db.row = baseRow();
    let n = 0;
    handler = (url) => {
      if (url.endsWith("/oauth/token")) return json(200, { access_token: "A2", refresh_token: "K2", expires_in: 86399 });
      n++;
      return n === 1 ? json(401, { message: "Invalid JWT" }) : workflows(16);
    };
    const r = await caller().getWorkflowStatus({ force: true });
    expect(r.state).toBe("installed");
    expect(tokenCalls()).toHaveLength(1);
  });

  it("snapshot check: a reconnect-required connection says so, and an unreachable answer is never cached", async () => {
    db.row = baseRow({ reconnectRequiredAt: new Date() });
    expect((await caller().getWorkflowStatus()).state).toBe("reconnect_required");
    db.row = baseRow();
    handler = () => json(503, {});
    expect((await caller().getWorkflowStatus()).state).toBe("unreachable");
    handler = () => workflows(16);
    expect((await caller().getWorkflowStatus()).state).toBe("installed"); // not served the cached "unreachable"
  });

  it("push: a connection problem stops the push BEFORE anything is written, with the coach sentence + cause", async () => {
    db.row = baseRow({ reconnectRequiredAt: new Date() });
    const e1 = await caller().pushCampaign({ kitId: 1 }).then(() => null, (e) => e);
    expect(e1.message).toBe("Your GoHighLevel connection has ended — reconnect GoHighLevel.");
    expect((e1.cause as GhlConnectionCause).kind).toBe("reconnect_required");

    db.row = baseRow({ tokenExpiresAt: past() });
    handler = () => json(503, {});
    const e2 = await caller().pushCampaign({ kitId: 1 }).then(() => null, (e) => e);
    expect(e2.code).toBe("SERVICE_UNAVAILABLE");
    expect((e2.cause as GhlConnectionCause).kind).toBe("unavailable");
    expect(calls.fetch.filter((c) => c.url.includes("customValues"))).toHaveLength(0);
  });
});

// ═══════════════════════════════════════ B. TRUTHFUL PUSH ══════════════════════════════════════════════════════════
describe("B — push session: write, read back, and report what GHL actually holds", () => {
  type Behaviour = "accept" | "reject" | "drop" | "alter";
  let store: Map<string, { id: string; name: string; value: string }>;
  let behaviour: Record<string, Behaviour>;
  let listFails: "never" | "start" | "end";
  let listCount: number;

  const ghl: Handler = async (url, init) => {
    const method = String(init.method ?? "GET");
    if (method === "GET") {
      listCount++;
      if ((listFails === "start" && listCount === 1) || (listFails === "end" && listCount >= 2)) return json(503, { message: "down" });
      return json(200, { customValues: Array.from(store.values()) });
    }
    const body = init.body ? JSON.parse(String(init.body)) : {};
    const b = behaviour[body.name] ?? "accept";
    if (b === "reject") return json(422, { message: `value too long for ${body.name}` });
    if (method === "DELETE") return json(200, {});
    if (b === "drop") return json(200, { customValue: { id: "ghost", name: body.name, value: body.value } });
    const id = url.split("/customValues/")[1] ?? `id-${store.size + 1}`;
    const value = b === "alter" ? `${body.value} (edited)` : body.value;
    store.set(body.name, { id, name: body.name, value });
    return json(200, { customValue: { id, name: body.name, value } });
  };

  beforeEach(() => {
    store = new Map([["ZAP Headlines", { id: "h1", name: "ZAP Headlines", value: "old headlines" }]]);
    behaviour = {};
    listFails = "never";
    listCount = 0;
    handler = ghl;
  });
  const open = () => GhlPushSession.open("LOC", { Authorization: "Bearer A1" });

  it("CONFIRMED: every value written and read back equal → confirmed; an existing value is updated (PUT), not duplicated", async () => {
    const s = await open();
    await s.upsert("ZAP Headlines", "new headlines");
    await s.upsert("ZAP Offer Copy", "the offer");
    const r = await s.verify();
    expect(r.confirmed).toBe(true);
    expect(r.confirmedCount).toBe(2);
    expect(calls.fetch.filter((c) => c.method === "PUT")).toHaveLength(1);
    expect(calls.fetch.filter((c) => c.method === "POST")).toHaveLength(1);
    expect(calls.fetch.filter((c) => c.method === "GET")).toHaveLength(2); // ONE list at the start, ONE at the end
  });

  it("REJECTED: GHL's status and message are carried to the coach; the push is not confirmed", async () => {
    behaviour["ZAP Ad Copy"] = "reject";
    const s = await open();
    await s.upsert("ZAP Offer Copy", "the offer");
    await s.upsert("ZAP Ad Copy", "the ad");
    const r = await s.verify();
    expect(r.confirmed).toBe(false);
    const slot = r.slots.find((x) => x.key === "adCopy")!;
    expect(slot.status).toBe("not_confirmed");
    expect(slot.values[0]).toMatchObject({ status: "rejected" });
    expect(slot.values[0].reason).toMatch(/422.*value too long/);
  });

  it("MISSING: GHL said 2xx but the value is not there on read-back → not confirmed (the case this item exists for)", async () => {
    behaviour["ZAP Landing Page"] = "drop";
    const s = await open();
    expect(await s.upsert("ZAP Landing Page", "page text")).toBe(true); // the write-level answer LOOKS fine
    const r = await s.verify();
    expect(r.confirmed).toBe(false);
    expect(r.slots.find((x) => x.key === "landingPage")!.values[0].status).toBe("missing");
  });

  it("CHANGED: present but holding a different value → not confirmed", async () => {
    behaviour["ZAP Hero Mechanism"] = "alter";
    const s = await open();
    await s.upsert("ZAP Hero Mechanism", "The Return Method");
    const r = await s.verify();
    expect(r.slots.find((x) => x.key === "mechanism")!.values[0].status).toBe("changed");
    expect(r.confirmed).toBe(false);
  });

  it("line-ending / trailing-space normalisation alone is still CONFIRMED (and nothing more is forgiven)", async () => {
    store.set("ZAP Offer Copy", { id: "o1", name: "ZAP Offer Copy", value: "line one\r\nline two  " });
    behaviour["ZAP Offer Copy"] = "drop"; // keep GHL's stored copy as the read-back value
    const s = await open();
    await s.upsert("ZAP Offer Copy", "line one\nline two");
    expect((await s.verify()).slots.find((x) => x.key === "offer")!.values[0].status).toBe("confirmed");
  });

  it("NOTHING TO SEND: slots with no values are 'nothing_to_send', never a failure — and don't block success", async () => {
    const s = await open();
    await s.upsert("ZAP Offer Copy", "the offer");
    const r = await s.verify();
    expect(r.confirmed).toBe(true);
    expect(r.slots.find((x) => x.key === "leadMagnetUrl")!.status).toBe("nothing_to_send");
    expect(r.slots.filter((x) => x.status === "nothing_to_send").length).toBe(9);
  });

  it("an empty push is NOT success", async () => {
    const r = await (await open()).verify();
    expect(r.confirmed).toBe(false);
    expect(r.expectedCount).toBe(0);
  });

  it("a slot whose values couldn't be prepared counts as not confirmed, with the reason", async () => {
    const s = await open();
    await s.upsert("ZAP Offer Copy", "the offer");
    s.slotError("landingPage", new Error("bad JSON"));
    const r = await s.verify();
    expect(r.confirmed).toBe(false);
    expect(r.slots.find((x) => x.key === "landingPage")).toMatchObject({ status: "not_confirmed" });
  });

  it("START LIST FAILS: the session refuses to open, so NOTHING is written (the blind-POST duplicate path is gone)", async () => {
    listFails = "start";
    await expect(open()).rejects.toBeInstanceOf(GhlListError);
    expect(calls.fetch.filter((c) => c.method !== "GET")).toHaveLength(0);
  });

  it("READ-BACK FAILS: nothing can be confirmed — every sent value is reported, none as confirmed", async () => {
    listFails = "end";
    const s = await open();
    await s.upsert("ZAP Offer Copy", "the offer");
    const r = await s.verify();
    expect(r.confirmed).toBe(false);
    expect(r.slots.find((x) => x.key === "offer")!.values[0]).toMatchObject({ status: "missing" });
    expect(r.slots.find((x) => x.key === "offer")!.values[0].reason).toMatch(/read back/);
  });

  it("an unmapped value name fails loudly instead of being reported as sent", async () => {
    const s = await open();
    await expect(s.upsert("ZAP Something New", "x")).rejects.toThrow(/Unmapped/);
  });
});

// ═══════════════════════════════════════ PINS — wiring the unit tests can't see ═══════════════════════════════════
describe("pins", () => {
  const ghlSrc = readFileSync(join(__dirname, "routers/ghl.ts"), "utf8");
  const modal = readFileSync(join(__dirname, "../client/src/v2/PushKitModal.tsx"), "utf8");
  it("all three readers get their token from the one helper; nothing else decrypts a GHL token", () => {
    expect(ghlSrc.match(/await getGhlAccess\(/g)?.length).toBeGreaterThanOrEqual(5);
    expect(ghlSrc).not.toMatch(/decryptToken|tokenExpiresAt\) < new Date/);
  });
  it("the unused duplicate token save (exchangeCode) is gone", () => {
    expect(ghlSrc).not.toMatch(/exchangeCode/);
  });
  it("every write goes through the verified session; the push returns the READ-BACK report", () => {
    expect(ghlSrc).not.toMatch(/upsertCustomValue\(\s*locationId/);
    expect(ghlSrc).toMatch(/session = await GhlPushSession\.open\(/);
    expect(ghlSrc).toMatch(/return session\.verify\(\);/);
  });
  it("client: GHL is ok ONLY when the report is confirmed; the banner only after a confirmed push", () => {
    expect(modal).toContain('return { platform: "ghl", ok: report.confirmed, report };');
    expect(modal).toMatch(/const showSnapshotBanner = ghlConfirmed && !!masterSnapshotId;/);
    expect(modal).toContain("Saved to GoHighLevel — ${report.confirmedCount} values confirmed");
  });
  it("'Push to both' fires only platforms that are ready", () => {
    expect(modal).toContain("if (metaPushable) jobs.push(");
    expect(modal).toContain("if (ghlPushable) jobs.push(");
  });
  it("migration 0112 exists, adds exactly the two nullable columns, and says it is not applied", () => {
    const sql = readFileSync(join(__dirname, "../drizzle/0112_ghl_reconnect_required.sql"), "utf8");
    expect(sql).toMatch(/ADD COLUMN `reconnectRequiredAt` TIMESTAMP NULL DEFAULT NULL/);
    expect(sql).toMatch(/ADD COLUMN `lastRenewalError` VARCHAR\(512\) NULL DEFAULT NULL/);
    expect(sql).toMatch(/NOT APPLIED/);
  });
});
