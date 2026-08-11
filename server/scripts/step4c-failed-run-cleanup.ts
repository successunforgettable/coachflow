/**
 * step4c-failed-run-cleanup.ts — clear the local rows left by the ABORTED 4c publish run.
 *
 * ⚠️ CONTEXT. The 2026-08-10 `--publish` attempt failed at the landing-page publish step
 * ("Landing page has 1 unfilled placeholder: [INSERT_PRICE]"), which is BEFORE any Graph call.
 * Verified: no `/tmp/step4c-ledger.jsonl` was ever created, and `meta_published_ads` is still
 * 2. **NOTHING EXISTS ON THE AD ACCOUNT.** This script therefore touches Meta not at all — it
 * imports no Meta module.
 *
 * ⚠️ WHY THE HARNESS'S OWN `--teardown` CANNOT DO THIS. Two gaps it exposed, both worth fixing
 * before the re-run:
 *   1. `--teardown` requires `/tmp/step4c-state.json`, which is written only AFTER a successful
 *      publish. A failure before that point leaves it with nothing to read.
 *   2. Even given a hand-written state file, it calls `teardownRecordedCampaign` first, and
 *      that correctly REFUSES a null campaign id — so it could never reach the local half.
 * The fix is to write the state file early and to skip the Meta phase when the ledger holds no
 * campaign. Recorded here rather than patched mid-incident.
 *
 * Scope is by EXPLICIT ID, taken from the run's log, and Cloudinary is cleared before the rows —
 * once a row is gone its image URLs are unrecoverable from the database.
 *
 * Usage:  npx tsx server/scripts/step4c-failed-run-cleanup.ts --execute
 */
import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  adCreatives, adCopy, services, idealCustomerProfiles, campaignConcepts, headlines,
  landingPages, metaPublishedAds,
} from "../../drizzle/schema";
import { sweepAdCreativeBatch } from "../lib/adCreativeTeardown";
import { conceptJobId } from "../conceptGenerator";

// Every id below was read off the failed run's log and confirmed by direct query.
const USER_ID = 1;
const SERVICE_ID = 312;
const ICP_ID = 286;
const COPY_AD_SET_ID = "sNkYRQIXmE8QQz2G9Yfwl";
const BATCH_ID = "batch-1786376772637-997a8f6f";
const LANDING_PAGE_ID = 237; // never published — publicUrl NULL, so no Cloudflare KV key exists

const BASELINE = { adCopy: 5424, headlines: 2174, adCreatives: 405, concepts: 6, published: 2 };

async function main() {
  if (!process.argv.includes("--execute")) {
    console.log(
      `DRY RUN — nothing deleted.\n` +
      `Would clear: service ${SERVICE_ID} · ICP ${ICP_ID} · concepts for ICP ${ICP_ID} · ` +
      `adCopy adSet ${COPY_AD_SET_ID} · creatives batch ${BATCH_ID} (+ Cloudinary) · ` +
      `landingPage ${LANDING_PAGE_ID}\nRe-run with --execute.`,
    );
    return;
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Guard: this script must never run against a state where a Meta publish DID happen.
  const published = Number((await db.select({ n: sql<number>`COUNT(*)` }).from(metaPublishedAds))[0].n);
  if (published !== BASELINE.published) {
    throw new Error(
      `REFUSING: meta_published_ads is ${published}, expected ${BASELINE.published}. That means a ` +
      `publish DID land and this script is the wrong tool — use the harness's --teardown so the ` +
      `Meta objects are removed first.`,
    );
  }

  // Cloudinary BEFORE the rows.
  const sweep = await sweepAdCreativeBatch(db, BATCH_ID, USER_ID);
  console.log(
    `sweep: rowsFound ${sweep.rowsFound} · rowsDeleted ${sweep.rowsDeleted} · ` +
    `public_ids ${sweep.publicIds.length} · cloudinaryDeleted ${sweep.cloudinaryDeleted} · ` +
    `failed ${sweep.cloudinaryFailed.length}`,
  );
  for (const f of sweep.cloudinaryFailed) console.log(`   🔴 cloudinary NOT deleted: ${f}`);

  await db.delete(landingPages).where(and(eq(landingPages.userId, USER_ID), eq(landingPages.id, LANDING_PAGE_ID)));
  await db.delete(adCopy).where(and(eq(adCopy.userId, USER_ID), eq(adCopy.adSetId, COPY_AD_SET_ID)));
  await db.delete(campaignConcepts).where(and(eq(campaignConcepts.userId, USER_ID), eq(campaignConcepts.icpId, ICP_ID)));
  await db.execute(sql`DELETE FROM jobs WHERE id = ${conceptJobId(ICP_ID)}`);
  await db.delete(idealCustomerProfiles).where(and(eq(idealCustomerProfiles.userId, USER_ID), eq(idealCustomerProfiles.id, ICP_ID)));
  await db.delete(services).where(and(eq(services.userId, USER_ID), eq(services.id, SERVICE_ID)));

  const one = async (t: any) => Number((await db.select({ n: sql<number>`COUNT(*)` }).from(t))[0].n);
  const after = {
    adCopy: await one(adCopy), headlines: await one(headlines), adCreatives: await one(adCreatives),
    concepts: await one(campaignConcepts), published: await one(metaPublishedAds),
  };
  const rows: any = await db.execute(sql`
    SELECT serviceId, COUNT(*) n FROM adCreatives WHERE serviceId IN (272,273,274,275,276,277,285) GROUP BY serviceId
  `);
  const pr = (Array.isArray(rows) ? rows[0] : (rows as any)?.rows ?? rows) as any[];
  const prot = (pr ?? []).reduce((a: number, r: any) => a + Number(r.n), 0);

  console.log("");
  for (const [k, v] of Object.entries(after)) {
    const want = (BASELINE as any)[k];
    console.log(`${k.padEnd(12)} ${v} ${v === want ? "✅" : "🔴"} (baseline ${want})`);
  }
  console.log(`protected    ${prot} ${prot === 29 ? "✅" : "🔴"} (expected 29) — ` +
    (pr ?? []).map((r: any) => `${r.serviceId}:${r.n}`).join(" "));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[step4c-failed-run-cleanup] FAILED:", e?.message ?? e);
  process.exit(1);
});
