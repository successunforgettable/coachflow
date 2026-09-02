/**
 * traceability-proof.ts — what fraction of the specifics a title ASSERTS can be
 * traced to a COACH-TYPED source.
 *
 * READ-ONLY. SELECTs only. Never writes a row, never touches the generation path,
 * and is NOT a gate. It is a measurement script in the shape of
 * verify-icp-grounding.ts.
 *
 * ── WHY IT COMPARES AGAINST THE TYPED SUBSET, NOT THE CORPUS ──────────────────
 * buildCoachCorpus is ~80% machine-written (measured 2026-08-30: 766 typed of
 * 3,788). Tracing against the corpus would compare generated copy to a generated
 * reference — the deepest instance of the family CLAUDE.md §15i names. The only
 * honest reference is what the coach actually typed: their ladder answers plus
 * their own chat messages.
 *
 * ── THE FALSE POSITIVE THIS IS DESIGNED AGAINST ───────────────────────────────
 * On 2026-08-30 a plain word-containment test scored `category` as coach-typed
 * because the single word "coaching" happened to appear in his description. A
 * title is a SHORT STRING; single-token overlap manufactures traces in the
 * flattering direction. Three rules answer it:
 *   1. Trace the SPECIFIC, never the title. "clients" is not a specific.
 *   2. A token available from the GENERATED vocabulary proves nothing about the
 *      typed one, even when it appears in both (§15h: a marker must discriminate).
 *   3. Evidence must be RARE (a token absent from the generated vocabulary) or
 *      MULTI-TOKEN (a contiguous 2+ significant-token phrase). A single common
 *      token is never a trace.
 *
 * ── THREE-VALUED, NEVER TWO ───────────────────────────────────────────────────
 * traced / untraced / unverifiable. An UNVERIFIABLE specific is excluded from
 * BOTH numerator and denominator and printed as its own raw number. Same
 * discipline as discarding `category`'s 8 characters rather than counting them.
 *
 * ── THE MEASURED BIAS (Arfeen, 2026-08-31) ────────────────────────────────────
 * Rule 2 errs safe but is biased: enrichment DERIVED the generated fields from
 * the coach's own description, so his words are laundered into the generated
 * vocabulary and rule 2 disqualifies them hardest where they are most central to
 * how he talks. The LAUNDERED SET (tokens in BOTH) is counted and reported so the
 * bias is measured rather than discovered.
 *
 * ── SUBJECT, NOT JUST TYPE (Arfeen, 2026-08-31) ───────────────────────────────
 * `3-Step Excavation` asserts something about the DELIVERABLE; `Notes App`
 * asserts something about the READER'S LIFE. Asset-subject specifics are
 * legitimate with no coach source — that is the ladder-absent substitute. They
 * require no trace and must NOT count as untraced, or the metric scores the
 * correct fix as worse.
 *
 * ── §15c: BOTH POLES MUST BE REACHABLE IN THE SAME CORPUS ─────────────────────
 * An extractor that can only find fabrication is confirming, not measuring.
 * NEGATIVE control in set A: "10-Year Gap", "Notes App", "Six Months".
 * POSITIVE control in set A: "What the YouTube Tutorial Skips" — `YouTube` is in
 * his priorAttempts answer and absent from every generated field.
 * The run FAILS ITS OWN TEST if it returns all-traced or all-untraced.
 *
 * ── THE THREE SETS — do not blur them ─────────────────────────────────────────
 *   A = the existing 55 titles, generated with `Product: ` BLANK.
 *       NEGATIVE CONTROLS ONLY. Never a before-number, never positive fixtures.
 *   B = fresh run, current unfixed prompt, name supplied via nameOverride. BEFORE.
 *   C = same run, fixed prompt. AFTER.
 * This script runs set A. B and C need the nameOverride harness, not yet built.
 *
 * Usage:
 *   railway run --environment production --service coachflow -- \
 *     npx tsx server/scripts/traceability-proof.ts --service 318 --icp 291 --kit 225 --set A
 */
import "dotenv/config";
import { appendFileSync } from "fs";
import { eq } from "drizzle-orm";

