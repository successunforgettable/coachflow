/**
 * publish-reroute-payload-proof.ts — PAYLOAD-LEVEL proof of publish-path step 1.
 *
 * ⚠️ CALLS META NEVER. It constructs the exact outgoing payload the rerouted publish path
 * would send and diffs it against the captured control payload. The live paused run is a
 * separate step needing Arfeen's explicit word.
 *
 * ⚠️ WHY IT GENERATES COPY FIRST. Verified 2026-08-09: ALL 5424 production adCopy rows have
 * NULL axes. Migration 0097 added the columns; the code that WRITES them is the undeployed
 * copy engine, and every gated row from this session's proofs was torn down. So no service
 * anywhere currently has gated Node 7 copy, and the proof has to create some.
 *
 * ⚠️ WHY A THROWAWAY THAT MIRRORS SERVICE 270. The control run used service 270 / LP 221
 * (postpartum fitness). Generating onto a throwaway with the SAME brief keeps the diff
 * about the thing under test — WHERE the copy comes from — rather than about two different
 * offers. The throwaway has no landing page of its own (only userId 1 has published LPs, 35
 * of them; the smoke account has none), so the payload borrows LP 221's real published URL
 * as `linkUrl`. `linkUrl` is not under test here and is passed through unchanged by both the
 * old and new paths.
 *
 * ⚠️ RUNS AS userId 1. Not for Meta's sake — nothing is published — but because LP 221
 * belongs to user 1 and the resolver is userId-scoped.
 *
 * Usage:  npx tsx server/scripts/publish-reroute-payload-proof.ts
 */
import "dotenv/config";
import { appendFileSync } from "fs";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { adCopy, services, idealCustomerProfiles, campaignConcepts, landingPages } from "../../drizzle/schema";
import { runAdCopyGeneration } from "../adCopyGenerator";
import { ensureConceptsForIcp, conceptJobId } from "../conceptGenerator";
import { resolveGatedPublishCopy } from "../_core/publishCopySource";
import { measureHeadlineFit } from "../_core/compositeHeadline";

const LOG = `/tmp/publish-reroute-payload-proof-${process.pid}.log`;
const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};
const rule = (c = "─") => say(c.repeat(78));

const USER_ID = 1;
const LP_ID = 221;
const LABEL = "ZZ-CONTROL-REROUTE-PAYLOAD — throwaway, safe to delete";

