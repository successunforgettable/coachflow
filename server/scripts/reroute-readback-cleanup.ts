/**
 * reroute-readback-cleanup.ts — finish the live proof: complete the Meta read-back, then
 * remove the test campaign and PROVE it is gone.
 *
 * WHY THIS EXISTS SEPARATELY. The publish itself succeeded — all four Graph calls, the
 * first complete publish this product has made — but two things in the harness were wrong:
 *
 *   1. `getAdCreatives(userId, { limit: 50 })` did not return the new creative, so the
 *      read-back reported empty strings and the assertions "failed" VACUOUSLY. An empty
 *      read is not evidence the copy is wrong; it is evidence the read was wrong.
 *   2. `deleteCampaign` returns a BOOLEAN rather than throwing, and the harness ignored it.
 *      The campaign is still in the account.
 *
 * Usage:  npx tsx server/scripts/reroute-readback-cleanup.ts
 */
import "dotenv/config";
import { appendFileSync } from "fs";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { adCopy, adCreatives } from "../../drizzle/schema";

const LOG = `/tmp/reroute-readback-cleanup-${process.pid}.log`;
const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};
const rule = (c = "─") => say(c.repeat(78));

const USER_ID = 1;
const CAMPAIGN_ID = "120251182716030626";
const CREATIVE_ID = "1794106041581416";
const HEADLINE_ADCOPY_ID = 5889;
const BODY_ADCOPY_ID = 5902;
const REUSE_CREATIVE_ID = 482;

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows: any[] = await db.select().from(adCopy)
    .where(and(eq(adCopy.userId, USER_ID), inArray(adCopy.id, [HEADLINE_ADCOPY_ID, BODY_ADCOPY_ID])));
  const headlineText = String(rows.find((r) => r.id === HEADLINE_ADCOPY_ID)?.content ?? "");
  const bodyText = String(rows.find((r) => r.id === BODY_ADCOPY_ID)?.content ?? "");
  const [creativeRow]: any[] = await db.select().from(adCreatives).where(eq(adCreatives.id, REUSE_CREATIVE_ID));
  const bakedHeadline = String(creativeRow?.headline ?? "");

  const { getAdCreatives, getCampaigns, deleteCampaign, updateCampaignStatus } = await import("../lib/metaAPI");

  // ── READ BACK, properly ───────────────────────────────────────────────────
  rule("═");
  say("META READ-BACK — searching a wider page for the creative");
  rule("═");
  const creatives = await getAdCreatives(USER_ID, { limit: 200 });
  say(`creatives returned: ${creatives.length}`);
  const mc: any = creatives.find((c: any) => String(c.id) === CREATIVE_ID);
  if (!mc) {
    say(`🔴 creative ${CREATIVE_ID} STILL not in the list — cannot confirm stored copy from this endpoint.`);
    say("   Newest few, for orientation:");
    for (const c of creatives.slice(0, 5)) say(`     id=${(c as any).id} title=${JSON.stringify((c as any).title ?? null)}`);
  } else {
    const metaTitle = String(mc.title ?? mc.object_story_spec?.link_data?.name ?? "");
    const metaBody = String(mc.body ?? mc.object_story_spec?.link_data?.message ?? "");
    say(`✅ creative ${CREATIVE_ID} found`);
    say("");
    say(`META headline field: "${metaTitle}"`);
    say(`adCopy ${HEADLINE_ADCOPY_ID}:     "${headlineText}"`);
    say(`baked on the image:  "${bakedHeadline}"`);
    say("");
    say(`META primary text:   "${metaBody.slice(0, 240)}${metaBody.length > 240 ? "…" : ""}"  [${metaBody.length} chars]`);
    say(`adCopy ${BODY_ADCOPY_ID}:     "${bodyText.slice(0, 240)}${bodyText.length > 240 ? "…" : ""}"  [${bodyText.length} chars]`);
    say("");
    rule();
    say("ASSERTIONS");
    rule();
    const hOk = metaTitle.trim() === headlineText.trim();
    const bOk = metaBody.trim() === bodyText.trim();
    const bakedOk = bakedHeadline.trim() === metaTitle.trim();
    say(`${hOk ? "✅" : "🔴"} Meta headline field === gated adCopy ${HEADLINE_ADCOPY_ID}`);
    say(`${bOk ? "✅" : "🔴"} Meta primary text  === gated adCopy ${BODY_ADCOPY_ID}`);
    say(`${bakedOk ? "✅" : "🔴"} headline BAKED on the image === Meta headline field`);
    say(`${metaTitle !== "Lose the mum tummy. Feel like you." ? "✅" : "🔴"} NOT the ungated control headline`);
    say(`${metaBody.includes("your postpartum body") ? "🔴" : "✅"} NOT the landing-page subheadline body`);
  }

  // ── CLEAN UP — and capture the boolean the last run ignored ───────────────
  say("\n" + "═".repeat(78));
  say("SELF-CLEAN — remove the test campaign");
  rule("═");
  const before = await getCampaigns(USER_ID, { limit: 50 });
  const beforeHit: any = before.find((c: any) => String(c.id) === CAMPAIGN_ID);
  say(`before: campaign ${CAMPAIGN_ID} ${beforeHit ? `present, status=${beforeHit.status}` : "not listed"}`);

  const deleted = await deleteCampaign(USER_ID, CAMPAIGN_ID);
  say(`deleteCampaign returned: ${deleted}`);

  if (!deleted) {
    // Meta refuses a hard delete in some states; archiving removes it from the working set
    // and guarantees it can never deliver. Better than leaving it live-but-paused.
    say("hard delete refused — falling back to status DELETED");
    try {
      const r = await updateCampaignStatus(USER_ID, CAMPAIGN_ID, "DELETED" as any);
      say(`updateCampaignStatus(DELETED) returned: ${JSON.stringify(r)}`);
    } catch (e: any) { say(`🔴 updateCampaignStatus failed: ${e?.message}`); }
  }

  const after = await getCampaigns(USER_ID, { limit: 50 });
  const afterHit: any = after.find((c: any) => String(c.id) === CAMPAIGN_ID);
  const namedStill = after.filter((c: any) => String(c.name ?? "").includes("ZZ-CONTROL-REROUTE"));
  say("");
  say(`after: campaign ${CAMPAIGN_ID} ${afterHit ? `STILL LISTED, status=${afterHit.status}` : "gone from the list"}`);
  say(`after: ZZ-CONTROL-REROUTE campaigns remaining: ${namedStill.length}${namedStill.length ? " → " + namedStill.map((c: any) => `${c.id}(${c.status})`).join(", ") : ""}`);
  say("");
  say(!afterHit || String(afterHit.status) === "DELETED"
    ? "✅ the test campaign is removed or archived — it cannot deliver and spends nothing."
    : "🔴 the test campaign is STILL ACTIVE IN THE ACCOUNT — report, do not leave silently.");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[reroute-readback-cleanup] FAILED:", e);
  process.exit(1);
});
