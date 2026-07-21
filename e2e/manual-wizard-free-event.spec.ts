/**
 * Manual-wizard E2E — free, in-person event, start→finish (2026-07-22).
 *
 * The machine testing the machine. Drives a full manual campaign and asserts on REAL rendered DOM + REAL
 * served page bytes. Every assertion is a `expect.soft` so the WHOLE PASS/FAIL table prints even when early
 * ones are red (heavy red is expected on current state — it proves the harness detects the real bugs).
 *
 * The 13 assertions (see the settled fix batch):
 *   A1  facts DATE step renders a real date-picker (not a text input)
 *   A2  facts VENUE step renders Online / In-person chips + a place-name field (not free text)
 *   A3  facts PRICE step renders Free / By-application chips (not free text)
 *   A4  entered date flows through → WhatsApp sequence length reflects it (not hardcoded 3)
 *   A5  published LP renders the FREE-event template (Iman), not Hormozi (paid)
 *   A6  no "in in person" / "at in person" (no non-place venue substitution) in served LP copy
 *   A7  no fabricated location names (London/Manchester/…) unless the coach entered them
 *   A8  ad-copy node renders a visible selectable deck (catches "0 cards / didn't come through")
 *   A9  an ad-copy failure does NOT loop back to the offer node
 *   A10 LP node does NOT reach 11-of-11 / complete when publish fails (gated on publicUrl)
 *   A11 kit [INSERT_*] placeholder count is reported (asserted low once Way 2 lands)
 *   A12 offer copy contains no fabricated price/date (no invented £-figures / dates the coach didn't enter)
 *   A13 (readability) Flesch–Kincaid grade of headline+hero copy is REPORTED (bar TBD by Arfeen)
 *
 * TARGET: a LOCAL server (scripted login is dev-only). Auth via GET /api/test-login/:openId. See e2e/README.md.
 */
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import {
  FREE_EVENT_MATERIAL, COACH_NAME, FABRICATED_CITY_WORDS, BAD_VENUE_PHRASES,
} from "./fixtures/free-event-material";

const TEST_OPENID = process.env.TEST_OPENID ?? "";

// ── the PASS/FAIL recorder — every assertion lands here so the full table prints at the end ──
type Row = { id: string; label: string; pass: boolean; detail: string };
const results: Row[] = [];
function record(id: string, label: string, pass: boolean, detail: string) {
  results.push({ id, label, pass, detail });
  // A soft assertion so the run goes RED overall if any assertion fails, without aborting the flow.
  expect.soft(pass, `${id} ${label} — ${detail}`).toBeTruthy();
}
function reached(id: string, label: string, ok: boolean, okDetail: string, failDetail = "phase never reached") {
  record(id, label, ok, ok ? okDetail : failDetail);
}

// ── resilient chat-wizard driving helpers ──
async function clickChip(page: Page, text: string, timeout = 90_000) {
  const chip = page.getByRole("button", { name: text, exact: false }).first();
  await chip.waitFor({ state: "visible", timeout });
  await chip.click();
}
async function waitForText(page: Page, text: string | RegExp, timeout = 120_000) {
  await page.getByText(text).first().waitFor({ state: "visible", timeout });
}
async function typeAndSend(page: Page, value: string) {
  const box = page.locator('input[placeholder], textarea[placeholder]').last();
  await box.fill(value);
  await page.keyboard.press("Enter");
}

// ── Flesch–Kincaid grade (A13) — pure, dependency-free ──
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}
function fleschKincaidGrade(text: string): number {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = (clean.match(/[.!?]+/g)?.length ?? 0) || 1;
  const words = clean.split(/\s+/).filter(Boolean);
  const wc = words.length || 1;
  const syl = words.reduce((s, w) => s + countSyllables(w), 0);
  return Math.round((0.39 * (wc / sentences) + 11.8 * (syl / wc) - 15.59) * 10) / 10;
}

