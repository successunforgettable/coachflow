/**
 * meta-control-publish.ts — THE CONTROL RUN for the publish-path reroute.
 *
 * ⚠️ THIS PUBLISHES A REAL AD TO A REAL META AD ACCOUNT. It is PAUSED at every level and
 * spends nothing, but it is not a simulation: it creates a genuine campaign, ad set, ad
 * creative and ad in Arfeen's Ads Manager.
 *
 * ⚠️ RUNS AS userId=1 (Arfeen), NOT the smoke account. `meta_access_tokens` holds exactly
 * one row and it is bound to userId 1, so `getMetaToken` returns null for any other user.
 *
 * WHY A CONTROL RUN. Per CHECKPOINT §8c the four Graph calls have NEVER fired against a
 * live token. Proving the reroute with a single publish would prove two things at once —
 * that the path works at all, and that the rerouted text is correct — and a failure could
 * not be attributed to either. So this run uses the CURRENT code exactly as it ships and
 * captures what Meta actually stores. The reroute run is diffed against it.
 *
 * WHAT IT REPLICATES. `PushKitModal.buildMetaInput()` verbatim: the headline is the
 * CREATIVE ROW's headline (the image-engine side-generation), and the body is
 * `deriveDefaultBody` — the landing page's subheadline, else its eyebrowHeadline. Neither
 * comes from the gated Node 7 pool. That is the behaviour being captured.
 *
 * Usage:  npx tsx server/scripts/meta-control-publish.ts <lpId> <creativeId>
 */
import "dotenv/config";
import { appendFileSync } from "fs";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { landingPages, adCreatives, campaignKits } from "../../drizzle/schema";

const LOG = `/tmp/meta-control-publish-${process.pid}.log`;
const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};
const rule = (c = "─") => say(c.repeat(78));

const USER_ID = 1;                                    // Arfeen — the token's owner
const LP_ID = Number(process.argv[2] ?? 221);
const CREATIVE_ID = Number(process.argv[3] ?? 368);
const CAMPAIGN_NAME = "ZZ-CONTROL-PUBLISH — throwaway, safe to delete";

