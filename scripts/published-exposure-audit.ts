/**
 * published-exposure-audit — READ-ONLY. Measures what a real audience could actually have seen.
 *
 * The fleet audit counted GENERATED content. Most of that sits in decks never selected or
 * published. This restricts screening to assets with a real publish/push record:
 *   - landingPages.publicUrl set  → rendered to Cloudflare KV at a public /p/<slug>
 *   - meta_published_ads          → ad copy actually pushed to Meta (joined via adSetId)
 *   - hvcoTitles/bonuses magnet URLs → hosted deliverables
 *
 * ⚠️ NOT MEASURABLE: GHL deployment. The GHL push writes Custom Values into the customer's
 * own GHL location and the schema keeps only ghl_access_tokens — there is no per-asset push
 * record, so email/WhatsApp reach cannot be established from this database either way.
 */
import { checkOutput } from "../server/_core/complianceAxis";
import { buildCoachCorpus, buildProofSupplied } from "../server/_core/groundingCorpus";
import { copyFieldsOf } from "../server/_core/persistenceGate";

const FAB = new Set([
  "invented_testimonial", "unearned_authority", "invented_statistic",
  "invented_guarantee", "invented_named_third_party",
]);

/** Accounts that are ours, not a paying coach's. Exposure here is a different problem. */
const TEST_USER_IDS = new Set([1, 2, 1254, 1255, 1256, 1257, 1258, 1613, 107432, 117174]);