// ── authenticated reads (the harness carries the session cookie via page.request) ──
async function trpcQuery(req: APIRequestContext, path: string, input: unknown): Promise<any> {
  // tRPC v11 single (non-batch) GET: /api/trpc/<path>?input=<url-encoded {"json":<input>}>
  const url = `/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const res = await req.get(url);
  if (!res.ok()) throw new Error(`trpc ${path} → ${res.status()}`);
  const body = await res.json();
  return body?.result?.data?.json ?? body?.result?.data ?? body;
}

test.describe.serial("manual wizard — free in-person event", () => {
  let page: Page;
  let kitId = 0;
  let servedLpHtml = "";
  let publicUrl = "";

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    if (!TEST_OPENID) return; // the guard test reports the miss; skip auth so the table still prints
    await page.goto(`/api/test-login/${encodeURIComponent(TEST_OPENID)}`);
    await page.waitForURL(/\/v2-dashboard/, { timeout: 60_000 });
  });

  test("guard — TEST_OPENID must be set", () => {
    record("PRE", "TEST_OPENID provided", !!TEST_OPENID, TEST_OPENID ? "set" : "MISSING — pass a real users.openId");
  });

  // ── Intake → manual kit, then the facts step (A1–A3 fire here, before any generation) ──
  test("drive intake → manual campaign, assert facts-step controls (A1–A3)", async () => {
    test.skip(!TEST_OPENID, "no TEST_OPENID");
    try {
      await page.goto("/v2-dashboard/trail/new");
      // Fork: manual path. The intake offers the three forks; take "I'll pick as we go".
      await clickChip(page, "I'll pick as we go").catch(async () => {
        // some builds gate the manual chip behind an initial prompt — nudge then retry
        await typeAndSend(page, "manual").catch(() => {});
        await clickChip(page, "I'll pick as we go");
      });
      // Paste the material for extraction.
      await clickChip(page, "I'll paste instead").catch(() => {});
      await typeAndSend(page, FREE_EVENT_MATERIAL);
      // Confirm the extracted cards (label varies: "Looks right" / "That's right" / "That's them").
      for (const ok of ["Looks right", "That's right", "That's them", "That's it"]) {
        if (await page.getByRole("button", { name: ok, exact: false }).first().isVisible().catch(() => false)) {
          await clickChip(page, ok); break;
        }
      }
      // Land in the wizard (kit created). Capture kitId from the URL.
      await page.waitForURL(/\/v2-dashboard\/trail\/\d+/, { timeout: 120_000 });
      kitId = Number(page.url().match(/\/trail\/(\d+)/)?.[1] ?? 0);

      // The upfront facts step runs before the offer node. Wait for the first fact question.
      await waitForText(page, /quick detail|before i build|what date|is it in person|price/i, 180_000);

      // A1 — DATE picker. Batch A renders <input type="date">; current deployed renders a free-text box.
      const dateStep = page.getByText(/what date|when.?s your event/i).first();
      if (await dateStep.isVisible().catch(() => false)) {
        const datePicker = page.locator('input[type="date"]');
        const isPicker = await datePicker.first().isVisible().catch(() => false);
        reached("A1", "facts DATE renders a real date-picker", isPicker,
          "input[type=date] present", "date step shows a free-text input, not a picker");
        // answer it (picker → ISO; fallback → type a canonical date)
        if (isPicker) { await datePicker.first().fill("2026-11-14"); await clickChip(page, "Confirm"); }
        else { await typeAndSend(page, "2026-11-14"); }
      } else {
        reached("A1", "facts DATE renders a real date-picker", false, "", "date fact step not shown");
      }

      // A2 — VENUE chips + place field (Online / In person → place-name).
      if (await page.getByText(/in person|online|where/i).first().isVisible().catch(() => false)) {
        const onlineChip = await page.getByRole("button", { name: /online/i }).first().isVisible().catch(() => false);
        const inPersonChip = await page.getByRole("button", { name: /in person/i }).first().isVisible().catch(() => false);
        reached("A2", "facts VENUE renders Online/In-person chips + place field", onlineChip && inPersonChip,
          "Online + In-person chips present", "venue step shows free text, not structured chips");
        if (inPersonChip) {
          await clickChip(page, "In person");
          await typeAndSend(page, "The Brew House, 14 King Street"); // a real place, never a city name from thin air
        } else { await typeAndSend(page, "The Brew House, 14 King Street"); }
      } else {
        reached("A2", "facts VENUE renders Online/In-person chips + place field", false, "", "venue fact step not shown");
      }

      // A3 — PRICE chips (Free / By-application / number).
      if (await page.getByText(/price|free|cost/i).first().isVisible().catch(() => false)) {
        const freeChip = await page.getByRole("button", { name: /free/i }).first().isVisible().catch(() => false);
        reached("A3", "facts PRICE renders Free/By-application chips", freeChip,
          "Free chip present", "price step shows free text, not chips");
        if (freeChip) await clickChip(page, "Free"); else await typeAndSend(page, "free");
      } else {
        reached("A3", "facts PRICE renders Free/By-application chips", false, "", "price fact step not shown");
      }
    } catch (e: any) {
      // Whatever wasn't recorded above is unreached — mark the remaining facts assertions failed.
      for (const [id, label] of [["A1", "facts DATE renders a real date-picker"], ["A2", "facts VENUE renders Online/In-person chips + place field"], ["A3", "facts PRICE renders Free/By-application chips"]] as const) {
        if (!results.find((r) => r.id === id)) reached(id, label, false, "", `flow error before this step: ${e?.message ?? e}`);
      }
    }
  });

  // ── Drive the 11 nodes to completion, watching the ad-copy node (A8/A9) ──
  test("drive nodes; ad-copy deck visible (A8) + no loop-to-offer (A9)", async () => {
    test.skip(!TEST_OPENID || !kitId, "intake did not reach the wizard");
    let sawOfferAfterAdCopy = false;
    let adCopyDeckVisible = false;
    let adCopyReached = false;
    try {
      // Walk the wizard: for each node, click "Show me options" when offered, then accept ("Love it" / "Use this one").
      for (let i = 0; i < 40; i++) {
        // ad-copy node detection
        if (await page.getByText(/ad copy/i).first().isVisible().catch(() => false)) {
          adCopyReached = true;
          const deck = page.locator('[style*="overflow"]').getByRole("button", { name: /use this one/i });
          adCopyDeckVisible = adCopyDeckVisible || await deck.first().isVisible().catch(() => false);
        }
        // if we ever see the OFFER node header again after ad-copy, that's the loop-back bug
        if (adCopyReached && await page.getByText(/^offer$|your offer/i).first().isVisible().catch(() => false)) {
          sawOfferAfterAdCopy = true;
        }
        // advance: prefer "Show me options", then any accept chip
        const advanced = await (async () => {
          for (const label of ["Show me options", "Use this one", "Love it", "Use This & Continue"]) {
            const b = page.getByRole("button", { name: label, exact: false }).first();
            if (await b.isVisible().catch(() => false)) { await b.click(); return true; }
          }
          return false;
        })();
        // completion?
        if (await page.getByText(/11 of 11|campaign kit|your kit is ready/i).first().isVisible().catch(() => false)) break;
        if (!advanced) await page.waitForTimeout(4000); // generation window
      }
      reached("A8", "ad-copy node renders a visible selectable deck", adCopyReached ? adCopyDeckVisible : false,
        "deck cards visible", adCopyReached ? "ad-copy node showed 0 selectable cards" : "ad-copy node never reached");
      reached("A9", "ad-copy failure does not loop back to the offer node", adCopyReached ? !sawOfferAfterAdCopy : false,
        "no offer re-entry after ad-copy", adCopyReached ? "offer node re-appeared after ad-copy" : "ad-copy node never reached");
    } catch (e: any) {
      if (!results.find((r) => r.id === "A8")) reached("A8", "ad-copy node renders a visible selectable deck", false, "", `flow error: ${e?.message ?? e}`);
      if (!results.find((r) => r.id === "A9")) reached("A9", "ad-copy failure does not loop back to the offer node", false, "", `flow error: ${e?.message ?? e}`);
    }
  });

  // ── Served-output + DB reads: A4, A5, A6, A7, A10, A11, A12, A13 ──
  test("assert served LP + kit facts (A4–A7, A10–A13)", async () => {
    test.skip(!TEST_OPENID || !kitId, "no kit to inspect");
    const req = page.request;

    // Kit + its landing page (authenticated tRPC reads; paths may need alignment against the live server).
    let kit: any = null, lp: any = null, whatsapp: any = null, offer: any = null;
    try { kit = await trpcQuery(req, "campaignKits.getById", { id: kitId }); } catch { /* recorded via nulls below */ }
    try { lp = await trpcQuery(req, "landingPages.getByKit", { kitId }); } catch {}
    try { whatsapp = await trpcQuery(req, "whatsappSequences.getByKit", { kitId }); } catch {}
    try { offer = await trpcQuery(req, "offers.getByKit", { kitId }); } catch {}

    publicUrl = lp?.publicUrl ?? kit?.landingPagePublicUrl ?? "";
    if (publicUrl) {
      const res = await req.get(publicUrl);
      if (res.ok()) servedLpHtml = await res.text();
    }

    // A10 — LP completion gated on publicUrl. If publish failed (no publicUrl) the node must NOT be complete.
    const lpComplete = !!(lp?.status === "complete" || kit?.selectedLandingPageId);
    reached("A10", "LP node not complete when publish failed (gated on publicUrl)",
      publicUrl ? true : !lpComplete,
      publicUrl ? "page published (publicUrl set)" : "no publicUrl AND node not marked complete",
      "node marked complete with no publicUrl (publish failure swallowed)");

    // A5 — free-event template = Iman, not Hormozi. Read served style markers / persisted publishedStyle.
    const style = (lp?.publishedStyle ?? "").toString();
    const bytesSayIman = /montserrat|Iman|#E2DC2A|electric.?green/i.test(servedLpHtml);
    const bytesSayHormozi = /event_hormozi|#8F5BF6|Poppins/i.test(servedLpHtml);
    const isIman = style.includes("iman") || (bytesSayIman && !bytesSayHormozi);
    reached("A5", "published LP is the FREE (Iman) template, not Hormozi",
      publicUrl ? isIman : false,
      `publishedStyle=${style || "?"}`, publicUrl ? `served Hormozi/paid (style=${style})` : "LP never published");

    // A6 — no non-place venue substitution in served copy.
    const badVenue = BAD_VENUE_PHRASES.filter((p) => servedLpHtml.includes(p));
    reached("A6", "no 'in in person' / non-place venue substitution in served LP",
      servedLpHtml ? badVenue.length === 0 : false,
      "no bad venue phrases", servedLpHtml ? `found: ${badVenue.join(", ")}` : "no served LP to scan");

    // A7 — no fabricated city names (the coach entered only "The Brew House, 14 King Street").
    const fabricated = FABRICATED_CITY_WORDS.filter((c) => new RegExp(`\\b${c}\\b`).test(servedLpHtml));
    reached("A7", "no fabricated location names in served LP",
      servedLpHtml ? fabricated.length === 0 : false,
      "no invented cities", servedLpHtml ? `found: ${fabricated.join(", ")}` : "no served LP to scan");

    // A4 — WhatsApp length reflects the entered date (Nov 2026 is far → 7, never the hardcoded 3).
    const waLen = Array.isArray(whatsapp?.messages) ? whatsapp.messages.length : whatsapp?.sequenceLength ?? 0;
    reached("A4", "WhatsApp sequence length reflects the entered date (not hardcoded 3)",
      waLen > 0 ? waLen !== 3 : false,
      `length=${waLen}`, waLen ? "length is 3 (date not flowing through)" : "no whatsapp sequence read");

    // A11 — kit [INSERT_*] placeholder count (reported; asserted low once Way 2 lands).
    const kitBlob = JSON.stringify(kit ?? {}) + JSON.stringify(lp ?? {}) + JSON.stringify(offer ?? {});
    const placeholders = kitBlob.match(/\[INSERT_[A-Z_0-9]+\]/g) ?? [];
    const uniquePh = Array.from(new Set(placeholders));
    // Reported always; the PASS bar (0 unresolved in published assets) is enforced after Way 2.
    reached("A11", "kit unresolved [INSERT_*] placeholder count is low",
      kit ? uniquePh.length === 0 : false,
      `${uniquePh.length} unique: ${uniquePh.join(", ") || "none"}`,
      kit ? `${uniquePh.length} unresolved placeholders: ${uniquePh.join(", ")}` : "kit not read");

    // A12 — offer copy contains no fabricated price/date the coach never entered.
    const offerText = JSON.stringify(offer ?? {});
    const invented = [
      ...(offerText.match(/£\s?\d[\d,]*/g) ?? []),
      ...(offerText.match(/\$\s?\d[\d,]*/g) ?? []),
    ];
    reached("A12", "offer copy has no fabricated price/date",
      offer ? invented.length === 0 : false,
      invented.length ? `figures: ${invented.join(", ")}` : "no invented figures",
      offer ? `fabricated figures: ${invented.join(", ")}` : "offer not read");

    // A13 — readability metric (reported; bar TBD).
    const headline = (lp?.content?.headline ?? "") + " " + (lp?.content?.subheadline ?? "") + " " + (offer?.headline ?? "");
    const grade = fleschKincaidGrade(headline || servedLpHtml.replace(/<[^>]+>/g, " ").slice(0, 4000));
    reached("A13", "readability (Flesch–Kincaid grade) within bar",
      Number.isFinite(grade) ? grade <= 12 : false, // provisional bar; Arfeen sets the real one
      `FK grade = ${grade}`, `FK grade = ${grade} (provisional bar 12)`);
  });

  test.afterAll(async () => {
    // Print the full PASS/FAIL table regardless of individual outcomes.
    const line = "─".repeat(78);
    const rows = results.map((r) => `${r.pass ? "PASS" : "FAIL"}  ${r.id.padEnd(4)} ${r.label}\n         ↳ ${r.detail}`);
    const passed = results.filter((r) => r.pass).length;
    // eslint-disable-next-line no-console
    console.log(`\n${line}\nMANUAL-WIZARD E2E — PASS/FAIL (${passed}/${results.length})\n${line}\n${rows.join("\n")}\n${line}\n`);
    await page.close().catch(() => {});
  });
});
