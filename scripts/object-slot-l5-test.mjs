/**
 * OBJECT-SLOT TEXT-LEAK TEST — L5.
 *
 * L1–L4 eliminated the BACKGROUND text vector (zero background signage in 24
 * renders) but the leak relocated onto the object's own surface: "MINDSET"
 * embossed on a block, "LEADERSHIP" engraved on a plinth. 22 clean / 2 leaked
 * = ~8%, which fails the no-uncontrolled-text standard.
 *
 * L5 specifies every face of the object — and of whatever it stands on — as
 * continuous worked material whose own grain/polish is the only marking it
 * carries. This measures whether that closes the surface route.
 *
 * PROTOCOL IS DELIBERATELY IDENTICAL to scripts/object-slot-text-leak-test.mjs
 * so the counts are directly comparable: same 6 niches, same 4 renders each,
 * same problem string, same model/size/quality. The ONLY difference is the L5
 * clause in the prompt and the output directory.
 *
 * Screenshot controls are omitted: L5 is scoped to the object template alone,
 * and imagePromptNegation.test.ts asserts the other four styles are untouched.
 *
 * Calls the REAL generateAdImagePrompt — never a copy — so what is measured is
 * what would ship. LOCAL ONLY: writes PNGs to disk, touches no prod row,
 * uploads nothing to Cloudinary, so there is nothing to tear down.
 *
 * Sampling honesty: 24 clean renders bound the leak rate below ~12.5% at 95%
 * confidence (rule of three). They do NOT prove zero.
 *
 *   railway run --environment production --service coachflow \
 *     npx tsx scripts/object-slot-l5-test.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { generateAdImagePrompt } from "../server/routers/adCreatives.ts";

const OUT = "docs/screenshots/run-2026-07-31-objectleak-L5";
mkdirSync(OUT, { recursive: true });

// 4 abstract/propless (the failure mode — both L1–L4 leaks were here)
// + 2 prop-rich controls (confirm L5 has not cost niche relevance).
const NICHES = [
  { slug: "coaching", niche: "coaching", abstract: true },
  { slug: "mindset", niche: "mindset", abstract: true },
  { slug: "leadership", niche: "leadership", abstract: true },
  { slug: "career-pivot", niche: "career-pivot", abstract: true },
  { slug: "fitness", niche: "fitness", abstract: false },
  { slug: "dog-training", niche: "dog training", abstract: false },
];
const RENDERS_PER_NICHE = 4;

// Same problem string as the L1–L4 run: it carries text-bearing artefacts
// (assessments, a LinkedIn headline), the second vector L3 removed.
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
const total = NICHES.length * RENDERS_PER_NICHE;

// Fail loudly if the L5 clause is somehow absent — a run that silently measures
// the OLD prompt would read as a clean result and be worse than no run at all.
const marker = "worked smooth and continuous";
const probe = generateAdImagePrompt("object", "coaching", PROBLEM);
if (!probe.includes(marker)) {
  console.error(`ABORT: object prompt does not contain the L5 clause ("${marker}").`);
  process.exit(1);
}
console.log(`[L5 marker present] measuring the L5 prompt.\n`);

for (const { slug, niche, abstract } of NICHES) {
  const prompt = generateAdImagePrompt("object", niche, PROBLEM);
  for (let i = 1; i <= RENDERS_PER_NICHE; i++) {
    const label = `object__${slug}__${i}`;
    n++;
    try {
      const buf = await renderOpenAI(prompt);
      writeFileSync(path.join(OUT, `${label}.png`), buf);
      results.push({ label, slug, abstract, style: "object", ok: true, prompt });
      console.log(`[${n}/${total}] OK   ${label}`);
    } catch (e) {
      results.push({ label, slug, abstract, style: "object", ok: false, error: String(e.message ?? e) });
      console.log(`[${n}/${total}] FAIL ${label} — ${e.message}`);
    }
  }
}

writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} rendered -> ${OUT}`);
console.log("Every render must now be opened and eyeballed at full size. Any text of any kind = leak.");
