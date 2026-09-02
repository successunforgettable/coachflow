/**
 * CONTROLLED LIVE PROOF — image engine Layers 1+2.
 *
 * Declared write scope, authorised 2026-08-05:
 *   1 throwaway service (clearly labelled) + 1 ICP + 4 adCreatives rows + 4 Cloudinary images.
 * Everything disposable. Teardown is scripts/layer12-live-teardown.ts.
 *
 * HARD GATES, in order. Any failure aborts BEFORE the next step:
 *   G1  tabloid routing — this calls runAdCreativesGeneration directly, never the editorial path
 *   G2  the LAYER1+2 marker must be present in THIS process, not merely in a local file read
 *   G3  every image must be saved to disk and verified non-empty BEFORE teardown is even possible
 *
 * Never tears anything down itself: it prints the ids and exits, so a human sees state first.
 */
import { writeFileSync, mkdirSync, existsSync, statSync } from "fs";
import { resolve } from "path";

// New stamp per run — the 2026-08-05 Layer-1+2 images stay on disk untouched as the "before".
const STAMP = process.env.PROOF_STAMP || "run-2026-08-05-layer1-rebuild-proof";
const OUTDIR = resolve(process.cwd(), "docs/screenshots", STAMP);

(async () => {
  const { getDb } = await import("../server/db");
  const schema = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("no db");

  // ── G2: MARKER, asserted in the live process ────────────────────────────────
  const { awarenessDeckPlan, subTypePlanFor } = await import("../server/_core/conceptAxis");
  const { AD_VARIATIONS } = await import("../server/_core/adVariations");
  const { generateAdImagePrompt } = await import("../server/routers/adCreatives");
  const plan = awarenessDeckPlan(AD_VARIATIONS.length);
  const subs = subTypePlanFor(plan);
  const probe = generateAdImagePrompt("person_shocked", "x", "y", false, undefined, "unaware", "aspirational");
  // Layer 2 marker (unchanged): sub-type replaces lighting AND backdrop.
  const layer2Ok =
    plan.length === AD_VARIATIONS.length &&
    new Set(subs).size > 1 &&
    /high-key natural daylight/.test(probe) &&
    !/Dark grey\/black background/.test(probe);

  // ── LAYER 1 REBUILD MARKER (2026-08-05) ─────────────────────────────────────
  // The previous marker asserted Layer 2 ONLY, which is why a build with a non-functional Layer 1
  // sailed through G2 and burned a live render. This asserts the ARCHITECTURE: the stage's action
  // must lead the prompt and the styling shell must follow it.
  const solProbe = generateAdImagePrompt("person_intense", "x", "y", false, undefined, "solution_aware", "grounded");
  const actionAt = solProbe.indexOf("laying plain cards out into a deliberate grid");
  const shellAt = solProbe.indexOf("Candid documentary photograph");
  const actions = new Set(plan.map((st, i) => generateAdImagePrompt(AD_VARIATIONS[i].style, "x", "y", false, undefined, st, subs[i]).split(".")[0]));
  const layer1Ok =
    actionAt >= 0 &&                              // the stage action is present…
    shellAt > actionAt &&                         // …and LEADS the styling shell
    !/seated behind a plain table/.test(solProbe) && // the pose-pinning clause is gone
    actions.size === AD_VARIATIONS.length;        // all four slots open on a different shot

  const markerOk = layer1Ok && layer2Ok;
  console.log(`[G2] LAYER 2 (styling) marker:            ${layer2Ok ? "ASSERTED" : "*** ABSENT ***"}`);
  console.log(`[G2] LAYER 1 (stage-led shot) marker:     ${layer1Ok ? "ASSERTED" : "*** ABSENT ***"}`);
  console.log(`[G2]   action@${actionAt} < shell@${shellAt}; distinct opening shots: ${actions.size}/${AD_VARIATIONS.length}`);
  console.log(`[G2] plan: ${plan.map((s, i) => `${AD_VARIATIONS[i].style}=${s}/${subs[i]}`).join("  ")}`);
  if (!markerOk) throw new Error("ABORT: Layers 1+2 not present in this process — refusing to write.");

  // ── G1: routing ─────────────────────────────────────────────────────────────
  const { runAdCreativesGeneration } = await import("../server/adCreativesGenerator");
  console.log("[G1] routing: calling runAdCreativesGeneration DIRECTLY (tabloid path, carries Layers 1+2).");
  console.log("[G1] runEditorialAdCreativesGeneration is NOT invoked; orchestration's adImageStyle branch is bypassed.");

  // ── PRE-COUNTS (read-only) ──────────────────────────────────────────────────
  const countOf = async (t: any) => (await db.select().from(t)).length;
  const preCreatives = await countOf(schema.adCreatives);
  const prePublished = await countOf(schema.metaPublishedAds);
  console.log(`[PRE] adCreatives=${preCreatives}  meta_published_ads=${prePublished}`);

  // ── WRITE 1: throwaway service ──────────────────────────────────────────────
  const LABEL = "LAYER12 PROOF — delete me";
  const svcIns: any = await db.insert(schema.services).values({
    userId: 117174,
    name: LABEL,
    category: "coaching",
    description: LABEL,
    targetCustomer: "Mid-career professionals planning a change of direction",
    mainBenefit: "A plan for the next move that survives a normal working week",
    uniqueMechanismSuggestion: "The Resequencing Method",
  } as any);
  const serviceId = Number(svcIns.insertId ?? svcIns[0]?.insertId);
  console.log(`[WRITE] service ${serviceId} created ("${LABEL}")`);

  // ── WRITE 2: ICP ────────────────────────────────────────────────────────────
  const icpIns: any = await db.insert(schema.idealCustomerProfiles).values({
    userId: 117174,
    serviceId,
    name: LABEL,
    angleName: "Mid-career professionals planning a change of direction",
  } as any);
  const icpId = Number(icpIns.insertId ?? icpIns[0]?.insertId);
  console.log(`[WRITE] icp ${icpId} created`);

  console.log(`\n>>> TEARDOWN IDS: service=${serviceId} icp=${icpId}\n`);

  // ── GENERATE ────────────────────────────────────────────────────────────────
  console.log("[RUN] generating tabloid batch (4 slots)…");
  const t0 = Date.now();
  const result: any = await runAdCreativesGeneration({
    userId: 117174,
    serviceId,
    niche: "career coaching",
    productName: "The Resequencing Method",
    uniqueMechanism: "The Resequencing Method",
    targetAudience: "Mid-career professionals planning a change of direction",
    mainBenefit: "A plan for the next move that survives a normal working week",
    pressingProblem: "The year runs out before the plan ever starts",
  } as any);
  console.log(`[RUN] done in ${Math.round((Date.now() - t0) / 1000)}s — result: ${JSON.stringify(result).slice(0, 200)}`);

  // ── FETCH + G3: SAVE IMAGES BEFORE ANYTHING ELSE ────────────────────────────
  const rows: any[] = await db.select().from(schema.adCreatives).where(eq(schema.adCreatives.serviceId, serviceId));
  console.log(`[POST] adCreatives rows for service ${serviceId}: ${rows.length}`);

  if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });
  const saved: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const url = r.imageUrl || r.imageURL || r.image_url;
    const label = `${String(i + 1).padStart(2, "0")}-${plan[i] ?? "slot"}-${subs[i] ?? ""}-${r.designStyle ?? "style"}`;
    if (!url) { console.log(`[G3] row ${r.id}: NO URL — cannot save`); continue; }
    try {
      const res = await fetch(url);
      if (!res.ok) { console.log(`[G3] row ${r.id}: HTTP ${res.status}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const path = resolve(OUTDIR, `${label}.png`);
      writeFileSync(path, buf);
      const size = statSync(path).size;
      if (size <= 0) { console.log(`[G3] row ${r.id}: EMPTY FILE`); continue; }
      saved.push(path);
      console.log(`[G3] saved ${label}.png  ${(size / 1024).toFixed(0)}KB  <- ${String(url).slice(0, 70)}`);
    } catch (e) {
      console.log(`[G3] row ${r.id}: save FAILED — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\n[G3] saved ${saved.length}/${rows.length} images to ${OUTDIR}`);
  if (saved.length !== rows.length || rows.length === 0) {
    console.log("[G3] *** HARD GATE FAILED — DO NOT TEAR DOWN. Images are not all on disk. ***");
  } else {
    console.log("[G3] HARD GATE PASSED — every image is on disk. Teardown is now safe.");
  }

  // ── DURING-COUNTS ───────────────────────────────────────────────────────────
  const midCreatives = await countOf(schema.adCreatives);
  const midPublished = await countOf(schema.metaPublishedAds);
  console.log(`[DURING] adCreatives=${midCreatives} (pre ${preCreatives}, delta +${midCreatives - preCreatives})`);
  console.log(`[DURING] meta_published_ads=${midPublished} (pre ${prePublished}, delta ${midPublished - prePublished})`);

  // ── PROMPT EVIDENCE — what each slot was actually told to depict ────────────
  // ⚠️ REWRITTEN 2026-08-05. This block printed the prompt's HEAD as "lighting" and its TAIL as the
  // stage directive — true under the old architecture, false now that the stage LEADS. Printing it
  // unchanged would report the shell as the shot. It now prints the shot concept the stage chose,
  // then the shell that styles it, in the order they actually appear.
  console.log("\n[EVIDENCE] per-slot SHOT CONCEPT (stage-led) then STYLING SHELL (sub-type):");
  AD_VARIATIONS.forEach((v, i) => {
    const p = generateAdImagePrompt(v.style, "career coaching", "The year runs out before the plan ever starts", false, undefined, plan[i], subs[i]);
    const shellAtI = p.indexOf("Candid documentary photograph");
    const shot = p.slice(0, shellAtI > 0 ? shellAtI : 200).replace(/\s+/g, " ").trim();
    const shell = shellAtI > 0 ? p.slice(shellAtI, shellAtI + 150).replace(/\s+/g, " ") : "(shell not located)";
    console.log(`  ${v.style.padEnd(15)} ${plan[i]}/${subs[i]}`);
    console.log(`     SHOT : ${shot.slice(0, 260)}…`);
    console.log(`     SHELL: ${shell}…`);
  });

  // The clean isolation pair. Slots 1 and 4 are BOTH esoteric, so lighting and backdrop are
  // identical between them — any visible difference is the awareness stage doing the work. This is
  // the comparison the 2026-08-05 run could not make, because style drove the shot back then.
  console.log("\n[EVIDENCE] LAYER-1 ISOLATION PAIR — slots 1 and 4 share a sub-type:");
  console.log(`  slot 1 = ${plan[0]}/${subs[0]}   slot 4 = ${plan[3]}/${subs[3]}   same sub-type: ${subs[0] === subs[3]}`);

  console.log(`\n>>> TEARDOWN: npx tsx scripts/layer12-live-teardown.ts ${serviceId} ${icpId}`);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(2); });
