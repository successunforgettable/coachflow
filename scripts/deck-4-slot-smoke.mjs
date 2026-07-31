/**
 * 4-SLOT DECK SMOKE — object-slot retirement, 2026-08-01.
 *
 * Proves the surviving deck still renders end to end after the arity change.
 * One niche, all four surviving styles, one render each.
 *
 * WHAT THIS PROVES that the unit tests do not: that a real render still comes
 * back for every slot in the shortened deck, with the renderer chosen by the
 * real `rendererForStyle` — i.e. that `screenshot` is still on gpt-image-1 and
 * the three person slots are still on Flux after `object` left STILL_LIFE_STYLES.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not call `generateImage()`, because
 * that helper calls `storagePut` and would create Cloudinary objects needing
 * teardown. Provider APIs are called directly and PNGs are written to disk, so
 * this touches no prod row, uploads nothing, and leaves nothing to sweep —
 * the same pattern as scripts/object-slot-l5-confirm.mjs.
 *
 *   railway run --environment production --service coachflow \
 *     npx tsx scripts/deck-4-slot-smoke.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import Replicate from "replicate";
import { generateAdImagePrompt } from "../server/routers/adCreatives.ts";
import { AD_VARIATIONS } from "../server/_core/adVariations.ts";
import { rendererForStyle } from "../server/_core/imageGeneration.ts";

const OUT = "docs/screenshots/run-2026-08-01-deck4-smoke";
mkdirSync(OUT, { recursive: true });

const NICHE = "leadership";
const PROBLEM =
  "They have done three StrengthsFinder assessments, updated their LinkedIn headline, " +
  "and read every careers book on the shelf, and still cannot answer what they want next.";
const SUBJECT = "A woman aged 38-46";

// A run that silently measured a stale deck would read as a pass and be worse
// than no run at all. Assert the retirement before spending a cent.
if (AD_VARIATIONS.length !== 4) {
  console.error(`ABORT: deck is ${AD_VARIATIONS.length}, expected 4.`);
  process.exit(1);
}
if (AD_VARIATIONS.some((v) => v.style === "object")) {
  console.error("ABORT: object slot still present in AD_VARIATIONS.");
  process.exit(1);
}
console.log(`[deck = ${AD_VARIATIONS.map((v) => v.style).join(", ")}]\n`);

async function renderOpenAI(prompt) {
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", quality: "medium", n: 1 }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const b64 = (await r.json())?.data?.[0]?.b64_json;
  if (!b64) throw new Error("no b64_json");
  return Buffer.from(b64, "base64");
}

async function renderFlux(prompt) {
  // REPLICATE_API_KEY, not the SDK's default REPLICATE_API_TOKEN — matches
  // _core/env.ts, which is what the real generateImage() reads.
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_KEY });
  const out = await replicate.run("black-forest-labs/flux-1.1-pro", {
    input: {
      prompt,
      aspect_ratio: "1:1",
      output_format: "png",
      output_quality: 90,
      safety_tolerance: 2,
      prompt_upsampling: false,
    },
  });
  const url = typeof out === "string" ? out : (out?.url?.() ?? out?.[0]);
  const res = await fetch(String(url));
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const results = [];
let n = 0;

for (const v of AD_VARIATIONS) {
  n++;
  const renderer = rendererForStyle(v.style, "1:1");
  const prompt = generateAdImagePrompt(v.style, NICHE, PROBLEM, false, SUBJECT);
  const label = `${String(n).padStart(2, "0")}__${v.style}__${renderer}`;
  try {
    const buf = renderer === "gpt-image-1" ? await renderOpenAI(prompt) : await renderFlux(prompt);
    writeFileSync(path.join(OUT, `${label}.png`), buf);
    results.push({ slot: n, style: v.style, formula: v.formula, renderer, ok: true });
    console.log(`[${n}/${AD_VARIATIONS.length}] OK   ${label}`);
  } catch (e) {
    results.push({ slot: n, style: v.style, formula: v.formula, renderer, ok: false, error: String(e.message ?? e) });
    console.log(`[${n}/${AD_VARIATIONS.length}] FAIL ${label} — ${e.message}`);
  }
}

writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} rendered -> ${OUT}`);