const LOG = `/tmp/traceability-proof-${process.pid}.log`;
const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};
const rule = (c = "─") => say(c.repeat(78));
const stop: (step: string, why: string) => never = (step, why) => {
  say(`\n>>> STOPPED AT ${step}.\n>>> ${why}\n>>> Not estimating past this point.`);
  process.exit(2);
};

// ── Lexical primitives ───────────────────────────────────────────────────────
// Deliberately mirrors bonusSignificantWords (validator.ts): 4+ letters, lowercased.
// Conservative stemming only — s/es/ing/ed. Aggressive stemming merges unrelated
// words and reintroduces the flattering error in a new form.
const STOP = new Set([
  "this","that","with","from","your","their","them","they","have","has","been","will",
  "what","when","where","which","who","whom","into","over","under","about","after",
  "before","because","while","those","these","than","then","just","only","also","more",
  "most","some","such","very","much","many","each","every","both","other","another",
  "would","could","should","being","doing","make","makes","made","take","takes","like",
  "here","there","were","was","are","and","the","for","you","our","its","it's","not",
]);
const stem = (w: string) => w.replace(/(ies)$/, "y").replace(/(sses|ses|es|s)$/, "").replace(/(ing|ed)$/, "");
const tokens = (s: string): string[] =>
  (String(s ?? "").toLowerCase().match(/[a-z]{4,}/g) ?? []).filter(w => !STOP.has(w)).map(stem);
const tokenSet = (s: string) => new Set(tokens(s));
const numerals = (s: string): string[] => Array.from(new Set(String(s ?? "").match(/\d+/g) ?? []));

/** Contiguous n-gram (n>=2) of significant tokens, for the multi-token evidence rule. */
function bigrams(s: string): string[] {
  const t = tokens(s);
  const out: string[] = [];
  for (let i = 0; i + 1 < t.length; i++) out.push(`${t[i]} ${t[i + 1]}`);
  return out;
}

type Subject = "reader" | "asset";
type SpecType = "number" | "timeframe" | "named_enemy" | "insider_term" | "scene";
type Specific = { span: string; type: SpecType; subject: Subject; tracePhrase: string };
type Verdict = "traced" | "untraced" | "unverifiable" | "asset_no_trace_required";
type Scored = Specific & { verdict: Verdict; evidence: string | null; reason: string; title: string };

