/**
 * OBJECT-SLOT L5 — CONFIRMATION BATCH.
 *
 * NO CODE CHANGE. This measures the SAME L5 prompt as
 * scripts/object-slot-l5-test.mjs, pointed at the worst case instead of spread
 * across six niches.
 *
 * WHY THESE TWO NICHES. `leadership` and `mindset` are the only niches that
 * actually leaked in the L1–L4 run (a cast "L" on a plinth engraved
 * "LEADERSHIP"; a block with "MINDSET" embossed), and in the first L5 batch
 * `leadership` selected a trophy-on-a-plinth in 4/4 renders — i.e. it reliably
 * summons the object class that conventionally carries engraving. Pointing 24
 * renders at those two is a harder test than spreading them thin over six.
 *
 * Batch 1 (6 niches × 4) was 24/24 clean. Cumulative across both batches gives
 * 48 renders against one unchanged prompt, which is what tightens the bound:
 * rule of three puts 0/48 under ~6% at 95% confidence, versus ~12.5% at n=24.
 *
 * Same model, size, quality and problem string as batch 1 so the two are
 * poolable. LOCAL ONLY: writes PNGs to disk, touches no prod row, uploads
 * nothing to Cloudinary, so there is nothing to tear down.
 *
 *   railway run --environment production --service coachflow \
 *     npx tsx scripts/object-slot-l5-confirm.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { generateAdImagePrompt } from "../server/routers/adCreatives.ts";

const OUT = "docs/screenshots/run-2026-07-31-objectleak-L5-confirm";
mkdirSync(OUT, { recursive: true });

// The two trophy-prone abstract niches, 12 each.
const NICHES = [
  { slug: "leadership", niche: "leadership", renders: 12 },
  { slug: "mindset", niche: "mindset", renders: 12 },
];

// Identical to batch 1 — keeps the two batches poolable.
const PROBLEM =
  "They have done three StrengthsFinder assessments, updated their LinkedIn headline, " +
  "and read every careers book on the shelf, and still cannot answer what they want next.";

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

// A run that silently measured the OLD prompt would read as a clean result and
// be worse than no run at all. Abort rather than produce a misleading number.
const marker = "worked smooth and continuous";
for (const { niche } of NICHES) {
  if (!generateAdImagePrompt("object", niche, PROBLEM).includes(marker)) {
    console.error(`ABORT: "${niche}" object prompt lacks the L5 clause ("${marker}").`);
    process.exit(1);
  }
}
console.log(`[L5 marker present on both niches] measuring the L5 prompt.\n`);

const results = [];
let n = 0;
const total = NICHES.reduce((a, x) => a + x.renders, 0);

for (const { slug, niche, renders } of NICHES) {
  const prompt = generateAdImagePrompt("object", niche, PROBLEM);
  for (let i = 1; i <= renders; i++) {
    const label = `object__${slug}__${String(i).padStart(2, "0")}`;
    n++;
    try {
      const buf = await renderOpenAI(prompt);
      writeFileSync(path.join(OUT, `${label}.png`), buf);
      results.push({ label, slug, style: "object", ok: true });
      console.log(`[${n}/${total}] OK   ${label}`);
    } catch (e) {
      results.push({ label, slug, style: "object", ok: false, error: String(e.message ?? e) });
      console.log(`[${n}/${total}] FAIL ${label} — ${e.message}`);
    }
  }
}

writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} rendered -> ${OUT}`);
console.log("Every render must now be opened and eyeballed at full size. Any lettering = leak.");
