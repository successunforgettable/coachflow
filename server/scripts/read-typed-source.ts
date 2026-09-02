// READ-ONLY. SELECTs only. Prints the coach's typed messages and the ICP's
// grounding provenance verbatim. Writes nothing.
async function main() {
  const { getDb } = await import("../db");
  const { eq } = await import("drizzle-orm");
  const { chatTranscripts, idealCustomerProfiles, sourceOfTruth } = await import("../../drizzle/schema");
  const db = await getDb();
  if (!db) throw new Error("no db");

  const [tr] = await db.select().from(chatTranscripts).where(eq(chatTranscripts.campaignKitId, 225)).limit(1);
  const msgs = (tr as any)?.messages as Array<Record<string, any>> | undefined;
  console.log(`=== chatTranscripts kit 225: ${msgs ? msgs.length : "NO ROW"} messages ===`);
  if (msgs) {
    msgs.forEach((m, i) => {
      if (m?.type === "user-bubble") console.log(`\n--- USER-TYPED [${m.id ?? i}] ---\n${m.text ?? ""}`);
    });
  }

  const [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, 291)).limit(1);
  console.log(`\n=== ICP 291 groundingMeta ===\n${JSON.stringify((icp as any)?.groundingMeta, null, 2)}`);

  const [sot] = await db.select().from(sourceOfTruth).where(eq(sourceOfTruth.userId, 1)).limit(1);
  console.log(`\n=== sourceOfTruth user 1 ===\n${sot ? JSON.stringify(sot, null, 2) : "NO ROW"}`);
}
main().then(() => process.exit(0)).catch(e => { console.error("FATAL", e); process.exit(1); });
export {};
