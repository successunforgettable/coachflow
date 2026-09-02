/**
 * CONTROLLED LIVE PROOF — LAYER 1 ISOLATION (2026-08-05, post-rebuild).
 *
 * THE QUESTION: does the awareness stage now drive the SHOT CONCEPT, or only the styling?
 *
 * The 2026-08-05 Layer-1+2 run could not answer this. It varied stage, sub-type AND style all at
 * once, so a visible difference could be attributed to any of the three. This run varies ONE thing.
 *
 *   HELD CONSTANT:  style (person_intense) · sub-type (grounded) · subject · niche · problem
 *   VARIED:         awareness stage only — problem_aware, solution_aware, product_aware
 *   CONTROL:        solution_aware rendered TWICE
 *
 * The control matters. Diffusion is stochastic: if two renders of the SAME cell differ as much as
 * two different stages do, then "the pictures look different" proves nothing. Image 4 is the
 * yardstick for how much difference is mere noise.
 *
 * ── WRITE SCOPE: DELIBERATELY SMALLER THAN AUTHORISED ────────────────────────
 * Authorised was 1 throwaway service + 1 ICP + creatives + images. This script writes NO DATABASE
 * ROWS AT ALL — no service, no ICP, no adCreatives. It calls the same two functions the cascade
 * calls (`generateAdImagePrompt` then `generateImage`, adCreativesGenerator.ts:584) with controlled
 * inputs. The DB rows would add nothing: the proof is visual, and the cascade cannot hold style
 * constant anyway because it assigns a different style per deck slot.
 *
 * Consequence: adCreatives and meta_published_ads are asserted UNCHANGED at start and end, and
 * there is nothing to tear down. Protected services 272–277 and service 285 are never referenced.
 *
 * HARD GATES, in order. Any failure aborts BEFORE a single image is paid for:
 *   G1  routing — the TABLOID builder and the tabloid renderer; editorial is never imported
 *   G2  the Layer-1 rebuild marker, asserted in THIS process
 *   G3  ISOLATION, proven on the strings before spending: the styling half of all four prompts
 *       must be BYTE-IDENTICAL, and the shot half must differ
 *   G4  every image saved to disk and verified non-empty
 */
import { writeFileSync, mkdirSync, existsSync, statSync, appendFileSync } from "fs";
import { resolve } from "path";

const STAMP = process.env.PROOF_STAMP || "run-2026-08-05-layer1-isolation";
const OUTDIR = resolve(process.cwd(), "docs/screenshots", STAMP);

/**
 * ⚠️ Node block-buffers stdout through a pipe, and `railway run` adds another layer. The first
 * attempt (2026-08-05 16:18) produced ZERO visible output for 25 minutes while every one of its
 * four renders was failing on an upstream Replicate 500 — the failures were invisible until the
 * process was killed and the buffer flushed. Every line therefore also goes to a file with
 * appendFileSync, which is not buffered, so a run can be watched while it happens.
 */
const PROGRESS = resolve(OUTDIR, "_progress.log");
const log = (m: string) => {
  console.log(m);
  try { appendFileSync(PROGRESS, `${m}\n`); } catch { /* dir not made yet */ }
};

