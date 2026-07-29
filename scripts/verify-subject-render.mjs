/**
 * P6 cause 2 visual verification — renders the three ICP shapes through the REAL
 * resolver and the REAL generateAdImagePrompt. Writes PNGs to disk only: no DB
 * rows, no Cloudinary upload, therefore nothing to tear down.
 *
 *   railway run --environment production --service coachflow \
 *     npx tsx scripts/verify-subject-render.mjs --icpId=247 --tag=clear-female
 *   ... --icpId=253 --tag=mixed
 *   ... --synthetic=male --tag=clear-male
 */
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import Replicate from "replicate";
import { getDb } from "../server/db.ts";
import { idealCustomerProfiles } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";
import { resolveSubjectDescriptor, subjectClausesForBatch, describeResolution } from "../server/_core/subjectDescriptor.ts";
import { generateAdImagePrompt } from "../server/routers/adCreatives.ts";

const arg = (n, d) => { const m = process.argv.find(a => a.startsWith(`--${n}=`)); return m ? m.slice(n.length + 3) : d; };
const icpId = arg("icpId", null);
const synthetic = arg("synthetic", null);
const tag = arg("tag", "shape");
const OUT = path.resolve("docs/screenshots/run-2026-07-29-p6c2", tag);
mkdirSync(OUT, { recursive: true });

// Career-pivot niche, matching the smoke services these ICPs belong to.
const NICHE = "Mid-career professionals aged 35-50 who feel stuck in a job that no longer fits them";
const PROBLEM = "They have done the assessments and updated the profile and are still stuck; Sunday evening brings dread, not because something went wrong but because nothing did.";

let resolution;
if (synthetic) {
  // Real resolver, synthetic input — no prod ICP with a clear male skew exists to
  // test against. Labelled as synthetic wherever it is reported.
  resolution = resolveSubjectDescriptor({ demographics: { gender: synthetic === "male" ? "Male" : "Female", age_range: "35-50" } });
} else {
  const db = await getDb();
  const [icp] = await db.select({
    demographics: idealCustomerProfiles.demographics, introduction: idealCustomerProfiles.introduction,
    fears: idealCustomerProfiles.fears, hopesDreams: idealCustomerProfiles.hopesDreams,
    frustrations: idealCustomerProfiles.frustrations, psychographics: idealCustomerProfiles.psychographics,
  }).from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, Number(icpId))).limit(1);
  resolution = resolveSubjectDescriptor(icp ?? null);
}
console.log(`SHAPE ${tag} :: ${describeResolution(resolution)}`);

const STYLES = ["person_shocked", "screenshot", "person_intense", "object", "person_curious"];
const replicate = new Replicate({ auth: process.env.REPLICATE_API_KEY });
const CLAUSES = subjectClausesForBatch(resolution, STYLES);

for (let i = 0; i < STYLES.length; i++) {
  const who = CLAUSES[i];
  const prompt = generateAdImagePrompt(STYLES[i], NICHE, PROBLEM, false, who);
  console.log(`SLOT ${i + 1} ${STYLES[i]} :: ${who}`);
  const t0 = Date.now();
  const out = await replicate.run("black-forest-labs/flux-1.1-pro", {
    input: { prompt, aspect_ratio: "1:1", output_format: "png", output_quality: 90, safety_tolerance: 2, prompt_upsampling: false },
  });
  const first = Array.isArray(out) ? out[0] : out;
  const url = typeof first === "string" ? first : (typeof first?.url === "function" ? first.url() : first?.url);
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(path.join(OUT, `${tag}-v${i + 1}-${STYLES[i]}.png`), buf);
  console.log(`  rendered ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
console.log(`DONE ${tag} -> ${OUT}`);
process.exit(0);
