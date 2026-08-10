/**
 * step4c-multiad-publish.ts — N assembled ads into ONE campaign and ONE ad set, on the REAL
 * ad account. The structural capability this product has never proven.
 *
 * ⚠️⚠️ THIS IS THE ONLY SCRIPT IN THE REPO THAT WRITES TO A LIVE AD ACCOUNT. ⚠️⚠️
 *
 * `act_1254349025145319` ("KS 1") is ACTIVE, bills in **AED**, and carries roughly
 * **AED 1,168,324** of lifetime spend across ~200 real campaigns. It is Arfeen's own
 * advertising account, not a sandbox. It runs as **userId 1** because the Meta token is bound
 * to user 1 — the 117174 smoke account cannot publish.
 *
 * ── IT DOES NOTHING WITHOUT AN EXPLICIT FLAG ────────────────────────────────────────────────
 *
 *   npx tsx server/scripts/step4c-multiad-publish.ts              → prints the plan, EXITS. No calls.
 *   npx tsx server/scripts/step4c-multiad-publish.ts --publish    → needs Arfeen's word on the day
 *   npx tsx server/scripts/step4c-multiad-publish.ts --teardown   → needs a SECOND, separate word
 *
 * The two phases are deliberately separate invocations. Approval to create is not approval to
 * delete, and an interrupted session must not leave the operator guessing which half ran.
 *
 * ── THE SAFEGUARDS, AND WHERE EACH ONE LIVES ────────────────────────────────────────────────
 *
 *   · live `GET /me` FIRST — a stale token stops everything before a single object is made
 *   · `campaignLabelFor` — "ZZ-4C-MULTIAD-<stamp>", and it REFUSES "Auto Campaign Kit"
 *   · `createPublishLedger` — every id hits disk the instant Meta returns it
 *   · `publishAssembledAds` — screens EVERY ad before the campaign exists; a fully blocked push
 *     creates nothing, and a failure part-way keeps what landed
 *   · `assertDailyBudgetFloor` — AED 20 pinned, refuses below 4 (our z.min(1) assumes USD)
 *   · PAUSED applied at campaign, ad set AND ad
 *   · `readBackPublishedSet` — proves from META's stored state that the ads share one ad set
 *   · `teardownRecordedCampaign` — deletes ONLY the recorded id, refuses the five protected
 *     campaigns, confirms by id, and proves the three orphans are untouched
 *
 * All of the above are unit-proven with fakes in metaSafety.test.ts, publishLedger.test.ts and
 * metaTeardown.test.ts. This file is the wiring; the guards are not implemented inline here.
 */
import "dotenv/config";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  adCreatives, adCopy, services, idealCustomerProfiles, campaignConcepts, headlines,
  landingPages, metaPublishedAds,
} from "../../drizzle/schema";
import { runAdCopyGeneration } from "../adCopyGenerator";
import { runAdCreativesGeneration } from "../adCreativesGenerator";
import { runLandingPageGeneration } from "../landingPageGenerator";
import { runLandingPagePublish } from "../landingPagePublisher";
import { ensureConceptsForIcp, conceptJobId } from "../conceptGenerator";
import { sweepAdCreativeBatch } from "../lib/adCreativeTeardown";
import { assembleConceptAds, describeAssembly } from "../_core/adAssembly";
import { publishAssembledAds } from "../_core/multiAdPublish";
import { createPublishLedger, readLedgerLines } from "../_core/publishLedger";
import { readBackPublishedSet, teardownRecordedCampaign } from "../_core/metaTeardown";
import {
  PINNED_DAILY_BUDGET_AED, assertDailyBudgetFloor, assertSafeCampaignName, campaignLabelFor,
} from "../_core/metaSafety";

const USER_ID = 1; // the Meta token is bound to user 1; the smoke account cannot publish
const MAX_ADS = 3; // two would prove shared membership; three shows it is not a special case
const MIN_ADS = 2; // below this the structural claim is unprovable — stop

const STATE = "/tmp/step4c-state.json";
const LEDGER = "/tmp/step4c-ledger.jsonl";
const LOG = `/tmp/step4c-multiad-${process.pid}.log`;

const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};
const rule = (c = "─") => say(c.repeat(78));

const BRIEF = {
  targetMarket: "operations consultants who bill by the hour and want to move to retainers",
  pressingProblem: "proposals sit unsent for days while the scope keeps moving, and the client goes quiet",
  desiredOutcome: "a booked retainer conversation within two weeks of first contact",
  uniqueMechanism: "the Scope-First Sequence",
};
const LABEL = "ZZ-4C-MULTIAD — throwaway, safe to delete";

