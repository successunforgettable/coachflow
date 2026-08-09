/**
 * reroute-live-publish-v2.ts — the live proof of publish-path step 1, done in the right order.
 *
 * ⚠️ PUBLISHES A REAL PAUSED AD to Arfeen's real ad account. $20 daily budget clears the
 * account's AED 3.00 ad-set floor; PAUSED at every level means it cannot spend.
 *
 * WHAT CHANGED FROM v1, AND WHY IT MATTERS. v1 read back through the LIST endpoints, which
 * do not surface fresh objects: the creative was absent from a 200-row page and the
 * assertions reported failure when the READ had failed. v1 also ran the read-back and the
 * deletion in one pass, so the campaign was removed before the read could be retried. This
 * version reads BY ID, and deletes ONLY after the read has succeeded — on any read failure
 * the paused campaign is deliberately LEFT IN PLACE to be investigated.
 *
 * Nothing is regenerated: gated copy 5889/5902 and rendered creative 482 are reused.
 *
 * Usage:  npx tsx server/scripts/reroute-live-publish-v2.ts
 */
import "dotenv/config";
import { appendFileSync } from "fs";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { adCopy, adCreatives, landingPages } from "../../drizzle/schema";

const LOG = `/tmp/reroute-live-publish-v2-${process.pid}.log`;
const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};
const rule = (c = "─") => say(c.repeat(78));

