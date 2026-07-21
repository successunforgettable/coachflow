/**
 * Manual-wizard E2E — free, in-person event, start→finish (2026-07-22, rev 2 against the REAL runtime flow).
 *
 * The machine testing the machine. Drives a full manual campaign and asserts on REAL rendered DOM + REAL
 * persisted content (read straight from the local test DB via mysql2). Every assertion is `expect.soft` so
 * the WHOLE PASS/FAIL table prints even under heavy red.
 *
 * Real intake flow (confirmed live via MCP): business description → "That's me" → "Live event" →
 * "I'll pick as we go" → ICP job (~2 min) → skip testimonials → FACTS STEP (date picker / venue chips+place /
 * price chips) → offer → mechanism → hvco → headlines → adCopy → landingPage → email → whatsapp → [adImages].
 * Ad Images is LAST, so every assertion is reachable before it — the harness stops after whatsapp.
 *
 * TARGET: a local dev server (NODE_ENV=development; /api/test-login is dev-only) against an isolated test DB.
 *   E2E_BASE_URL   default http://localhost:3000
 *   TEST_OPENID    a real users.openId (seeded coach)
 *   E2E_DB_URL     default mysql://root@127.0.0.1:3307/zap_test  (direct reads for A4–A13)
 */
import { test, expect, type Page } from "@playwright/test";
import { FABRICATED_CITY_WORDS, BAD_VENUE_PHRASES } from "./fixtures/free-event-material";

const TEST_OPENID = process.env.TEST_OPENID ?? "";
const DB_URL = process.env.E2E_DB_URL ?? "mysql://root@127.0.0.1:3307/zap_test";
const BUSINESS = "I'm Jordan Blake, a career coach. I run a live, in-person masterclass called The Career Pivot Intensive for mid-career professionals (35-50) who feel stuck in a job that no longer fits and want to move into work that suits them without a pay cut. My method is a three-part framework: Map, Bridge, Move — a practical 90-day plan to land the pivot.";
const EVENT_DATE_ISO = "2026-11-14"; // far future → WhatsApp length should derive to 7, never the hardcoded 3
const VENUE = "The Brew House, 14 King Street"; // a real place; never a city name from thin air

// ── PASS/FAIL recorder ──
type Row = { id: string; label: string; pass: boolean; detail: string };
const results: Row[] = [];
function record(id: string, label: string, pass: boolean, detail: string) {
  if (results.find((r) => r.id === id)) return; // first verdict wins
  results.push({ id, label, pass, detail });
  expect.soft(pass, `${id} ${label} — ${detail}`).toBeTruthy();
}

// ── direct DB read (mysql2) — the isolated test DB is on the same box ──
async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const mysql = await import("mysql2/promise");
  const conn = await mysql.createConnection(DB_URL);
  try { const [rows] = await conn.query(sql, params); return rows as T[]; }
  finally { await conn.end(); }
}

// ── chat driving helpers ──
async function clickChip(page: Page, name: string | RegExp, timeout = 240_000) {
  const b = page.getByRole("button", { name, exact: false }).first();
  await b.waitFor({ state: "visible", timeout });
  await b.click();
}
async function chipVisible(page: Page, name: string | RegExp): Promise<boolean> {
  return page.getByRole("button", { name, exact: false }).first().isVisible().catch(() => false);
}

// ── Flesch–Kincaid (A13), pure ──
function syl(w: string): number {
  const s = w.toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return 0; if (s.length <= 3) return 1;
  const g = s.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, g ? g.length : 1);
}
function fkGrade(text: string): number {
  const c = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const sent = (c.match(/[.!?]+/g)?.length ?? 0) || 1;
  const words = c.split(/\s+/).filter(Boolean); const wc = words.length || 1;
  const s = words.reduce((a, w) => a + syl(w), 0);
  return Math.round((0.39 * (wc / sent) + 11.8 * (s / wc) - 15.59) * 10) / 10;
}

