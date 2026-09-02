/**
 * SET B — the real before-number. Current unfixed prompt, product name supplied
 * through `nameOverride`, `persist: false`.
 *
 * §0b pre-committed: count + MAX(createdAt) measured IMMEDIATELY BEFORE the
 * generation call and IMMEDIATELY AFTER it, in this same process, so the
 * baseline is never separated from the event it baselines (§0a).
 *
 * Temperature is NOT pinned. Set B is the before-number for PRODUCTION
 * behaviour; the API default of 1.0 is the thing being measured.
 *
 * Mode: liteMode. Evidence, not guess — liteMode gives 5 long + 5 short + 30
 * power + 20 subheadlines = 60 nominal, which matches the three 60-row sets on
 * this account exactly. Set A shows 55 rows because `gateBeforePersist` drops
 * some at persist time; `persist:false` returns BEFORE that gate, so this run
 * reports the RAW generated count, not a gated one.
 */
const OUT: string[] = [];
const say = (m: string) => { OUT.push(m); console.log(m); };

async function measure(db: any, sql: any) {
  const r: any = await db.execute(sql`SELECT COUNT(*) AS c, MAX(createdAt) AS m FROM hvcoTitles`);
  const row = Array.isArray(r) ? (Array.isArray(r[0]) ? r[0][0] : r[0]) : r?.rows?.[0];
  return { count: Number(row.c), max: String(row.m) };
}

async function main() {
  const { getDb } = await import("../db");
  const { sql, eq } = await import("drizzle-orm");
  const { services, idealCustomerProfiles } = await import("../../drizzle/schema");
  const { runHvcoGeneration } = await import("../hvcoGenerator");

  const db = await getDb();
  if (!db) throw new Error("no db");

  const NAME = "The Incredible You Coach Training";
  const SERVICE_ID = 318;

  const [svc] = await db.select().from(services).where(eq(services.id, SERVICE_ID)).limit(1);
  const icps = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, SERVICE_ID));
  say(`[CTX] serviceId=${SERVICE_ID} userId=${svc.userId} storedName=${JSON.stringify(svc.name)}`);
  say(`[CTX] nameOverride=${JSON.stringify(NAME)}`);
  say(`[CTX] service.targetCustomer=${JSON.stringify(svc.targetCustomer)}`);
  say(`[CTX] service.hvcoTopic=${JSON.stringify(svc.hvcoTopic)}`);
  say(`[CTX] ICPs for this service: [${icps.map((i: any) => i.id).join(",")}] (no campaignId passed -> first is used)`);
  say(`[CTX] liteMode=true persist=false temperature=UNSET (API default 1.0)`);

  const before = await measure(db, sql);
  say(`[BEFORE] hvcoTitles count=${before.count} MAX(createdAt)=${before.max}`);

  const t0 = Date.now();
  const result = await runHvcoGeneration({
    userId: svc.userId,
    serviceId: SERVICE_ID,
    targetMarket: "",
    hvcoTopic: "",
    liteMode: true,
    persist: false,
    nameOverride: NAME,
  });
  say(`[RUN] completed in ${Math.round((Date.now() - t0) / 1000)}s hvcoSetId=${result.hvcoSetId}`);

  const after = await measure(db, sql);
  say(`[AFTER] hvcoTitles count=${after.count} MAX(createdAt)=${after.max}`);
  say(`[DELTA] count ${before.count} -> ${after.count} (${after.count === before.count ? "UNCHANGED" : "CHANGED"}) | MAX(createdAt) ${before.max} -> ${after.max} (${after.max === before.max ? "UNCHANGED" : "CHANGED"})`);

  const titles = result.titles ?? [];
  say(`[TITLES] ${titles.length} generated`);
  titles.forEach((t, i) => say(`${String(i + 1).padStart(3, " ")}. ${t}`));

  const fs = await import("fs");
  fs.writeFileSync(process.env.SETB_OUT || "setb.txt", OUT.join("\n") + "\n");
}

main().then(() => process.exit(0)).catch((e) => { console.error("[SETB] FATAL", e); process.exit(1); });

export {};
