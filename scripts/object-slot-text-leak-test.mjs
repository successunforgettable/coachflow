/**
 * OBJECT-SLOT TEXT-LEAK TEST (P6d, L1–L4).
 *
 * The Step D live render put a wall sign reading "COACHING" into the object slot,
 * sharp and centred above the composited headline. This measures whether the
 * structural fix removed it.
 *
 * Calls the REAL generateAdImagePrompt — never a copy — so what is measured is
 * what ships. LOCAL ONLY: writes PNGs to disk, touches no prod row, uploads
 * nothing to Cloudinary, so there is nothing to tear down.
 *
 * Sampling honesty: 24 clean renders bound the leak rate below ~12.5% at 95%
 * confidence (rule of three). They do NOT prove zero. The structural layers are
 * what make the slot clean; this only checks the cause is actually gone.
 *
 * Niches are weighted to the WORST case — abstract service niches with no
 * physical vocabulary, which is precisely what made the model reach for signage.
 * Two prop-rich controls confirm the fix has not destroyed niche relevance.
 *
 *   railway run --environment production --service coachflow \
 *     npx tsx scripts/object-slot-text-leak-test.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { generateAdImagePrompt } from "../server/routers/adCreatives.ts";

const OUT = "docs/screenshots/run-2026-07-31-objectleak";
mkdirSync(OUT, { recursive: true });

// 4 abstract/propless (the failure mode) + 2 prop-rich controls.
const NICHES = [
  { slug: "coaching", niche: "coaching", abstract: true },
  { slug: "mindset", niche: "mindset", abstract: true },
  { slug: "leadership", niche: "leadership", abstract: true },
  { slug: "career-pivot", niche: "career-pivot", abstract: true },
  { slug: "fitness", niche: "fitness", abstract: false },
  { slug: "dog-training", niche: "dog training", abstract: false },
];
const RENDERS_PER_NICHE = 4;

// A problem string carrying text-bearing artefacts — the second vector L3 removed.
// Passed in deliberately: if L3 holds, none of this reaches the image.
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

const results = [];
let n = 0;
const total = NICHES.length * RENDERS_PER_NICHE + NICHES.length; // objects + screenshot controls

for (const { slug, niche, abstract } of NICHES) {
  const prompt = generateAdImagePrompt("object", niche, PROBLEM);
  for (let i = 1; i <= RENDERS_PER_NICHE; i++) {
    const label = `object__${slug}__${i}`;
    n++;
    try {
      const buf = await renderOpenAI(prompt);
      writeFileSync(path.join(OUT, `${label}.png`), buf);
      results.push({ label, slug, abstract, style: "object", ok: true });
      console.log(`[${n}/${total}] OK   ${label}`);
    } catch (e) {
      results.push({ label, slug, abstract, style: "object", ok: false, error: String(e.message ?? e) });
      console.log(`[${n}/${total}] FAIL ${label} — ${e.message}`);
    }
  }
}

// L4 changed the screenshot slot's compliance note too (it was person-worded on a
// person-free style). That slot PASSED in Step D, so one control render per niche
// confirms the change did not regress it. Not shipping an unverified pixel change.
for (const { slug, niche } of NICHES) {
  const prompt = generateAdImagePrompt("screenshot", niche, PROBLEM);
  const label = `screenshot-control__${slug}`;
  n++;
  try {
    const buf = await renderOpenAI(prompt);
    writeFileSync(path.join(OUT, `${label}.png`), buf);
    results.push({ label, slug, style: "screenshot", ok: true });
    console.log(`[${n}/${total}] OK   ${label}`);
  } catch (e) {
    results.push({ label, slug, style: "screenshot", ok: false, error: String(e.message ?? e) });
    console.log(`[${n}/${total}] FAIL ${label} — ${e.message}`);
  }
}

writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} rendered -> ${OUT}`);
console.log("Every render must now be opened and eyeballed. Any text of any kind = failure.");
