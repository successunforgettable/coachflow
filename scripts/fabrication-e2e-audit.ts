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

/**
 * Fleet-wide, read-only. Screens every service's persisted content and reports SCALE:
 * how many services carry invented proof, how many claims, and the worst examples.
 * Modifies nothing.
 */
async function auditAll(): Promise<number> {
  const { getDb } = await import("../server/db");
  const schema = await import("../drizzle/schema");
  const { eq, inArray } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("no db");

  const services: any[] = await db.select().from(schema.services);
  const icps: any[] = await db.select({
    serviceId: schema.idealCustomerProfiles.serviceId,
    groundingMeta: schema.idealCustomerProfiles.groundingMeta,
  }).from(schema.idealCustomerProfiles);
  const gmBy = new Map<number, unknown>();
  for (const i of icps) if (!gmBy.has(i.serviceId)) gmBy.set(i.serviceId, i.groundingMeta);

  const ground = new Map<number, any>();
  for (const svc of services) {
    ground.set(svc.id, {
      corpus: buildCoachCorpus({ service: svc as any, groundingMeta: gmBy.get(svc.id) }),
      supplied: buildProofSupplied(svc as any),
      name: svc.name,
    });
  }

  const TABLES: Array<[string, any]> = [
    ["heroMechanisms", schema.heroMechanisms], ["hvcoTitles", schema.hvcoTitles],
    ["headlines", schema.headlines], ["adCopy", schema.adCopy],
    ["emailSequences", schema.emailSequences], ["whatsappSequences", schema.whatsappSequences],
    ["landingPages", schema.landingPages], ["offers", schema.offers],
  ];

  const byClass = new Map<string, number>();
  const byTable = new Map<string, number>();
  const affected = new Set<number>();
  const worst: Array<{ svc: number; table: string; id: number; cls: string; matched: string }> = [];
  let totalRows = 0, totalClaims = 0;

  for (const [name, table] of TABLES) {
    let rows: any[] = [];
    try { rows = await db.select().from(table); }
    catch (e) { console.log(`  (skipped ${name}: ${e instanceof Error ? e.message : e})`); continue; }
    for (const r of rows) {
      const g = ground.get(r.serviceId);
      if (!g) continue;
      totalRows++;
      const fields = copyFieldsOf(r);
      if (fields.length === 0) continue;
      const res = checkOutput(fields.map((f) => ({ ...f, role: "body" as const })), { corpus: g.corpus, supplied: g.supplied });
      if (res.ok) continue;
      affected.add(r.serviceId);
      byTable.set(name, (byTable.get(name) ?? 0) + res.blocking.length);
      for (const h of res.blocking) {
        totalClaims++;
        byClass.set(String(h.classId), (byClass.get(String(h.classId)) ?? 0) + 1);
        if (worst.length < 4000) worst.push({ svc: r.serviceId, table: name, id: r.id, cls: String(h.classId), matched: String(h.matched) });
      }
    }
    console.log(`  scanned ${name}: ${rows.length} rows`);
  }

  console.log(`
${"=".repeat(70)}
FLEET-WIDE FABRICATION EXPOSURE (read-only)
${"=".repeat(70)}`);
  console.log(`services in prod        : ${services.length}`);
  console.log(`services with ≥1 claim  : ${affected.size}  (${Math.round(affected.size / services.length * 100)}%)`);
  console.log(`content rows screened   : ${totalRows}`);
  console.log(`blocking claims total   : ${totalClaims}`);
  console.log(`
BY CLASS`);
  for (const [c, n] of [...byClass.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${c}`);
  console.log(`
BY TABLE`);
  for (const [t, n] of [...byTable.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${t}`);

  const perSvc = new Map<number, number>();
  for (const w of worst) perSvc.set(w.svc, (perSvc.get(w.svc) ?? 0) + 1);
  console.log(`
WORST SERVICES`);
  for (const [sid, n] of [...perSvc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10))
    console.log(`  service ${String(sid).padStart(4)}  ${String(n).padStart(4)} claims  — ${ground.get(sid)?.name ?? "?"}`);

  console.log(`
WORST EXAMPLES (most severe classes first)`);
  const SEVERITY = ["invented_testimonial", "unearned_authority", "invented_statistic", "invented_guarantee", "invented_named_third_party"];
  const seen = new Set<string>();
  for (const cls of SEVERITY) {
    const ex = worst.filter((w) => w.cls === cls);
    for (const e of ex.slice(0, 4)) {
      const k = `${cls}|${e.matched}`;
      if (seen.has(k)) continue;
      seen.add(k);
      console.log(`  [${cls}] svc ${e.svc} ${e.table}#${e.id}: "${e.matched.slice(0, 100)}"`);
    }
  }
  return totalClaims;
}

(async () => {
  const mode = process.argv[2];
  let blocking = 0;
  if (mode === "audit") blocking = await auditPersisted(Number(process.argv[3]));
  else if (mode === "live") blocking = await liveGeneration();
  else if (mode === "all") blocking = await auditAll();
  else { console.error("usage: fabrication-e2e-audit.ts <audit <serviceId> | live | all>"); process.exit(2); }

  console.log(`\n${blocking === 0 ? "PASS — no invented proof" : `FAIL — ${blocking} blocking claim(s)`}`);
  process.exit(blocking === 0 ? 0 : 1);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(2); });
