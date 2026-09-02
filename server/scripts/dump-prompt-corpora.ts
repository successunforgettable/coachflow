// READ-ONLY. Writes the four text sources that reach the title prompt to JSON,
// so overlap with the generated titles can be measured rather than eyeballed.
async function main() {
  const { getDb } = await import("../db");
  const { eq } = await import("drizzle-orm");
  const { services, idealCustomerProfiles, sourceOfTruth } = await import("../../drizzle/schema");
  const { getCascadeContext } = await import("../_core/cascadeContext");
  const db = await getDb(); if (!db) throw new Error("no db");

  const [svc] = await db.select().from(services).where(eq(services.id, 318)).limit(1);
  const [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, 291)).limit(1);
  const [sot] = await db.select().from(sourceOfTruth).where(eq(sourceOfTruth.userId, 1)).limit(1);
  const cascade = await getCascadeContext(1, 291, "hvco");

  const s: any = svc, i: any = icp, t: any = sot;
  const out = {
    SOT: [t.coreOffer, t.targetAudience, t.mainPainPoint, t.mainBenefits, t.uniqueValue, t.idealCustomerAvatar].filter(Boolean).join("\n"),
    ICP: [i.pains, i.goals, i.implementationBarriers].filter(Boolean).join("\n"),
    SVC: [s.targetCustomer, s.hvcoTopic].filter(Boolean).join("\n"),
    CASCADE: cascade,
  };
  const fs = await import("fs");
  fs.writeFileSync(process.env.CORPORA_OUT || "corpora.json", JSON.stringify(out, null, 2));
  console.log(Object.entries(out).map(([k, v]) => `${k}: ${(v as string).length} chars`).join("\n"));
}
main().then(() => process.exit(0)).catch(e => { console.error("FATAL", e); process.exit(1); });
export {};
