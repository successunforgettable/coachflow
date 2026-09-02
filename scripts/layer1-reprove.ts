/**
 * CONTROLLED RE-PROVE — Layer 1, after the three amendments (2026-08-05, run 2).
 *
 *   HELD CONSTANT:  style (person_intense) · sub-type (grounded) · subject · niche · problem
 *   VARIED:         awareness stage — ALL FIVE
 *   CONTROL:        solution_aware rendered TWICE (the diffusion-noise yardstick)
 *   COMPOSITE:      solution_aware ALSO rendered with headline + body + CTA laid over it
 *
 * Why all five, not four. `unaware` is the LARGEST slice of the cold deck — awarenessPlanForCount(8)
 * returns unaware:3, problem_aware:3, solution_aware:1, product_aware:1 — and it has never once been
 * rendered. `most_aware` is the FIX-2 COLLISION FOIL: product_aware used to render as a head-on
 * portrait, which is most_aware's reserved PD-4 shape. If those two still look alike, Fix 2 failed.
 *
 * Why the composite. Fix 3's entire claim is that the finished ad's text clears the work surface.
 * That is a property of the COMPOSITED image, and the previous run only ever inspected raw pixels
 * and inferred the collision. Inference is not proof. The composite is rendered through the same
 * `renderAdCreative(..., zone: "lower")` the cascade uses (adCreativesGenerator.ts:624).
 *
 * WRITE SCOPE: ZERO DATABASE ROWS. Counts are asserted unchanged (405 / 2) at start and end.
 * Protected services 272-277 and 285 are never referenced.
 *
 * GATES: G1 routing · G2 rebuild marker · G3 isolation proven on strings BEFORE spending · G4 disk.
 */
import { writeFileSync, mkdirSync, existsSync, statSync, appendFileSync } from "fs";
import { resolve } from "path";