/** Verbatim port of PushKitModal.deriveDefaultBody — do not "improve" it. */
function deriveDefaultBody(lpData: any, angleKey: string): string {
  if (!lpData) return "";
  const angleRaw =
    angleKey === "godfather" ? lpData.godfatherAngle :
    angleKey === "free"      ? lpData.freeAngle :
    angleKey === "dollar"    ? lpData.dollarAngle :
                               lpData.originalAngle;
  if (!angleRaw) return "";
  let parsed: any = null;
  try {
    parsed = typeof angleRaw === "string" ? JSON.parse(angleRaw) : angleRaw;
  } catch {
    return "";
  }
  return parsed?.subheadline || parsed?.eyebrowHeadline || "";
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  rule("═");
  say("META CONTROL PUBLISH — CURRENT CODE, PAUSED, REAL AD ACCOUNT");
  say(`userId ${USER_ID} · lp ${LP_ID} · creative ${CREATIVE_ID}`);
  rule("═");

  const [lp]: any[] = await db.select().from(landingPages).where(eq(landingPages.id, LP_ID));
  if (!lp) throw new Error(`landing page ${LP_ID} not found`);
  if (!lp.publicUrl) throw new Error(`landing page ${LP_ID} has no publicUrl — it is not published`);
  if (lp.userId !== USER_ID) throw new Error(`landing page ${LP_ID} belongs to user ${lp.userId}, not ${USER_ID}`);

  const [creative]: any[] = await db.select().from(adCreatives).where(eq(adCreatives.id, CREATIVE_ID));
  if (!creative) throw new Error(`creative ${CREATIVE_ID} not found`);
  if (creative.userId !== USER_ID) throw new Error(`creative ${CREATIVE_ID} belongs to user ${creative.userId}`);
  const PROTECTED = [272, 273, 274, 275, 276, 277, 285];
  if (PROTECTED.includes(Number(creative.serviceId))) {
    throw new Error(`creative ${CREATIVE_ID} sits on PROTECTED service ${creative.serviceId} — refusing`);
  }

  const [kit]: any[] = await db.select().from(campaignKits).where(eq(campaignKits.selectedLandingPageId, LP_ID));
  const lpAngle = kit?.selectedLandingPageAngle || "original";
  say(`landing page: ${lp.publicUrl}`);
  say(`kit angle:    ${lpAngle}${kit ? ` (kit ${kit.id})` : " (no kit — defaulted)"}`);
  say(`creative:     #${creative.variationNumber} ${creative.designStyle} / ${creative.headlineFormula}, service ${creative.serviceId}`);

  // ── THE OUTGOING PAYLOAD — buildMetaInput() verbatim ──────────────────────
  const payload = {
    headline: creative.headline as string,
    body: deriveDefaultBody(lp, lpAngle).trim(),
    linkUrl: lp.publicUrl as string,
    imageUrl: (creative.imageUrl as string) || undefined,
    verticalImageUrl: (creative.verticalImageUrl as string) || undefined,
    callToAction: "LEARN_MORE",
    campaignName: CAMPAIGN_NAME,
    serviceId: Number(creative.serviceId),
    objective: "OUTCOME_LEADS" as const,
    dailyBudget: 1,                 // minimum allowed; PAUSED means it cannot spend
    targeting: { countries: ["US"] },
    status: "PAUSED" as const,      // campaign, ad set AND ad
  };

  say("\n" + "─".repeat(78));
  say("OUTGOING PAYLOAD — what the current code sends");
  rule();
  say(`headline (Meta headline field):  "${payload.headline}"   [${payload.headline.length} chars]`);
  say(`body (Meta primary text):        "${payload.body}"`);
  say(`  → body length ${payload.body.length}; source = landing page ${lpAngle}Angle.subheadline`);
  say(`linkUrl:                         ${payload.linkUrl}`);
  say(`imageUrl:                        ${payload.imageUrl ? "present" : "MISSING"}`);
  say(`status:                          ${payload.status}   dailyBudget: $${payload.dailyBudget}`);
  if (!payload.body) throw new Error("derived body is empty — the modal would refuse to push; stopping");

  // ── FIRE — the four Graph calls, for the first time ever ──────────────────
  say("\n" + "─".repeat(78));
  say("PUBLISHING — createCampaign → createAdSet → createAdCreative → createAd");
  rule();
  const { appRouter } = await import("../routers");
  const caller = appRouter.createCaller({
    user: { id: USER_ID, subscriptionTier: "pro", role: "admin" },
    req: {} as any,
    res: {} as any,
  } as any);

  let res: any;
  try {
    res = await caller.meta.publishToMeta(payload as any);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    // The four calls fail with distinct messages — which one fires localises the problem.
    const which =
      /Failed to create Meta campaign/i.test(msg) ? "createCampaign (1 of 4)" :
      /Failed to create Meta ad set/i.test(msg) ? "createAdSet (2 of 4)" :
      /Failed to create Meta ad creative/i.test(msg) ? "createAdCreative (3 of 4)" :
      /Failed to create Meta ad\b/i.test(msg) ? "createAd (4 of 4)" :
      "NOT one of the four creation calls — see the message";
    say(`🔴 PUBLISH FAILED at: ${which}`);
    say(`🔴 message: ${msg}`);
    say("");
    say("STOPPING. No retry, per instruction. Nothing to delete unless a campaign id appears above.");
    throw e;
  }

  say(`✅ published. campaignId=${res.campaignId} adSetId(meta)=${res.metaAdSetId ?? "?"} adId=${res.adId ?? "?"}`);

  // ── READ BACK — what Meta actually holds ──────────────────────────────────
  say("\n" + "─".repeat(78));
  say("READ-BACK FROM META — not our request, Meta's stored copy");
  rule();
  const { getCampaigns, getAdSets, getAdCreatives, getCampaignStatus } = await import("../lib/metaAPI");
  const { getMetaToken } = await import("../lib/metaAPI") as any;

  const campaigns = await getCampaigns(USER_ID, { limit: 25 });
  const mine = campaigns.find((c: any) => String(c.id) === String(res.campaignId));
  say(`campaign:  ${mine ? `${mine.id} "${mine.name}" status=${(mine as any).status}` : "🔴 NOT FOUND in read-back"}`);

  const adSets = await getAdSets(USER_ID, { limit: 50 } as any);
  const mySet = adSets.find((s: any) => String(s.campaignId ?? s.campaign_id) === String(res.campaignId));
  say(`ad set:    ${mySet ? `${mySet.id} "${(mySet as any).name}" status=${(mySet as any).status}` : "(not matched by campaignId — see raw list below)"}`);

  const creatives = await getAdCreatives(USER_ID, { limit: 50 });
  say(`creatives returned: ${creatives.length}`);
  for (const c of creatives.slice(0, 6)) {
    const anyC = c as any;
    say(`   id=${anyC.id} title=${JSON.stringify(anyC.title ?? anyC.name ?? null)} body=${JSON.stringify(String(anyC.body ?? anyC.object_story_spec?.link_data?.message ?? "").slice(0, 120))}`);
  }

  try {
    const token = await getMetaToken(USER_ID);
    if (token) say(`campaign status (direct): ${await getCampaignStatus(token, res.campaignId)}`);
  } catch (e: any) { say(`campaign status read failed: ${e?.message}`); }

  say("\n" + "─".repeat(78));
  say("COMPARE — expected TODAY behaviour");
  rule();
  say(`expected headline = the CREATIVE ROW's headline (image-side, ungated): "${payload.headline}"`);
  say(`expected body     = landing-page ${lpAngle}Angle.subheadline (NOT the gated pool)`);
  say("");
  say(`⚠️ CAMPAIGN LEFT IN PLACE: ${res.campaignId}. Delete only after the read-back above is`);
  say("   confirmed complete and unambiguous. If anything is missing, leave it and re-read.");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[meta-control-publish] FAILED:", e);
  process.exit(1);
});
