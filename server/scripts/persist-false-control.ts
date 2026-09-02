/**
 * persist:false NEGATIVE CONTROL.
 *
 * A flag that is supposed to suppress a write proves nothing until it is SHOWN to
 * suppress one. Counts hvcoTitles BEFORE and AFTER a dry run, measured on both
 * sides at run time (§15f) — never assumed, and never read from a document.
 *
 * Absence is not evidence: "no error" is not "no write". The delta is the evidence.
 */
import "dotenv/config";
import { sql } from "drizzle-orm";

(async () => {
  const { getDb } = await import("../db");
  const { runHvcoGeneration } = await import("../hvcoGenerator");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const count = async (): Promise<number> => {
    const r: any = await db.execute(sql`SELECT COUNT(*) AS n FROM hvcoTitles`);
    return Number(r[0][0].n);
  };

  const before = await count();
  console.log(`hvcoTitles BEFORE : ${before}   (measured)`);

  const r = await runHvcoGeneration({
    userId: 1,
    serviceId: 318,
    targetMarket: "",
    hvcoTopic: "",
    liteMode: true,
    persist: false,
    nameOverride: "The Career Layer Method",
  });

  const after = await count();
  console.log(`hvcoTitles AFTER  : ${after}   (measured)`);
  console.log(`DELTA             : ${after - before}`);
  console.log(`titles returned in memory: ${r.titles?.length ?? 0}`);
  (r.titles ?? []).slice(0, 3).forEach((t, i) => console.log(`   ${i + 1}. ${t}`));
  console.log(after === before
    ? "✅ persist:false SUPPRESSED THE WRITE — zero rows, measured both sides."
    : "🔴 ROWS WERE WRITTEN. persist:false does not suppress. ABORT the harness.");
})().catch(e => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
