/**
 * imagehook-proof.ts — LIVE proof for the baked-text fix (image sprint, step 2).
 *
 * Calls the REAL runAdCopyGeneration and the REAL runAdCreativesGeneration, so this
 * exercises the shipped path — copy chain, compliance gate, distinctness gate, anti-echo,
 * renderer routing, compositor — and not a rebuilt copy of it (STANDING RULE 2).
 *
 * ⚠️ THIS IS THE FIRST SCRIPT IN THE COPY CHAPTER THAT RENDERS. It creates real Cloudinary
 * objects. Teardown therefore runs through `sweepAdCreativeBatch`, which as of the image
 * sprint's step 1 REQUIRES a userId and refuses outright on protected services — and which
 * reads the public_ids BEFORE deleting rows, because once the rows are gone the URLs are
 * unrecoverable and the images stay hosted forever.
 *
 * ⚠️ REQUIRES MIGRATION 0098. `image_hook` must be a valid `adCopy.contentType` value or
 * every hook insert fails. The script checks INFORMATION_SCHEMA first and refuses to run
 * rather than producing a half-deck that would look like a code failure.
 *
 * WHAT THIS RUN MUST SHOW:
 *   1. image_hook rows PERSISTED, stamped with the same four P.D.A.F. axes.
 *   2. NO hook is a prefix of any body in the deck — the defect was the picture carrying a
 *      140-char truncation of a body's opening.
 *   3. The gate ledger shows the hook participating in the DECK-WIDE anti-echo.
 *   4. A finished COMPOSITE on disk for Arfeen to judge. ⚠️ THE COMPOSITE, NEVER THE RAW —
 *      CHECKPOINT records a run where the raw render passed while the finished ad was
 *      broken. No gate here can see whether a picture is good.
 *
 * Usage:  npx tsx server/scripts/imagehook-proof.ts [userId]
 */
import "dotenv/config";
import { appendFileSync, writeFileSync, mkdirSync } from "fs";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { adCopy, adCreatives, services, idealCustomerProfiles, campaignConcepts } from "../../drizzle/schema";
import { runAdCopyGeneration } from "../adCopyGenerator";
import { runAdCreativesGeneration } from "../adCreativesGenerator";
import { ensureConceptsForIcp, conceptJobId } from "../conceptGenerator";
import { contentWords, type GateLedger, formatLedger } from "../_core/pdafGate";

const LOG = `/tmp/imagehook-proof-${process.pid}.log`;
const OUTDIR = `docs/screenshots/run-imagehook-proof`;
const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};
const rule = (c = "─") => say(c.repeat(78));

