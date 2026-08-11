/**
 * step4c-multiad-publish.ts — N assembled ads into ONE campaign and ONE ad set, on the REAL
 * ad account. The structural capability this product has never proven.
 *
 * ⚠️⚠️ THIS IS THE ONLY SCRIPT IN THE REPO THAT WRITES TO A LIVE AD ACCOUNT. ⚠️⚠️
 *
 * `act_1254349025145319` ("KS 1") is ACTIVE, bills in **AED**, and carries roughly
 * **AED 1,168,324** of lifetime spend across ~200 real campaigns. It is Arfeen's own
 * advertising account, not a sandbox. It runs as **userId 1** because the Meta token is bound
 * to user 1 — the 117174 smoke account cannot publish.
 *
 * ── THREE PHASES, THREE INVOCATIONS ─────────────────────────────────────────────────────────
 *
 *   npx tsx server/scripts/step4c-multiad-publish.ts             → prints the plan, EXITS. No calls.
 *   …                                                 --prepare  → builds the throwaway. NO META AT ALL.
 *   …                                                 --publish  → the live ad-account write. Word #1.
 *   …                                                 --teardown → deletes it again.       Word #2.
 *
 * **Why three and not two (changed 2026-08-11).** The 2026-08-10 attempt spent about twelve
 * minutes generating concepts, copy, four images and a landing page BEFORE it ever reached
 * Meta — and then died on the landing page, inside that same long window, having consumed the
 * publish authorisation without touching the ad account. All of that generation is already
 * proven by step 3 and 4b; none of it is what 4c tests. Splitting it out means `--publish` is
 * short, its failure surface is only the thing under test, and a generation hiccup no longer
 * costs an approval. It also lets a failed `--publish` be retried against the SAME prepared
 * set instead of rebuilding one.
 *
 * ⚠️ `--prepare` and `--publish` MUST run on the same machine: the state file and the ledger
 * live in /tmp, and `assertPublishable` refuses a state file prepared on another host.
 *
 * ── THE SAFEGUARDS, AND WHERE EACH ONE LIVES ────────────────────────────────────────────────
 *
 *   · live `GET /me` FIRST — a stale token stops everything before a single object is made
 *   · the prepared service must still EXIST — `--publish` refuses to publish against a set that
 *     has already been torn down
 *   · `campaignLabelFor` — "ZZ-4C-MULTIAD-<stamp>", and it REFUSES "Auto Campaign Kit"
 *   · `createPublishLedger` — every Meta id hits disk the instant Meta returns it
 *   · the run-state file — every LOCAL id hits disk the instant the row exists, so a crash at
 *     any point still leaves teardown a complete work list
 *   · `publishAssembledAds` — screens EVERY ad before the campaign exists; a fully blocked push
 *     creates nothing, and a failure part-way keeps what landed
 *   · `assertDailyBudgetFloor` — AED 20 pinned, refuses below 4 (our z.min(1) assumes USD)
 *   · PAUSED applied at campaign, ad set AND ad
 *   · `readBackPublishedSet` — proves from META's stored state that the ads share one ad set
 *   · `teardownRecordedCampaign` — deletes ONLY the recorded id, refuses the five protected
 *     campaigns, confirms by id, and proves the three orphans are untouched. **Unchanged.**
 *   · `metaPhasePlan` — when NOTHING was ever created on Meta, teardown skips that phase rather
 *     than throwing, and goes straight to the local sweep
 *
 * All of the above are unit-proven with fakes in metaSafety.test.ts, publishLedger.test.ts,
 * metaTeardown.test.ts, step4cPageAnswers.test.ts and step4cRunState.test.ts. This file is the
 * wiring; the guards are not implemented inline here.
 */
import "dotenv/config";
import { hostname } from "os";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  adCreatives, adCopy, services, idealCustomerProfiles, campaignConcepts, headlines,
  landingPages, metaPublishedAds, users, coachAssets,
} from "../../drizzle/schema";
import type { LandingPageContent } from "../../drizzle/schema";
import { runAdCopyGeneration } from "../adCopyGenerator";
import { runAdCreativesGeneration } from "../adCreativesGenerator";
import { runLandingPageGeneration } from "../landingPageGenerator";
import { runLandingPagePublish } from "../landingPagePublisher";
import { ensureConceptsForIcp, conceptJobId } from "../conceptGenerator";
import { sweepAdCreativeBatch } from "../lib/adCreativeTeardown";
import { assembleConceptAds, describeAssembly } from "../_core/adAssembly";
import { publishAssembledAds } from "../_core/multiAdPublish";
import { createPublishLedger, readLedgerLines } from "../_core/publishLedger";
import { readBackPublishedSet, teardownRecordedCampaign } from "../_core/metaTeardown";
import {
  PINNED_DAILY_BUDGET_AED, assertDailyBudgetFloor, assertSafeCampaignName, campaignLabelFor,
} from "../_core/metaSafety";
import {
  assertNoOperatorTokens, assertNoSentinelAnswers, collectTokens, planOperatorAnswers,
} from "../_core/step4cPageAnswers";
import {
  assertPublishable, emptyRunState, mergeRunState, metaPhasePlan, type Step4cRunState,
} from "../_core/step4cRunState";

const USER_ID = 1; // the Meta token is bound to user 1; the smoke account cannot publish
const MAX_ADS = 3; // two would prove shared membership; three shows it is not a special case
const MIN_ADS = 2; // below this the structural claim is unprovable — stop

const STATE = "/tmp/step4c-state.json";
const LEDGER = "/tmp/step4c-ledger.jsonl";
const LOG = `/tmp/step4c-multiad-${process.pid}.log`;

const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};
const rule = (c = "─") => say(c.repeat(78));

