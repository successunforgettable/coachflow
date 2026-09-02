/**
 * CONTROLLED RE-PROVE AT PRODUCTION RATIO — 4:5 (2026-08-06).
 *
 *   HELD CONSTANT:  style (person_intense) · sub-type (grounded) · subject · niche · problem · 4:5
 *   VARIED:         awareness stage — all five
 *   CONTROL:        solution_aware rendered twice (diffusion-noise yardstick)
 *   COMPOSITED:     EVERY stage, with real headline + body + CTA — Fix 3 can only be judged finished
 *   SEVENTH:        the still-life `screenshot` slot — FIRST PIXELS EVER on that path
 *
 * The still life is deliberately OUTSIDE the controlled set: different model (gpt-image-1), different
 * prompt shell, and its own crop step. Folding it in would confound the stage comparison.
 *
 * CROP DIRECTION IS NOT SETTLED HERE. gpt-image-1 cannot emit 4:5, so it renders its legal 2:3
 * (1024x1536) and is cropped to 1024x1280. ONE render produces BOTH candidate crops so the call is
 * made on pixels, at no extra spend.
 *
 * WRITE SCOPE: ZERO DATABASE ROWS. adCreatives asserted 405 at start and end.
 * GATES: G1 routing · G2 markers · G3 styling byte-identical BEFORE spend · G4 disk.
 */
import { writeFileSync, mkdirSync, existsSync, statSync, appendFileSync } from "fs";
import { resolve } from "path";

