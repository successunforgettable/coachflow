/**
 * reroute-live-publish.ts — THE LIVE PROOF of publish-path step 1.
 *
 * ⚠️ PUBLISHES A REAL AD to Arfeen's real Meta ad account, PAUSED at every level, $1 daily
 * budget. It is paused so it cannot spend, but it is not a simulation.
 *
 * WHAT IS UNDER TEST: that the GATED copy survives the whole publish path and arrives in
 * Meta intact — the headline field, the primary text, and the headline baked onto the
 * picture all being the same gated rows rather than the image-engine side-generation and
 * the landing-page subheadline the control run shipped.
 *
 * WHAT IS NOT UNDER TEST: the image's subject matter. One creative is rendered rather than
 * the full four-slot deck, because the deck loop is not what this proves and four renders
 * would leave three unused assets in Cloudinary.
 *
 * ⚠️ SELF-CLEAN ON FAILURE. If any of the four Graph calls errors, whatever was already
 * created is deleted before exiting, so a partial hierarchy is never left in the account.
 *
 * Usage:  npx tsx server/scripts/reroute-live-publish.ts
 */
import "dotenv/config";
import { appendFileSync, writeFileSync, mkdirSync } from "fs";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { adCopy, adCreatives, landingPages } from "../../drizzle/schema";
import { generateImage } from "../_core/imageGeneration";
import { renderAdCreative } from "../_core/compositeHeadline";
import { storagePut } from "../storage";
import { FEED_ASPECT } from "../_core/adVariations";
import { generateAdImagePrompt } from "../routers/adCreatives";

const LOG = `/tmp/reroute-live-publish-${process.pid}.log`;
const OUTDIR = "docs/screenshots/run-reroute-live-publish";
const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};
const rule = (c = "─") => say(c.repeat(78));

const USER_ID = 1;
const HEADLINE_ADCOPY_ID = 5889;
const BODY_ADCOPY_ID = 5902;
const SERVICE_ID = 305;
const LP_ID = 221;
const CAMPAIGN_NAME = "ZZ-CONTROL-REROUTE — throwaway test publish, safe to delete";
const STYLE = "person_shocked";
/** Reuse the creative rendered by the first attempt, which died at createAdSet. */
const REUSE_CREATIVE_ID = 482;
/**
 * ⚠️ THE AD ACCOUNT IS DENOMINATED IN AED, NOT USD. The first attempt sent 1, which Meta
 * received as 100 minor units = AED 1.00, under its AED 3.00 ad-set floor, and
 * `createAdSet` refused with blame_field_specs [["daily_budget"]]. 20 is the publish
 * modal's own default and clears the floor with room. PAUSED means it still cannot spend.
 *
 * Logged separately as a product defect: `publishToMeta` accepts `z.number().min(1)`, a
 * floor that assumes USD and is below Meta's minimum for a non-USD account.
 */