type RunState = {
  campaignName: string;
  serviceId: number; icpId: number; adSetId: string; batchId: string;
  landingPageId: number; landingPageSlug: string; publicUrl: string;
  publishedRowIds: number[];
  ads: Array<{ adId: string; creativeId: string; headline: string; body: string; conceptId: number | null }>;
  metaCampaignId: string | null; metaAdSetId: string | null;
};

/**
 * THE FIRST THING THE RUN DOES. Our `tokenExpiresAt` proves only what we BELIEVE; a rotated app
 * secret or a disconnected account leaves the row looking perfect and fails on the first write.
 * A stale token here means stop — never "try and see".
 */
async function assertTokenLive(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { metaAccessTokens } = await import("../../drizzle/schema");
  const { decryptToken } = await import("../_core/tokenCrypto");
  const [row] = await db.select().from(metaAccessTokens).where(eq(metaAccessTokens.userId, USER_ID)).limit(1);
  if (!row) throw new Error("STOP — no meta_access_tokens row for user 1. Nothing was attempted.");
  if (new Date() >= new Date((row as any).tokenExpiresAt)) {
    throw new Error(`STOP — the stored Meta token expired at ${(row as any).tokenExpiresAt}. Reconnect first.`);
  }
  const token = decryptToken((row as any).accessToken);
  const url = new URL("https://graph.facebook.com/v21.0/me");
  url.searchParams.set("access_token", token);
  url.searchParams.set("fields", "id,name");
  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `STOP — Meta rejected the token on GET /me (HTTP ${res.status}): ${text.slice(0, 300)}. ` +
      `Nothing was created. Reconnect Meta before retrying.`,
    );
  }
  const me = JSON.parse(text);
  say(`✅ token LIVE — Meta answered as ${me.name} (${me.id})`);
}

async function baselines(db: any) {
  const one = async (t: any) => Number((await db.select({ n: sql<number>`COUNT(*)` }).from(t))[0].n);
  return {
    adCopy: await one(adCopy), headlines: await one(headlines), adCreatives: await one(adCreatives),
    concepts: await one(campaignConcepts), published: await one(metaPublishedAds),
  };
}

