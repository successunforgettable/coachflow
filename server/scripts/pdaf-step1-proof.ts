/**
 * pdaf-step1-proof.ts — live proof for Step 1 of the desire axis: concept
 * generation made durable, and its trigger moved from the ad-copy entry to
 * campaign-kit creation.
 *
 * ⚠️ WRITES TO PRODUCTION. Creates one labelled throwaway service, one ICP, one
 * campaign kit, one concept set and (to prove the video path) one concept script.
 * Renders no images: no creative rows, no Cloudinary objects, adCreatives untouched.
 * Teardown is id-scoped in dependency order, printed at the end, NOT executed here.
 *
 * ZERO COPY CHANGES are exercised by this script — Node 6 and Node 7 are not called.
 *
 * What it proves:
 *   1. calling the REAL ensureCampaignKit triggers concept generation
 *   2. the durable job row reaches a TERMINAL state (complete/failed), not limbo
 *   3. the concept set exists BEFORE ad copy is ever invoked
 *   4. the trigger is IDEMPOTENT — a second call neither regenerates nor duplicates
 *   5. the video-script path still gets its concepts, proven by generating one
 *
 * Usage:  npx tsx server/scripts/pdaf-step1-proof.ts [userId]
 */
import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { services, idealCustomerProfiles, campaignKits, campaignConcepts, conceptScripts, jobs } from "../../drizzle/schema";
import { ensureCampaignKit } from "../routers/campaignKits";
import { ensureConceptsForIcp, conceptJobId } from "../conceptGenerator";
import { generateScriptForConcept } from "../conceptScriptGenerator";