/** An upstream hang must not burn the session. Caps a single render attempt. */
const withTimeout = <T>(p: Promise<T>, ms: number, what: string): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT after ${ms / 1000}s: ${what}`)), ms))]);

// ── THE CONTROLLED CELL ──────────────────────────────────────────────────────
const STYLE = "person_intense";
const SUBTYPE = "grounded";
const NICHE = "career coaching";
const PROBLEM = "The year runs out before the plan ever starts";
const SUBJECT = "A woman in her late thirties";

const RUNS: { label: string; stage: string }[] = [
  { label: "01-problem_aware", stage: "problem_aware" },
  { label: "02-solution_aware", stage: "solution_aware" },
  { label: "03-product_aware", stage: "product_aware" },
  { label: "04-solution_aware-CONTROL-repeat", stage: "solution_aware" },
];

(async () => {
  // Made FIRST so the unbuffered progress log captures the gates too, not just the renders.
  if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });
  const { getDb } = await import("../server/db");
  const schema = await import("../drizzle/schema");
  const db = await getDb();
  if (!db) throw new Error("no db");

  const { generateAdImagePrompt } = await import("../server/routers/adCreatives");
  const { rendererForStyle, generateImage } = await import("../server/_core/imageGeneration");
  const { awarenessDeckPlan, subTypePlanFor } = await import("../server/_core/conceptAxis");
  const { AD_VARIATIONS } = await import("../server/_core/adVariations");

  // ── G1: ROUTING ─────────────────────────────────────────────────────────────
  const renderer = rendererForStyle(STYLE);
  log(`[G1] builder : generateAdImagePrompt  (TABLOID path, carries Layers 1+2)`);
  log(`[G1] editorial: buildEditorialPrompt is NOT imported by this script`);
  log(`[G1] renderer : style=${STYLE} -> ${renderer}`);
  if (renderer !== "flux-1.1-pro") {
    throw new Error(`ABORT: expected flux-1.1-pro for ${STYLE}, got ${renderer}`);
  }

  // ── G2: LAYER-1 REBUILD MARKER, in this process ─────────────────────────────
  const plan = awarenessDeckPlan(AD_VARIATIONS.length);
  const subs = subTypePlanFor(plan);
  const solProbe = generateAdImagePrompt(STYLE, "x", "y", false, undefined, "solution_aware", "grounded");
  const actionAt = solProbe.indexOf("laying plain cards out into a deliberate grid");
  const shellAt = solProbe.indexOf("Candid documentary photograph");
  const layer1Ok =
    actionAt >= 0 && shellAt > actionAt && !/seated behind a plain table/.test(solProbe);
  log(`[G2] LAYER 1 (stage-led shot) marker: ${layer1Ok ? "ASSERTED" : "*** ABSENT ***"}`);
  log(`[G2]   stage action @${actionAt} precedes styling shell @${shellAt}`);
  if (!layer1Ok) throw new Error("ABORT: the Layer-1 rebuild is not present in this process.");

  // ── BUILD THE FOUR PROMPTS ──────────────────────────────────────────────────
  const prompts = RUNS.map((r) =>
    generateAdImagePrompt(STYLE, NICHE, PROBLEM, false, SUBJECT, r.stage, SUBTYPE),
  );

  // ── G3: ISOLATION, PROVEN ON THE STRINGS BEFORE SPENDING ────────────────────
  // Everything from the styling shell onward — lighting, backdrop, niche, problem, clean plate,
  // compliance — must be byte-identical across all four. If it is, then any pixel difference can
  // only come from the shot half, which is the stage's.
  const shells = prompts.map((p) => p.slice(p.indexOf("Candid documentary photograph")));
  const shots = prompts.map((p) => p.slice(0, p.indexOf("Candid documentary photograph")).trim());
  const shellsIdentical = new Set(shells).size === 1;
  const shotsDiffer = new Set(shots.slice(0, 3)).size === 3; // the three DIFFERENT stages
  const controlIdentical = shots[1] === shots[3];            // repeat of solution_aware
  log(`[G3] styling half byte-identical across all 4 : ${shellsIdentical}`);
  log(`[G3] shot half differs across the 3 stages    : ${shotsDiffer}`);
  log(`[G3] control (img 2 vs 4) has identical prompt: ${controlIdentical}`);
  if (!shellsIdentical || !shotsDiffer || !controlIdentical) {
    throw new Error("ABORT: the set is not controlled — refusing to spend on images.");
  }
  log("\n[G3] THE ONLY THING THAT VARIES — each slot's shot half:");
  RUNS.forEach((r, i) => log(`  ${r.label}\n     ${shots[i].slice(0, 300)}…\n`));
  log(`[G3] the shared styling half (identical in all four):\n     ${shells[0].slice(0, 200)}…\n`);

  // ── PRE-COUNTS (read-only) ──────────────────────────────────────────────────
  const countOf = async (t: any) => (await db.select().from(t)).length;
  const preCreatives = await countOf(schema.adCreatives);
  const prePublished = await countOf(schema.metaPublishedAds);
  log(`[PRE] adCreatives=${preCreatives}  meta_published_ads=${prePublished}`);
  log(`[PRE] this script writes NO database rows; both counts must be unchanged at the end.`);

  // ── GENERATE ────────────────────────────────────────────────────────────────
  if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });
  const saved: string[] = [];
  for (let i = 0; i < RUNS.length; i++) {
    const r = RUNS[i];
    let url: string | undefined;
    // Two attempts. The 2026-08-05 16:18 run lost all four slots to a transient Replicate 500;
    // one retry per slot costs little and survives a blip without a whole re-run.
    for (let attempt = 1; attempt <= 2 && !url; attempt++) {
      log(`\n[RUN] ${r.label} — rendering (attempt ${attempt}/2)…`);
      const t0 = Date.now();
      try {
        const res = await withTimeout(
          generateImage({ prompt: prompts[i], style: STYLE } as any),
          180_000,
          r.label,
        );
        url = (res as any)?.url;
        log(`[RUN] ${r.label} done in ${Math.round((Date.now() - t0) / 1000)}s`);
      } catch (e) {
        log(`[RUN] ${r.label} attempt ${attempt} FAILED after ${Math.round((Date.now() - t0) / 1000)}s — ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (!url) { log(`[G4] ${r.label}: no image after 2 attempts`); continue; }
    try {
      const res = await fetch(url);
      if (!res.ok) { log(`[G4] ${r.label}: HTTP ${res.status}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const path = resolve(OUTDIR, `${r.label}.png`);
      writeFileSync(path, buf);
      const size = statSync(path).size;
      if (size <= 0) { log(`[G4] ${r.label}: EMPTY FILE`); continue; }
      saved.push(path);
      log(`[G4] saved ${r.label}.png  ${(size / 1024).toFixed(0)}KB`);
    } catch (e) {
      log(`[G4] ${r.label}: save FAILED — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  log(`\n[G4] saved ${saved.length}/${RUNS.length} images to ${OUTDIR}`);
  log(saved.length === RUNS.length
    ? "[G4] HARD GATE PASSED — every image is on disk."
    : "[G4] *** HARD GATE FAILED — some images are missing. ***");

  // ── POST-COUNTS ─────────────────────────────────────────────────────────────
  const postCreatives = await countOf(schema.adCreatives);
  const postPublished = await countOf(schema.metaPublishedAds);
  log(`\n[POST] adCreatives=${postCreatives} (pre ${preCreatives}, delta ${postCreatives - preCreatives})`);
  log(`[POST] meta_published_ads=${postPublished} (pre ${prePublished}, delta ${postPublished - prePublished})`);
  log(postCreatives === preCreatives && postPublished === prePublished
    ? "[POST] RECONCILED — zero database writes, nothing to tear down."
    : "*** [POST] UNEXPECTED DB DELTA — investigate before doing anything else. ***");
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(2); });