async function protectedTotal(db: any): Promise<string> {
  const rows: any = await db.execute(sql`
    SELECT serviceId, COUNT(*) n FROM adCreatives WHERE serviceId IN (272,273,274,275,276,277,285) GROUP BY serviceId
  `);
  const pr = (Array.isArray(rows) ? rows[0] : (rows as any)?.rows ?? rows) as any[];
  const total = (pr ?? []).reduce((a: number, r: any) => a + Number(r.n), 0);
  return `${total} — ${(pr ?? []).map((r: any) => `${r.serviceId}:${r.n}`).join(" ")}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLISH
// ══════════════════════════════════════════════════════════════════════════════
async function publish() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  rule("═");
  say("STEP 4c — PUBLISH. N ads → ONE campaign, ONE ad set. LIVE AD ACCOUNT.");
  rule("═");

  // 1 — the token, before anything else exists.
  await assertTokenLive();

  const before = await baselines(db);
  say(`baseline: adCopy ${before.adCopy} · headlines ${before.headlines} · adCreatives ${before.adCreatives} · ` +
      `concepts ${before.concepts} · published ${before.published}`);
  say(`protected: ${await protectedTotal(db)}\n`);

  // 2 — the throwaway cascade, under user 1 because that is who Meta knows.
  const [ins] = await db.insert(services).values({
    userId: USER_ID, name: LABEL, category: "consulting",
    description: "Throwaway created by step4c-multiad-publish.ts. Safe to delete.",
    targetCustomer: BRIEF.targetMarket, mainBenefit: BRIEF.desiredOutcome, painPoints: BRIEF.pressingProblem,
  } as any);
  const serviceId = Number((ins as any).insertId);
  const [icpIns] = await db.insert(idealCustomerProfiles).values({
    userId: USER_ID, serviceId, name: LABEL,
    angleName: "operations consultants moving to retainers",
    introduction: "Independent operations consultants, 5-15 years in, billing hourly.",
    pains: BRIEF.pressingProblem,
    fears: "that raising the model loses the client entirely, and the pipeline goes quiet for a quarter",
    goals: BRIEF.desiredOutcome, frustrations: "scope creeps between the call and the proposal",
    objections: "my clients would never agree to a retainer",
    buyingTriggers: "a month where billable hours dropped but workload did not",
    source: "generated" as const,
  } as any);
  const icpId = Number((icpIns as any).insertId);
  say(`throwaway service ${serviceId} · ICP ${icpId}`);

  say("\ngenerating concepts (polling up to 12 minutes)…");
  await ensureConceptsForIcp({ userId: USER_ID, icpId, serviceId });
  let concepts: any[] = [];
  const tC = Date.now();
  while (Date.now() - tC < 12 * 60 * 1000) {
    concepts = await db.select({ id: campaignConcepts.id }).from(campaignConcepts)
      .where(eq(campaignConcepts.icpId, icpId));
    if (concepts.length > 0) break;
    await new Promise((r) => setTimeout(r, 15_000));
  }
  if (!concepts.length) throw new Error("STOP — no concepts; assembly would have nothing to key on");
  say(`concepts: ${concepts.length}`);

  say("\nrunning Node 7 (ad copy)…");
  const copyRes: any = await runAdCopyGeneration({
    userId: USER_ID, serviceId, adType: "lead_gen", adStyle: "direct", adCallToAction: "Book a Call",
    targetMarket: BRIEF.targetMarket, productCategory: "consulting engagement design",
    specificProductName: "The Scope-First Sequence", pressingProblem: BRIEF.pressingProblem,
    desiredOutcome: BRIEF.desiredOutcome, uniqueMechanism: BRIEF.uniqueMechanism,
  } as any);
  say(`adSet ${copyRes.adSetId}: headlines ${copyRes.headlineCount} · bodies ${copyRes.bodyCount} · hooks ${copyRes.imageHookCount}`);

  say("\nrendering the creative cascade…");
  await runAdCreativesGeneration({
    userId: USER_ID, serviceId, niche: "operations consulting",
    productName: "The Scope-First Sequence", uniqueMechanism: BRIEF.uniqueMechanism,
    targetAudience: BRIEF.targetMarket, mainBenefit: BRIEF.desiredOutcome,
    pressingProblem: BRIEF.pressingProblem, adType: "lead_gen",
  } as any);
  const [firstCreative] = await db.select({ batchId: adCreatives.batchId }).from(adCreatives)
    .where(and(eq(adCreatives.userId, USER_ID), eq(adCreatives.serviceId, serviceId)))
    .orderBy(adCreatives.id);
  const batchId = String((firstCreative as any)?.batchId ?? "");
  if (!batchId) throw new Error("STOP — no creatives were produced");

  // 3 — its OWN landing page, so the ad-to-page compliance gate is evaluated against a page
  // the copy actually agrees with. Pointing throwaway copy at an unrelated live page invites a
  // block that would tell us nothing about the capability under test.
  say("\ngenerating and publishing the throwaway landing page…");
  const { landingPageId } = await runLandingPageGeneration({ userId: USER_ID, serviceId });
  const { publicUrl, slug } = await runLandingPagePublish({
    userId: USER_ID, landingPageId, styleMode: "sales_kutcher" as any,
  });
  say(`landing page ${landingPageId} → ${publicUrl}`);

  // 4 — assemble.
  const { ads, ledger: asmLedger } = await assembleConceptAds(db, USER_ID, serviceId, { batchId });
  say("\n" + describeAssembly(asmLedger));
  if (ads.length < MIN_ADS) {
    throw new Error(
      `STOP — assembly produced ${ads.length} ad(s); at least ${MIN_ADS} are needed to prove they ` +
      `share one ad set. Nothing was published.`,
    );
  }
  const chosen = ads.slice(0, MAX_ADS);
  say(`publishing ${chosen.length} of ${ads.length} assembled ads`);

  // 5 — the guards, applied before a single Graph call.
  assertDailyBudgetFloor(PINNED_DAILY_BUDGET_AED);
  const campaignName = campaignLabelFor(new Date().toISOString());
  assertSafeCampaignName(campaignName);
  say(`campaign name: ${campaignName} · daily budget AED ${PINNED_DAILY_BUDGET_AED} (${PINNED_DAILY_BUDGET_AED * 100} minor units) · status PAUSED`);

  // 6 — the ledger: every id on disk the instant Meta returns it.
  writeFileSync(LEDGER, "");
  const ledger = createPublishLedger({ path: LEDGER, write: (l) => appendFileSync(LEDGER, l) });
  const meta = await import("../lib/metaAPI");
  const recordingDeps = {
    createCampaign: async (u: number, p: any) => {
      const r = await meta.createCampaign(u, p);
      if (r?.id) ledger.record("campaign", r.id, campaignName);
      return r;
    },
    createAdSet: async (u: number, p: any) => {
      const r = await meta.createAdSet(u, p);
      if (r?.id) ledger.record("adset", r.id);
      return r;
    },
    createAdCreative: async (u: number, p: any) => {
      const r = await meta.createAdCreative(u, p);
      if (r?.id) ledger.record("creative", r.id);
      return r;
    },
    createAd: async (u: number, p: any) => {
      const r = await meta.createAd(u, p);
      if (r?.id) ledger.record("ad", r.id);
      return r;
    },
  };

  // 7 — the per-ad compliance screen, identical in shape to publishToMeta's gate.
  const { checkOutput, checkAdToPageMatch } = await import("../_core/complianceAxis");
  const { buildCoachCorpus, buildProofSupplied } = await import("../_core/groundingCorpus");
  const [svc] = await db.select().from(services)
    .where(and(eq(services.id, serviceId), eq(services.userId, USER_ID))).limit(1);
  const [gateIcp] = await db.select().from(idealCustomerProfiles)
    .where(eq(idealCustomerProfiles.id, icpId)).limit(1);
  const [lpRow] = await db.select().from(landingPages).where(eq(landingPages.id, landingPageId)).limit(1);
  const lpContent: any = (lpRow as any)?.content;
  const pageText = lpContent && typeof lpContent === "object"
    ? ["eyebrowHeadline", "mainHeadline", "subheadline", "problemAgitation", "solutionIntro", "uniqueMechanism"]
        .map((k) => lpContent[k]).filter((v) => typeof v === "string").join(" ")
    : "";

  say("\npublishing…");
  const result = await publishAssembledAds(recordingDeps, {
    userId: USER_ID,
    campaignName,
    objective: "OUTCOME_LEADS",
    linkUrl: publicUrl,
    status: "PAUSED",
    dailyBudget: PINNED_DAILY_BUDGET_AED,
    callToAction: "LEARN_MORE",
    targeting: { geoLocations: { countries: ["AE"] } },
    ads: chosen.map((a) => ({
      conceptId: a.conceptId, headline: a.headline.text, body: a.body.text,
      headlineAdCopyId: a.headline.id, bodyAdCopyId: a.body.id,
      imageUrl: a.creative.imageUrl, verticalImageUrl: a.creative.verticalImageUrl,
    })),
    screen: async (a) => {
      const gate = checkOutput(
        [
          { location: "headline", text: a.headline, role: "short" as const },
          { location: "body", text: a.body, role: "body" as const },
        ],
        svc ? { corpus: buildCoachCorpus({ service: svc, groundingMeta: (gateIcp as any)?.groundingMeta }), supplied: buildProofSupplied(svc) } : undefined,
        { requireGrounding: true },
      );
      const blocking = [...(gate?.blocking ?? [])];
      if (pageText) {
        const m = checkAdToPageMatch(`${a.headline} ${a.body}`, pageText);
        if (!m.ok) blocking.push(...(m.blocking as any));
      }
      return { blocked: blocking.length > 0, classes: Array.from(new Set(blocking.map((h: any) => String(h.classId)))) };
    },
  });

  say(`\ncampaign ${result.campaignId ?? "none"} · ad set ${result.adSetId ?? "none"}`);
  say(`published ${result.published.length} · blocked ${result.blocked.length} · failed ${result.failed.length}`);
  for (const b of result.blocked) say(`   blocked concept ${b.conceptId}: ${b.classes.join(", ")}`);
  for (const f of result.failed) say(`   🔴 failed concept ${f.conceptId} at ${f.stage}: ${f.message}`);
  if (result.refusedReason) say(`   REFUSED: ${result.refusedReason}`);

  const state: RunState = {
    campaignName, serviceId, icpId, adSetId: copyRes.adSetId, batchId,
    landingPageId, landingPageSlug: slug, publicUrl, publishedRowIds: [],
    metaCampaignId: result.campaignId, metaAdSetId: result.adSetId,
    ads: result.published.map((p) => {
      const src = chosen[p.index];
      return { adId: p.metaAdId, creativeId: p.metaCreativeId, headline: src.headline.text, body: src.body.text, conceptId: p.conceptId };
    }),
  };

  // Provenance rows, ids kept so teardown removes exactly these.
  for (const p of result.published) {
    const [row] = await db.insert(metaPublishedAds).values({
      userId: USER_ID, adSetId: copyRes.adSetId,
      metaCampaignId: result.campaignId!, metaAdSetId: result.adSetId!,
      metaAdId: p.metaAdId, metaCreativeId: p.metaCreativeId,
      campaignName, status: "PAUSED", objective: "OUTCOME_LEADS",
      dailyBudget: String(PINNED_DAILY_BUDGET_AED),
      headlineAdCopyId: p.headlineAdCopyId ?? undefined, bodyAdCopyId: p.bodyAdCopyId ?? undefined,
    } as any);
    state.publishedRowIds.push(Number((row as any).insertId));
  }
  writeFileSync(STATE, JSON.stringify(state, null, 2));
  say(`\nstate: ${STATE}\nledger: ${LEDGER}`);

  if (!result.campaignId || !result.adSetId || result.published.length < MIN_ADS) {
    say(`\n🔴 fewer than ${MIN_ADS} ads landed — the shared-ad-set claim is unproven. Run --teardown.`);
    return;
  }

  // 8 — THE READ-BACK. Meta's stored state, never our request.
  rule();
  say("READ-BACK — what META stored");
  rule();
  const rb = await readBackPublishedSet(meta as any, {
    userId: USER_ID, campaignId: result.campaignId, adSetId: result.adSetId,
    expected: state.ads,
  });
  say(`${rb.allShareOneAdSet ? "✅" : "🔴"} all ads share ONE ad set: ${rb.sharedAdSetId ?? "NO"}`);
  say(`${rb.adSetBelongsToCampaign ? "✅" : "🔴"} that ad set belongs to the one campaign`);
  say(`${rb.allPaused ? "✅" : "🔴"} campaign, ad set and every ad are PAUSED`);
  say(`   daily_budget stored by Meta: ${rb.dailyBudgetMinorUnits ?? "none"} minor units (expected 2000)`);
  for (const c of rb.copyMatches) {
    say(`   ${c.titleOk && c.bodyOk ? "✅" : "🔴"} creative ${c.creativeId}: headline ${c.titleOk ? "==" : "!="} assembled · body ${c.bodyOk ? "==" : "!="} assembled`);
  }
  for (const p of rb.problems) say(`   🔴 ${p}`);
  say(rb.ok ? "\n✅ 4c PROVEN — N ads in one campaign and one ad set, all paused, copy as assembled."
            : "\n🔴 4c NOT proven — see above.");
  say("\n⚠️ NOTHING IS TORN DOWN YET. Teardown is a SEPARATE invocation and a separate approval.");
}

// ══════════════════════════════════════════════════════════════════════════════
// TEARDOWN
// ══════════════════════════════════════════════════════════════════════════════
async function teardown() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!existsSync(STATE)) throw new Error(`no ${STATE} — nothing recorded to tear down`);
  const state: RunState = JSON.parse(readFileSync(STATE, "utf8"));

  rule("═");
  say("STEP 4c — TEARDOWN. Meta side first, then local.");
  rule("═");

  // The ledger is the authority on what to delete, not the state file: it is written the
  // instant each object exists and survives a crash the state file would not.
  const entries = readLedgerLines(readFileSync(LEDGER, "utf8").split("\n"));
  const campaignId = entries.find((e) => e.kind === "campaign")?.id ?? state.metaCampaignId;
  const adIds = entries.filter((e) => e.kind === "ad").map((e) => e.id);
  say(`ledger: campaign ${campaignId ?? "none"} · ads ${adIds.join(", ") || "none"}`);

  const meta = await import("../lib/metaAPI");
  const listCampaigns = async (userId: number) => {
    const rows = await meta.getCampaigns(userId);
    return (rows ?? []).map((c: any) => ({ id: String(c.id), name: String(c.name) }));
  };
  const mt = await teardownRecordedCampaign(
    { deleteCampaign: meta.deleteCampaign as any, getCampaignById: meta.getCampaignById, getAdById: meta.getAdById, listCampaigns },
    { userId: USER_ID, campaignId, adIds },
  );
  say(`\ncampaign ${mt.campaignId}: deleted=${mt.deleted} · confirmed by id = ${mt.confirmedStatus}`);
  for (const a of mt.ads) say(`   ad ${a.id}: ${a.confirmedGone ? "✅ gone" : `🔴 still ${a.status}`}`);
  say(`   "Auto Campaign Kit" count ${mt.orphanCheck.autoKitCount} (expected ${mt.orphanCheck.expected}) ${mt.orphanCheck.countUnchanged ? "✅" : "🔴"}`);
  say(`   pre-existing orphans intact ${mt.orphanCheck.allOrphansIntact ? "✅" : "🔴"} — present ${mt.orphanCheck.orphansPresent.join(", ")}`);
  for (const p of mt.problems) say(`   🔴 ${p}`);

  // ── local: Cloudinary before rows, creatives before concepts ──────────────
  rule();
  say("LOCAL TEARDOWN");
  rule();
  const sweep = await sweepAdCreativeBatch(db, state.batchId, USER_ID);
  say(`sweep: rows ${sweep.rowsDeleted} · cloudinary ${sweep.cloudinaryDeleted}/${sweep.publicIds.length} · failed ${sweep.cloudinaryFailed.length}`);

  for (const id of state.publishedRowIds) {
    await db.delete(metaPublishedAds).where(and(eq(metaPublishedAds.userId, USER_ID), eq(metaPublishedAds.id, id)));
  }
  // The published page is a real URL until the KV key goes — the DB row alone is not enough.
  try {
    const { ensureKvNamespace, deleteKvPage } = await import("../lib/cloudflare");
    await deleteKvPage(await ensureKvNamespace(), state.landingPageSlug);
    say(`landing page KV key ${state.landingPageSlug} deleted`);
  } catch (e: any) {
    say(`🔴 could not delete the KV page ${state.landingPageSlug}: ${String(e?.message ?? e)} — do it by hand`);
  }
  await db.delete(landingPages).where(and(eq(landingPages.userId, USER_ID), eq(landingPages.id, state.landingPageId)));
  await db.delete(adCopy).where(and(eq(adCopy.userId, USER_ID), eq(adCopy.adSetId, state.adSetId)));
  await db.delete(campaignConcepts).where(and(eq(campaignConcepts.userId, USER_ID), eq(campaignConcepts.icpId, state.icpId)));
  await db.execute(sql`DELETE FROM jobs WHERE id = ${conceptJobId(state.icpId)}`);
  await db.delete(idealCustomerProfiles).where(and(eq(idealCustomerProfiles.userId, USER_ID), eq(idealCustomerProfiles.id, state.icpId)));
  await db.delete(services).where(and(eq(services.userId, USER_ID), eq(services.id, state.serviceId)));

  const after = await baselines(db);
  say("");
  say(`adCopy       ${after.adCopy} ${after.adCopy === 5424 ? "✅" : "🔴"} (baseline 5424)`);
  say(`headlines    ${after.headlines} ${after.headlines === 2174 ? "✅" : "🔴"} (baseline 2174)`);
  say(`adCreatives  ${after.adCreatives} ${after.adCreatives === 405 ? "✅" : "🔴"} (baseline 405)`);
  say(`concepts     ${after.concepts} ${after.concepts === 6 ? "✅" : "🔴"} (baseline 6)`);
  say(`published    ${after.published} ${after.published === 2 ? "✅" : "🔴"} (baseline 2)`);
  say(`protected    ${await protectedTotal(db)} (expected 29)`);
  say(`\nlog: ${LOG}`);
}

// ══════════════════════════════════════════════════════════════════════════════
const argv = process.argv.slice(2);
if (argv.includes("--publish")) {
  publish().then(() => process.exit(0)).catch((e) => { console.error("[step4c] PUBLISH FAILED:", e?.message ?? e); process.exit(1); });
} else if (argv.includes("--teardown")) {
  teardown().then(() => process.exit(0)).catch((e) => { console.error("[step4c] TEARDOWN FAILED:", e?.message ?? e); process.exit(1); });
} else {
  console.log(`
step4c-multiad-publish.ts — NOTHING HAS BEEN DONE.

This script writes to a LIVE ad account (act_1254349025145319, AED, ~AED 1.17M spent).
It requires an explicit flag, and the two phases need two SEPARATE approvals from Arfeen:

  --publish    creates ONE campaign, ONE ad set and up to ${MAX_ADS} PAUSED ads
               at AED ${PINNED_DAILY_BUDGET_AED}/day, after a live GET /me token check
  --teardown   deletes ONLY the campaign id recorded in ${LEDGER},
               refuses the five protected campaigns, confirms by id, and proves
               the three pre-existing orphans are untouched

No flag was given, so no call was made.`);
  process.exit(0);
}
