/**
 * fabrication-e2e-audit — layer (iv): the scheduled end-to-end assertion.
 *
 * 🔴 WHY THIS EXISTS. Fixtures and unit tests were 23/23 green while the live publish gate
 * returned ok=true on a named testimonial, an invented client count, an invented statistic
 * and an unstated guarantee. Every other test layer is authored by the same hands that wrote
 * the detectors; this one is authored by the MODEL. It is the only layer that has ever caught
 * a real failure here, so it must run on a schedule rather than living in someone's head.
 *
 * Two modes, both read-only against prod:
 *
 *   audit   — screen ALREADY-PERSISTED assets for a service through the same gate the
 *             persistence boundary uses. Answers: did anything invented get stored?
 *               npx tsx scripts/fabrication-e2e-audit.ts audit <serviceId>
 *
 *   live    — run a REAL generation for a synthetic zero-client coach and screen what the
 *             model actually returns, WITHOUT persisting anything. Answers: does the prompt
 *             still invite invention? This is the root-cause check.
 *               npx tsx scripts/fabrication-e2e-audit.ts live
 *
 * Exit code is non-zero when blocking claims are found, so a scheduler can alarm on it.
 */

import { checkOutput } from "../server/_core/complianceAxis";
import { buildCoachCorpus, buildProofSupplied } from "../server/_core/groundingCorpus";
import { copyFieldsOf } from "../server/_core/persistenceGate";

/** A zero-client coach. Every proof-shaped claim about people is unsupported by definition. */
const LAUNCH_STAGE_COACH = {
  name: "Sleep Reset for New Parents",
  category: "coaching",
  description:
    "I just finished my paediatric sleep consultant certification three months ago. I help exhausted new parents get their baby sleeping through the night without leaving them to cry it out. I don't have any paying clients yet - I've only done a few free sessions for friends.",
  targetCustomer: "First-time parents with babies between 4 and 12 months old who are severely sleep deprived",
  mainBenefit: "Their baby sleeps through the night within three weeks, using a gentle method",
};

function screen(label: string, texts: Array<{ location: string; text: string }>, service: any, groundingMeta?: unknown) {
  const grounding = {
    corpus: buildCoachCorpus({ service, groundingMeta }),
    supplied: buildProofSupplied(service),
  };
  const res = checkOutput(texts.map((t) => ({ ...t, role: "body" as const })), grounding);
  if (res.ok) {
    console.log(`  ✅ ${label} — clean`);
    return 0;
  }
  console.log(`  ❌ ${label} — ${res.blocking.length} blocking`);
  for (const h of res.blocking.slice(0, 8)) {
    console.log(`       [${h.classId}] @${h.location}: "${String(h.matched).slice(0, 90)}"`);
  }
  return res.blocking.length;
}

async function auditPersisted(serviceId: number): Promise<number> {
  const { getDb } = await import("../server/db");
  const schema = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("no db");

  const [service] = await db.select().from(schema.services).where(eq(schema.services.id, serviceId)).limit(1);
  if (!service) throw new Error(`service ${serviceId} not found`);
  const [icp] = await db.select().from(schema.idealCustomerProfiles)
    .where(eq(schema.idealCustomerProfiles.serviceId, serviceId)).limit(1);

  console.log(`\nAUDIT service ${serviceId} — ${service.name}`);
  let total = 0;
  const tables: Array<[string, any]> = [
    ["heroMechanisms", schema.heroMechanisms], ["hvcoTitles", schema.hvcoTitles],
    ["headlines", schema.headlines], ["adCopy", schema.adCopy],
    ["emailSequences", schema.emailSequences], ["whatsappSequences", schema.whatsappSequences],
  ];
  for (const [name, table] of tables) {
    const rows: any[] = await db.select().from(table).where(eq((table as any).serviceId, serviceId));
    if (rows.length === 0) { console.log(`  ·  ${name} — none`); continue; }
    let n = 0;
    for (const r of rows) n += screen(`${name}#${r.id}`, copyFieldsOf(r), service, (icp as any)?.groundingMeta);
    total += n;
  }
  return total;
}

async function liveGeneration(): Promise<number> {
  const { invokeLLM } = await import("../server/_core/llm");
  const corpus = buildCoachCorpus({ service: LAUNCH_STAGE_COACH as any });
  console.log(`\nLIVE generation — isLaunchStage=${corpus.isLaunchStage} (must be true)`);

  // The mechanism prompt's proof guidance, exactly as heroMechanismsGenerator now builds it
  // for a launch-stage coach. If the prompt still invites a track record, this surfaces it.
  const guidance =
    `   - What the method is DESIGNED to produce, described as the outcome it aims at rather than a
     figure anyone has already hit — the mechanism stands on how it works, not on a track record
   - Why this approach exists: the reasoning and the insight behind it, in the first person`;

  const prompt = `You are an expert direct response copywriter creating compelling Hero Mechanisms.

Product: ${LAUNCH_STAGE_COACH.name}
Target market: ${LAUNCH_STAGE_COACH.targetCustomer}
Coach's own description: ${LAUNCH_STAGE_COACH.description}

Create 3 HERO MECHANISMS. Each must have:
1. A proprietary-sounding NAME specific to this niche.
2. A full PARAGRAPH description (150-200 words) that includes:
   - The specific problem it solves (name the problem, not a category of problems)
${guidance}
   - What specifically makes it different from what they've already tried
   - One before/after moment, written as what the method is DESIGNED to produce

Return ONLY a JSON array of 3 objects with "name" and "description" fields, nothing else.`;

  const resp = await invokeLLM({ messages: [{ role: "user", content: prompt }] });
  const raw = resp.choices[0]?.message?.content;
  const content = typeof raw === "string" ? raw : JSON.stringify(raw);
  const cleaned = content.trim().replace(/^```(?:json)?/, "").replace(/```$/, "").trim();

  let mechs: Array<{ name: string; description: string }> = [];
  try { mechs = JSON.parse(cleaned); } catch { console.log("  (unparseable model output)\n", content.slice(0, 400)); return 1; }

  let total = 0;
  for (const m of mechs) {
    console.log(`\n  — ${m.name}`);
    console.log(`    ${(m.description ?? "").slice(0, 260)}…`);
    total += screen(m.name, [{ location: "mechanismDescription", text: m.description ?? "" }], LAUNCH_STAGE_COACH);
  }
  return total;
}

(async () => {
  const mode = process.argv[2];
  let blocking = 0;
  if (mode === "audit") blocking = await auditPersisted(Number(process.argv[3]));
  else if (mode === "live") blocking = await liveGeneration();
  else { console.error("usage: fabrication-e2e-audit.ts <audit <serviceId> | live>"); process.exit(2); }

  console.log(`\n${blocking === 0 ? "PASS — no invented proof" : `FAIL — ${blocking} blocking claim(s)`}`);
  process.exit(blocking === 0 ? 0 : 1);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(2); });
