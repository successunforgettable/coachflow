/**
 * LOCAL render proof for the hybrid image switch + the negation sweep.
 *
 * Renders BOTH prompt paths and composites each through the REAL compositor, so
 * the output shows the plate AND the scrim over it — which is what actually
 * needs judging, since compositeHeadline paints a fixed #0A0A0E scrim and never
 * inspects plate brightness.
 *
 *   tabloid   — all 5 slots via the real generateAdImagePrompt, model chosen by
 *               the real rendererForStyle (2 still lifes → gpt-image-1)
 *   editorial — all 5 slots via the real buildEditorialPrompt on flux-2-pro
 *
 * WRITES NOTHING TO PROD. No DB row, no Cloudinary object, no storagePut — the
 * model calls are made directly here rather than through generateImage, and the
 * PNGs land on local disk. There is nothing to tear down.
 *
 *   railway run --environment production --service coachflow \
 *     npx tsx scripts/render-proof-hybrid.mjs --out=docs/screenshots/run-2026-07-30-hybrid
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import Replicate from "replicate";
import { generateAdImagePrompt } from "../server/routers/adCreatives.ts";
import { buildEditorialPrompt, EDITORIAL_VARIATIONS, variationToScene } from "../server/_core/editorialPrompt.ts";
import { rendererForStyle } from "../server/_core/imageGeneration.ts";
import { AD_VARIATIONS } from "../server/_core/adVariations.ts";
import { renderAdCreative } from "../server/_core/compositeHeadline.ts";

const arg = (n, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${n}=`));
  return m ? m.slice(n.length + 3) : d;
};
const OUT = arg("out", "docs/screenshots/run-2026-07-30-hybrid");
mkdirSync(OUT, { recursive: true });

// A real coach-shaped brief. Deliberately a niche whose obvious prop is a
// text-bearing one (pipeline / calendar / dashboard), because that is precisely
// where gpt-image-1's better comprehension became a text liability.
const NICHE = "burnt-out sales managers at mid-market SaaS companies";
const PROBLEM =
  "They inherited a team that has missed target three quarters running and cannot tell whether it is the people or the pipeline.";
const SUBJECT = "A woman in her late thirties";
const HEADLINES = [
  "THE PIPELINE ISN'T THE PROBLEM",
  "THREE QUARTERS DOWN. NOW WHAT?",
  "WHY YOUR BEST REP IS STALLING",
  "40 HOURS OF FORECASTING. FOUR.",
  "STILL RUNNING MONDAY STANDUPS?",
];
const BODY = [
  "You've rebuilt the forecast twice and it still slips.",
  "The team hits activity targets and misses revenue.",
  "You know which deals are real. The board doesn't.",
];

const replicate = new Replicate({ auth: process.env.REPLICATE_API_KEY });

async function flux(model, prompt, aspect = "1:1") {
  const out = await replicate.run(model, {
    input: {
      prompt,
      aspect_ratio: aspect,
      output_format: "png",
      output_quality: 90,
      safety_tolerance: 2,
      ...(model.includes("flux-1.1-pro") ? { prompt_upsampling: false } : {}),
    },
  });
  const first = Array.isArray(out) ? out[0] : out;
  const url = typeof first === "string" ? first : typeof first?.url === "function" ? first.url() : first?.url;
  if (!url) throw new Error("no URL from Replicate");
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function openai(prompt) {
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", quality: "medium", n: 1 }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error("no b64_json");
  return Buffer.from(b64, "base64");
}

const results = [];

async function emit(label, prompt, renderer, zone, headline, body) {
  const t0 = Date.now();
  try {
    const plate =
      renderer === "gpt-image-1"
        ? await openai(prompt)
        : await flux(renderer === "flux-2-pro" ? "black-forest-labs/flux-2-pro" : "black-forest-labs/flux-1.1-pro", prompt);
    const genMs = Date.now() - t0;
    writeFileSync(path.join(OUT, `${label}__raw.png`), plate);
    // The REAL compositor, at the REAL zone — this is the half that judges
    // whether the new plates survive the scrim.
    const composited = await renderAdCreative(plate, { headline, bodyText: body, ctaLabel: "Get the playbook", zone });
    writeFileSync(path.join(OUT, `${label}__composited.png`), composited);
    results.push({ label, renderer, zone, genMs, totalMs: Date.now() - t0, ok: true });
    console.log(`OK   ${label.padEnd(34)} ${renderer.padEnd(14)} zone=${String(zone).padEnd(7)} ${(genMs / 1000).toFixed(1)}s`);
  } catch (e) {
    results.push({ label, renderer, zone, ok: false, error: String(e.message ?? e) });
    console.log(`FAIL ${label.padEnd(34)} ${renderer} — ${e.message}`);
  }
}

console.log("── TABLOID (hybrid: still lifes on gpt-image-1, people on flux-1.1-pro) ──");
for (let i = 0; i < AD_VARIATIONS.length; i++) {
  const v = AD_VARIATIONS[i];
  const prompt = generateAdImagePrompt(v.style, NICHE, PROBLEM, false, SUBJECT);
  const renderer = rendererForStyle(v.style, "1:1");
  await emit(`tabloid-${i + 1}-${v.style}`, prompt, renderer, "lower", HEADLINES[i], BODY[i % BODY.length]);
}

console.log("\n── EDITORIAL (flux-2-pro, negation sweep) ──");
for (let i = 0; i < EDITORIAL_VARIATIONS.length; i++) {
  const v = EDITORIAL_VARIATIONS[i];
  const scene = variationToScene(v);
  const prompt = buildEditorialPrompt(scene, NICHE);
  await emit(`editorial-${i + 1}-${v.key}`, prompt, "flux-2-pro", scene.zone, HEADLINES[i], BODY[i % BODY.length]);
}

writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
const ok = results.filter((r) => r.ok);
console.log(`\n${ok.length}/${results.length} rendered → ${OUT}`);
for (const r of results.filter((x) => !x.ok)) console.log(`  FAILED: ${r.label} — ${r.error}`);