const STAMP = process.env.PROOF_STAMP || "run-2026-08-05-layer1-reprove";
const OUTDIR = resolve(process.cwd(), "docs/screenshots", STAMP);
const PROGRESS = resolve(OUTDIR, "_progress.log");
const log = (m: string) => { console.log(m); try { appendFileSync(PROGRESS, `${m}\n`); } catch {} };
const withTimeout = <T>(p: Promise<T>, ms: number, what: string): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT ${ms / 1000}s: ${what}`)), ms))]);

const STYLE = "person_intense";
const SUBTYPE = "grounded";
const NICHE = "career coaching";
const PROBLEM = "The year runs out before the plan ever starts";
const SUBJECT = "A woman in her late thirties";

const RUNS = [
  { label: "01-unaware", stage: "unaware" },
  { label: "02-problem_aware", stage: "problem_aware" },
  { label: "03-solution_aware", stage: "solution_aware" },
  { label: "04-product_aware", stage: "product_aware" },
  { label: "05-most_aware", stage: "most_aware" },
  { label: "06-solution_aware-CONTROL-repeat", stage: "solution_aware" },
];

(async () => {
  if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });
  const { getDb } = await import("../server/db");
  const schema: any = await import("../drizzle/schema");
  const db = await getDb();
  if (!db) throw new Error("no db");

  const { generateAdImagePrompt } = await import("../server/routers/adCreatives");
  const { rendererForStyle, generateImage } = await import("../server/_core/imageGeneration");
  const { renderAdCreative } = await import("../server/_core/compositeHeadline");

  // ── G1 ROUTING ──────────────────────────────────────────────────────────────
  const renderer = rendererForStyle(STYLE);
  log(`[G1] builder=generateAdImagePrompt (TABLOID) · renderer=${renderer} · editorial NOT imported`);
  if (renderer !== "flux-1.1-pro") throw new Error(`ABORT: expected flux-1.1-pro, got ${renderer}`);

  // ── G2 MARKER + the three amendments, asserted live ─────────────────────────
  const sol = generateAdImagePrompt(STYLE, "x", "y", false, undefined, "solution_aware", SUBTYPE);
  const prob = generateAdImagePrompt(STYLE, "x", "y", false, undefined, "problem_aware", SUBTYPE);
  const prod = generateAdImagePrompt(STYLE, "x", "y", false, undefined, "product_aware", SUBTYPE);
  const most = generateAdImagePrompt(STYLE, "x", "y", false, undefined, "most_aware", SUBTYPE);
  const checks: [string, boolean][] = [
    ["stage action leads the styling shell", sol.indexOf("laying plain cards") < sol.indexOf("Candid documentary photograph")],
    ["FIX 1 no distress shape in problem_aware", !/hand at the temple|head in hands|rubbing temples/i.test(prob) && /overtaken by the task/.test(prob)],
    ["FIX 2 product_aware is mid-demonstration", /mid-demonstration/.test(prod) && /off-camera/.test(prod)],
    ["FIX 2 product_aware ≠ most_aware direct address", !/faces the camera directly/.test(prod) && /faces the camera directly/.test(most)],
    ["FIX 3 focal work in middle band", /middle band of the frame/.test(sol)],
    ["FIX 3 foreground named as defocused", /falling softly out of focus/.test(sol)],
  ];
  for (const [name, ok] of checks) log(`[G2] ${ok ? "PASS" : "*** FAIL ***"}  ${name}`);
  if (checks.some(([, ok]) => !ok)) throw new Error("ABORT: an amendment is not present in this process.");

  // ── G3 ISOLATION, proven on strings before spending ─────────────────────────
  const prompts = RUNS.map((r) => generateAdImagePrompt(STYLE, NICHE, PROBLEM, false, SUBJECT, r.stage, SUBTYPE));
  const shells = prompts.map((p) => p.slice(p.indexOf("Candid documentary photograph")));
  const shots = prompts.map((p) => p.slice(0, p.indexOf("Candid documentary photograph")).trim());
  const shellsIdentical = new Set(shells).size === 1;
  const shotsDiffer = new Set(shots.slice(0, 5)).size === 5;
  const controlIdentical = shots[2] === shots[5];
  log(`[G3] styling half byte-identical across all 6 : ${shellsIdentical}`);
  log(`[G3] shot half differs across all 5 stages    : ${shotsDiffer}`);
  log(`[G3] control (img 3 vs 6) prompt-identical    : ${controlIdentical}`);
  if (!shellsIdentical || !shotsDiffer || !controlIdentical) throw new Error("ABORT: set is not controlled — refusing to spend.");
  log("\n[G3] the only thing that varies — each slot's shot half:");
  RUNS.forEach((r, i) => log(`  ${r.label}\n     ${shots[i].slice(0, 280)}…\n`));

  // ── PRE ─────────────────────────────────────────────────────────────────────
  const countOf = async (t: any) => (await db.select().from(t)).length;
  const preC = await countOf(schema.adCreatives);
  const preP = await countOf(schema.metaPublishedAds);
  log(`[PRE] adCreatives=${preC}  meta_published_ads=${preP}  (this script writes NO rows)`);

  // ── RENDER ──────────────────────────────────────────────────────────────────
  const saved: string[] = [];
  const rawBuffers = new Map<string, Buffer>();
  for (let i = 0; i < RUNS.length; i++) {
    const r = RUNS[i];
    let url: string | undefined;
    for (let a = 1; a <= 2 && !url; a++) {
      log(`\n[RUN] ${r.label} — rendering (attempt ${a}/2)…`);
      const t0 = Date.now();
      try {
        const res: any = await withTimeout(generateImage({ prompt: prompts[i], style: STYLE } as any), 180_000, r.label);
        url = res?.url;
        log(`[RUN] ${r.label} done in ${Math.round((Date.now() - t0) / 1000)}s`);
      } catch (e) { log(`[RUN] ${r.label} attempt ${a} FAILED — ${e instanceof Error ? e.message : String(e)}`); }
    }
    if (!url) { log(`[G4] ${r.label}: no image after 2 attempts`); continue; }
    try {
      const res = await fetch(url);
      if (!res.ok) { log(`[G4] ${r.label}: HTTP ${res.status}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const path = resolve(OUTDIR, `${r.label}.png`);
      writeFileSync(path, buf);
      if (statSync(path).size <= 0) { log(`[G4] ${r.label}: EMPTY`); continue; }
      rawBuffers.set(r.label, buf);
      saved.push(path);
      log(`[G4] saved ${r.label}.png  ${(statSync(path).size / 1024).toFixed(0)}KB`);
    } catch (e) { log(`[G4] ${r.label}: save FAILED — ${e instanceof Error ? e.message : String(e)}`); }
  }

  // ── COMPOSITE — Solution-Aware only. This is the ONLY way to prove Fix 3. ────
  const solRaw = rawBuffers.get("03-solution_aware");
  if (solRaw) {
    log("\n[COMPOSITE] laying headline + body + CTA over 03-solution_aware via renderAdCreative(zone:'lower')…");
    try {
      const composited = await renderAdCreative(solRaw, {
        headline: "Your next move, mapped in one sitting.",
        emphasis: "one sitting",
        bodyText: "A repeatable way to lay the year out on one surface, so the plan survives a normal working week.",
        ctaLabel: "Get the method",
        zone: "lower",
      });
      const cpath = resolve(OUTDIR, "03-solution_aware-COMPOSITED.png");
      writeFileSync(cpath, composited);
      saved.push(cpath);
      log(`[COMPOSITE] saved 03-solution_aware-COMPOSITED.png  ${(statSync(cpath).size / 1024).toFixed(0)}KB`);
      log("[COMPOSITE] ⚠️ JUDGE FIX 3 ON THIS FILE — does the type sit on clean, defocused surface?");
    } catch (e) { log(`[COMPOSITE] FAILED — ${e instanceof Error ? e.message : String(e)}`); }
  } else {
    log("\n[COMPOSITE] skipped — the solution_aware raw render is missing.");
  }

  log(`\n[G4] saved ${saved.length} files (${RUNS.length} raw + 1 composite expected) to ${OUTDIR}`);
  log(saved.length === RUNS.length + 1 ? "[G4] HARD GATE PASSED" : "[G4] *** HARD GATE FAILED — something is missing ***");

  // ── POST ────────────────────────────────────────────────────────────────────
  const postC = await countOf(schema.adCreatives);
  const postP = await countOf(schema.metaPublishedAds);
  log(`\n[POST] adCreatives=${postC} (pre ${preC}, delta ${postC - preC})`);
  log(`[POST] meta_published_ads=${postP} (pre ${preP}, delta ${postP - preP})`);
  log(postC === 405 && postC === preC && postP === preP
    ? "[POST] RECONCILED — adCreatives back at 405, zero writes, nothing to tear down."
    : "*** [POST] UNEXPECTED DELTA — investigate. ***");
  process.exit(0);
})().catch((e) => { log(`FATAL ${e instanceof Error ? e.message : e}`); process.exit(2); });
