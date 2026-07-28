/**
 * Read-only. Answers "how much of the fleet-wide hit count is REAL invented proof?"
 *
 * A raw hit count is not an exposure figure. Systematic false positives show up instantly
 * as the same matched string repeating across unrelated services, so frequency is the fastest
 * precision signal available. Reporting a raw total as "invented claims" would be exactly the
 * fake precision META_AD_COMPLIANCE_REFERENCE.md warns against.
 */
import { checkOutput } from "../server/_core/complianceAxis";
import { buildCoachCorpus, buildProofSupplied } from "../server/_core/groundingCorpus";
import { copyFieldsOf } from "../server/_core/persistenceGate";

const FAB = new Set([
  "invented_testimonial", "unearned_authority", "invented_statistic",
  "invented_guarantee", "invented_named_third_party",
]);

(async () => {
  const { getDb } = await import("../server/db");
  const schema = await import("../drizzle/schema");
  const db = await getDb();
  if (!db) throw new Error("no db");

  const services: any[] = await db.select().from(schema.services);
  const icps: any[] = await db.select({
    serviceId: schema.idealCustomerProfiles.serviceId,
    groundingMeta: schema.idealCustomerProfiles.groundingMeta,
  }).from(schema.idealCustomerProfiles);
  const gm = new Map<number, unknown>();
  for (const i of icps) if (!gm.has(i.serviceId)) gm.set(i.serviceId, i.groundingMeta);

  const ground = new Map<number, any>();
  for (const s of services) ground.set(s.id, {
    corpus: buildCoachCorpus({ service: s as any, groundingMeta: gm.get(s.id) }),
    supplied: buildProofSupplied(s as any),
  });

  const TABLES: Array<[string, any]> = [
    ["heroMechanisms", schema.heroMechanisms], ["hvcoTitles", schema.hvcoTitles],
    ["headlines", schema.headlines], ["adCopy", schema.adCopy],
    ["landingPages", schema.landingPages], ["offers", schema.offers],
  ];

  const freq = new Map<string, Map<string, number>>();   // class -> matched -> count
  const svcOf = new Map<string, Set<number>>();          // class|matched -> services
  let fabTotal = 0, cmpTotal = 0;

  for (const [, table] of TABLES) {
    let rows: any[] = [];
    try { rows = await db.select().from(table); } catch { continue; }
    for (const r of rows) {
      const g = ground.get(r.serviceId);
      if (!g) continue;
      const fields = copyFieldsOf(r);
      if (!fields.length) continue;
      const res = checkOutput(fields.map((f) => ({ ...f, role: "body" as const })), g);
      for (const h of res.blocking) {
        const cls = String(h.classId);
        if (!FAB.has(cls)) { cmpTotal++; continue; }
        fabTotal++;
        if (!freq.has(cls)) freq.set(cls, new Map());
        const m = String(h.matched);
        freq.get(cls)!.set(m, (freq.get(cls)!.get(m) ?? 0) + 1);
        const k = `${cls}|${m}`;
        if (!svcOf.has(k)) svcOf.set(k, new Set());
        svcOf.get(k)!.add(r.serviceId);
      }
    }
  }

  console.log(`\nFABRICATION hits: ${fabTotal}   COMPLIANCE hits: ${cmpTotal}\n`);
  for (const [cls, m] of freq) {
    const distinct = m.size;
    const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log(`── ${cls}: ${[...m.values()].reduce((a, b) => a + b, 0)} hits, ${distinct} distinct strings`);
    for (const [s, n] of top) {
      const svcs = svcOf.get(`${cls}|${s}`)?.size ?? 0;
      console.log(`   ${String(n).padStart(4)}×  (${svcs} svc)  "${s.slice(0, 74)}"`);
    }
    console.log("");
  }
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(2); });
