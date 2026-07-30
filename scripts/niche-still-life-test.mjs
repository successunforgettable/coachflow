/**
 * Cross-niche still-life test — does the model pick objects that belong to the
 * coach's world, or generic props?
 *
 * Narrow by design: only the two styles where the bake-off gap appeared
 * (`object`, `screenshot`), flux-1.1-pro vs gpt-image-1 medium. Mini is dropped —
 * it is slower than full at medium, so it has no lane.
 *
 * ONE process for the whole matrix. The first attempt shelled out per niche and
 * paid ~45s of `railway run` startup twelve times over while 16 tsx processes
 * contended; that was the bottleneck, not the APIs.
 *
 * Local only: writes PNGs to disk. No DB rows, no Cloudinary, nothing to tear down.
 *
 *   railway run --environment production --service coachflow \
 *     npx tsx scripts/niche-still-life-test.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import Replicate from "replicate";
import { generateAdImagePrompt } from "../server/routers/adCreatives.ts";

const OUT = path.resolve("docs/screenshots/run-2026-07-30-niches");
mkdirSync(OUT, { recursive: true });

const NICHES = [
  ["fitness", "women over 40 rebuilding strength after years away from the gym",
   "They start a programme every January, get sore, lose two weeks to a tweaked back and stop by February."],
  ["b2b", "B2B software founders whose sales pipeline stalls after the first call",
   "Discovery calls go well and then nothing moves; deals sit for months with no clear reason."],
  ["perimenopause", "women in perimenopause struggling with broken sleep and flat energy",
   "They wake at 3am most nights, run on caffeine, and have been told their bloods are normal."],
  ["photography", "portrait photographers who cannot fill their booking calendar",
   "Their work is good but enquiries are sporadic and they discount to fill gaps."],
  ["dogs", "owners of reactive dogs who dread every walk",
   "Their dog lunges and barks at other dogs, so they walk at 6am to avoid everyone and feel isolated."],
  ["piano", "adult beginners learning piano who quit around month three",
   "They practise inconsistently, plateau on playing with both hands, and decide they are not musical."],
];
const STYLES = ["object", "screenshot"];
const MODELS = ["flux-1.1-pro", "gpt-image-1"];

const replicate = new Replicate({ auth: process.env.REPLICATE_API_KEY });

async function renderFlux(prompt) {
  const out = await replicate.run("black-forest-labs/flux-1.1-pro", {
    input: { prompt, aspect_ratio: "1:1", output_format: "png", output_quality: 90,
             safety_tolerance: 2, prompt_upsampling: false },
  });
  const first = Array.isArray(out) ? out[0] : out;
  const url = typeof first === "string" ? first : (typeof first?.url === "function" ? first.url() : first?.url);
  if (!url) throw new Error("no URL from Replicate");
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function renderOpenAI(prompt) {
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
for (const [slug, niche, problem] of NICHES) {
  for (const style of STYLES) {
    for (const model of MODELS) {
      // Still-life styles never interpolate a subject clause, so none is passed.
      const prompt = generateAdImagePrompt(style, niche, problem);
      const label = `${slug}__${style}__${model}`;
      const t0 = Date.now();
      try {
        const buf = model === "flux-1.1-pro" ? await renderFlux(prompt) : await renderOpenAI(prompt);
        const ms = Date.now() - t0;
        writeFileSync(path.join(OUT, `${label}.png`), buf);
        results.push({ slug, style, model, ms, ok: true });
        console.log(`OK   ${label}  ${(ms / 1000).toFixed(1)}s`);
      } catch (e) {
        results.push({ slug, style, model, ms: Date.now() - t0, ok: false, error: String(e.message ?? e) });
        console.log(`FAIL ${label}  ${e.message}`);
      }
    }
  }
}

const summary = {};
for (const m of MODELS) {
  const rs = results.filter(r => r.model === m && r.ok).map(r => r.ms).sort((a, b) => a - b);
  summary[m] = rs.length ? { n: rs.length, medianMs: rs[Math.floor(rs.length / 2)] } : { n: 0 };
}
writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ NICHES, results, summary }, null, 2));
console.log("\nLATENCY " + JSON.stringify(summary));
console.log(`WROTE ${results.filter(r => r.ok).length}/${results.length}`);
process.exit(0);