const USER_ID = Number(process.argv[2] ?? 1);
const LABEL = "ZZ-PDAF-STEP1 — throwaway, safe to delete";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  console.log("═".repeat(78));
  console.log("STEP 1 PROOF — durable concepts, triggered at kit creation");
  console.log("═".repeat(78));

  // ── Throwaway service + ICP ───────────────────────────────────────────────
  const [svcIns] = await db.insert(services).values({
    userId: USER_ID,
    name: LABEL,
    category: "consulting",
    description: "Throwaway row created by pdaf-step1-proof.ts. Safe to delete.",
    targetCustomer: "operations consultants who bill by the hour and want to move to retainers",
    mainBenefit: "a booked retainer conversation within two weeks of first contact",
    painPoints: "proposals sit unsent while the scope keeps moving and the client goes quiet",
  } as any);
  const serviceId = Number((svcIns as any).insertId);

  const [icpIns] = await db.insert(idealCustomerProfiles).values({
    userId: USER_ID,
    serviceId,
    name: "ZZ-PDAF-STEP1 ICP",
    pains: "proposals sit unsent for days; the scope keeps moving; the client goes quiet before the number is discussed",
    fears: "that raising the rate ends the relationship; that the pipeline is one silence away from empty",
    goals: "predictable retainer revenue instead of hours billed after the fact",
    objections: "retainers feel like a bigger ask than the work I already do",
    buyingTriggers: "a quarter where two engagements stalled at the proposal stage",
  } as any);
  const icpId = Number((icpIns as any).insertId);
  console.log(`created throwaway service=${serviceId} icp=${icpId}`);

  // ── 1. The real kit-creation path fires the trigger ───────────────────────
  console.log("\n" + "─".repeat(78));
  console.log("1. ensureCampaignKit → concept trigger");
  console.log("─".repeat(78));
  const t0 = Date.now();
  const kitId = await ensureCampaignKit(USER_ID, icpId, "discovery_call");
  console.log(`kit created id=${kitId} in ${Date.now() - t0}ms (the caller did NOT wait for concepts)`);

  // ── 2. Durable job reaches a terminal state ───────────────────────────────
  console.log("\n" + "─".repeat(78));
  console.log("2. DURABLE JOB — polling to a terminal state");
  console.log("─".repeat(78));
  const jobId = conceptJobId(icpId);
  let jobStatus = "(none)";
  // 8 concepts × up to 3 gate attempts, then a per-concept solo re-check, is several
  // sequential LLM calls. A 240s window timed out while the job was still alive and
  // then completed unseen — the run looked like a durability failure and was not.
  const deadline = Date.now() + 600_000;
  while (Date.now() < deadline) {
    const [j] = await db.select({ status: jobs.status, error: jobs.error, result: jobs.result })
      .from(jobs).where(eq(jobs.id, jobId)).limit(1);
    jobStatus = j?.status ?? "(none)";
    if (jobStatus === "complete" || jobStatus === "failed") {
      console.log(`job ${jobId} → ${jobStatus} after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      if (j?.result) console.log(`result: ${j.result}`);
      if (j?.error) console.log(`error: ${j.error}`);
      break;
    }
    await sleep(3000);
  }
  if (jobStatus !== "complete" && jobStatus !== "failed") {
    console.log(`⚠️ job still ${jobStatus} after 240s — reporting as non-terminal`);
  }

  // ── 3. The set exists before ad copy is ever invoked ──────────────────────
  const concepts = await db.select().from(campaignConcepts).where(eq(campaignConcepts.icpId, icpId));
  console.log("\n" + "─".repeat(78));
  console.log("3. CONCEPT SET ON THE RECORD (ad copy has NOT been invoked in this script)");
  console.log("─".repeat(78));
  console.log(`concepts for icp ${icpId}: ${concepts.length}`);
  const desires = Array.from(new Set(concepts.map((c: any) => String(c.desire))));
  const stages = Array.from(new Set(concepts.map((c: any) => String(c.awareness))));
  console.log(`distinct desires: ${desires.length}`);
  desires.forEach((d, i) => console.log(`  ${i + 1}. ${d.slice(0, 88)}`));
  console.log(`awareness stages present: ${stages.join(", ")}`);
  console.log(`persona values (expected: all identical — persona is pinned to the ICP): ` +
    `${Array.from(new Set(concepts.map((c: any) => String(c.personaLabel)))).length}`);

  // ── 4. Idempotency ────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(78));
  console.log("4. IDEMPOTENCY — second and third calls must not regenerate");
  console.log("─".repeat(78));
  const again1 = await ensureConceptsForIcp({ userId: USER_ID, icpId, serviceId });
  const kitAgain = await ensureCampaignKit(USER_ID, icpId, "discovery_call");
  const again2 = await ensureConceptsForIcp({ userId: USER_ID, icpId, serviceId });
  await sleep(2000);
  const afterCount = (await db.select({ id: campaignConcepts.id })
    .from(campaignConcepts).where(eq(campaignConcepts.icpId, icpId))).length;
  console.log(`direct ensure #1 → ${again1}`);
  console.log(`ensureCampaignKit again → kit ${kitAgain} (same kit: ${kitAgain === kitId})`);
  console.log(`direct ensure #2 → ${again2}`);
  console.log(`concept count before ${concepts.length} → after ${afterCount}  (must be unchanged)`);

  // ── 5. The video path still gets its concepts ─────────────────────────────
  console.log("\n" + "─".repeat(78));
  console.log("5. VIDEO-SCRIPT PATH — unchanged consumer, proven live");
  console.log("─".repeat(78));
  let scriptId: number | null = null;
  if (concepts.length > 0) {
    const target: any = concepts[0];
    try {
      scriptId = await generateScriptForConcept({ userId: USER_ID, conceptId: target.id });
      const [script] = await db.select().from(conceptScripts).where(eq(conceptScripts.id, scriptId)).limit(1);
      const scenes = (script as any)?.scenes;
      const sceneCount = Array.isArray(scenes) ? scenes.length : (scenes ? Object.keys(scenes).length : 0);
      console.log(`generated script id=${scriptId} from concept ${target.id}`);
      console.log(`  concept awareness=${target.awareness} hook=${target.hookPattern}`);
      console.log(`  script  awareness=${(script as any)?.awareness} hook=${(script as any)?.hookPattern} ` +
        `target=${(script as any)?.targetLengthSeconds}s scenes=${sceneCount}`);
      console.log(`  → the video path read the concept and produced a script: PASS`);
    } catch (e) {
      console.log(`  ⚠️ video path FAILED: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    console.log("  no concepts to script — video path could not be exercised");
  }

  // ── 6. Teardown ───────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(78));
  console.log("6. TEARDOWN — id-scoped, dependency order, NOT executed here");
  console.log("─".repeat(78));
  console.log(`DELETE FROM conceptScripts   WHERE icpId = ${icpId} AND userId = ${USER_ID};`);
  console.log(`DELETE FROM campaignConcepts WHERE icpId = ${icpId} AND userId = ${USER_ID};`);
  console.log(`DELETE FROM jobs             WHERE id = '${jobId}';`);
  console.log(`DELETE FROM campaignKits     WHERE id = ${kitId} AND userId = ${USER_ID};`);
  console.log(`DELETE FROM idealCustomerProfiles WHERE id = ${icpId} AND userId = ${USER_ID};`);
  console.log(`DELETE FROM services         WHERE id = ${serviceId} AND userId = ${USER_ID};`);
  console.log("-- No images rendered: adCreatives baseline untouched, Cloudinary not involved.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[step1-proof] FAILED:", e);
    process.exit(1);
  });