/** The captured control payload — CHECKPOINT §0, the 2026-08-09 control run. */
const CONTROL = {
  headline: "Lose the mum tummy. Feel like you.",
  headlineSource: "adCreatives.headline — image-engine side-generation, UNGATED",
  body:
    "This is not a workout class and it is not a meal plan handout. It is the explanation " +
    "nobody gave you at your 6-week check — why your postpartum body responds differently to " +
    "everything you used to do, and exactly what to do instead.",
  bodySource: "landingPages.freeAngle.subheadline — PAGE copy, never screened as ad copy",
  outcome: "BLOCKED at meta.ts:316 — classes=[second_person_protected_attribute]. 0 Graph calls fired.",
};

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  rule("═");
  say("PUBLISH-PATH STEP 1 — PAYLOAD PROOF (no Meta call)");
  rule("═");

  const [lp]: any[] = await db.select().from(landingPages).where(eq(landingPages.id, LP_ID));
  if (!lp?.publicUrl) throw new Error(`LP ${LP_ID} is not published`);
  const [src]: any[] = await db.select().from(services).where(eq(services.id, lp.serviceId));
  if (!src) throw new Error(`source service ${lp.serviceId} not found`);
  say(`mirroring service ${src.id} ("${src.name}") · borrowing its published LP ${LP_ID}`);

  // ── Throwaway carrying the SAME brief ─────────────────────────────────────
  const [ins] = await db.insert(services).values({
    userId: USER_ID, name: LABEL, category: src.category ?? "coaching",
    description: "Throwaway created by publish-reroute-payload-proof.ts. Safe to delete.",
    targetCustomer: src.targetCustomer, mainBenefit: src.mainBenefit, painPoints: src.painPoints,
  } as any);
  const serviceId = Number((ins as any).insertId);
  const [icpIns] = await db.insert(idealCustomerProfiles).values({
    userId: USER_ID, serviceId, name: LABEL,
    angleName: String(src.targetCustomer ?? "").slice(0, 120) || "target buyer",
    introduction: String(src.description ?? "").slice(0, 400),
    pains: src.painPoints, fears: src.painPoints, goals: src.mainBenefit,
    frustrations: src.painPoints, objections: "this will not work for me",
    buyingTriggers: "a month where nothing changed", source: "generated" as const,
  } as any);
  const icpId = Number((icpIns as any).insertId);
  say(`created throwaway service ${serviceId} · ICP ${icpId}`);

  say("generating concepts (the desire axis; polling up to 10 minutes)…");
  const tC = Date.now();
  await ensureConceptsForIcp({ userId: USER_ID, icpId, serviceId });
  let concepts: any[] = [];
  while (Date.now() - tC < 10 * 60 * 1000) {
    concepts = await db.select({ desire: campaignConcepts.desire })
      .from(campaignConcepts).where(eq(campaignConcepts.icpId, icpId));
    if (concepts.length > 0) break;
    await new Promise((r) => setTimeout(r, 15_000));
  }
  say(`concepts landed: ${concepts.length} in ${((Date.now() - tC) / 1000).toFixed(1)}s`);

  const copyRes: any = await runAdCopyGeneration({
    userId: USER_ID, serviceId,
    adType: "lead_gen", adStyle: "direct", adCallToAction: "Learn More",
    targetMarket: String(src.targetCustomer ?? ""),
    productCategory: String(src.category ?? "coaching"),
    specificProductName: String(src.name ?? "the programme"),
    pressingProblem: String(src.painPoints ?? ""),
    desiredOutcome: String(src.mainBenefit ?? ""),
    uniqueMechanism: String(src.name ?? "the method"),
  } as any);
  say(`gated copy: adSet=${copyRes.adSetId} headlines=${copyRes.headlineCount} bodies=${copyRes.bodyCount} hooks=${copyRes.imageHookCount}`);

  // ── THE REROUTE, resolved by the shipped code ─────────────────────────────
  const gated = await resolveGatedPublishCopy(db, USER_ID, serviceId, { canvasWidth: 896 });
  if (gated.unavailableReason) throw new Error(`resolver refused: ${gated.unavailableReason}`);
  const h = gated.headline!, b = gated.body!;

  say("\n" + "─".repeat(78));
  say("NEW OUTGOING PAYLOAD — what the rerouted publish path would send");
  rule();
  say(`headline (Meta headline field): "${h.text}"   [${h.text.length} chars]`);
  say(`  ← adCopy id ${h.id} · axes ${h.awareness}/${h.format} · desire "${String(h.desire ?? "").slice(0, 40)}"`);
  say(`  ← compliance CHECKED AT GENERATION: ${h.complianceCheckedAt ? "yes" : "🔴 NO"} (score ${h.complianceScore ?? "—"}, v${h.complianceVersion ?? "—"})`);
  say(`body (Meta primary text):       "${b.text.slice(0, 220)}${b.text.length > 220 ? "…" : ""}"   [${b.text.length} chars]`);
  say(`  ← adCopy id ${b.id} · axes ${b.awareness}/${b.format} · desire "${String(b.desire ?? "").slice(0, 40)}"`);
  say(`  ← compliance CHECKED AT GENERATION: ${b.complianceCheckedAt ? "yes" : "🔴 NO"} (score ${b.complianceScore ?? "—"}, v${b.complianceVersion ?? "—"})`);
  say(`linkUrl: ${lp.publicUrl}   (borrowed from LP ${LP_ID}; not under test)`);
  say(`provenance: headlineAdCopyId=${h.id} bodyAdCopyId=${b.id} copyAdSetId=${gated.adSetId}`);

  // ── The rendered-width rule ───────────────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("LENGTH RULE — measured in RENDERED WIDTH, not characters");
  rule();
  for (const w of [896, 1024]) {
    const fit = measureHeadlineFit(h.text, w, "lower");
    say(`  ${w}px canvas → ${fit.lines.length} line(s) @ ${fit.fontSize}px, widest ${fit.widestLine}/${fit.maxWidth}px — ${fit.fits ? "✅ no truncation" : "🔴 WOULD TRUNCATE"}`);
  }
  say(`  candidates rejected for width: ${gated.rejectedForWidth.length}${gated.rejectedForWidth.length ? " → " + gated.rejectedForWidth.map((r) => `#${r.id}`).join(", ") : ""}`);

  // ── Same gate the control died on, run WITHOUT publishing ─────────────────
  say("\n" + "─".repeat(78));
  say("THE COMPLIANCE GATE THE CONTROL RUN DIED ON — re-run on the new payload");
  rule();
  const { checkOutput } = await import("../_core/complianceAxis");
  const { buildCoachCorpus, buildProofSupplied } = await import("../_core/groundingCorpus");
  const [svc]: any[] = await db.select().from(services).where(eq(services.id, serviceId));
  const [gIcp]: any[] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, serviceId));
  const runGate = (headline: string, body: string) => checkOutput(
    [
      { location: "headline", text: headline, role: "short" as const },
      { location: "body", text: body, role: "body" as const },
      { location: "callToAction", text: "Learn More", role: "cta" as const },
    ],
    { corpus: buildCoachCorpus({ service: svc, groundingMeta: (gIcp as any)?.groundingMeta }), supplied: buildProofSupplied(svc) },
    { requireGrounding: true },
  );
  const newGate: any = runGate(h.text, b.text);
  const ctlGate: any = runGate(CONTROL.headline, CONTROL.body);
  say(`CONTROL payload  → blocking hits: ${(ctlGate?.blocking ?? []).length} ${(ctlGate?.blocking ?? []).length ? `[${Array.from(new Set((ctlGate.blocking as any[]).map((x) => x.classId))).join(",")}]` : ""}`);
  say(`REROUTED payload → blocking hits: ${(newGate?.blocking ?? []).length} ${(newGate?.blocking ?? []).length ? `[${Array.from(new Set((newGate.blocking as any[]).map((x) => x.classId))).join(",")}]` : ""}`);
  say((newGate?.blocking ?? []).length === 0
    ? "✅ the rerouted payload CLEARS the gate that blocked the control."
    : "🔴 the rerouted payload would ALSO be blocked — report, do not work around.");

  // ── Side by side ──────────────────────────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("BEFORE / AFTER");
  rule();
  say("HEADLINE FIELD");
  say(`  before: "${CONTROL.headline}"`);
  say(`          ${CONTROL.headlineSource}`);
  say(`  after:  "${h.text}"`);
  say(`          adCopy ${h.id}, gated (${h.awareness}/${h.format}), compliance-screened at generation`);
  say("PRIMARY TEXT");
  say(`  before: "${CONTROL.body.slice(0, 150)}…"`);
  say(`          ${CONTROL.bodySource}`);
  say(`  after:  "${b.text.slice(0, 150)}${b.text.length > 150 ? "…" : ""}"`);
  say(`          adCopy ${b.id}, gated (${b.awareness}/${b.format}), compliance-screened at generation`);
  say(`  control outcome: ${CONTROL.outcome}`);

  // ── Teardown, printed only ────────────────────────────────────────────────
  const rows: any[] = await db.select({ id: adCopy.id }).from(adCopy).where(eq(adCopy.adSetId, copyRes.adSetId));
  say("\n" + "─".repeat(78));
  say("TEARDOWN — NOT executed. No images rendered, so Cloudinary is not involved.");
  rule();
  say(`DELETE FROM adCopy WHERE adSetId = '${copyRes.adSetId}' AND userId = ${USER_ID};   -- ${rows.length} rows`);
  say(`DELETE FROM campaignConcepts WHERE icpId = ${icpId} AND userId = ${USER_ID};   -- ${concepts.length} concepts`);
  say(`DELETE FROM jobs WHERE id = '${conceptJobId(icpId)}' AND userId = '${USER_ID}';`);
  say(`DELETE FROM idealCustomerProfiles WHERE id = ${icpId} AND userId = ${USER_ID};`);
  say(`DELETE FROM services WHERE id = ${serviceId} AND userId = ${USER_ID};`);
  say("-- Reconcile: adCopy 5424 · headlines 2174 · adCreatives 405 · protected 29");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[publish-reroute-payload-proof] FAILED:", e);
  process.exit(1);
});