const arg = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const serviceId = Number(arg("--service"));
  const icpId = Number(arg("--icp"));
  const kitId = Number(arg("--kit"));
  const setLabel = (arg("--set") ?? "A").toUpperCase();
  if (!serviceId || !icpId || !kitId) stop("ARGS", "Need --service, --icp and --kit.");

  const { getDb } = await import("../db");
  const { services, idealCustomerProfiles, hvcoTitles, chatTranscripts } = await import("../../drizzle/schema");
  const { invokeLLM } = await import("../_core/llm");

  const db = await getDb();
  if (!db) stop("DB", "Database not available.");

  say(`TRACEABILITY PROOF — SET ${setLabel}  ·  service ${serviceId} / ICP ${icpId} / kit ${kitId}`);
  say(`READ-ONLY. No row is written. Not a gate. Log: ${LOG}`);
  if (setLabel === "A") {
    say(`⚠️  SET A was generated with \`Product: \` BLANK. NEGATIVE CONTROLS ONLY —`);
    say(`   this is NOT the before-number for item 1. That is set B (nameOverride).`);
  }

  // ── The two vocabularies ───────────────────────────────────────────────────
  const [svc] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
  if (!svc) stop("STEP 1", `services row ${serviceId} not found.`);
  const GEN_FIELDS = [
    "name","category","description","targetCustomer","mainBenefit",
    "painPoints","whyProblemExists","uniqueMechanismSuggestion",
  ] as const;
  const generatedText = GEN_FIELDS.map(f => String((svc as any)[f] ?? "")).join(" \n");
  const generatedVocab = tokenSet(generatedText);

  const [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, icpId)).limit(1);
  if (!icp) stop("STEP 1", `ICP row ${icpId} not found.`);
  const gm = (icp as any).groundingMeta as Record<string, unknown> | null;
  const ladder = (gm?.ladderAnswers ?? null) as Record<string, string> | null;
  if (!ladder || Object.keys(ladder).length === 0) {
    stop("STEP 2",
      `ICP ${icpId} has no ladderAnswers. There is no coach-typed source to trace against, ` +
      `so every reader-subject specific would be untraced by construction and the run would ` +
      `have only one reachable pole. Point this at an ICP with ladder answers.`);
  }

  const [tr] = await db.select().from(chatTranscripts).where(eq(chatTranscripts.campaignKitId, kitId)).limit(1);
  let typedMessages: string[] = [];
  if (tr) {
    try {
      const msgs = JSON.parse(JSON.stringify((tr as any).messages)) as Array<Record<string, unknown>>;
      typedMessages = msgs.filter(m => m?.type === "user-bubble").map(m => String(m.text ?? ""));
    } catch { say("  !! transcript present but unparseable — ladder answers only"); }
  } else {
    say("  !! no chatTranscripts row — the coach's opening description is NOT available.");
    say("     Tracing against ladder answers alone. This UNDERSTATES the traced fraction.");
  }

  const typedText = [...typedMessages, ...Object.values(ladder)].join(" \n");
  const typedVocab = tokenSet(typedText);
  const typedBigrams = new Set(bigrams(typedText));
  const typedNumerals = new Set(numerals(typedText));

  // ── The measured bias: laundered tokens ────────────────────────────────────
  const laundered = new Set(Array.from(typedVocab).filter(t => generatedVocab.has(t)));
  const rareTyped = new Set(Array.from(typedVocab).filter(t => !generatedVocab.has(t)));

  rule("═");
  say("VOCABULARIES");
  rule();
  say(`  coach-typed messages captured : ${typedMessages.length}`);
  say(`  ladder answers                : ${Object.keys(ladder).length} of 4`);
  say(`  typed significant tokens      : ${typedVocab.size}`);
  say(`  generated significant tokens  : ${generatedVocab.size}`);
  say(`  LAUNDERED (in BOTH)           : ${laundered.size}` +
      `  = ${typedVocab.size ? ((laundered.size / typedVocab.size) * 100).toFixed(1) : "0"}% of his typed vocabulary`);
  say(`  RARE-TYPED (usable evidence)  : ${rareTyped.size}`);
  say(`\n  The laundered set is the MEASURED BIAS. Enrichment derived the generated`);
  say(`  fields from his own description, so his words appear on both sides and rule 2`);
  say(`  disqualifies them as evidence. A large laundered share means the traced`);
  say(`  fraction below is SYSTEMATICALLY LOW and must be read with that caveat.`);

  // ── Titles ─────────────────────────────────────────────────────────────────
  const rows = await db.select({ id: hvcoTitles.id, title: hvcoTitles.title })
    .from(hvcoTitles).where(eq(hvcoTitles.serviceId, serviceId));
  let titles = rows.map(r => String(r.title ?? "")).filter(t => t.trim());
  if (titles.length === 0) stop("STEP 3", `No hvcoTitles for service ${serviceId}.`);

  // ── SYNTHETIC CONTROL (Arfeen, 2026-08-31) ──────────────────────────────
  // Set A's only trace came from `YouTube` appearing twice. A control that
  // depends on the corpus HAPPENING to contain a traceable token is not a
  // control: had that word been absent, the run returns zero traced and nothing
  // separates a BROKEN extractor from a TRUTHFUL zero. These three titles are
  // hand-built from material that exists ONLY in the ladder answers, plus one
  // built from nothing. Their verdicts are asserted, not observed.
  const SYNTHETIC: { title: string; expect: "traced" | "untraced"; why: string }[] = [
    { title: "The Limiting Beliefs That Stop the Yes", expect: "traced",
      why: "hesitation: '...was their own limiting beliefs'" },
    { title: "What the Mastermind Actually Changed in Six Months", expect: "traced",
      why: "successMoment: '...the other people in the mastermind'" },
    { title: "The 47-Minute Sunrise Reset for Tired Founders", expect: "untraced",
      why: "built from nothing — no counterpart anywhere in the typed source" },
  ];
  const synthTitles = SYNTHETIC.map(s => s.title);
  if (arg("--synthetic") !== "off") {
    titles = [...titles, ...synthTitles];
    say(`\n  SYNTHETIC CONTROL ACTIVE — ${SYNTHETIC.length} hand-built titles appended.`);
  }
  say(`\n  titles to analyse: ${titles.length}`);

  // ── Extraction — the ONLY LLM step, and it makes no judgement ──────────────
  // It is asked WHAT A TITLE ASSERTS, never whether something is invented.
  // Classification is deterministic, below. An LLM asked "is this fabricated?"
  // guesses; an LLM asked "what does this sentence assert?" is doing extraction.
  const SCHEMA = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            span: { type: "string" },
            type: { type: "string", enum: ["number", "timeframe", "named_enemy", "insider_term", "scene"] },
            subject: { type: "string", enum: ["reader", "asset"] },
            tracePhrase: { type: "string" },
          },
          required: ["title", "span", "type", "subject", "tracePhrase"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  };

  const INSTRUCTION =