(async () => {
  const { getDb } = await import("../server/db");
  const schema = await import("../drizzle/schema");
  const { eq, isNotNull } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("no db");

  const services: any[] = await db.select().from(schema.services);
  const svcById = new Map<number, any>(services.map((s) => [s.id, s]));
  const icps: any[] = await db.select({
    serviceId: schema.idealCustomerProfiles.serviceId,
    groundingMeta: schema.idealCustomerProfiles.groundingMeta,
  }).from(schema.idealCustomerProfiles);
  const gm = new Map<number, unknown>();
  for (const i of icps) if (!gm.has(i.serviceId)) gm.set(i.serviceId, i.groundingMeta);

  const groundOf = (serviceId: number) => {
    const s = svcById.get(serviceId);
    if (!s) return null;
    return { corpus: buildCoachCorpus({ service: s, groundingMeta: gm.get(serviceId) }), supplied: buildProofSupplied(s) };
  };

  type Row = { kind: string; ref: string; serviceId: number; userId: number; cls: string; matched: string; slug?: string };
  const hits: Row[] = [];

  // ── 1. PUBLISHED LANDING PAGES ────────────────────────────────────────────
  const lps: any[] = await db.select().from(schema.landingPages).where(isNotNull(schema.landingPages.publicUrl));
  console.log(`published landing pages: ${lps.length}`);
  for (const lp of lps) {
    const g = groundOf(lp.serviceId);
    if (!g) continue;
    // Screen the angle that was actually published.
    const angleKey = `${lp.activeAngle || "original"}Angle`;
    const content = lp[angleKey] ?? lp.originalAngle;
    const parsed = typeof content === "string" ? (() => { try { return JSON.parse(content); } catch { return null; } })() : content;
    const fields = parsed && typeof parsed === "object"
      ? copyFieldsOf(parsed as Record<string, unknown>)
      : copyFieldsOf(lp);
    if (!fields.length) continue;
    const res = checkOutput(fields.map((f) => ({ ...f, role: "body" as const })), g);
    for (const h of res.blocking) if (FAB.has(String(h.classId)))
      hits.push({ kind: "landingPage", ref: `LP#${lp.id}`, serviceId: lp.serviceId, userId: lp.userId, cls: String(h.classId), matched: String(h.matched), slug: lp.publicSlug ?? undefined });
  }

  // ── 2. AD COPY ACTUALLY PUSHED TO META ────────────────────────────────────
  const pubAds: any[] = await db.select().from(schema.metaPublishedAds);
  console.log(`meta published ads: ${pubAds.length} (adSets: ${new Set(pubAds.map((a) => a.adSetId)).size})`);
  for (const setId of new Set(pubAds.map((a) => a.adSetId))) {
    const rows: any[] = await db.select().from(schema.adCopy).where(eq(schema.adCopy.adSetId, setId as any));
    for (const r of rows) {
      const g = groundOf(r.serviceId);
      if (!g) continue;
      const res = checkOutput(copyFieldsOf(r).map((f) => ({ ...f, role: "body" as const })), g);
      for (const h of res.blocking) if (FAB.has(String(h.classId)))
        hits.push({ kind: "metaAd", ref: `adCopy#${r.id} (set ${setId})`, serviceId: r.serviceId, userId: r.userId, cls: String(h.classId), matched: String(h.matched) });
    }
  }

  // ── 3. HOSTED DELIVERABLES ────────────────────────────────────────────────
  for (const [label, table] of [["leadMagnet", schema.hvcoTitles], ["bonus", schema.bonuses]] as const) {
    const rows: any[] = await db.select().from(table as any);
    for (const r of rows) {
      if (!r.magnetPdfUrl && !r.magnetHtmlUrl) continue;
      const g = groundOf(r.serviceId);
      if (!g) continue;
      const res = checkOutput(copyFieldsOf(r).map((f) => ({ ...f, role: "body" as const })), g);
      for (const h of res.blocking) if (FAB.has(String(h.classId)))
        hits.push({ kind: label, ref: `${label}#${r.id}`, serviceId: r.serviceId, userId: r.userId, cls: String(h.classId), matched: String(h.matched) });
    }
  }

  // ── REPORT ────────────────────────────────────────────────────────────────
  const real = hits.filter((h) => !TEST_USER_IDS.has(h.userId));
  const test = hits.filter((h) => TEST_USER_IDS.has(h.userId));
  console.log(`\n${"=".repeat(64)}\nPUBLISHED FABRICATION EXPOSURE (read-only)\n${"=".repeat(64)}`);
  console.log(`published-surface hits total : ${hits.length}`);
  console.log(`  on REAL coach accounts     : ${real.length}`);
  console.log(`  on test/smoke accounts     : ${test.length}`);

  const by = (arr: Row[], k: keyof Row) => {
    const m = new Map<string, number>();
    for (const h of arr) m.set(String(h[k]), (m.get(String(h[k])) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  console.log(`\nBY CLASS (real accounts)`);
  for (const [c, n] of by(real, "cls")) console.log(`  ${String(n).padStart(4)}  ${c}`);
  console.log(`\nBY ASSET KIND (real accounts)`);
  for (const [c, n] of by(real, "kind")) console.log(`  ${String(n).padStart(4)}  ${c}`);
  console.log(`\nWORST SERVICES (real accounts)`);
  for (const [s, n] of by(real, "serviceId").slice(0, 12)) {
    const svc = svcById.get(Number(s));
    console.log(`  service ${String(s).padStart(4)}  ${String(n).padStart(4)} hits  user ${svc?.userId}  — ${(svc?.name ?? "?").slice(0, 44)}`);
  }
  console.log(`\nEVERY PUBLISHED-SURFACE HIT ON A REAL ACCOUNT`);
  for (const h of real.slice(0, 60))
    console.log(`  [${h.cls}] ${h.ref} svc${h.serviceId} ${h.slug ? "/p/" + h.slug : ""}: "${h.matched.slice(0, 76)}"`);

  // ── TARGETED: the two named items ─────────────────────────────────────────
  console.log(`\n${"=".repeat(64)}\nTARGETED LOOKUPS\n${"=".repeat(64)}`);
  for (const needle of ["Sarah Chen", "hundreds of successful clients"]) {
    console.log(`\n"${needle}"`);
    let found = 0;
    for (const [label, table] of [
      ["heroMechanisms", schema.heroMechanisms], ["adCopy", schema.adCopy], ["hvcoTitles", schema.hvcoTitles],
      ["headlines", schema.headlines], ["landingPages", schema.landingPages], ["offers", schema.offers],
    ] as const) {
      const rows: any[] = await db.select().from(table as any);
      for (const r of rows) {
        const blob = JSON.stringify(r);
        if (!new RegExp(needle, "i").test(blob)) continue;
        found++;
        const svc = svcById.get(r.serviceId);
        const isTest = TEST_USER_IDS.has(r.userId) ? "TEST" : "REAL";
        const pub = label === "landingPages" ? (r.publicUrl ? `PUBLISHED ${r.publicSlug}` : "not published") : "n/a";
        if (found <= 14) console.log(`  ${label}#${r.id} svc${r.serviceId} user${r.userId} [${isTest}] ${pub} — ${(svc?.name ?? "?").slice(0, 34)}`);
      }
    }
    console.log(`  total rows containing it: ${found}`);
  }
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(2); });