const DAILY_BUDGET = 20;

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  rule("═");
  say("PUBLISH-PATH STEP 1 — LIVE PAUSED PUBLISH (real ad account)");
  rule("═");

  // ── The gated rows, re-read rather than trusted from the earlier log ───────
  const rows: any[] = await db.select().from(adCopy)
    .where(and(eq(adCopy.userId, USER_ID), inArray(adCopy.id, [HEADLINE_ADCOPY_ID, BODY_ADCOPY_ID])));
  const gh = rows.find((r) => r.id === HEADLINE_ADCOPY_ID);
  const gb = rows.find((r) => r.id === BODY_ADCOPY_ID);
  if (!gh || !gb) throw new Error("gated rows 5889/5902 not found for user 1");
  for (const [label, r] of [["headline", gh], ["body", gb]] as const) {
    if (!r.awareness || !r.complianceCheckedAt) {
      throw new Error(`${label} row ${r.id} is not gated (awareness=${r.awareness}, checked=${r.complianceCheckedAt}) — refusing`);
    }
  }
  const headlineText = String(gh.content);
  const bodyText = String(gb.content);
  say(`gated headline  adCopy ${gh.id} [${gh.awareness}/${gh.format}] "${headlineText}"`);
  say(`gated body      adCopy ${gb.id} [${gb.awareness}/${gb.format}] ${bodyText.length} chars`);

  const [lp]: any[] = await db.select().from(landingPages).where(eq(landingPages.id, LP_ID));
  if (!lp?.publicUrl) throw new Error(`LP ${LP_ID} is not published`);

  // ── REUSE the already-rendered creative ───────────────────────────────────
  // The first attempt rendered the picture and then died at createAdSet on the AED budget
  // floor. Re-rendering would spend money for nothing and, worse, would change the asset
  // under test — the whole point is that THIS baked headline reaches Meta.
  const [existing]: any[] = await db.select().from(adCreatives)
    .where(and(eq(adCreatives.id, REUSE_CREATIVE_ID), eq(adCreatives.userId, USER_ID)));
  if (!existing) throw new Error(`creative ${REUSE_CREATIVE_ID} not found for user ${USER_ID}`);
  // Guard the assertion's meaning: if the stored row does not bake the gated headline, the
  // baked-vs-field comparison later would be comparing the wrong things and still "pass".
  if (String(existing.headline).trim() !== headlineText.trim()) {
    throw new Error(
      `creative ${REUSE_CREATIVE_ID} bakes "${existing.headline}" but adCopy ${HEADLINE_ADCOPY_ID} ` +
      `is "${headlineText}" — refusing: the baked-vs-field assertion would be meaningless`,
    );
  }
  say("\n" + "─".repeat(78));
  say(`REUSING rendered creative ${REUSE_CREATIVE_ID} — nothing re-rendered, nothing regenerated`);
  rule();
  const bakedHeadline = String(existing.headline);
  const imageUrl = String(existing.imageUrl);
  const batchId = String(existing.batchId);
  say(`baked headline: "${bakedHeadline}"`);
  say(`imageFormat ${existing.imageFormat} · headlineAdCopyId=${existing.headlineAdCopyId} · batch ${batchId}`);

  // ── Publish, PAUSED ───────────────────────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("PUBLISH — PAUSED at campaign, ad set and ad");
  rule();
  const payload = {
    headline: headlineText,
    body: bodyText,
    linkUrl: lp.publicUrl as string,
    imageUrl,
    callToAction: "LEARN_MORE",
    campaignName: CAMPAIGN_NAME,
    serviceId: SERVICE_ID,
    objective: "OUTCOME_LEADS" as const,
    dailyBudget: DAILY_BUDGET,
    targeting: { countries: ["US"] },
    status: "PAUSED" as const,
    headlineAdCopyId: HEADLINE_ADCOPY_ID,
    bodyAdCopyId: BODY_ADCOPY_ID,
    copyAdSetId: String(gh.adSetId),
  };
  say(`payload.status = ${payload.status} (pre-publish)`);

  const { appRouter } = await import("../routers");
  const caller = appRouter.createCaller({
    user: { id: USER_ID, subscriptionTier: "pro", role: "admin" }, req: {} as any, res: {} as any,
  } as any);

  let res: any;
  try {
    res = await caller.meta.publishToMeta(payload as any);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const which =
      /Failed to create Meta campaign/i.test(msg) ? "createCampaign (1 of 4)" :
      /Failed to create Meta ad set/i.test(msg) ? "createAdSet (2 of 4)" :
      /Failed to create Meta ad creative/i.test(msg) ? "createAdCreative (3 of 4)" :
      /Failed to create Meta ad\b/i.test(msg) ? "createAd (4 of 4)" :
      "NOT one of the four creation calls";
    say(`🔴 PUBLISH FAILED at: ${which}`);
    say(`🔴 message: ${msg}`);
    // SELF-CLEAN: remove any partial hierarchy so no orphan is left behind.
    try {
      const { getCampaigns, deleteCampaign } = await import("../lib/metaAPI");
      const cs = await getCampaigns(USER_ID, { limit: 25 });
      const orphans = cs.filter((c: any) => String(c.name ?? "").includes("ZZ-CONTROL-REROUTE"));
      for (const o of orphans) { await deleteCampaign(USER_ID, (o as any).id); say(`   self-clean: deleted campaign ${(o as any).id}`); }
      if (orphans.length === 0) say("   self-clean: nothing was created — nothing to delete");
    } catch (ce: any) { say(`   🔴 self-clean FAILED: ${ce?.message}`); }
    throw e;
  }

  say(`✅ published. campaign=${res.campaignId} adSet=${res.adSetId} creative=${res.creativeId} ad=${res.adId}`);

  // ── Read back what META holds ─────────────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("READ-BACK FROM META — Meta's stored copy, not our request");
  rule();
  const { getCampaigns, getAdSets, getAdCreatives, getCampaignStatus, deleteCampaign } = await import("../lib/metaAPI");
  const { getMetaToken } = await import("../lib/metaAPI") as any;

  const campaigns = await getCampaigns(USER_ID, { limit: 25 });
  const mine: any = campaigns.find((c: any) => String(c.id) === String(res.campaignId));
  say(`campaign ${res.campaignId} → ${mine ? `"${mine.name}" status=${mine.status}` : "🔴 NOT FOUND"}`);
  const adSets = await getAdSets(USER_ID, { limit: 50 } as any);
  const mySet: any = adSets.find((s: any) => String(s.id) === String(res.adSetId));
  say(`ad set   ${res.adSetId} → ${mySet ? `status=${mySet.status}` : "(not in first page)"}`);

  const creatives = await getAdCreatives(USER_ID, { limit: 50 });
  const mc: any = creatives.find((c: any) => String(c.id) === String(res.creativeId));
  const metaTitle = String(mc?.title ?? mc?.object_story_spec?.link_data?.name ?? "");
  const metaBody = String(mc?.body ?? mc?.object_story_spec?.link_data?.message ?? "");
  say(`creative ${res.creativeId} → ${mc ? "found" : "🔴 NOT FOUND"}`);
  say(`  META headline field: "${metaTitle}"`);
  say(`  META primary text:   "${metaBody.slice(0, 200)}${metaBody.length > 200 ? "…" : ""}"  [${metaBody.length} chars]`);

  say("\n" + "─".repeat(78));
  say("ASSERTIONS — did the GATED copy arrive intact?");
  rule();
  const headlineMatches = metaTitle.trim() === headlineText.trim();
  const bodyMatches = metaBody.trim() === bodyText.trim();
  const bakedMatchesField = bakedHeadline.trim() === metaTitle.trim();
  say(`${headlineMatches ? "✅" : "🔴"} Meta headline === adCopy ${HEADLINE_ADCOPY_ID}`);
  say(`${bodyMatches ? "✅" : "🔴"} Meta primary text === adCopy ${BODY_ADCOPY_ID}`);
  say(`${bakedMatchesField ? "✅" : "🔴"} headline BAKED on the image === Meta headline field`);
  say(`${metaTitle !== "Lose the mum tummy. Feel like you." ? "✅" : "🔴"} not the ungated control headline`);
  const paused = String(mine?.status) === "PAUSED";
  say(`${paused ? "✅" : "🔴"} campaign PAUSED after publish (status=${mine?.status})`);
  try {
    const token = await getMetaToken(USER_ID);
    if (token) say(`   direct status read: ${await getCampaignStatus(token, res.campaignId)}`);
  } catch (e: any) { say(`   direct status read failed: ${e?.message}`); }

  // ── Self-clean: delete the test campaign, then PROVE it is gone ───────────
  say("\n" + "─".repeat(78));
  say("SELF-CLEAN — delete the test campaign and verify by read-back");
  rule();
  await deleteCampaign(USER_ID, res.campaignId);
  const after = await getCampaigns(USER_ID, { limit: 25 });
  const stillThere = after.some((c: any) => String(c.id) === String(res.campaignId));
  say(stillThere ? `🔴 campaign ${res.campaignId} STILL PRESENT` : `✅ campaign ${res.campaignId} gone, confirmed by read-back`);
  say(`   ZZ-CONTROL-REROUTE present? ${after.some((c: any) => String((c as any).name ?? "").includes("ZZ-CONTROL-REROUTE"))}`);

  say("\n" + "─".repeat(78));
  say("DATABASE THROWAWAY — LEFT IN PLACE, per instruction. Teardown when authorised:");
  rule();
  say(`  sweepAdCreativeBatch(db, '${batchId}', ${USER_ID})   -- 1 row, 3 Cloudinary objects`);
  say(`  DELETE FROM meta_published_ads WHERE metaCampaignId = '${res.campaignId}' AND userId = ${USER_ID};`);
  say(`  DELETE FROM adCopy WHERE adSetId = '${gh.adSetId}' AND userId = ${USER_ID};`);
  say(`  DELETE FROM campaignConcepts WHERE icpId = 279 AND userId = ${USER_ID};`);
  say(`  DELETE FROM jobs WHERE id IN ('concepts-icp-279','concepts-icp-278') AND userId = '${USER_ID}';`);
  say(`  DELETE FROM idealCustomerProfiles WHERE id IN (278,279) AND userId = ${USER_ID};`);
  say(`  DELETE FROM services WHERE id IN (304,305) AND userId = ${USER_ID};`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[reroute-live-publish] FAILED:", e);
  process.exit(1);
});
