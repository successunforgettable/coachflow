/**
 * Live proof of the creatives step against PROD data — fix C, P6 cause 1, P8 rotation.
 *
 * Invokes the REAL runAdCreativesGeneration (the exact function Auto Mode step 9
 * calls) against a real prod service, so the prompts, the body-deck rotation and
 * the Replicate call are all the shipping code paths.
 *
 * WRITES: 5 rows in `adCreatives`, one batchId. NOTHING ELSE.
 *   - reads services + idealCustomerProfiles + adCopy
 *   - does NOT touch campaignKits (runAdCreativesGeneration never writes one)
 *   - protected parent rows (services 272-277 / ICPs 249-254) are READ ONLY
 * Teardown is therefore: DELETE FROM adCreatives WHERE batchId = '<printed id>'
 *
 *   railway run --environment production --service coachflow \
 *     npx tsx scripts/prove-creatives-live.mjs --serviceId=277 --icpId=254
 */
import { getDb } from "../server/db.ts";
import { services, idealCustomerProfiles } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";
import { runAdCreativesGeneration, generateContextualAdHeadlines } from "../server/adCreativesGenerator.ts";

const arg = (n, d) => {
  const m = process.argv.find(a => a.startsWith(`--${n}=`));
  return m ? m.slice(n.length + 3) : d;
};
const serviceId = Number(arg("serviceId", "277"));
const icpId = Number(arg("icpId", "254"));

const db = await getDb();
if (!db) throw new Error("no db");

const [svc] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
const [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, icpId)).limit(1);
if (!svc) throw new Error(`service ${serviceId} not found`);

const niche = (svc.targetCustomer ?? svc.category ?? "coaching").slice(0, 200);
const pressingProblem = svc.painPoints ?? svc.description ?? "";
console.log(`SERVICE ${serviceId} "${svc.name}"`);
console.log(`NICHE   ${niche.slice(0, 110)}`);
console.log(`PROBLEM ${String(pressingProblem).slice(0, 110)}`);

const t0 = Date.now();
const headlines = await generateContextualAdHeadlines({
  productName: svc.name,
  mainBenefit: svc.mainBenefit ?? "",
  targetAudience: svc.targetCustomer ?? "",
  uniqueMechanism: "the Sequence Reset",
  pressingProblem,
  icpPains: icp?.pains || undefined,
  icpFears: icp?.fears || undefined,
});
console.log(`HEADLINES ${headlines.length} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const t1 = Date.now();
const res = await runAdCreativesGeneration({
  userId: 117174,
  serviceId,
  niche,
  productName: svc.name,
  uniqueMechanism: "the Sequence Reset",
  targetAudience: svc.targetCustomer ?? "",
  mainBenefit: svc.mainBenefit ?? "",
  pressingProblem,
  adType: "lead_gen",
  headlines,
  campaignType: "lead_magnet",
});
const totalMs = Date.now() - t1;
console.log(`BATCH ${res.batchId} creatives=${res.creativeCount}`);
console.log(`TOTAL ${(totalMs / 1000).toFixed(1)}s for ${res.creativeCount} images -> ${(totalMs / res.creativeCount / 1000).toFixed(1)}s each`);
console.log(`TEARDOWN DELETE FROM adCreatives WHERE batchId = '${res.batchId}';`);
process.exit(0);
