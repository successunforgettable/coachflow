/**
 * Ad-image render harness — fix-C proof + model bake-off.
 *
 * Calls the REAL generateAdImagePrompt from server/routers/adCreatives.ts (never
 * a copy — a copied prompt would test the copy, per CLAUDE.md §15a's lesson) and
 * renders the 5 tabloid styles on one or more providers, recording per-call
 * latency. Writes PNGs + a JSON result sheet to the output dir.
 *
 * Local-only: writes to disk, touches no ZAP storage, DB or prod row.
 *
 *   railway run --environment production --service coachflow \
 *     npx tsx scripts/adimage-bakeoff.mjs --models=flux-1.1-pro --out=docs/screenshots/run-2026-07-29-fixC
 *
 * Models: flux-1.1-pro (Replicate) | gpt-image-1 | gpt-image-1-mini (OpenAI)
 */
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import Replicate from "replicate";
import { generateAdImagePrompt } from "../server/routers/adCreatives.ts";

const arg = (n, d) => {
  const m = process.argv.find(a => a.startsWith(`--${n}=`));
  return m ? m.slice(n.length + 3) : d;
};
const OUT = path.resolve(arg("out", "docs/screenshots/adimage-bakeoff"));
const MODELS = arg("models", "flux-1.1-pro").split(",").map(s => s.trim()).filter(Boolean);
const QUALITY = arg("quality", "medium");
mkdirSync(OUT, { recursive: true });

// ── The real ZAP inputs from the 2026-07-28 beginner run (service 282 / ICP 259,
//    "Exhausted First-Time Parents"). That service row was torn down, so `niche`
//    and `problem` are RECONSTRUCTED from the ICP dump in
//    RUN_2026-07-28_artifacts-full.txt. Never generic test prompts.
const NICHE = "first-time parents of babies aged 4-12 months who are exhausted by night waking";
const PROBLEM =
  "Baby feeds to sleep every night and wakes every two hours; the parent has tried wake windows, " +
  "sleep sacks, white noise and dream feeds and nothing holds for more than three nights.";

const STYLES = ["person_shocked", "screenshot", "person_intense", "object", "person_curious"];

async function renderReplicate(prompt) {
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_KEY });
  const out = await replicate.run("black-forest-labs/flux-1.1-pro", {
    input: {
      prompt,
      aspect_ratio: "1:1",
      output_format: "png",
      output_quality: 90,
      safety_tolerance: 2,
      // Mirrors server/_core/imageGeneration.ts after fix C.
      prompt_upsampling: false,
    },
  });
  const first = Array.isArray(out) ? out[0] : out;
  const url = typeof first === "string" ? first : (typeof first?.url === "function" ? first.url() : first?.url);
  if (!url) throw new Error("Replicate returned no URL");
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function renderOpenAI(prompt, model) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set — cannot run the OpenAI half of the bake-off");
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, size: "1024x1024", quality: QUALITY, n: 1 }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no b64_json");
  return Buffer.from(b64, "base64");
}

const results = [];
for (const model of MODELS) {
  for (let i = 0; i < STYLES.length; i++) {
    const style = STYLES[i];
    const prompt = generateAdImagePrompt(style, NICHE, PROBLEM);
    const label = `${model}__v${i + 1}-${style}`;
    const t0 = Date.now();
    try {
      const buf = model === "flux-1.1-pro"
        ? await renderReplicate(prompt)
        : await renderOpenAI(prompt, model);
      const ms = Date.now() - t0;
      const file = path.join(OUT, `${label}.png`);
      writeFileSync(file, buf);
      results.push({ model, style, variation: i + 1, ms, bytes: buf.length, ok: true });
      console.log(`OK   ${label}  ${(ms / 1000).toFixed(1)}s  ${(buf.length / 1024).toFixed(0)}KB`);
    } catch (e) {
      const ms = Date.now() - t0;
      results.push({ model, style, variation: i + 1, ms, ok: false, error: String(e.message ?? e) });
      console.log(`FAIL ${label}  ${(ms / 1000).toFixed(1)}s  ${e.message}`);
    }
  }
}

// Latency summary per model — the axis the investigation left unmeasured.
const summary = {};
for (const m of MODELS) {
  const rs = results.filter(r => r.model === m && r.ok).map(r => r.ms).sort((a, b) => a - b);
  summary[m] = rs.length
    ? { n: rs.length, medianMs: rs[Math.floor(rs.length / 2)], minMs: rs[0], maxMs: rs[rs.length - 1],
        meanMs: Math.round(rs.reduce((a, b) => a + b, 0) / rs.length) }
    : { n: 0 };
}
writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ niche: NICHE, problem: PROBLEM, results, summary }, null, 2));
console.log("\nLATENCY", JSON.stringify(summary));
console.log(`\nWrote ${results.filter(r => r.ok).length}/${results.length} images to ${OUT}`);