`You extract the SPECIFICS a marketing title asserts. You make no judgement about whether anything is true or invented — you only report what is asserted.

A SPECIFIC is a concrete claim the title makes. Types:
- number: a count ("3 Scripts", "5 Sentences")
- timeframe: a duration or deadline ("90-Day", "Six Months", "This Week")
- named_enemy: a named obstacle, thing or practice blamed for the problem ("the Niche Worksheet", "cold outreach")
- insider_term: a term only someone in this niche would use
- scene: a concrete situational detail about a person's life or surroundings ("the Notes App", "reorganising the folder", "an unfinished sentence")

SUBJECT is who or what the specific is about:
- "asset" — it describes the DELIVERABLE being offered: its format, its structure, how many parts it has, what kind of document it is. ("3-Step Excavation", "A PDF", "One-Page Tool", "5 Sentences" when they are the contents of the thing being given away.)
- "reader" — it describes the READER'S life, history, situation, body, career or circumstances. ("10-Year Gap", "12 Years of Expertise", "Former Directors", "the Notes App on their phone".)

When a number could be either, decide by what it counts: parts of the deliverable are "asset"; years of the reader's career are "reader".

tracePhrase: the shortest literal noun phrase carrying the specific's content, lowercased, for text matching. For a bare count use the counted noun ("outreach scripts"). Keep it verbatim from the title.

Return every specific in every title. A title may have several or none.`;

  const scored: Scored[] = [];
  const BATCH = 10;
  let extracted = 0;
  let rejectedNumeric = 0;
  let rejectedOrphan = 0;
  for (let i = 0; i < titles.length; i += BATCH) {
    const batch = titles.slice(i, i + BATCH);
    const res = await invokeLLM({
      messages: [
        { role: "system", content: INSTRUCTION },
        { role: "user", content: `Extract the specifics asserted by each of these titles:\n\n${batch.map((t, n) => `${n + 1}. ${t}`).join("\n")}` },
      ],
      response_format: { type: "json_schema", json_schema: { name: "title_specifics", schema: SCHEMA } },
    } as any);
    // InvokeResult is OpenAI-shaped: choices[0].message.content, which may itself
    // be a string or an array of content parts. Read it the way landing.ts does —
    // and never assume the shape (CLAUDE.md §15i: name the line, do not believe it).
    const msg = (res as any)?.choices?.[0]?.message?.content;
    const rawContent: string = typeof msg === "string"
      ? msg
      : Array.isArray(msg)
        ? String(msg.find((c: any) => c?.type === "text")?.text ?? "{}")
        : "{}";
    const cleaned = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    let parsed: { items?: Specific[] & { title?: string }[] } = {};
    try { parsed = JSON.parse(cleaned || "{}"); }
    catch { say(`  !! batch ${i / BATCH + 1}: unparseable extractor output — first 160 chars: ${cleaned.slice(0, 160)}`); }
    // `required` is ADVISORY on the Anthropic tool-use path (CLAUDE.md §15i) — guard every field.
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    if (items.length === 0) say(`  !! batch ${i / BATCH + 1}: extractor returned no items`);
    extracted += items.length;
    for (const raw of items as any[]) {
      const span = String(raw?.span ?? "").trim();
      const tracePhrase = String(raw?.tracePhrase ?? span).trim();
      // VALIDITY FILTER (added after the set-A run: 21 of the extracted specifics
      // carried the LIST INDEX as `span`, and the model's `title` field was
      // unreliable). Re-attribute the specific to whichever batch title actually
      // contains its span, and reject it outright if none does or if the span is
      // purely numeric. This fixes attribution and validity in one move.
      if (/^[\s\d.,%-]+$/.test(span)) { rejectedNumeric++; continue; }
      const norm = (x: string) => x.toLowerCase().replace(/[\u2018\u2019\u201c\u201d'"`]/g, "'").replace(/\s+/g, " ").trim();
      const owner = batch.find(bt => norm(bt).includes(norm(span)));
      if (!owner) { rejectedOrphan++; continue; }
      const title = owner;
      const type = (["number","timeframe","named_enemy","insider_term","scene"] as const)
        .includes(raw?.type) ? raw.type as SpecType : "insider_term";
      const subject: Subject = raw?.subject === "asset" ? "asset" : "reader";
      if (!span) continue;

      // ── Deterministic classification ────────────────────────────────────
      if (subject === "asset") {
        scored.push({ span, type, subject, tracePhrase, title,
          verdict: "asset_no_trace_required", evidence: null,
          reason: "describes the deliverable — legitimate with no coach source" });
        continue;
      }
      const t = tokens(tracePhrase);
      const nums = numerals(span);
      const rareHits = t.filter(w => rareTyped.has(w));
      const bigramHits = bigrams(tracePhrase).filter(b => typedBigrams.has(b));
      const launderedHits = t.filter(w => laundered.has(w));

      if (rareHits.length > 0) {
        scored.push({ span, type, subject, tracePhrase, title, verdict: "traced",
          evidence: rareHits.join(", "),
          reason: `rare token present in typed source and ABSENT from generated vocabulary` });
      } else if (bigramHits.length > 0) {
        scored.push({ span, type, subject, tracePhrase, title, verdict: "traced",
          evidence: bigramHits.join(", "),
          reason: "contiguous multi-token phrase shared with typed source" });
      } else if (nums.length > 0 && !nums.some(n => typedNumerals.has(n))) {
        scored.push({ span, type, subject, tracePhrase, title, verdict: "untraced", evidence: null,
          reason: `numeral(s) ${nums.join("/")} appear nowhere in the coach's typed words` });
      } else if (t.length === 0) {
        scored.push({ span, type, subject, tracePhrase, title, verdict: "unverifiable", evidence: null,
          reason: "no lexical anchor to trace on" });
      } else if (launderedHits.length > 0) {
        scored.push({ span, type, subject, tracePhrase, title, verdict: "unverifiable", evidence: null,
          reason: `only overlap is laundered (${launderedHits.join(", ")}) — present in BOTH typed and generated, so it cannot discriminate` });
      } else {
        scored.push({ span, type, subject, tracePhrase, title, verdict: "untraced", evidence: null,
          reason: "no overlap with the coach's typed words" });
      }
    }
  }
  if (extracted === 0) stop("STEP 4", "The extractor returned nothing across every batch.");

  rule("═");
  say("VALIDITY FILTER — §15c on the filter itself");
  rule();
  say(`  specifics returned by extractor : ${extracted}`);
  say(`  REJECTED, span purely numeric   : ${rejectedNumeric}`);
  say(`  REJECTED, span in no batch title: ${rejectedOrphan}`);
  say(`  kept                            : ${scored.length}`);
  if (rejectedNumeric + rejectedOrphan === 0) {
    say("  🔴 THE FILTER REJECTED NOTHING. On the set-A corpus it must reject the 21");
    say("     index-as-span items. A filter that fires on nothing is decoration (§15c).");
  } else {
    say("  ✅ The filter fired. It is not decoration.");
  }

  // ── THE HEADLINE: the scene count ──────────────────────────────────────────
  const readerSpecs = scored.filter(s => s.subject === "reader");
  const scenes = readerSpecs.filter(s => s.type === "scene");
  const scenesUntraced = scenes.filter(s => s.verdict === "untraced");
  rule("═");
  say("HEADLINE — THE `scene` COUNT. This is what the run is for.");
  rule("═");
  say(`  reader-subject SCENE specifics : ${scenes.length}`);
  say(`  of which UNTRACED              : ${scenesUntraced.length}`);
  say(`\n  A scene is a concrete situational detail asserted about the reader's life.`);
  say(`  It is none of number, timeframe, named enemy or insider term — so no gate we`);
  say(`  own looks for it. This is the fabricated-intimacy class, counted.`);
  for (const s of scenesUntraced) say(`    · "${s.span}"   ← ${s.title.slice(0, 70)}`);

  // ── The fraction ───────────────────────────────────────────────────────────
  const traced = readerSpecs.filter(s => s.verdict === "traced");
  const untraced = readerSpecs.filter(s => s.verdict === "untraced");
  const unverifiable = readerSpecs.filter(s => s.verdict === "unverifiable");
  const assetSpecs = scored.filter(s => s.subject === "asset");
  const denom = traced.length + untraced.length;

  rule("═");
  say("THE FRACTION — reader-subject specifics only");
  rule();
  say(`  TRACED       : ${traced.length}`);
  say(`  UNTRACED     : ${untraced.length}`);
  say(`  UNVERIFIABLE : ${unverifiable.length}   <-- excluded from BOTH numerator and denominator`);
  say(`  ASSET        : ${assetSpecs.length}   <-- require no trace; NOT counted as untraced`);
  say(`\n  TRACEABLE FRACTION: ${traced.length} of ${denom}` +
      (denom ? `  =  ${((traced.length / denom) * 100).toFixed(1)}%` : "  =  n/a (denominator 0)"));
  say(`  Laundered share of his typed vocabulary: ${typedVocab.size ? ((laundered.size / typedVocab.size) * 100).toFixed(1) : "0"}%` +
      ` — the traced fraction is systematically LOW by this much.`);

  // ── §15c: both poles reachable? ────────────────────────────────────────────
  rule("═");
  say("§15c — BOTH POLES REACHABLE IN THIS CORPUS?");
  rule();
  const ok = traced.length > 0 && untraced.length > 0;
  say(`  reported at least one TRACED   : ${traced.length > 0 ? "YES" : "NO"}`);
  say(`  reported at least one UNTRACED : ${untraced.length > 0 ? "YES" : "NO"}`);
  say(ok
    ? "  ✅ Both poles reached. This is a measurement."
    : "  🔴 ONE POLE ONLY. An extractor that can only find fabrication is CONFIRMING,\n     not measuring. Treat the fraction above as UNPROVEN.");
  if (traced.length > 0) for (const s of traced) say(`    TRACED  "${s.span}"  ← evidence: ${s.evidence}`);

  // ── Synthetic control verdicts ─────────────────────────────────────────────
  if (arg("--synthetic") !== "off") {
    rule("═");
    say("SYNTHETIC CONTROL — verdicts ASSERTED IN ADVANCE, not observed");
    rule();
    let synthOk = true;
    for (const sc of SYNTHETIC) {
      const mine = scored.filter(x => x.title === sc.title && x.subject === "reader");
      const anyTraced = mine.some(x => x.verdict === "traced");
      const pass = sc.expect === "traced" ? anyTraced : !anyTraced;
      if (!pass) synthOk = false;
      say(`  ${pass ? "✅" : "🔴"} expect ${sc.expect.padEnd(8)} got ${anyTraced ? "traced  " : "no-trace"}  "${sc.title}"`);
      say(`      ${sc.why}`);
      for (const m of mine) say(`      · [${m.type}] ${m.verdict} "${m.span}"${m.evidence ? ` · ${m.evidence}` : ""}`);
      if (mine.length === 0) say(`      · extractor found NO reader-subject specific in this title`);
    }
    say(synthOk
      ? "\n  ✅ Synthetic control PASSED. A zero from this extractor would be a truthful zero."
      : "\n  🔴 SYNTHETIC CONTROL FAILED. Do NOT trust set B — a broken extractor and a\n     truthful zero are currently indistinguishable.");
  }

  // ── Per-type breakdown, one line each ──────────────────────────────────────
  rule("═");
  say("EVERY SPECIFIC, ONE LINE EACH");
  rule();
  for (const s of scored) {
    say(`  [${s.subject}/${s.type}] ${s.verdict.padEnd(24)} "${s.span}"`);
    say(`      ${s.reason}${s.evidence ? `  · evidence: ${s.evidence}` : ""}`);
  }
  say(`\nDone. Read-only throughout; no row was written.`);
}

main().catch((e) => { say(`\nFAILED: ${e?.message ?? e}`); process.exit(1); });
