/**
 * pdaf-gate-proof.ts — LIVE proof for the P.D.A.F. distinctness gate.
 *
 * Calls the REAL runAdCopyGeneration, so this exercises the shipped path — compliance
 * gate, capped regeneration, distinctness gate, anti-echo, trim — and not a rebuilt copy
 * of it. A harness that re-implements the sequence proves the harness (STANDING RULE 2).
 *
 * ⚠️ THIS SCRIPT WRITES TO PRODUCTION. It creates ONE labelled throwaway service and one
 * ad-copy set for the smoke user. It renders NO images, so no adCreatives rows and no
 * Cloudinary objects are produced. Teardown is id-scoped (id list + userId guard, never
 * userId alone — smoke user 117174 OWNS the protected creatives on services 272-277),
 * printed at the end, and NOT executed here.
 *
 * THE TWO THINGS THIS RUN MUST SHOW, per Arfeen 2026-08-07:
 *   A. With the gate on, 0% collapse among the KEPT rows — re-audited FROM THE DATABASE,
 *      not from the in-memory ledger, so the proof reads what actually persisted.
 *   B. At least one body rewritten because it echoed a NON-PARTNER headline. That is the
 *      only evidence the deck-wide check does work the old pairwise check would not have,
 *      and the gate records `wasPartner` per finding so it is mechanical, not argued.
 *
 * Plus the regeneration ledger — evicted / recovered and on which axis / dropped at the
 * cap — PRINTED from what the gate recorded, never inferred from the surviving rows.
 *
 * Usage:  npx tsx server/scripts/pdaf-gate-proof.ts [userId]
 */
import "dotenv/config";
import { appendFileSync } from "fs";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { adCopy, services, idealCustomerProfiles, campaignConcepts } from "../../drizzle/schema";
import { runAdCopyGeneration } from "../adCopyGenerator";
import { ensureConceptsForIcp, conceptJobId } from "../conceptGenerator";
import { auditBatch, type PdafLabels } from "../_core/pdafDistinctness";
import { formatLedger, type GateLedger } from "../_core/pdafGate";

// `railway run` BLOCK-BUFFERS STDOUT — two runs on 2026-08-06 were invisible for 25
// minutes while failing. Everything printed here also lands on disk immediately, so a
// long run can be watched and a crashed one can still be read.
const LOG = `/tmp/pdaf-gate-proof-${process.pid}.log`;
const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};

const USER_ID = Number(process.argv[2] ?? 117174);
const LABEL = "ZZ-PDAF-GATE-PROOF — throwaway, safe to delete";

const BRIEF = {
  adType: "lead_gen" as const,
  adStyle: "direct",
  adCallToAction: "Book a Call",
  targetMarket: "operations consultants who bill by the hour and want to move to retainers",
  productCategory: "consulting engagement design",
  specificProductName: "The Scope-First Sequence",
  pressingProblem:
    "proposals sit unsent for days while the scope keeps moving, and the client goes quiet before the number is ever discussed",
  desiredOutcome: "a booked retainer conversation within two weeks of first contact",
  uniqueMechanism: "the Scope-First Sequence",
};