const USER_ID = 1;
const HEADLINE_ADCOPY_ID = 5889;
const BODY_ADCOPY_ID = 5902;
const REUSE_CREATIVE_ID = 482;
const SERVICE_ID = 305;
const LP_ID = 221;
const DAILY_BUDGET = 20;
const CAMPAIGN_NAME = "ZZ-CONTROL-REROUTE — throwaway test publish, safe to delete";
const CONTROL_HEADLINE = "Lose the mum tummy. Feel like you.";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const meta = await import("../lib/metaAPI");

  rule("═");
  say("PUBLISH-PATH STEP 1 — LIVE PAUSED PUBLISH, READ BACK BY ID");
  rule("═");

  // ── Inputs, re-read from the database rather than trusted from a log ──────
  const rows: any[] = await db.select().from(adCopy)
    .where(and(eq(adCopy.userId, USER_ID), inArray(adCopy.id, [HEADLINE_ADCOPY_ID, BODY_ADCOPY_ID])));
  const gh = rows.find((r) => r.id === HEADLINE_ADCOPY_ID);
  const gb = rows.find((r) => r.id === BODY_ADCOPY_ID);
  if (!gh || !gb) throw new Error("gated rows 5889/5902 not found");
  for (const [label, r] of [["headline", gh], ["body", gb]] as const) {
    if (!r.awareness || !r.complianceCheckedAt) throw new Error(`${label} row ${r.id} is not gated — refusing`);
  }
  const headlineText = String(gh.content);
  const bodyText = String(gb.content);

  const [creativeRow]: any[] = await db.select().from(adCreatives)
    .where(and(eq(adCreatives.id, REUSE_CREATIVE_ID), eq(adCreatives.userId, USER_ID)));
  if (!creativeRow) throw new Error(`creative ${REUSE_CREATIVE_ID} not found`);
  const bakedHeadline = String(creativeRow.headline);
  if (bakedHeadline.trim() !== headlineText.trim()) {
    throw new Error(`creative ${REUSE_CREATIVE_ID} bakes a different string than adCopy ${HEADLINE_ADCOPY_ID} — refusing`);
  }
  const [lp]: any[] = await db.select().from(landingPages).where(eq(landingPages.id, LP_ID));
  if (!lp?.publicUrl) throw new Error(`LP ${LP_ID} is not published`);

  say(`gated headline  adCopy ${gh.id} [${gh.awareness}/${gh.format}] "${headlineText}"`);
  say(`gated body      adCopy ${gb.id} [${gb.awareness}/${gb.format}] ${bodyText.length} chars`);
  say(`baked on image  adCreatives ${REUSE_CREATIVE_ID} "${bakedHeadline}" (${creativeRow.imageFormat})`);
  say(`budget ${DAILY_BUDGET} · status PAUSED (pre-publish)`);

  // ── Publish ───────────────────────────────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("PUBLISH");
  rule();
  const { appRouter } = await import("../routers");
  const caller = appRouter.createCaller({
    user: { id: USER_ID, subscriptionTier: "pro", role: "admin" }, req: {} as any, res: {} as any,
  } as any);

  let res: any;
  try {
    res = await caller.meta.publishToMeta({
      headline: headlineText, body: bodyText, linkUrl: lp.publicUrl,
      imageUrl: String(creativeRow.imageUrl), callToAction: "LEARN_MORE",
      campaignName: CAMPAIGN_NAME, serviceId: SERVICE_ID, objective: "OUTCOME_LEADS",
      dailyBudget: DAILY_BUDGET, targeting: { countries: ["US"] }, status: "PAUSED",
      headlineAdCopyId: HEADLINE_ADCOPY_ID, bodyAdCopyId: BODY_ADCOPY_ID,
      copyAdSetId: String(gh.adSetId),
    } as any);
  } catch (e: any) {
    const m = String(e?.message ?? e);
    const which =
      /Failed to create Meta campaign/i.test(m) ? "createCampaign (1 of 4)" :
      /Failed to create Meta ad set/i.test(m) ? "createAdSet (2 of 4)" :
      /Failed to create Meta ad creative/i.test(m) ? "createAdCreative (3 of 4)" :
      /Failed to create Meta ad\b/i.test(m) ? "createAd (4 of 4)" : "NOT one of the four creation calls";
    say(`🔴 PUBLISH FAILED at: ${which}`);
    say(`🔴 ${m}`);
    try {
      const cs = await meta.getCampaigns(USER_ID, { limit: 50 });
      const orphans = cs.filter((c: any) => String(c.name ?? "").includes("ZZ-CONTROL-REROUTE"));
      for (const o of orphans) { await meta.deleteCampaign(USER_ID, (o as any).id); say(`   self-clean: deleted ${(o as any).id}`); }
      if (!orphans.length) say("   self-clean: nothing created");
    } catch (ce: any) { say(`   🔴 self-clean failed: ${ce?.message}`); }
    throw e;
  }
  say(`✅ campaign=${res.campaignId} adSet=${res.adSetId} creative=${res.creativeId} ad=${res.adId}`);

  // ── READ BACK BY ID — BEFORE any deletion ─────────────────────────────────
  say("\n" + "═".repeat(78));
  say("READ-BACK BY ID — Meta's stored copy");
  rule("═");
  const mc: any = await meta.getAdCreativeById(USER_ID, String(res.creativeId));
  const campaign: any = await meta.getCampaignById(USER_ID, String(res.campaignId));
  const adSet: any = await meta.getAdSetById(USER_ID, String(res.adSetId));
  const ad: any = await meta.getAdById(USER_ID, String(res.adId));

  const readOk = !!mc && (mc.effectiveTitle.length > 0 || mc.effectiveBody.length > 0);
  if (!readOk) {
    say(`🔴 BY-ID READ-BACK FAILED — creative ${res.creativeId} returned ${mc ? "empty fields" : "null"}.`);
    say("");
    say("⚠️ THE PAUSED CAMPAIGN IS DELIBERATELY LEFT IN PLACE so it can be investigated.");
    say(`   campaign ${res.campaignId} · adSet ${res.adSetId} · ad ${res.adId} · creative ${res.creativeId}`);
    say("   It is PAUSED and spends nothing. Do not assume the copy is wrong — the READ failed.");
    return;
  }

  say(`creative ${res.creativeId} — found by id`);
  say("");
  say(`META headline field: "${mc.effectiveTitle}"`);
  say(`gated adCopy ${HEADLINE_ADCOPY_ID}:    "${headlineText}"`);
  say(`baked on the image:  "${bakedHeadline}"`);
  say("");
  say(`META primary text:   "${mc.effectiveBody.slice(0, 260)}${mc.effectiveBody.length > 260 ? "…" : ""}"  [${mc.effectiveBody.length} chars]`);
  say(`gated adCopy ${BODY_ADCOPY_ID}:    "${bodyText.slice(0, 260)}${bodyText.length > 260 ? "…" : ""}"  [${bodyText.length} chars]`);

  say("\n" + "─".repeat(78));
  say("ASSERTIONS");
  rule();
  const hOk = mc.effectiveTitle.trim() === headlineText.trim();
  const bOk = mc.effectiveBody.trim() === bodyText.trim();
  const bakedOk = bakedHeadline.trim() === mc.effectiveTitle.trim();
  const notControl = mc.effectiveTitle.trim() !== CONTROL_HEADLINE;
  const notLpBody = !mc.effectiveBody.includes("your postpartum body");
  say(`${hOk ? "✅" : "🔴"} Meta headline field === gated adCopy ${HEADLINE_ADCOPY_ID}`);
  say(`${bOk ? "✅" : "🔴"} Meta primary text  === gated adCopy ${BODY_ADCOPY_ID}`);
  say(`${bakedOk ? "✅" : "🔴"} headline BAKED on the image === Meta headline field`);
  say(`${notControl ? "✅" : "🔴"} NOT the ungated control headline`);
  say(`${notLpBody ? "✅" : "🔴"} NOT the landing-page subheadline body`);
  say("");
  say(`campaign status: ${campaign?.status} (effective ${campaign?.effective_status})`);
  say(`ad set  status: ${adSet?.status} (effective ${adSet?.effective_status}) daily_budget=${adSet?.daily_budget}`);
  say(`ad      status: ${ad?.status} (effective ${ad?.effective_status})`);
  const allPaused = [campaign?.status, adSet?.status, ad?.status].every((s) => String(s) === "PAUSED");
  say(`${allPaused ? "✅" : "🔴"} PAUSED at campaign, ad set AND ad`);

  const allPassed = hOk && bOk && bakedOk && notControl && notLpBody;
  if (!allPassed) {
    say("");
    say("🔴 AN ASSERTION FAILED — leaving the paused campaign in place for inspection.");
    return;
  }

  // ── Only now: delete, and confirm BY ID ───────────────────────────────────
  say("\n" + "═".repeat(78));
  say("SELF-CLEAN — read-back complete, so the campaign can go");
  rule("═");
  const deleted = await meta.deleteCampaign(USER_ID, String(res.campaignId));
  say(`deleteCampaign returned: ${deleted}`);
  const after: any = await meta.getCampaignById(USER_ID, String(res.campaignId));
  say(after === null
    ? `✅ campaign ${res.campaignId} is GONE — confirmed by id, not by a list`
    : `campaign ${res.campaignId} still readable: status=${after.status} effective=${after.effective_status}`);
  if (after && String(after.status) !== "DELETED") {
    say("🔴 still present and not DELETED — report rather than leave silently.");
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[reroute-live-publish-v2] FAILED:", e);
  process.exit(1);
});