const STAMP = process.env.PROOF_STAMP || "run-2026-08-06-layer3-verify";
const OUTDIR = resolve(process.cwd(), "docs/screenshots", STAMP);
const log = (m: string) => { console.log(m); try { appendFileSync(resolve(OUTDIR, "_progress.log"), `${m}\n`); } catch {} };
const withTimeout = <T>(p: Promise<T>, ms: number, what: string): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT ${ms / 1000}s: ${what}`)), ms))]);

const STYLE = "person_intense";
const STILL_STYLE = "screenshot";
const SUBTYPE = "grounded";
const RATIO = "4:5";
const NICHE = "career coaching";
const PROBLEM = "The year runs out before the plan ever starts";
const SUBJECT = "A woman in her late thirties";

// RE-VERIFY PASS: only the two slots whose behaviour the two changes could have altered.
// The other four stages were proven at 4:5 in run-2026-08-06-layer3-45 and are unaffected by a
// crop-direction flip (person path is never cropped) — re-rendering them would be spend for nothing.
const RUNS = [
  { label: "01-solution_aware-PERSON", stage: "solution_aware" },
  { label: "02-solution_aware-CONTROL-repeat", stage: "solution_aware" },
];

const COPY = {
  headline: "Your next move, mapped in one sitting.",
  emphasis: "one sitting",
  bodyText: "A repeatable way to lay the year out on one surface, so the plan survives a normal working week.",
  ctaLabel: "Get the method",
  zone: "lower" as const,
};

(async () => {
  if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });
  const { getDb } = await import("../server/db");
  const schema: any = await import("../drizzle/schema");
  const db = await getDb();
  if (!db) throw new Error("no db");

  const { generateAdImagePrompt } = await import("../server/routers/adCreatives");
  const { rendererForStyle, generateImage, openAiPlanFor, emittedCanvasFor } = await import("../server/_core/imageGeneration");
  const { renderAdCreative, textSafeZoneFor, reservedBandWording } = await import("../server/_core/compositeHeadline");

  // ── G1 ROUTING ──────────────────────────────────────────────────────────────
  const rPerson = rendererForStyle(STYLE, RATIO);
  const rStill = rendererForStyle(STILL_STYLE, RATIO);
  log(`[G1] person '${STYLE}' @${RATIO} -> ${rPerson}`);
  log(`[G1] still  '${STILL_STYLE}' @${RATIO} -> ${rStill}   (must stay gpt-image-1: the bake-off model)`);
  log(`[G1] gpt-image-1 plan @${RATIO}: ${JSON.stringify(openAiPlanFor(RATIO))}`);
  if (rPerson !== "flux-1.1-pro") throw new Error(`ABORT: person path routed to ${rPerson}`);
  if (rStill !== "gpt-image-1") throw new Error(`ABORT: still life fell off gpt-image-1 -> ${rStill}`);

  // ── G2 MARKERS ──────────────────────────────────────────────────────────────
  // Key off the EMITTED canvas per renderer — the whole point of the 2026-08-06 change. The first
  // version of this gate used the nominal 1024x1280 for both paths and correctly ABORTED the run.
  const [pw, ph] = emittedCanvasFor(STYLE, RATIO);
  const [sw, sh] = emittedCanvasFor(STILL_STYLE, RATIO);
  const z = textSafeZoneFor(pw, ph);
  const band = reservedBandWording(pw, ph);
  const stillBand = reservedBandWording(sw, sh);
  log(`[G2] person path emits ${pw}x${ph} -> reserved ${z.reservedFrac.toFixed(4)} -> "${band}"`);
  log(`[G2] still  path emits ${sw}x${sh} -> "${stillBand}"  (differs: ${band !== stillBand})`);
  const sol = generateAdImagePrompt(STYLE, "x", "y", false, undefined, "solution_aware", SUBTYPE, RATIO);
  const prob = generateAdImagePrompt(STYLE, "x", "y", false, undefined, "problem_aware", SUBTYPE, RATIO);
  const prod = generateAdImagePrompt(STYLE, "x", "y", false, undefined, "product_aware", SUBTYPE, RATIO);
  const most = generateAdImagePrompt(STYLE, "x", "y", false, undefined, "most_aware", SUBTYPE, RATIO);
  const checks: [string, boolean][] = [
    ["stage action leads the styling shell", sol.indexOf("laying plain cards") < sol.indexOf("Candid documentary photograph")],
    ["FIX 1 no distress shape", !/hand at the temple|head in hands|rubbing temples/i.test(prob) && /overtaken by the task/.test(prob)],
    ["FIX 2 product_aware mid-demonstration", /mid-demonstration/.test(prod)],
    ["FIX 2 product_aware ≠ most_aware direct address", !/faces the camera directly/.test(prod) && /faces the camera directly/.test(most)],
    ["FIX 3 prompt quotes the COMPOSITOR's band", sol.includes(band)],
    ["FIX 3 still-life band keys off ITS OWN emitted canvas", generateAdImagePrompt(STILL_STYLE, "x", "y", false, undefined, "problem_aware", SUBTYPE, RATIO).includes(stillBand)],
  ];
  for (const [n, ok] of checks) log(`[G2] ${ok ? "PASS" : "*** FAIL ***"}  ${n}`);
  if (checks.some(([, ok]) => !ok)) throw new Error("ABORT: a marker is absent.");

  // ── G3 ISOLATION ────────────────────────────────────────────────────────────
  const prompts = RUNS.map((r) => generateAdImagePrompt(STYLE, NICHE, PROBLEM, false, SUBJECT, r.stage, SUBTYPE, RATIO));
  const shells = prompts.map((p) => p.slice(p.indexOf("Candid documentary photograph")));
  const shots = prompts.map((p) => p.slice(0, p.indexOf("Candid documentary photograph")).trim());
  const ok3 = new Set(shells).size === 1 && shots[0] === shots[1];
  log(`[G3] styling byte-identical: ${new Set(shells).size === 1} · control prompt-identical: ${shots[0] === shots[1]}`);
  if (!ok3) throw new Error("ABORT: set is not controlled — refusing to spend.");

  const preC = (await db.select().from(schema.adCreatives)).length;
  const preP = (await db.select().from(schema.metaPublishedAds)).length;
  log(`[PRE] adCreatives=${preC}  meta_published_ads=${preP}  (zero rows written by this script)`);

  const saved: string[] = [];
  const save = (name: string, buf: Buffer) => {
    const path = resolve(OUTDIR, name);
    writeFileSync(path, buf);
    if (statSync(path).size > 0) { saved.push(path); log(`[G4] saved ${name}  ${(statSync(path).size / 1024).toFixed(0)}KB`); }
  };

  // ── THE FIVE STAGES + CONTROL, each raw AND composited ──────────────────────
  for (let i = 0; i < RUNS.length; i++) {
    const r = RUNS[i];
    let url: string | undefined;
    for (let a = 1; a <= 2 && !url; a++) {
      log(`\n[RUN] ${r.label} @${RATIO} (attempt ${a}/2)…`);
      const t0 = Date.now();
      try {
        const res: any = await withTimeout(generateImage({ prompt: prompts[i], style: STYLE, aspectRatio: RATIO } as any), 180_000, r.label);
        url = res?.url;
        log(`[RUN] ${r.label} done in ${Math.round((Date.now() - t0) / 1000)}s`);
      } catch (e) { log(`[RUN] ${r.label} attempt ${a} FAILED — ${e instanceof Error ? e.message : String(e)}`); }
    }
    if (!url) { log(`[G4] ${r.label}: no image`); continue; }
    const raw = Buffer.from(await (await fetch(url)).arrayBuffer());
    const sharp = (await import("sharp")).default;
    const m = await sharp(raw).metadata();
    log(`[DIM] ${r.label} rendered ${m.width}x${m.height} (ratio ${(m.width! / m.height!).toFixed(3)}, 4:5 = 0.800)`);
    save(`${r.label}.png`, raw);
    try { save(`${r.label}-COMPOSITED.png`, await renderAdCreative(raw, COPY)); }
    catch (e) { log(`[COMPOSITE] ${r.label} FAILED — ${e instanceof Error ? e.message : String(e)}`); }
  }

  // ── SEVENTH: the still life. First pixels this path has ever had. ───────────
  log(`\n[STILL] rendering '${STILL_STYLE}' on gpt-image-1 — FIRST EVER render of this slot`);
  const stillPrompt = generateAdImagePrompt(STILL_STYLE, NICHE, PROBLEM, false, undefined, "problem_aware", SUBTYPE, RATIO);
  try {
    const res: any = await withTimeout(generateImage({ prompt: stillPrompt, style: STILL_STYLE, aspectRatio: RATIO } as any), 240_000, "still");
    if (res?.url) {
      const stillBuf = Buffer.from(await (await fetch(res.url)).arrayBuffer());
      const sharp = (await import("sharp")).default;
      const m = await sharp(stillBuf).metadata();
      log(`[STILL] delivered ${m.width}x${m.height} (already cropped by generateImage)`);
      save("07-still-screenshot-problem_aware.png", stillBuf);
      save("07-still-screenshot-COMPOSITED.png", await renderAdCreative(stillBuf, COPY));
    } else log("[STILL] no URL returned");
  } catch (e) { log(`[STILL] FAILED — ${e instanceof Error ? e.message : String(e)}`); }

  log("\n[CROP] direction SETTLED — DEFAULT_CROP_DIRECTION is now 'bottom' (crop B). The still life");
  log("[CROP]   above was produced through it, so 07 IS the B crop, composited.");

  log(`\n[G4] saved ${saved.length} files to ${OUTDIR}`);
  const postC = (await db.select().from(schema.adCreatives)).length;
  const postP = (await db.select().from(schema.metaPublishedAds)).length;
  log(`[POST] adCreatives=${postC} (pre ${preC}, delta ${postC - preC}) · meta_published_ads=${postP} (delta ${postP - preP})`);
  log(postC === 405 && postC === preC && postP === preP
    ? "[POST] RECONCILED — 405, zero writes, nothing to tear down."
    : "*** [POST] UNEXPECTED DELTA ***");
  process.exit(0);
})().catch((e) => { log(`FATAL ${e instanceof Error ? e.message : e}`); process.exit(2); });
