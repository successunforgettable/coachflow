// READ-ONLY. Prints the message sequence of kit 225 compactly: what was shown,
// and where the coach was asked to choose. No summarisation of content.
async function main() {
  const { getDb } = await import("../db");
  const { eq } = await import("drizzle-orm");
  const { chatTranscripts } = await import("../../drizzle/schema");
  const db = await getDb();
  if (!db) throw new Error("no db");
  const [tr] = await db.select().from(chatTranscripts).where(eq(chatTranscripts.campaignKitId, 225)).limit(1);
  const msgs = ((tr as any)?.messages ?? []) as Array<Record<string, any>>;
  msgs.forEach((m, i) => {
    const t = m?.type ?? "?";
    const nodeKey = m?.nodeKey ? ` nodeKey=${m.nodeKey}` : "";
    const rev = m?.reveal ? ` reveal.title=${JSON.stringify(m.reveal.title)} eyebrow=${JSON.stringify(m.reveal.eyebrow)}` : "";
    const opts = m?.options ? ` options=${JSON.stringify(m.options)}` : "";
    const snippet = t === "zappy-bubble" ? ` :: ${String(m.text ?? "").slice(0, 110)}` : "";
    console.log(`[${String(i).padStart(2, " ")}] ${m.id ?? ""} ${t}${nodeKey}${rev}${opts}${snippet}`);
  });
}
main().then(() => process.exit(0)).catch(e => { console.error("FATAL", e); process.exit(1); });
export {};