const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "n/a");
const rule = (c = "─") => say(c.repeat(78));

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  rule("═");
  say("P.D.A.F. DISTINCTNESS GATE — LIVE PROOF");
  say(`user ${USER_ID} · writes one throwaway service + one ad-copy set · renders nothing`);
  rule("═");

  const [ins] = await db.insert(services).values({
    userId: USER_ID,
    name: LABEL,
    category: "consulting",
    description:
      "Throwaway service row created by pdaf-gate-proof.ts to exercise the real ad-copy generator through the distinctness gate. Safe to delete.",
    targetCustomer: BRIEF.targetMarket,
    mainBenefit: BRIEF.desiredOutcome,
    painPoints: BRIEF.pressingProblem,
  } as any);
  const serviceId = Number((ins as any).insertId);
  say(`created throwaway service id=${serviceId}`);

  // ── A THROWAWAY ICP, AND REAL CONCEPTS FOR IT ─────────────────────────────
  // ⚠️ WITHOUT THIS THE PROOF IS WEAKER THAN IT LOOKS. runAdCopyGeneration resolves its
  // ICP by serviceId (adCopyGenerator.ts:244); with no ICP there are no concepts, the
  // desire axis falls back to the single deck-constant value, and the gate would be
  // proven with only TWO usable axes — which is the pinned ceiling this whole chapter
  // exists to lift. Generating concepts here makes desire genuinely live, so the run
  // exercises the desire -> awareness -> format priority rather than skipping its first
  // choice.
  const [icpIns] = await db.insert(idealCustomerProfiles).values({
    userId: USER_ID,
    serviceId,
    name: LABEL,
    angleName: "operations consultants moving to retainers",
    introduction: "Independent operations consultants, 5-15 years in, billing hourly and capped by their own calendar.",
    pains: BRIEF.pressingProblem,
    fears: "that raising the model loses the client entirely, and that the pipeline goes quiet for a quarter",
    goals: BRIEF.desiredOutcome,
    frustrations: "scope creeps between the call and the proposal; the number keeps changing; nobody says no, they just stop replying",
    objections: "my clients would never agree to a retainer; my work is genuinely project-shaped",
    buyingTriggers: "a month where billable hours dropped but workload did not",
    source: "generated" as const,
  } as any);
  const icpId = Number((icpIns as any).insertId);
  say(`created throwaway ICP id=${icpId}`);

  // ⚠️ CONCEPTS TAKE MINUTES, NOT SECONDS — and more now that the yield fix over-generates
  // 1.5x. Do not read a long wait as a hang.
  // ensureConceptsForIcp is NON-BLOCKING by design — it returns a status
  // ("enqueued" / "exists" / "in_flight" / "retrying") and the work runs as a durable job.
  // So the harness has to POLL. CHECKPOINT §12.9: the job deliberately stays `pending` and
  // never moves to `running` (the reaper sweeps pending; `running` is never swept, which is
  // exactly how a dead job becomes a permanent zombie). A 240s window once timed out on a
  // job that was alive and later completed — poll for 10 minutes.
  say(`generating concepts (over-generated 1.5x by the yield fix; expect minutes)…`);
  const tC = Date.now();
  const conceptStatus = await ensureConceptsForIcp({ userId: USER_ID, icpId, serviceId });
  say(`ensureConceptsForIcp → "${conceptStatus}" (non-blocking; polling for the rows)`);

  const POLL_MS = 10 * 60 * 1000;
  let desireRows: any[] = [];
  while (Date.now() - tC < POLL_MS) {
    desireRows = await db
      .select({ desire: campaignConcepts.desire, awareness: campaignConcepts.awareness })
      .from(campaignConcepts).where(eq(campaignConcepts.icpId, icpId));
    if (desireRows.length > 0) break;
    await new Promise((r) => setTimeout(r, 15_000));
    say(`  …still waiting (${((Date.now() - tC) / 1000).toFixed(0)}s)`);
  }
  say(`concepts landed: ${desireRows.length} rows in ${((Date.now() - tC) / 1000).toFixed(1)}s`);
  if (desireRows.length === 0) {
    say("⚠️ NO CONCEPTS AFTER 10 MINUTES. The desire axis will fall back to the deck constant.");
    say("   Report that plainly — do not describe the desire axis as exercised.");
  }
  const distinctDesires = Array.from(new Set(desireRows.map((r: any) => String(r.desire ?? "").trim()).filter(Boolean)));
  say(`distinct desires available to the gate: ${distinctDesires.length}`);
  if (distinctDesires.length < 2) {
    say("⚠️ FEWER THAN TWO DESIRES — the desire axis is effectively pinned for this run, so the");
    say("   gate will fall to awareness/format. Say so in the report rather than claiming the");
    say("   desire axis was exercised.");
  }

  const t0 = Date.now();
  const res = await runAdCopyGeneration({ userId: USER_ID, serviceId, ...BRIEF });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  // The gate stashes its ledger here so the harness reports what the gate RECORDED rather
  // than reconstructing decisions from the rows that happen to have survived.
  const ledger: GateLedger | undefined = (globalThis as any).__ZAP_LAST_PDAF_LEDGER__;

  say(
    `\ngenerated in ${secs}s — adSetId=${res.adSetId}\n` +
    `headlines=${res.headlineCount} bodies=${res.bodyCount} links=${res.linkCount} ` +
    `(generated ${res.generatedCount}, dropped by the compliance gate ${res.droppedCount})`,
  );

  // ── THE LEDGER, printed from the gate's own record ────────────────────────
  say("\n" + "─".repeat(78));
  say("REGENERATION LEDGER — recorded by the gate, not inferred");
  rule();
  if (!ledger) {
    say("🔴 NO LEDGER FOUND. The gate did not run — investigate before reading anything below.");
  } else {
    say(formatLedger(ledger));
  }

  // ── A. Collapse among the rows that actually persisted ────────────────────
  const rows: any[] = await db
    .select({
      id: adCopy.id, contentType: adCopy.contentType, content: adCopy.content,
      bodyAngle: adCopy.bodyAngle, persona: adCopy.persona, desire: adCopy.desire,
      awareness: adCopy.awareness, format: adCopy.format,
    })
    .from(adCopy)
    .where(eq(adCopy.adSetId, res.adSetId));

  const labelsOf = (r: any): PdafLabels => ({
    persona: r.persona ?? null, desire: r.desire ?? null,
    awareness: r.awareness ?? null, format: r.format ?? null,
  });

  // THE POPULATION IS HEADLINES + BODIES. Links are excluded by the same locked decision
  // the gate applies — a 30-character CTA surface is not one of the three fused surfaces.
  const population = rows.filter((r) => r.contentType === "headline" || r.contentType === "body");
  const links = rows.filter((r) => r.contentType === "link");
  const kept = auditBatch(population.map((r) => ({ id: r.id, labels: labelsOf(r) })));

  say("\n" + "─".repeat(78));
  say("A. COLLAPSE AMONG THE KEPT ROWS — re-audited FROM THE DATABASE");
  rule();
  say(`population ${population.length} rows (${links.length} link rows excluded, never counted)`);
  say(`pairs ${kept.pairCount} · collapsing ${kept.collapsingPairs.length} (${pct(kept.collapseRate)})`);
  say(`histogram 0..4 axes differing: ${kept.differingHistogram.join(" · ")}`);
  if (ledger) {
    say(`\nBEFORE the gate (same deck, measured by the gate): ${ledger.collapsingPairsBefore} pairs (${pct(ledger.collapseRateBefore)})`);
    say(`AFTER  the gate (same deck, measured by the gate): ${ledger.collapsingPairsAfter} pairs (${pct(ledger.collapseRateAfter)})`);
  }
  say(
    `\nVERDICT A: ${kept.collapsingPairs.length === 0
      ? "✅ PASS — 0% collapse among the rows that persisted."
      : `🔴 FAIL — ${kept.collapsingPairs.length} collapsing pair(s) survived to the database.`}`,
  );
  if (kept.collapsingPairs.length > 0) {
    for (const p of kept.collapsingPairs.slice(0, 10)) {
      say(`   ids ${p.a} ↔ ${p.b}: only ${p.verdict.differingCount} axis differs (${p.verdict.differingDimensions.join(", ") || "none"})`);
    }
  }

  // ── B. The deck-wide echo proof point ─────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("B. DECK-WIDE ANTI-ECHO — did it catch a NON-PARTNER echo?");
  rule();
  const rewrites = ledger?.echoRewrites ?? [];
  const nonPartner = rewrites.filter((e) => !e.wasPartner);
  say(`echo rewrites this run ....... ${rewrites.length}`);
  say(`  against its OWN partner .... ${rewrites.length - nonPartner.length}  (pairwise checking would also have caught these)`);
  say(`  against a NON-PARTNER ...... ${nonPartner.length}  (ONLY a deck-wide check finds these)`);
  for (const e of rewrites) {
    say(`   ${e.id} echoed ${e.against} — "${e.shared}" ${e.wasPartner ? "[partner]" : "[NON-PARTNER ✅]"} (attempt ${e.attempt})`);
  }
  say(
    `\nVERDICT B: ${nonPartner.length > 0
      ? "✅ PASS — at least one body was rewritten for echoing a headline it was NOT generated beside."
      : "⚠️ NOT DEMONSTRATED THIS RUN — no non-partner echo occurred. This is not a gate failure; it means this particular deck did not produce one. Re-run, or report it honestly as undemonstrated. Do NOT claim the deck-wide check is proven without this line reading PASS."}`,
  );
  if ((ledger?.echoUnfixed?.length ?? 0) > 0) {
    say(`\n⚠️ ${ledger!.echoUnfixed.length} echo(es) still present after the cap:`);
    for (const e of ledger!.echoUnfixed) say(`   ${e.id} still echoes ${e.against} — "${e.shared}"`);
  }

  // ── The deck, for reading ─────────────────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("THE DECK — first 12 words of each body (the priming real estate)");
  rule();
  population.filter((r) => r.contentType === "body").forEach((b, i) => {
    const first = String(b.content).replace(/\s+/g, " ").split(" ").slice(0, 12).join(" ");
    say(`  ${String(i + 1).padStart(2)}. [${b.awareness}/${b.format}] ${first}…`);
  });
  say("\nHEADLINES:");
  population.filter((r) => r.contentType === "headline").forEach((h, i) => {
    say(`  ${String(i + 1).padStart(2)}. [${h.awareness}/${h.format}] ${h.content}`);
  });

  // ── Teardown — id-scoped, printed, NOT executed ───────────────────────────
  say("\n" + "─".repeat(78));
  say("TEARDOWN — id-scoped, NOT executed here");
  rule();
  const ids = rows.map((r) => r.id).join(",");
  say(`DELETE FROM adCopy WHERE id IN (${ids}) AND userId = ${USER_ID};   -- ${rows.length} rows`);
  say(`DELETE FROM campaignConcepts WHERE icpId = ${icpId} AND userId = ${USER_ID};   -- ${desireRows.length} concepts`);
  // ensureConceptsForIcp writes a durable jobs row with a DETERMINISTIC per-ICP id
  // (conceptGenerator.ts:454 — `concepts-icp-<icpId>`). It is inert and `jobs` has 24h
  // retention, but it is a production row this script creates, so teardown owns it.
  say(`DELETE FROM jobs WHERE id = '${conceptJobId(icpId)}' AND userId = '${USER_ID}';   -- 1 concept job`);
  say(`DELETE FROM idealCustomerProfiles WHERE id = ${icpId} AND userId = ${USER_ID};   -- 1 throwaway ICP`);
  say(`DELETE FROM services WHERE id = ${serviceId} AND userId = ${USER_ID};   -- 1 throwaway service`);
  say("");
  say("-- ⚠️ ID-SCOPED, NEVER userId-SCOPED. Smoke user 117174 OWNS the 25 protected");
  say("--    creatives on services 272-277; a userId-only delete would destroy them.");
  say("-- No creatives rendered: adCreatives baseline 405 untouched, no Cloudinary objects.");
  say("-- Reconcile after teardown: adCopy 5424 · headlines 2174 · adCreatives 405");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[pdaf-gate-proof] FAILED:", e);
    process.exit(1);
  });