test.describe.serial("manual wizard — free in-person event", () => {
  let page: Page;
  let kitId = 0;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    if (!TEST_OPENID) return;
    await page.goto(`/api/test-login/${encodeURIComponent(TEST_OPENID)}`);
    await page.waitForURL(/\/v2-dashboard/, { timeout: 60_000 });
  });
  test.afterAll(async () => {
    const line = "─".repeat(80);
    const rows = results.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
      .map((r) => `${r.pass ? "PASS" : "FAIL"}  ${r.id.padEnd(4)} ${r.label}\n           ↳ ${r.detail}`);
    const passed = results.filter((r) => r.pass).length;
    // eslint-disable-next-line no-console
    console.log(`\n${line}\nMANUAL-WIZARD E2E — ${passed}/${results.length} PASS\n${line}\n${rows.join("\n")}\n${line}\n`);
    await page.close().catch(() => {});
  });

  test("guard — TEST_OPENID set", () => {
    record("A0", "TEST_OPENID provided", !!TEST_OPENID, TEST_OPENID ? "set" : "MISSING");
  });

  test("intake → facts step (A1–A3)", async () => {
    test.skip(!TEST_OPENID, "no TEST_OPENID");
    await page.goto("/v2-dashboard/trail/new");

    // business description → the free-text chat input
    const box = page.getByRole("textbox").first();
    await box.waitFor({ state: "visible", timeout: 30_000 });
    await box.fill(BUSINESS);
    await box.press("Enter");

    await clickChip(page, "That's me");        // confirm the "WHAT I HEARD" reflection
    await clickChip(page, "Live event");        // campaign type
    await clickChip(page, "I'll pick as we go"); // manual fork → ICP job (~2 min) then testimonial picker
    await clickChip(page, /Skip — I don't have testimonials|Skip/); // waits out the ICP, then skips

    // kit created + navigated
    await page.waitForURL(/\/v2-dashboard\/trail\/\d+/, { timeout: 240_000 });
    kitId = Number(page.url().match(/\/trail\/(\d+)/)?.[1] ?? 0);

    // ── FACTS STEP ──
    // A1 — DATE: a real native date-picker (Batch A). Committed HEAD shows a free-text box → red.
    const dateInput = page.locator('input[type="date"]');
    const a1 = await dateInput.first().isVisible({ timeout: 60_000 }).catch(() => false);
    record("A1", "facts DATE renders a real date-picker", a1, a1 ? "input[type=date] present" : "no date picker (free-text)");
    if (a1) { await dateInput.first().fill(EVENT_DATE_ISO); await clickChip(page, "Confirm", 30_000); }

    // A2 — VENUE: Online / In-person chips + a place field.
    const onlineChip = await chipVisible(page, /online/i);
    const inPersonChip = await chipVisible(page, /in person/i);
    record("A2", "facts VENUE renders Online/In-person chips + place field", onlineChip && inPersonChip,
      onlineChip && inPersonChip ? "chips present" : "venue is free-text, not chips");
    if (inPersonChip) {
      await clickChip(page, /in person/i, 30_000);
      const placeInput = page.locator('input[placeholder="Venue name & city"]');
      await placeInput.first().fill(VENUE);
      await clickChip(page, "Confirm", 30_000);
    }

    // A3 — PRICE: Free chip (event) present, not free text.
    const freeChip = await chipVisible(page, /free/i);
    record("A3", "facts PRICE renders Free/By-application chips", freeChip, freeChip ? "Free chip present" : "price is free-text");
    if (freeChip) await clickChip(page, /it.?s free|free/i, 30_000);
  });

  test("drive nodes to whatsapp; ad-copy deck (A8) + no loop-to-offer (A9)", async () => {
    test.skip(!TEST_OPENID || !kitId, "intake didn't reach the wizard");
    let adCopyReached = false, adCopyDeck = false, offerAfterAdCopy = false;

    // Loop: deal/accept whatever the current node offers, until whatsapp is selected (node 10 of 11).
    // Ad Images (11) is last — we stop before it; no assertion needs it.
    for (let i = 0; i < 120; i++) {
      const [kit] = await dbQuery<any>("SELECT selectedWhatsAppSequenceId w, selectedAdCopyId ac FROM campaignKits WHERE id=?", [kitId]);
      if (kit?.w) break; // whatsapp done → everything A4–A13 needs is persisted

      // ad-copy node detection (the deck must be visible + selectable)
      if (await page.getByText(/ad copy/i).first().isVisible().catch(() => false)) {
        adCopyReached = true;
        if (await chipVisible(page, /use this one/i)) adCopyDeck = true;
      }
      if (adCopyReached && kit?.ac && await page.getByText(/your offer|^offer$/i).first().isVisible().catch(() => false)) {
        offerAfterAdCopy = true;
      }

      // advance: deal a dealable node, pick a card, or accept a reveal
      let acted = false;
      for (const label of [/show me options/i, /use this one/i, /love it/i, /use this & continue/i, /looks good/i]) {
        if (await chipVisible(page, label)) { await clickChip(page, label, 30_000).catch(() => {}); acted = true; break; }
      }
      if (!acted) await page.waitForTimeout(5000); // generation window
    }

    record("A8", "ad-copy node renders a visible selectable deck", adCopyReached && adCopyDeck,
      adCopyReached ? (adCopyDeck ? "deck shown" : "0 selectable cards") : "ad-copy node not reached");
    record("A9", "ad-copy failure does not loop back to offer", adCopyReached && !offerAfterAdCopy,
      adCopyReached ? (offerAfterAdCopy ? "offer re-entered" : "no offer re-entry") : "ad-copy node not reached");
  });

  test("assert persisted assets (A4–A7, A10–A13)", async () => {
    test.skip(!TEST_OPENID || !kitId, "no kit");
    const [kit] = await dbQuery<any>("SELECT * FROM campaignKits WHERE id=?", [kitId]);
    const facts = typeof kit?.campaignFacts === "string" ? JSON.parse(kit.campaignFacts) : (kit?.campaignFacts ?? {});
    const [lp] = kit?.selectedLandingPageId ? await dbQuery<any>("SELECT * FROM landingPages WHERE id=?", [kit.selectedLandingPageId]) : [null];
    const [wa] = kit?.selectedWhatsAppSequenceId ? await dbQuery<any>("SELECT * FROM whatsappSequences WHERE id=?", [kit.selectedWhatsAppSequenceId]) : [null];
    const [offer] = kit?.selectedOfferId ? await dbQuery<any>("SELECT * FROM offers WHERE id=?", [kit.selectedOfferId]) : [null];
    const lpContent = lp ? (typeof lp.content === "string" ? lp.content : JSON.stringify(lp.content)) : "";
    const offerText = offer ? JSON.stringify(offer) : "";

    // A4 — WhatsApp length reflects the (far-future) date → 7, not the hardcoded 3.
    const waMsgs = wa ? (typeof wa.messages === "string" ? JSON.parse(wa.messages) : wa.messages) : null;
    const waLen = Array.isArray(waMsgs) ? waMsgs.length : 0;
    record("A4", "WhatsApp length reflects the date (≠ hardcoded 3)", waLen > 0 && waLen !== 3,
      waLen ? `length=${waLen} (date=${facts?.eventSchedule?.date})` : "no whatsapp sequence");

    // A5 — free event → Iman, not Hormozi. price=__FREE__ classifies "na" → Iman.
    const style = String(lp?.publishedStyle ?? "");
    const priceAmt = String(facts?.price?.amount ?? "");
    const isFree = priceAmt === "__FREE__" || priceAmt === "";
    const imanOk = lp ? (style.includes("iman") || (isFree && !style.includes("hormozi"))) : false;
    record("A5", "LP is the FREE (Iman) template, not Hormozi", imanOk,
      lp ? `publishedStyle=${style || "(unset)"} price=${priceAmt}` : "no landing page");

    // A6 — no non-place venue substitution in LP copy.
    const badVenue = BAD_VENUE_PHRASES.filter((p) => lpContent.includes(p));
    record("A6", "no 'in in person' / non-place venue substitution", lp ? badVenue.length === 0 : false,
      lp ? (badVenue.length ? `found: ${badVenue.join(", ")}` : "clean") : "no landing page");

    // A7 — no fabricated cities (coach entered only "The Brew House, 14 King Street").
    const cities = FABRICATED_CITY_WORDS.filter((c) => new RegExp(`\\b${c}\\b`).test(lpContent));
    record("A7", "no fabricated location names", lp ? cities.length === 0 : false,
      lp ? (cities.length ? `found: ${cities.join(", ")}` : "clean") : "no landing page");

    // A10 — LP not complete when publish failed (no publicUrl). Cloudflare omitted → publish fails.
    const published = !!lp?.publicUrl;
    const nodeStatuses = kit?.nodeStatuses ? (typeof kit.nodeStatuses === "string" ? JSON.parse(kit.nodeStatuses) : kit.nodeStatuses) : {};
    const lpMarkedComplete = !!kit?.selectedLandingPageId && (nodeStatuses?.landingPage === "complete" || nodeStatuses?.landingPage === "done" || !nodeStatuses?.landingPage);
    record("A10", "LP not complete when publish failed (gated on publicUrl)",
      published ? true : !lpMarkedComplete,
      published ? "published" : (lpMarkedComplete ? "marked complete with no publicUrl (bug)" : "correctly held (no publicUrl)"));

    // A11 — kit unresolved [INSERT_*] placeholder count.
    const blob = JSON.stringify(kit) + lpContent + offerText + (wa ? JSON.stringify(wa) : "");
    const ph = Array.from(new Set(blob.match(/\[INSERT_[A-Z_0-9]+\]/g) ?? []));
    record("A11", "kit unresolved [INSERT_*] count = 0", ph.length === 0, ph.length ? `${ph.length}: ${ph.join(", ")}` : "none");

    // A12 — offer copy has no fabricated price/date the coach never entered.
    const figs = [...(offerText.match(/[£$]\s?\d[\d,]*/g) ?? [])];
    record("A12", "offer copy has no fabricated price/date", offer ? figs.length === 0 : false,
      offer ? (figs.length ? `figures: ${figs.join(", ")}` : "clean") : "no offer");

    // A13 — readability (reported; bar TBD).
    const headline = lp ? (() => { try { const c = JSON.parse(lpContent); return `${c.headline ?? ""} ${c.subheadline ?? ""}`; } catch { return lpContent.slice(0, 2000); } })() : "";
    const grade = fkGrade(headline || "");
    record("A13", "readability (Flesch–Kincaid) within bar", Number.isFinite(grade) && grade > 0 ? grade <= 12 : false,
      `FK grade = ${grade} (provisional bar 12)`);
  });
});