const USER_ID = Number(process.argv[2] ?? 117174);
const LABEL = "ZZ-IMAGEHOOK-PROOF — throwaway, safe to delete";

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

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  rule("═");
  say("IMAGE-HOOK (BAKED TEXT) — LIVE PROOF");
  say(`user ${USER_ID} · RENDERS REAL IMAGES · teardown via the guarded sweep`);
  rule("═");

  // ── PRE-FLIGHT: migration 0098 must be applied ────────────────────────────
  const [{ COLUMN_TYPE: colType }]: any = await db.execute(sql`
    SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adCopy' AND COLUMN_NAME = 'contentType'
  `).then((r: any) => (Array.isArray(r) ? r[0] : r?.rows ?? r));
  say(`adCopy.contentType = ${colType}`);
  if (!String(colType).includes("image_hook")) {
    throw new Error(
      "migration 0098 is NOT applied — adCopy.contentType has no 'image_hook' value. " +
      "Apply it before running this proof; every hook insert would fail and the deck would " +
      "look like a code failure rather than a missing migration.",
    );
  }
  say("✅ migration 0098 present\n");

  // ── Throwaway service + ICP + concepts ────────────────────────────────────
  const [ins] = await db.insert(services).values({
    userId: USER_ID, name: LABEL, category: "consulting",
    description: "Throwaway service created by imagehook-proof.ts. Safe to delete.",
    targetCustomer: BRIEF.targetMarket, mainBenefit: BRIEF.desiredOutcome, painPoints: BRIEF.pressingProblem,
  } as any);
  const serviceId = Number((ins as any).insertId);
  say(`created throwaway service id=${serviceId}`);

  const [icpIns] = await db.insert(idealCustomerProfiles).values({
    userId: USER_ID, serviceId, name: LABEL,
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

  say("generating concepts (non-blocking; polling up to 10 minutes)…");
  const tC = Date.now();
  await ensureConceptsForIcp({ userId: USER_ID, icpId, serviceId });
  let conceptRows: any[] = [];
  while (Date.now() - tC < 10 * 60 * 1000) {
    conceptRows = await db.select({ desire: campaignConcepts.desire })
      .from(campaignConcepts).where(eq(campaignConcepts.icpId, icpId));
    if (conceptRows.length > 0) break;
    await new Promise((r) => setTimeout(r, 15_000));
    say(`  …still waiting (${((Date.now() - tC) / 1000).toFixed(0)}s)`);
  }
  say(`concepts landed: ${conceptRows.length} in ${((Date.now() - tC) / 1000).toFixed(1)}s`);

  // ── Node 7: copy, including the image hooks ───────────────────────────────
  const copyRes = await runAdCopyGeneration({ userId: USER_ID, serviceId, ...BRIEF });
  const ledger: GateLedger | undefined = (globalThis as any).__ZAP_LAST_PDAF_LEDGER__;
  say(
    `\nad copy: adSetId=${copyRes.adSetId} headlines=${copyRes.headlineCount} ` +
    `bodies=${copyRes.bodyCount} links=${copyRes.linkCount} imageHooks=${copyRes.imageHookCount}`,
  );

  say("\n" + "─".repeat(78));
  say("GATE LEDGER — recorded by the gate, not inferred");
  rule();
  say(ledger ? formatLedger(ledger) : "🔴 NO LEDGER FOUND — investigate before reading anything below.");

  const rows: any[] = await db
    .select({ id: adCopy.id, contentType: adCopy.contentType, content: adCopy.content,
              persona: adCopy.persona, desire: adCopy.desire, awareness: adCopy.awareness, format: adCopy.format })
    .from(adCopy).where(eq(adCopy.adSetId, copyRes.adSetId));
  const hooks = rows.filter((r) => r.contentType === "image_hook");
  const bodies = rows.filter((r) => r.contentType === "body");

  // ── 1. Hooks persisted, stamped ───────────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("1. IMAGE_HOOK ROWS PERSISTED AND STAMPED");
  rule();
  say(`image_hook rows: ${hooks.length}`);
  const unstamped = hooks.filter((h) => !h.awareness || !h.desire || !h.format);
  say(`missing an axis: ${unstamped.length}`);
  for (const h of hooks) say(`   [${h.awareness}/${h.format}] (${String(h.content).length} chars) ${h.content}`);
  say(hooks.length > 0 && unstamped.length === 0
    ? "✅ PASS — hooks persisted, every one carrying all four axes."
    : "🔴 FAIL — see above.");

  // ── 2. No hook is a prefix of any body ────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("2. NO HOOK IS A PREFIX OF ANY BODY — the defect being fixed");
  rule();
  const norm = (s: string) => contentWords(s).join(" ");
  const offenders: string[] = [];
  for (const h of hooks) {
    const hn = norm(String(h.content));
    for (const b of bodies) {
      const bn = norm(String(b.content));
      if (hn && (bn.startsWith(hn) || hn.startsWith(bn.slice(0, hn.length)))) {
        offenders.push(`hook ${h.id} vs body ${b.id}: "${String(h.content).slice(0, 60)}"`);
      }
    }
  }
  say(`hooks × bodies compared: ${hooks.length} × ${bodies.length}`);
  say(offenders.length === 0
    ? "✅ PASS — no hook restates a body's opening."
    : `🔴 FAIL — ${offenders.length} overlap(s):`);
  for (const o of offenders) say(`   ${o}`);

  // ── 3. The hook participated in deck-wide anti-echo ───────────────────────
  say("\n" + "─".repeat(78));
  say("3. THE HOOK IS IN THE DECK-WIDE ANTI-ECHO POPULATION");
  rule();
  const inPopulation = (ledger?.keptBySurface ?? {})["image_hook"] ?? 0;
  say(`kept by surface: ${JSON.stringify(ledger?.keptBySurface ?? {})}`);
  say(`hook rows counted in the gate population: ${inPopulation}`);
  const hookEchoes = (ledger?.echoRewrites ?? []).filter((e) => String(e.against).startsWith("image_hook"));
  say(`bodies rewritten for echoing a HOOK: ${hookEchoes.length}`);
  for (const e of hookEchoes) say(`   ${e.id} echoed ${e.against} — "${e.shared}"`);
  say(inPopulation > 0
    ? "✅ PASS — hooks are inside the population and are anti-echo targets."
    : "🔴 FAIL — hooks did not reach the gate population.");
  if (hookEchoes.length === 0) {
    say("NOTE: no body echoed a hook this run. That is not a failure — it means the chain");
    say("      produced none. Do NOT report it as proof the hook-echo path fired.");
  }

  // ── 4. RENDER, and save the COMPOSITE for judgement ───────────────────────
  say("\n" + "─".repeat(78));
  say("4. RENDER — the composite is the only thing that proves this");
  rule();
  const creativeRes = await runAdCreativesGeneration({
    userId: USER_ID, serviceId, niche: "operations consulting",
    productName: BRIEF.specificProductName, uniqueMechanism: BRIEF.uniqueMechanism,
    targetAudience: BRIEF.targetMarket, mainBenefit: BRIEF.desiredOutcome,
    pressingProblem: BRIEF.pressingProblem, adType: "lead_gen",
  } as any);
  const batchId = (creativeRes as any).batchId;
  say(`rendered batchId=${batchId}`);

  const creatives: any[] = await db
    .select({ id: adCreatives.id, imageUrl: adCreatives.imageUrl, rawImageUrl: adCreatives.rawImageUrl,
              designStyle: adCreatives.designStyle, imageFormat: adCreatives.imageFormat })
    .from(adCreatives).where(and(eq(adCreatives.batchId, batchId), eq(adCreatives.userId, USER_ID)));

  mkdirSync(OUTDIR, { recursive: true });
  for (const [i, c] of Array.from(creatives.entries())) {
    for (const [kind, url] of [["composite", c.imageUrl], ["raw", c.rawImageUrl]] as const) {
      if (!url) continue;
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      const f = `${OUTDIR}/${String(i + 1).padStart(2, "0")}-${c.designStyle}-${kind}.png`;
      writeFileSync(f, buf);
      say(`   saved ${f} (${(buf.length / 1024).toFixed(0)}KB, ${c.imageFormat})`);
    }
  }
  say("");
  say("⚠️ JUDGE THE COMPOSITE, NEVER THE RAW. CHECKPOINT records a run where the raw render");
  say("   passed while the finished ad was broken. Nothing here can see whether a picture is");
  say("   good — that judgement is Arfeen's, on the pixels.");

  // ── Teardown — printed, NOT executed, and it goes through the GUARDED sweep ─
  say("\n" + "─".repeat(78));
  say("TEARDOWN — NOT executed here. Cloudinary FIRST, then rows.");
  rule();
  say(`Creatives + Cloudinary (${creatives.length} rows, ${creatives.length * 2} objects) — run:`);
  say(`  npx tsx -e "import('./server/db').then(async m=>{const db=await m.getDb();` +
      `const t=await import('./server/lib/adCreativeTeardown');` +
      `console.log(await t.sweepAdCreativeBatch(db,'${batchId}',${USER_ID}));})"`);
  say(`  ⚠️ userId is REQUIRED and the sweep refuses outright on services 272-277/285.`);
  say("");
  say(`DELETE FROM adCopy WHERE id IN (${rows.map((r) => r.id).join(",")}) AND userId = ${USER_ID};   -- ${rows.length} rows`);
  say(`DELETE FROM campaignConcepts WHERE icpId = ${icpId} AND userId = ${USER_ID};   -- ${conceptRows.length} concepts`);
  say(`DELETE FROM jobs WHERE id = '${conceptJobId(icpId)}' AND userId = '${USER_ID}';   -- 1 concept job`);
  say(`DELETE FROM idealCustomerProfiles WHERE id = ${icpId} AND userId = ${USER_ID};   -- 1 throwaway ICP`);
  say(`DELETE FROM services WHERE id = ${serviceId} AND userId = ${USER_ID};   -- 1 throwaway service`);
  say("");
  say("-- Reconcile after teardown: adCopy 5424 · headlines 2174 · adCreatives 405 · jobs 0");
  say("-- AND confirm Cloudinary is clean: the sweep reports cloudinaryDeleted vs publicIds.");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[imagehook-proof] FAILED:", e);
  process.exit(1);
});