const BRIEF = {
  targetMarket: "operations consultants who bill by the hour and want to move to retainers",
  pressingProblem: "proposals sit unsent for days while the scope keeps moving, and the client goes quiet",
  desiredOutcome: "a booked retainer conversation within two weeks of first contact",
  uniqueMechanism: "the Scope-First Sequence",
};
const LABEL = "ZZ-4C-MULTIAD — throwaway, safe to delete";

// ══════════════════════════════════════════════════════════════════════════════
// RUN STATE — written the instant each artifact exists, never at the end
// ══════════════════════════════════════════════════════════════════════════════

/**
 * The whole point of fix 2: a crash between creating a row and recording its id produces an
 * orphan nobody can find later. So every insert is followed IMMEDIATELY by one of these, and
 * the file is rewritten in full each time (it is a few hundred bytes — a partial append is a
 * worse failure than a rewrite).
 */
let runState: Step4cRunState | null = null;

function saveState(patch: Partial<Step4cRunState>): Step4cRunState {
  if (!runState) throw new Error("internal: saveState before the state was initialised");
  runState = mergeRunState(runState, patch, new Date().toISOString());
  writeFileSync(STATE, JSON.stringify(runState, null, 2));
  return runState;
}

function loadState(): Step4cRunState {
  if (!existsSync(STATE)) {
    throw new Error(
      `no ${STATE} — nothing recorded. If a run crashed before writing anything, there is nothing ` +
      `local to tear down either; confirm with a direct query before assuming so.`,
    );
  }
  return JSON.parse(readFileSync(STATE, "utf8")) as Step4cRunState;
}

function ledgerCampaignId(): string | null {
  if (!existsSync(LEDGER)) return null;
  const entries = readLedgerLines(readFileSync(LEDGER, "utf8").split("\n"));
  return entries.find((e) => e.kind === "campaign")?.id ?? null;
}

function ledgerAdIds(): string[] {
  if (!existsSync(LEDGER)) return [];
  return readLedgerLines(readFileSync(LEDGER, "utf8").split("\n"))
    .filter((e) => e.kind === "ad").map((e) => e.id);
}

/**
 * THE FIRST THING THE PUBLISH PHASE DOES. Our `tokenExpiresAt` proves only what we BELIEVE; a
 * rotated app secret or a disconnected account leaves the row looking perfect and fails on the
 * first write. A stale token here means stop — never "try and see".
 */
async function assertTokenLive(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { metaAccessTokens } = await import("../../drizzle/schema");
  const { decryptToken } = await import("../_core/tokenCrypto");
  const [row] = await db.select().from(metaAccessTokens).where(eq(metaAccessTokens.userId, USER_ID)).limit(1);
  if (!row) throw new Error("STOP — no meta_access_tokens row for user 1. Nothing was attempted.");
  if (new Date() >= new Date((row as any).tokenExpiresAt)) {
    throw new Error(`STOP — the stored Meta token expired at ${(row as any).tokenExpiresAt}. Reconnect first.`);
  }
  const token = decryptToken((row as any).accessToken);
  const url = new URL("https://graph.facebook.com/v21.0/me");
  url.searchParams.set("access_token", token);
  url.searchParams.set("fields", "id,name");
  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `STOP — Meta rejected the token on GET /me (HTTP ${res.status}): ${text.slice(0, 300)}. ` +
      `Nothing was created. Reconnect Meta before retrying.`,
    );
  }
  const me = JSON.parse(text);
  say(`✅ token LIVE — Meta answered as ${me.name} (${me.id})`);
}

async function baselines(db: any) {
  const one = async (t: any) => Number((await db.select({ n: sql<number>`COUNT(*)` }).from(t))[0].n);
  return {
    adCopy: await one(adCopy), headlines: await one(headlines), adCreatives: await one(adCreatives),
    concepts: await one(campaignConcepts), published: await one(metaPublishedAds),
  };
}

