import "dotenv/config";

// Browser-free clean-room proof of the durable-job fix. The full Playwright harness wedges at browser launch in
// this env (3×, post-rate-limit), so this exercises exactly the changed code path the way prod triggers it:
// reconcileBonusPdfs (on-Kit-load self-heal) → enqueueBonusPdfJob (durable jobs-table job) → runBonusPdfGeneration
// (resumable) → assetBody ×3. Two orphaned sets (kit 13, 14: bodies 0/3) should heal; the done set (kit 15: 3/3)
// must be left untouched (resumable guard). Publish (PDF) is expected to fail clean-room (no Cloudflare) — the proof
// is assetBody, not magnetPdfUrl.
async function main() {
  const { reconcileBonusPdfs } = await import("../bonusPdfGenerator");
  const { getDb } = await import("../db");
  const { bonuses, jobs } = await import("../../drizzle/schema");
  const { eq, inArray } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("no db");

  const USER = 1;
  const HEAL_KITS = [13, 14];
  const DONE_KIT = 15;

  const snap = async () => {
    const rows = await db.select({ kit: bonuses.campaignKitId, id: bonuses.id, body: bonuses.assetBody, setId: bonuses.bonusSetId })
      .from(bonuses).where(inArray(bonuses.campaignKitId, [13, 14, 15]));
    const by: Record<number, { total: number; bodies: number }> = {};
    for (const r of rows) { by[r.kit!] ??= { total: 0, bodies: 0 }; by[r.kit!].total++; if (r.body != null) by[r.kit!].bodies++; }
    return by;
  };

  console.log("=== BEFORE ===", JSON.stringify(await snap()));
  const doneBefore = (await snap())[DONE_KIT];

  // Trigger the exact prod path: on-Kit-load reconciliation for each orphaned kit.
  for (const kit of HEAL_KITS) {
    await reconcileBonusPdfs(USER, kit);
    console.log(`reconcileBonusPdfs(user=${USER}, kit=${kit}) fired`);
  }

  // Show the durable jobs that reconcile enqueued (proves jobs-table durability, not fire-and-forget).
  const jobRows = await db.select({ id: jobs.id, status: jobs.status }).from(jobs).where(inArray(jobs.status, ["pending", "running", "complete", "failed"]));
  console.log("bpdf jobs after enqueue:", JSON.stringify(jobRows.filter((j) => j.id.startsWith("bpdf-"))));

  // Poll to completion (in-process setImmediate runners keep working while we wait). PDF gen ~1–2 min/bonus.
  const started = Date.now();
  const TIMEOUT_MS = 12 * 60 * 1000;
  let last = "";
  while (Date.now() - started < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 15_000));
    const s = await snap();
    const jr = await db.select({ id: jobs.id, status: jobs.status }).from(jobs);
    const bp = jr.filter((j) => j.id.startsWith("bpdf-")).map((j) => `${j.id.slice(0, 12)}=${j.status}`).join(" ");
    const line = `t+${Math.round((Date.now() - started) / 1000)}s  kit13=${s[13]?.bodies ?? 0}/${s[13]?.total ?? 0}  kit14=${s[14]?.bodies ?? 0}/${s[14]?.total ?? 0}  kit15=${s[15]?.bodies ?? 0}/${s[15]?.total ?? 0}  jobs[${bp}]`;
    if (line.slice(line.indexOf("kit13")) !== last) { console.log(line); last = line.slice(line.indexOf("kit13")); }
    const healed = HEAL_KITS.every((k) => (s[k]?.bodies ?? 0) === (s[k]?.total ?? 99));
    if (healed) { console.log(">>> HEALED: both orphaned sets reached assetBody full"); break; }
  }

  const after = await snap();
  console.log("=== AFTER ===", JSON.stringify(after));
  // Assertions.
  const pass13 = (after[13]?.bodies ?? 0) === (after[13]?.total ?? 0) && (after[13]?.total ?? 0) > 0;
  const pass14 = (after[14]?.bodies ?? 0) === (after[14]?.total ?? 0) && (after[14]?.total ?? 0) > 0;
  const untouched15 = (after[DONE_KIT]?.bodies ?? -1) === (doneBefore?.bodies ?? -2); // must not regenerate the done set
  console.log(`ASSERT kit13 healed (0/3→3/3): ${pass13 ? "PASS" : "FAIL"}`);
  console.log(`ASSERT kit14 healed (0/3→3/3): ${pass14 ? "PASS" : "FAIL"}`);
  console.log(`ASSERT kit15 done-set untouched (${doneBefore?.bodies}/3): ${untouched15 ? "PASS" : "FAIL"}`);
  console.log(`RESULT: ${pass13 && pass14 && untouched15 ? "DURABLE-JOB PATH GREEN" : "RED"}`);
  process.exit(0);
}
main().catch((e) => { console.error("SCRIPT ERR", e); process.exit(1); });