async function protectedTotal(db: any): Promise<string> {
  const rows: any = await db.execute(sql`
    SELECT serviceId, COUNT(*) n FROM adCreatives WHERE serviceId IN (272,273,274,275,276,277,285) GROUP BY serviceId
  `);
  const pr = (Array.isArray(rows) ? rows[0] : (rows as any)?.rows ?? rows) as any[];
  const total = (pr ?? []).reduce((a: number, r: any) => a + Number(r.n), 0);
  return `${total} — ${(pr ?? []).map((r: any) => `${r.serviceId}:${r.n}`).join(" ")}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// FIX 1 — the throwaway page answers its own operator questions
// ══════════════════════════════════════════════════════════════════════════════

const ANGLE_COLS = ["originalAngle", "godfatherAngle", "freeAngle", "dollarAngle"] as const;

/**
 * Clear every operator token on the throwaway page THROUGH THE COACH'S OWN PATH.
 *
 * `applyOperatorAnswer` is the unified action the live operator intake calls
 * (`landingPages.answerOperatorField`): it substitutes the token in the prose AND sets the
 * structured field (price.amount, eventSchedule.*), returning a coach-scoped write where the
 * answer belongs on the users row instead. Answering any other way — patching the JSON, or
 * seeding `placeholderValues` — would publish a page under conditions no coach can reach.
 *
 * 🔑 `placeholderValues` is NOT the mechanism here and seeding it does nothing: the landing-page
 * publisher never calls `buildResolvedMap`. That registry is read at the Meta and GHL export
 * points only. This was the actual cause of the 2026-08-10 failure.
 *
 * Every angle column is answered, not just the active one, so the page is consistent if the
 * active angle is ever switched — the same thing `reanswerOperatorField` does.
 */
async function answerPageOperatorQuestions(
  db: any,
  landingPageId: number,
): Promise<{ answeredTokens: string[]; coachFieldsBefore: Record<string, string | null> }> {
  const { applyOperatorAnswer, deriveOperatorQuestions } = await import("../lib/templates/operatorFields");

  const [page] = await db.select().from(landingPages)
    .where(and(eq(landingPages.id, landingPageId), eq(landingPages.userId, USER_ID))).limit(1);
  if (!page) throw new Error(`STOP — landing page ${landingPageId} not found for user ${USER_ID}`);

  const angleKey = ((page as any).activeAngle || "original") as "original" | "godfather" | "free" | "dollar";
  const activeContent = ((page as any)[`${angleKey}Angle`] || (page as any).originalAngle) as LandingPageContent | null;
  const [coachRow] = await db.select({ bookingUrl: users.bookingUrl }).from(users).where(eq(users.id, USER_ID)).limit(1);

  // Both halves are needed. A structured hold (an unanswered sales price) is asked for with no
  // token anywhere in the prose; an auto-fill token is baked in the prose and never asked. The
  // 2026-08-10 failure was the first kind.
  const baked = collectTokens(activeContent ?? {});
  const asked = deriveOperatorQuestions((page as any).pageType, activeContent, { bookingUrl: coachRow?.bookingUrl })
    .map((q) => q.token);
  const plan = planOperatorAnswers(baked, asked);
  assertNoSentinelAnswers(plan);

  // Snapshot the coach-scoped fields BEFORE anything is written, so teardown can restore them.
  // `bookingUrl` is the only coach-scoped path in the registry today; if another is ever added
  // this snapshot must grow with it or teardown will silently stop reversing it.
  const coachFieldsBefore: Record<string, string | null> = {};

  if (plan.length === 0) {
    say("   the page asked nothing — no operator tokens baked and no structured holds");
    return { answeredTokens: [], coachFieldsBefore };
  }
  say(`   answering ${plan.length} operator question(s): ${plan.map((p) => `${p.token}${p.source === "fallback" ? " (fallback)" : ""}`).join(", ")}`);

  for (const step of plan) {
    const fresh = await db.select().from(landingPages).where(eq(landingPages.id, landingPageId)).limit(1);
    const row = fresh[0];
    const update: Record<string, LandingPageContent> = {};
    let coachColumn: { column: string; value: string } | undefined;
    for (const col of ANGLE_COLS) {
      const angle = (row as any)[col] as LandingPageContent | null;
      if (!angle) continue;
      const applied = applyOperatorAnswer(angle, step.token, step.answer);
      update[col] = applied.content;
      if (applied.coachColumn) coachColumn = applied.coachColumn;
    }
    if (Object.keys(update).length > 0) {
      await db.update(landingPages).set(update as any).where(eq(landingPages.id, landingPageId));
    }
    // A coach-scoped answer (booking URL) belongs on the users row — the same write the live
    // mutation performs. Recorded in the state file because it is a change OUTSIDE the throwaway
    // and teardown must know it happened.
    if (coachColumn) {
      if (!(coachColumn.column in coachFieldsBefore)) {
        const [priorRow] = await db.execute(
          sql`SELECT ${sql.identifier(coachColumn.column)} AS v FROM users WHERE id = ${USER_ID}`,
        ) as any;
        const prior = Array.isArray(priorRow) ? priorRow[0] : priorRow;
        coachFieldsBefore[coachColumn.column] = prior?.v ?? null;
      }
      await db.update(users).set({ [coachColumn.column]: coachColumn.value } as any).where(eq(users.id, USER_ID));
      say(`   ⚠️ wrote users.${coachColumn.column} for user ${USER_ID} — a coach-scoped answer, not a ` +
          `throwaway row. Prior value recorded; teardown restores it.`);
    }
  }

  // Re-derive from the UPDATED page: the answers must have actually cleared the questions.
  const [after] = await db.select().from(landingPages).where(eq(landingPages.id, landingPageId)).limit(1);
  const afterActive = ((after as any)[`${angleKey}Angle`] || (after as any).originalAngle) as LandingPageContent | null;
  const [coachAfter] = await db.select({ bookingUrl: users.bookingUrl }).from(users).where(eq(users.id, USER_ID)).limit(1);
  const remaining = deriveOperatorQuestions((after as any).pageType, afterActive, { bookingUrl: coachAfter?.bookingUrl });
  if (remaining.length > 0) {
    throw new Error(
      `STOP — after answering, the page still asks ${remaining.length} question(s): ` +
      `${remaining.map((q) => q.token).join(", ")}. The publish gate would hold it.`,
    );
  }
  for (const col of ANGLE_COLS) {
    const angle = (after as any)[col];
    if (angle) assertNoOperatorTokens(JSON.stringify(angle), `stored content (${col})`);
  }
  return { answeredTokens: plan.map((p) => p.token), coachFieldsBefore };
}

/**
 * The same check the publish gate performs, run EARLY and against the RENDERED page.
 *
 * The stored-content check above is necessary but not sufficient: the gate scans HTML, and a
 * template can emit a token of its own for a field it considers unanswered. This mirrors the
 * publisher's render dispatch so the run stops here — before it has spent anything further —
 * rather than discovering it inside `runLandingPagePublish`.
 *
 * ⚠️ It MIRRORS the publisher rather than sharing one function with it, so the two can drift.
 * That is accepted deliberately: the publisher's own gate remains the authority and still runs
 * a moment later, so the worst case of drift here is a duplicated error message, never a page
 * that publishes with a token in it.
 */
async function assertRenderedPageIsClean(db: any, landingPageId: number): Promise<void> {
  const { injectRealTestimonials } = await import("../lib/realTestimonials");
  const { renderLandingPageHtml, resolveEventStyle, resolveSalesStyle, resolveWebinarStyle, styleForPageType } =
    await import("../lib/templates/renderRegistry");

  const [lp] = await db.select().from(landingPages).where(eq(landingPages.id, landingPageId)).limit(1);
  const angleKey = ((lp as any).activeAngle || "original") as "original" | "godfather" | "free" | "dollar";
  const content = ((lp as any)[`${angleKey}Angle`] || (lp as any).originalAngle) as LandingPageContent;
  const [svc] = await db.select({ name: services.name }).from(services).where(eq(services.id, (lp as any).serviceId)).limit(1);
  const [coach] = await db.select({ coachName: users.coachName, coachBackground: users.coachBackground })
    .from(users).where(eq(users.id, USER_ID)).limit(1);

  // Same asset fetch the publisher performs (per-user rows plus this page's own), so a template
  // branch that depends on an asset renders here the same way it will there.
  const assetRows = await db
    .select({ assetType: coachAssets.assetType, url: coachAssets.url })
    .from(coachAssets)
    .where(and(eq(coachAssets.userId, USER_ID), or(isNull(coachAssets.landingPageId), eq(coachAssets.landingPageId, landingPageId))));

  const enriched = await injectRealTestimonials(content, USER_ID, (lp as any).serviceId);
  const pageType = (lp as any).pageType || "sales_page";
  const base = styleForPageType(pageType) ?? ("sales_kutcher" as any);
  const styleMode = resolveWebinarStyle(resolveSalesStyle(resolveEventStyle(base, enriched), enriched), enriched);
  const html = await renderLandingPageHtml(styleMode as any, {
    content: enriched,
    serviceName: svc?.name ?? "Campaign",
    coachName: coach?.coachName ?? null,
    coachBackground: coach?.coachBackground ?? null,
    assetRows,
    serviceId: (lp as any).serviceId,
    userId: USER_ID,
    pageType,
  } as any);
  assertNoOperatorTokens(html, `the rendered landing page (${styleMode})`);
  say(`   ✅ rendered page is token-free (${styleMode}, ${html.length} chars)`);
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — PREPARE. Local + the throwaway page. NOTHING TOUCHES META.
// ══════════════════════════════════════════════════════════════════════════════
async function prepare() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  rule("═");
  say("STEP 4c — PREPARE. Throwaway cascade + landing page. NO META CALLS IN THIS PHASE.");
  rule("═");

  const before = await baselines(db);
  say(`baseline: adCopy ${before.adCopy} · headlines ${before.headlines} · adCreatives ${before.adCreatives} · ` +
      `concepts ${before.concepts} · published ${before.published}`);
  say(`protected: ${await protectedTotal(db)}\n`);

  // A fresh run starts from empty files — a stale ledger from a previous run must never be read
  // as this run's delete list.
  const now = new Date().toISOString();
  runState = emptyRunState({ now, host: hostname(), label: LABEL });
  writeFileSync(STATE, JSON.stringify(runState, null, 2));
  writeFileSync(LEDGER, "");
  say(`state: ${STATE} (written from here on, one update per artifact)\nledger: ${LEDGER} (empty until --publish)\n`);

  const [ins] = await db.insert(services).values({
    userId: USER_ID, name: LABEL, category: "consulting",
    description: "Throwaway created by step4c-multiad-publish.ts. Safe to delete.",
    targetCustomer: BRIEF.targetMarket, mainBenefit: BRIEF.desiredOutcome, painPoints: BRIEF.pressingProblem,
  } as any);
  const serviceId = Number((ins as any).insertId);
  saveState({ serviceId });

  const [icpIns] = await db.insert(idealCustomerProfiles).values({
    userId: USER_ID, serviceId, name: LABEL,
    angleName: "operations consultants moving to retainers",
    introduction: "Independent operations consultants, 5-15 years in, billing hourly.",
    pains: BRIEF.pressingProblem,
    fears: "that raising the model loses the client entirely, and the pipeline goes quiet for a quarter",
    goals: BRIEF.desiredOutcome, frustrations: "scope creeps between the call and the proposal",
    objections: "my clients would never agree to a retainer",
    buyingTriggers: "a month where billable hours dropped but workload did not",
    source: "generated" as const,
  } as any);
  const icpId = Number((icpIns as any).insertId);
  saveState({ icpId });
  say(`throwaway service ${serviceId} · ICP ${icpId}`);

  say("\ngenerating concepts (polling up to 12 minutes)…");
  await ensureConceptsForIcp({ userId: USER_ID, icpId, serviceId });
  let concepts: any[] = [];
  const tC = Date.now();
  while (Date.now() - tC < 12 * 60 * 1000) {
    concepts = await db.select({ id: campaignConcepts.id }).from(campaignConcepts)
      .where(eq(campaignConcepts.icpId, icpId));
    if (concepts.length > 0) break;
    await new Promise((r) => setTimeout(r, 15_000));
  }
  if (!concepts.length) throw new Error("STOP — no concepts; assembly would have nothing to key on");
  saveState({ conceptCount: concepts.length });
  say(`concepts: ${concepts.length}`);

  say("\nrunning Node 7 (ad copy)…");
  const copyRes: any = await runAdCopyGeneration({
    userId: USER_ID, serviceId, adType: "lead_gen", adStyle: "direct", adCallToAction: "Book a Call",
    targetMarket: BRIEF.targetMarket, productCategory: "consulting engagement design",
    specificProductName: "The Scope-First Sequence", pressingProblem: BRIEF.pressingProblem,
    desiredOutcome: BRIEF.desiredOutcome, uniqueMechanism: BRIEF.uniqueMechanism,
  } as any);
  saveState({ adSetId: copyRes.adSetId });
  say(`adSet ${copyRes.adSetId}: headlines ${copyRes.headlineCount} · bodies ${copyRes.bodyCount} · hooks ${copyRes.imageHookCount}`);

  say("\nrendering the creative cascade…");
  await runAdCreativesGeneration({
    userId: USER_ID, serviceId, niche: "operations consulting",
    productName: "The Scope-First Sequence", uniqueMechanism: BRIEF.uniqueMechanism,
    targetAudience: BRIEF.targetMarket, mainBenefit: BRIEF.desiredOutcome,
    pressingProblem: BRIEF.pressingProblem, adType: "lead_gen",
  } as any);
  const [firstCreative] = await db.select({ batchId: adCreatives.batchId }).from(adCreatives)
    .where(and(eq(adCreatives.userId, USER_ID), eq(adCreatives.serviceId, serviceId)))
    .orderBy(adCreatives.id);
  const batchId = String((firstCreative as any)?.batchId ?? "");
  if (!batchId) throw new Error("STOP — no creatives were produced");
  saveState({ batchId });
  say(`batch ${batchId}`);

  // Its OWN landing page, so the ad-to-page compliance gate is evaluated against a page the copy
  // actually agrees with. Pointing throwaway copy at an unrelated live page invites a block that
  // would tell us nothing about the capability under test.
  say("\ngenerating the throwaway landing page…");
  const { landingPageId } = await runLandingPageGeneration({ userId: USER_ID, serviceId });
  saveState({ landingPageId });
  say(`landing page ${landingPageId}`);

  // ── FIX 1 ─────────────────────────────────────────────────────────────────
  say("\nanswering the page's operator questions (the coach's own path)…");
  const { answeredTokens, coachFieldsBefore } = await answerPageOperatorQuestions(db, landingPageId);
  saveState({ answeredTokens, coachFieldsBefore });
  await assertRenderedPageIsClean(db, landingPageId);

  say("\npublishing the throwaway landing page…");
  const { publicUrl, slug } = await runLandingPagePublish({
    userId: USER_ID, landingPageId, styleMode: "sales_kutcher" as any,
  });
  saveState({ landingPageSlug: slug, publicUrl, phase: "prepared" });
  say(`landing page live at ${publicUrl}`);

  rule();
  say("✅ PREPARE COMPLETE — and NOTHING was sent to Meta in this phase.");
  say(`   state: ${STATE}   (--publish reads this; it must run on THIS machine, ${hostname()})`);
  say("   next: --publish, which needs Arfeen's explicit word and writes to the live ad account.");
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — PUBLISH. The live ad-account write.
// ══════════════════════════════════════════════════════════════════════════════
async function publish() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  rule("═");
  say("STEP 4c — PUBLISH. N ads → ONE campaign, ONE ad set. LIVE AD ACCOUNT.");
  rule("═");

  // 1 — the prepared state, and every reason to refuse it.
  const loaded = loadState();
  assertPublishable(loaded, hostname());
  runState = loaded;
  const { serviceId, icpId, adSetId, batchId, landingPageId, publicUrl } = loaded as Required<
    Pick<Step4cRunState, "serviceId" | "icpId" | "adSetId" | "batchId" | "landingPageId" | "publicUrl">
  >;

  // The staleness guard that a file check cannot give: is the prepared throwaway still THERE?
  // A state file outlives the rows it describes, and publishing against a torn-down set would
  // build ads from copy that no longer exists.
  const [svcRow] = await db.select().from(services)
    .where(and(eq(services.id, serviceId), eq(services.userId, USER_ID))).limit(1);
  if (!svcRow) {
    throw new Error(
      `REFUSING to publish: prepared service ${serviceId} is no longer in the database — it has already ` +
      `been torn down. Run --prepare again.`,
    );
  }
  if (String((svcRow as any).name) !== LABEL) {
    throw new Error(
      `REFUSING to publish: service ${serviceId} is named "${(svcRow as any).name}", not the throwaway ` +
      `label. This state file does not describe a 4c throwaway.`,
    );
  }
  say(`prepared set: service ${serviceId} · ICP ${icpId} · copy ${adSetId} · batch ${batchId} · page ${landingPageId}`);
  say(`landing page: ${publicUrl}\n`);

  const before = await baselines(db);
  say(`baseline: adCopy ${before.adCopy} · headlines ${before.headlines} · adCreatives ${before.adCreatives} · ` +
      `concepts ${before.concepts} · published ${before.published}`);
  say(`protected: ${await protectedTotal(db)}\n`);

  // 2 — the token, before anything else. Deliberately ahead of assembly: a stale token should
  // cost nothing.
  await assertTokenLive();

  // 3 — assemble.
  const { ads, ledger: asmLedger } = await assembleConceptAds(db, USER_ID, serviceId, { batchId });
  say("\n" + describeAssembly(asmLedger));
  if (ads.length < MIN_ADS) {
    throw new Error(
      `STOP — assembly produced ${ads.length} ad(s); at least ${MIN_ADS} are needed to prove they ` +
      `share one ad set. Nothing was published.`,
    );
  }
  const chosen = ads.slice(0, MAX_ADS);
  say(`publishing ${chosen.length} of ${ads.length} assembled ads`);

  // 4 — the guards, applied before a single Graph call.
  assertDailyBudgetFloor(PINNED_DAILY_BUDGET_AED);
  const campaignName = campaignLabelFor(new Date().toISOString());
  assertSafeCampaignName(campaignName);
  saveState({ campaignName, phase: "publish" });
  say(`campaign name: ${campaignName} · daily budget AED ${PINNED_DAILY_BUDGET_AED} (${PINNED_DAILY_BUDGET_AED * 100} minor units) · status PAUSED`);

  // 5 — the ledger: every id on disk the instant Meta returns it.
  writeFileSync(LEDGER, "");
  const ledger = createPublishLedger({ path: LEDGER, write: (l) => appendFileSync(LEDGER, l) });
  const meta = await import("../lib/metaAPI");
  const recordingDeps = {
    createCampaign: async (u: number, p: any) => {
      const r = await meta.createCampaign(u, p);
      if (r?.id) ledger.record("campaign", r.id, campaignName);
      return r;
    },
    createAdSet: async (u: number, p: any) => {
      const r = await meta.createAdSet(u, p);
      if (r?.id) ledger.record("adset", r.id);
      return r;
    },
    createAdCreative: async (u: number, p: any) => {
      const r = await meta.createAdCreative(u, p);
      if (r?.id) ledger.record("creative", r.id);
      return r;
    },
    createAd: async (u: number, p: any) => {
      const r = await meta.createAd(u, p);
      if (r?.id) ledger.record("ad", r.id);
      return r;
    },
  };

  // 6 — the per-ad compliance screen, identical in shape to publishToMeta's gate.
  const { checkOutput, checkAdToPageMatch } = await import("../_core/complianceAxis");
  const { buildCoachCorpus, buildProofSupplied } = await import("../_core/groundingCorpus");
  const [gateIcp] = await db.select().from(idealCustomerProfiles)
    .where(eq(idealCustomerProfiles.id, icpId)).limit(1);
  const [lpRow] = await db.select().from(landingPages).where(eq(landingPages.id, landingPageId)).limit(1);
  // 🔴 LATENT BUG, FIXED HERE. This read `(lpRow as any).content` — a column `landingPages` does
  // not have. It was always undefined, so `pageText` was always "" and the ad-to-page compliance
  // check below NEVER RAN. That silently defeated the reason 4c generates its own page at all
  // (plan §2: so the gate is evaluated against a page the copy agrees with). Now it reads the
  // ACTIVE angle, the same one the publisher renders.
  const lpAngleKey = ((lpRow as any)?.activeAngle || "original") as "original" | "godfather" | "free" | "dollar";
  const lpContent: any = (lpRow as any)?.[`${lpAngleKey}Angle`] ?? (lpRow as any)?.originalAngle;
  const pageText = lpContent && typeof lpContent === "object"
    ? ["eyebrowHeadline", "mainHeadline", "subheadline", "problemAgitation", "solutionIntro", "uniqueMechanism"]
        .map((k) => lpContent[k]).filter((v) => typeof v === "string").join(" ")
    : "";

  say("\npublishing…");
  const result = await publishAssembledAds(recordingDeps, {
    userId: USER_ID,
    campaignName,
    objective: "OUTCOME_LEADS",
    linkUrl: publicUrl,
    status: "PAUSED",
    dailyBudget: PINNED_DAILY_BUDGET_AED,
    callToAction: "LEARN_MORE",
    targeting: { geoLocations: { countries: ["AE"] } },
    ads: chosen.map((a) => ({
      conceptId: a.conceptId, headline: a.headline.text, body: a.body.text,
      headlineAdCopyId: a.headline.id, bodyAdCopyId: a.body.id,
      imageUrl: a.creative.imageUrl, verticalImageUrl: a.creative.verticalImageUrl,
    })),
    screen: async (a) => {
      const gate = checkOutput(
        [
          { location: "headline", text: a.headline, role: "short" as const },
          { location: "body", text: a.body, role: "body" as const },
        ],
        svcRow ? { corpus: buildCoachCorpus({ service: svcRow, groundingMeta: (gateIcp as any)?.groundingMeta }), supplied: buildProofSupplied(svcRow) } : undefined,
        { requireGrounding: true },
      );
      const blocking = [...(gate?.blocking ?? [])];
      if (pageText) {
        const m = checkAdToPageMatch(`${a.headline} ${a.body}`, pageText);
        if (!m.ok) blocking.push(...(m.blocking as any));
      }
      return { blocked: blocking.length > 0, classes: Array.from(new Set(blocking.map((h: any) => String(h.classId)))) };
    },
  });

  say(`\ncampaign ${result.campaignId ?? "none"} · ad set ${result.adSetId ?? "none"}`);
  say(`published ${result.published.length} · blocked ${result.blocked.length} · failed ${result.failed.length}`);
  for (const b of result.blocked) say(`   blocked concept ${b.conceptId}: ${b.classes.join(", ")}`);
  for (const f of result.failed) say(`   🔴 failed concept ${f.conceptId} at ${f.stage}: ${f.message}`);
  if (result.refusedReason) say(`   REFUSED: ${result.refusedReason}`);

  // The Meta ids reach the state file immediately, beside the ledger that already holds them.
  saveState({
    phase: "published",
    metaCampaignId: result.campaignId,
    metaAdSetId: result.adSetId,
    ads: result.published.map((p) => {
      const src = chosen[p.index];
      return { adId: p.metaAdId, creativeId: p.metaCreativeId, headline: src.headline.text, body: src.body.text, conceptId: p.conceptId };
    }),
  });

  // Provenance rows, ids kept so teardown removes exactly these — each recorded as it is written.
  const publishedRowIds: number[] = [];
  for (const p of result.published) {
    const [row] = await db.insert(metaPublishedAds).values({
      userId: USER_ID, adSetId,
      metaCampaignId: result.campaignId!, metaAdSetId: result.adSetId!,
      metaAdId: p.metaAdId, metaCreativeId: p.metaCreativeId,
      campaignName, status: "PAUSED", objective: "OUTCOME_LEADS",
      dailyBudget: String(PINNED_DAILY_BUDGET_AED),
      headlineAdCopyId: p.headlineAdCopyId ?? undefined, bodyAdCopyId: p.bodyAdCopyId ?? undefined,
    } as any);
    publishedRowIds.push(Number((row as any).insertId));
    saveState({ publishedRowIds: [...publishedRowIds] });
  }
  say(`\nstate: ${STATE}\nledger: ${LEDGER}`);

  if (!result.campaignId || !result.adSetId || result.published.length < MIN_ADS) {
    say(`\n🔴 fewer than ${MIN_ADS} ads landed — the shared-ad-set claim is unproven. Run --teardown.`);
    return;
  }

  // 7 — THE READ-BACK. Meta's stored state, never our request.
  rule();
  say("READ-BACK — what META stored");
  rule();
  const rb = await readBackPublishedSet(meta as any, {
    userId: USER_ID, campaignId: result.campaignId, adSetId: result.adSetId,
    expected: runState!.ads ?? [],
  });
  say(`${rb.allShareOneAdSet ? "✅" : "🔴"} all ads share ONE ad set: ${rb.sharedAdSetId ?? "NO"}`);
  say(`${rb.adSetBelongsToCampaign ? "✅" : "🔴"} that ad set belongs to the one campaign`);
  say(`${rb.allPaused ? "✅" : "🔴"} campaign, ad set and every ad are PAUSED`);
  say(`   daily_budget stored by Meta: ${rb.dailyBudgetMinorUnits ?? "none"} minor units (expected 2000)`);
  for (const c of rb.copyMatches) {
    say(`   ${c.titleOk && c.bodyOk ? "✅" : "🔴"} creative ${c.creativeId}: headline ${c.titleOk ? "==" : "!="} assembled · body ${c.bodyOk ? "==" : "!="} assembled`);
  }
  for (const p of rb.problems) say(`   🔴 ${p}`);
  say(rb.ok ? "\n✅ 4c PROVEN — N ads in one campaign and one ad set, all paused, copy as assembled."
            : "\n🔴 4c NOT proven — see above.");
  say("\n⚠️ NOTHING IS TORN DOWN YET. Teardown is a SEPARATE invocation and a separate approval.");
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — TEARDOWN. Meta side when there IS one, then local, always.
// ══════════════════════════════════════════════════════════════════════════════
async function teardown() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const state = loadState();

  rule("═");
  say("STEP 4c — TEARDOWN.");
  rule("═");
  say(`state phase "${state.phase}" · prepared on ${state.host} · started ${state.startedAt}`);

  // ── FIX 2 — is there anything on Meta at all? ─────────────────────────────
  // The ledger is the authority: it is written the instant an object exists. When neither it nor
  // the state names a campaign, this run never reached Meta and the Meta phase is SKIPPED — the
  // old code threw here and could never reach the local half. The protected-id refusal inside
  // teardownRecordedCampaign is untouched and still runs for any non-null id.
  const plan = metaPhasePlan({ ledgerCampaignId: ledgerCampaignId(), stateCampaignId: state.metaCampaignId });
  say(`\nmeta phase: ${plan.run ? "RUN" : "SKIP"} — ${plan.reason}`);

  if (plan.run) {
    const adIds = ledgerAdIds();
    say(`ledger: campaign ${plan.campaignId} · ads ${adIds.join(", ") || "none"}`);
    const meta = await import("../lib/metaAPI");
    const listCampaigns = async (userId: number) => {
      const rows = await meta.getCampaigns(userId);
      return (rows ?? []).map((c: any) => ({ id: String(c.id), name: String(c.name) }));
    };
    const mt = await teardownRecordedCampaign(
      { deleteCampaign: meta.deleteCampaign as any, getCampaignById: meta.getCampaignById, getAdById: meta.getAdById, listCampaigns },
      { userId: USER_ID, campaignId: plan.campaignId, adIds },
    );
    say(`\ncampaign ${mt.campaignId}: deleted=${mt.deleted} · confirmed by id = ${mt.confirmedStatus}`);
    for (const a of mt.ads) say(`   ad ${a.id}: ${a.confirmedGone ? "✅ gone" : `🔴 still ${a.status}`}`);
    say(`   "Auto Campaign Kit" count ${mt.orphanCheck.autoKitCount} (expected ${mt.orphanCheck.expected}) ${mt.orphanCheck.countUnchanged ? "✅" : "🔴"}`);
    say(`   pre-existing orphans intact ${mt.orphanCheck.allOrphansIntact ? "✅" : "🔴"} — present ${mt.orphanCheck.orphansPresent.join(", ")}`);
    for (const p of mt.problems) say(`   🔴 ${p}`);
  }

  // ── local: Cloudinary before rows, creatives before concepts ──────────────
  rule();
  say("LOCAL TEARDOWN — id-scoped");
  rule();

  // Every delete below is scoped by an id the state file recorded. Where a crash left an id
  // UNRECORDED but its parent known, the serviceId is used to find it — still id-scoped, just one
  // hop out. It is never a name match and never a date range.
  const { serviceId } = state;

  // Creatives + Cloudinary. sweepAdCreativeBatch carries the protected-service refusal on the
  // RESOLVED rows, so it is used for every batch rather than hand-rolling a second sweeper.
  let batchIds: string[] = state.batchId ? [state.batchId] : [];
  if (batchIds.length === 0 && serviceId) {
    const rows = await db.selectDistinct({ batchId: adCreatives.batchId }).from(adCreatives)
      .where(and(eq(adCreatives.userId, USER_ID), eq(adCreatives.serviceId, serviceId)));
    batchIds = rows.map((r: any) => String(r.batchId)).filter(Boolean);
    if (batchIds.length > 0) say(`no batchId recorded — recovered ${batchIds.length} batch(es) from service ${serviceId}`);
  }
  for (const b of batchIds) {
    const sweep = await sweepAdCreativeBatch(db, b, USER_ID);
    say(`sweep ${b}: rows ${sweep.rowsDeleted} · cloudinary ${sweep.cloudinaryDeleted}/${sweep.publicIds.length} · failed ${sweep.cloudinaryFailed.length}`);
    for (const f of sweep.cloudinaryFailed) say(`   🔴 cloudinary NOT deleted: ${f}`);
  }
  if (batchIds.length === 0) say("no creatives to sweep (none recorded and none found for the service)");

  // Provenance rows: by row id where recorded, else by the Meta campaign id they carry.
  if (state.publishedRowIds?.length) {
    for (const id of state.publishedRowIds) {
      await db.delete(metaPublishedAds).where(and(eq(metaPublishedAds.userId, USER_ID), eq(metaPublishedAds.id, id)));
    }
    say(`meta_published_ads: deleted ${state.publishedRowIds.length} recorded row(s)`);
  } else if (state.metaCampaignId) {
    await db.delete(metaPublishedAds)
      .where(and(eq(metaPublishedAds.userId, USER_ID), eq(metaPublishedAds.metaCampaignId, state.metaCampaignId)));
    say(`meta_published_ads: no row ids recorded — deleted by campaign ${state.metaCampaignId}`);
  }

  // The published page is a real URL until the KV key goes — the DB row alone is not enough.
  if (state.landingPageSlug) {
    try {
      const { ensureKvNamespace, deleteKvPage } = await import("../lib/cloudflare");
      await deleteKvPage(await ensureKvNamespace(), state.landingPageSlug);
      say(`landing page KV key ${state.landingPageSlug} deleted`);
    } catch (e: any) {
      say(`🔴 could not delete the KV page ${state.landingPageSlug}: ${String(e?.message ?? e)} — do it by hand`);
    }
  } else {
    say("no published slug recorded — the page never went live, so there is no KV key");
  }

  if (state.landingPageId) {
    await db.delete(landingPages).where(and(eq(landingPages.userId, USER_ID), eq(landingPages.id, state.landingPageId)));
  } else if (serviceId) {
    await db.delete(landingPages).where(and(eq(landingPages.userId, USER_ID), eq(landingPages.serviceId, serviceId)));
  }

  if (state.adSetId) {
    await db.delete(adCopy).where(and(eq(adCopy.userId, USER_ID), eq(adCopy.adSetId, state.adSetId)));
  } else if (serviceId) {
    await db.delete(adCopy).where(and(eq(adCopy.userId, USER_ID), eq(adCopy.serviceId, serviceId)));
    say(`no copy adSetId recorded — cleared adCopy by service ${serviceId}`);
  }

  if (state.icpId) {
    await db.delete(campaignConcepts).where(and(eq(campaignConcepts.userId, USER_ID), eq(campaignConcepts.icpId, state.icpId)));
    await db.execute(sql`DELETE FROM jobs WHERE id = ${conceptJobId(state.icpId)}`);
    await db.delete(idealCustomerProfiles).where(and(eq(idealCustomerProfiles.userId, USER_ID), eq(idealCustomerProfiles.id, state.icpId)));
  }
  if (serviceId) {
    await db.delete(services).where(and(eq(services.userId, USER_ID), eq(services.id, serviceId)));
  }

  // Coach-scoped answers are written OUTSIDE the throwaway, so deleting the throwaway does not
  // reverse them. Restored to whatever was there before this run touched it — including null.
  for (const [column, before] of Object.entries(state.coachFieldsBefore ?? {})) {
    await db.update(users).set({ [column]: before } as any).where(eq(users.id, USER_ID));
    say(`restored users.${column} for user ${USER_ID} to ${before === null ? "NULL" : `"${before}"`}`);
  }

  const after = await baselines(db);
  say("");
  say(`adCopy       ${after.adCopy} ${after.adCopy === 5424 ? "✅" : "🔴"} (baseline 5424)`);
  say(`headlines    ${after.headlines} ${after.headlines === 2174 ? "✅" : "🔴"} (baseline 2174)`);
  say(`adCreatives  ${after.adCreatives} ${after.adCreatives === 405 ? "✅" : "🔴"} (baseline 405)`);
  say(`concepts     ${after.concepts} ${after.concepts === 6 ? "✅" : "🔴"} (baseline 6)`);
  say(`published    ${after.published} ${after.published === 2 ? "✅" : "🔴"} (baseline 2)`);
  say(`protected    ${await protectedTotal(db)} (expected 29)`);
  say(`\nlog: ${LOG}`);
}

// ══════════════════════════════════════════════════════════════════════════════
const argv = process.argv.slice(2);
const run = (fn: () => Promise<void>, name: string) =>
  fn().then(() => process.exit(0)).catch((e) => {
    console.error(`[step4c] ${name} FAILED:`, e?.message ?? e);
    console.error(`[step4c] the state file at ${STATE} records everything created up to this point — ` +
                  `--teardown can clear it.`);
    process.exit(1);
  });

if (argv.includes("--prepare")) {
  run(prepare, "PREPARE");
} else if (argv.includes("--publish")) {
  run(publish, "PUBLISH");
} else if (argv.includes("--teardown")) {
  run(teardown, "TEARDOWN");
} else {
  console.log(`
step4c-multiad-publish.ts — NOTHING HAS BEEN DONE.

This script writes to a LIVE ad account (act_1254349025145319, AED, ~AED 1.17M spent).
It requires an explicit flag, and the phases need SEPARATE approvals from Arfeen:

  --prepare    builds the throwaway cascade (service, ICP, concepts, copy, 4 creatives),
               answers the landing page's operator questions through the coach's own path,
               and publishes that page. WRITES LOCAL ROWS. TOUCHES META NOT AT ALL.
               Writes ${STATE} as it goes, so a crash is still tearable-down.

  --publish    loads that state, refuses if the prepared service is gone or if it was
               prepared on another machine, does a live GET /me, then creates ONE campaign,
               ONE ad set and up to ${MAX_ADS} PAUSED ads at AED ${PINNED_DAILY_BUDGET_AED}/day,
               and reads every object back by id

  --teardown   deletes ONLY the campaign id recorded in ${LEDGER} — refusing the five
               protected campaigns, confirming by id, and proving the three pre-existing
               orphans are untouched — then clears the local rows and Cloudinary.
               When no campaign was ever created it SKIPS the Meta phase and still runs
               the local sweep.

⚠️ --prepare and --publish must run on the SAME machine: the state and ledger live in /tmp.

No flag was given, so no call was made.`);
  process.exit(0);
}
