/**
 * Sprint 2 — grounding checker (F2 speaker facts + F5 viewer financial information), RECORD-ONLY.
 * The LLM is MOCKED throughout: every test here exercises the deterministic half, which never trusts the
 * model. Verdicts were fixed before the first run. Live model behaviour is measured separately by
 * server/scripts/grounding-checker-eval.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  checkGrounding, renderRetryNote, normaliseForMatch, verifyQuote, extractNumbers, verifyEvidence,
  certaintyMarkersIn, CHECKER_SINGLE_VALUED_SLOTS, GROUNDING_CHECKER_SYSTEM_PROMPT, MAX_EXTRACTION_ATTEMPTS,
  splitSentences, sentenceEquals,
  type GroundingCheckResult,
} from "./_core/groundingChecker";
import { buildCoachFacts, SINGLE_VALUED_SLOTS, type CoachFact, type CoachFactsResult } from "./_core/coachFacts";
import { GROUNDING_FIXTURES, scoreFixtureRun, matchesAnchor } from "./__fixtures__/groundingCheckerScripts";

// ── helpers ───────────────────────────────────────────────────────────────────────────────────────
const fact = (slot: string, kind: CoachFact["kind"], value: string, source: CoachFact["source"] = "coach_typed"): CoachFact =>
  ({ slot, kind, value, source, sourceRef: `test:${slot}:${value.slice(0, 8)}`, sourcedAt: null });
const factsOf = (facts: CoachFact[], extra: Partial<CoachFactsResult> = {}): CoachFactsResult =>
  ({ facts, canonical: {}, superseded: [], excluded: [], ...extra });

type Responder = () => unknown;
function mockInvoke(...responders: Responder[]) {
  const calls: any[] = [];
  let i = 0;
  const fn = async (params: any) => {
    calls.push(params);
    const r = responders[Math.min(i++, responders.length - 1)];
    const body = r();
    if (body instanceof Error) throw body;
    return {
      id: "mock", created: 0, model: "mock-model",
      choices: [{ index: 0, message: { role: "assistant", content: typeof body === "string" ? body : JSON.stringify(body) }, finish_reason: "tool_use" }],
      usage: { prompt_tokens: 1000, completion_tokens: 80, total_tokens: 1080 },
    } as any;
  };
  return Object.assign(fn, { calls });
}
const claim = (over: Record<string, unknown>) => ({
  quote: "", kind: "age", specificity: "specific", slot: "none", normalised_value: "", evidence: "", certainty_markers: [], ...over,
});
/** The §15k reading proof for TEXT: its real opening and closing sentence. */
const COPY_READ_OK = {
  sentence_count: 5,
  first_sentence: "Me at forty-four, I left my job at a bank.",
  last_sentence: "Since 2021 I have run this session every month.",
};
const copyReadFor = (text: string) => { const ss = splitSentences(text); return { sentence_count: ss.length, first_sentence: ss[0], last_sentence: ss[ss.length - 1] }; };
const payload = (p: { claims?: unknown[]; fin?: unknown[]; copyRead?: unknown }) =>
  ({ speaker_claims: p.claims ?? [], viewer_financial_findings: p.fin ?? [], copy_read: p.copyRead ?? COPY_READ_OK });

const TEXT =
  "Me at forty-four, I left my job at a bank. I’ve trained coaches in forty-nine countries — every one of them. " +
  "You will know exactly which pattern is yours. Your savings are sitting in a current account. " +
  "Since 2021 I have run this session every month.";
const asset = (text = TEXT) => ({ assetType: "script", assetId: "t", fields: [{ name: "spoken", text }] });
const run = (resp: unknown, facts: CoachFactsResult = factsOf([])) => checkGrounding(asset(), facts, { invoke: mockInvoke(() => resp) });

// ── A. normalisation and quote verification ───────────────────────────────────────────────────────
describe("quote verification", () => {
  it("normalises whitespace, quote marks, dashes and case", () => {
    expect(normaliseForMatch("I’ve  been\n“thinking” — Since 2021")).toBe(normaliseForMatch("i've been \"thinking\" - since 2021"));
    expect(normaliseForMatch("forty–four")).toBe("forty-four");
  });
  it("accepts a verbatim quote across quote-mark and dash variants; rejects altered, short and cross-field quotes", () => {
    const idx = [{ name: "a", norm: normaliseForMatch(TEXT) }, { name: "b", norm: normaliseForMatch("Second field starts here.") }];
    expect(verifyQuote("I've trained coaches in forty-nine countries - every one", idx)).toBe("a");
    expect(verifyQuote("I've trained coaches in fifty countries", idx)).toBeNull();
    expect(verifyQuote("Me", idx)).toBeNull();
    expect(verifyQuote("once a month. Second field", idx)).toBeNull();
    expect(verifyQuote("Second field starts here.", idx)).toBe("b");
  });
});

// ── B. numbers ────────────────────────────────────────────────────────────────────────────────────
describe("number normalisation", () => {
  const vals = (s: string) => extractNumbers(s).filter((m) => !m.lone).map((m) => m.value);
  it.each([
    ["fifty-two countries", [52]], ["a million people", [1_000_000]], ["twenty-five years", [25]],
    ["1,000,000 downloads", [1_000_000]], ["one hundred and twenty clients", [120]], ["a decade in banking", [10]],
    ["two decades", [20]], ["3,000 coaches", [3000]], ["10k followers", [10000]], ["forty nine", [49]],
    ["since 2021", [2021]], ["two million", [2_000_000]], ["a dozen", [12]],
  ])("%s", (s, expected) => { expect(vals(s)).toEqual(expected); });
  it("marks a bare 'one' as a pronoun", () => {
    expect(extractNumbers("the one question I ask")[0]).toMatchObject({ value: 1, lone: true });
  });
});

// ── C. evidence verification ──────────────────────────────────────────────────────────────────────
describe("evidence verification", () => {
  const facts = [fact("coach_background", "biography", "I spent 25 years in retail banking."), fact("ladder_trigger", "practice", "They were stuck.")];
  it("verifies a span inside one fact", () => {
    expect(verifyEvidence("25 years in retail banking", "twenty-five years in banking", "tenure", facts)).toMatchObject({ verified: true, rejection: null });
  });
  it("rejects a fabricated span, a span joined across two facts, and a trivially short span", () => {
    expect(verifyEvidence("30 years in banking", "thirty years", "tenure", facts).rejection).toBe("evidence_not_found");
    expect(verifyEvidence("banking. They were stuck", "banking", "career", facts).rejection).toBe("evidence_not_found");
    expect(verifyEvidence("a", "at a bank", "career", facts).rejection).toBe("evidence_too_short");
    expect(verifyEvidence("", "at a bank", "career", facts).rejection).toBe("no_evidence");
  });
  it("rejects evidence whose numbers do not match the quote's", () => {
    expect(verifyEvidence("years in retail banking", "twelve years in banking", "tenure", facts).rejection).toBe("evidence_number_mismatch");
  });
  it("D-a: a confirmed rewording grounds practice, never biography", () => {
    const rw = [fact("practice_note", "practice", "I work with women returning to work", "coach_confirmed_rewording")];
    expect(verifyEvidence("women returning to work", "I work with women returning to work", "practice", rw).verified).toBe(true);
    expect(verifyEvidence("women returning to work", "I returned to work", "life_event", rw).rejection).toBe("rewording_not_evidence_for_biography");
  });
});

// ── D. verdicts ───────────────────────────────────────────────────────────────────────────────────
describe("verdicts", () => {
  it("grounded: a specific fact with verified evidence", async () => {
    const r = await run(payload({ claims: [claim({ quote: "I left my job at a bank", kind: "career", evidence: "worked at a bank" })] }),
      factsOf([fact("coach_background", "biography", "I worked at a bank before coaching.")]));
    expect(r.status).toBe("checked");
    expect(r.speakerClaims[0]).toMatchObject({ verdict: "grounded", evidenceVerified: true });
  });
  it("ungrounded: a specific fact without verified evidence (fabricated citation counted)", async () => {
    const r = await run(payload({ claims: [claim({ quote: "Me at forty-four", evidence: "I am forty-four" })] }), factsOf([fact("x", "biography", "mind coach")]));
    expect(r.speakerClaims[0]).toMatchObject({ verdict: "ungrounded", evidenceRejection: "evidence_not_found" });
    expect(r.counts.specificBiographyUngrounded).toBe(1);
    expect(r.counts.unverifiedEvidence).toBe(1);
  });
  it("D-c: unspecific colour is not_checkable, never a biography finding", async () => {
    const r = await run(payload({ claims: [claim({ quote: "I left my job at a bank", kind: "life_event", specificity: "unspecific" })] }));
    expect(r.speakerClaims[0].verdict).toBe("not_checkable");
    expect(r.counts.specificBiographyUngrounded).toBe(0);
    expect(r.counts.notCheckable).toBe(1);
  });
  const countries = (value: string) => factsOf([fact("countries", "credential", value)], { canonical: { countries: fact("countries", "credential", value) } });
  it("conflicts_with_current_fact: 'forty-nine' against a canonical 52", async () => {
    const r = await run(payload({ claims: [claim({ quote: "I’ve trained coaches in forty-nine countries", kind: "credential", slot: "countries", normalised_value: "49" })] }), countries("52"));
    expect(r.speakerClaims[0]).toMatchObject({ verdict: "conflicts_with_current_fact", slotCheck: "conflict" });
    expect(r.speakerClaims[0].conflict).toMatchObject({ copyValue: 49, canonicalValue: "52" });
  });
  it("number words and digits compare equal: copy 'forty-nine' matches canonical '49 countries'", async () => {
    const f = countries("Coaches trained in 49 countries");
    const r = await run(payload({ claims: [claim({ quote: "I’ve trained coaches in forty-nine countries", kind: "credential", slot: "countries", normalised_value: "49", evidence: "49 countries" })] }), f);
    expect(r.speakerClaims[0]).toMatchObject({ verdict: "grounded", slotCheck: "match" });
  });
  it("a conflict outranks verified evidence from a stale non-slot fact", async () => {
    const f = factsOf([fact("coach_background", "biography", "Trained coaches in 49 countries"), fact("countries", "credential", "52")],
      { canonical: { countries: fact("countries", "credential", "52") } });
    const r = await run(payload({ claims: [claim({ quote: "I’ve trained coaches in forty-nine countries", kind: "credential", slot: "countries", evidence: "49 countries" })] }), f);
    expect(r.speakerClaims[0]).toMatchObject({ evidenceVerified: true, verdict: "conflicts_with_current_fact" });
  });
  it("a year after 'since' is not read as a count; a slot with no canonical value falls back to evidence", async () => {
    const f = factsOf([], { canonical: { years_experience: fact("years_experience", "biography", "5") } });
    const r = await run(payload({ claims: [claim({ quote: "Since 2021 I have run this session every month", kind: "tenure", slot: "years_experience" })] }), f);
    expect(r.speakerClaims[0]).toMatchObject({ slotCheck: "undetermined", verdict: "ungrounded" });
    const r2 = await run(payload({ claims: [claim({ quote: "I’ve trained coaches in forty-nine countries", kind: "credential", slot: "countries" })] }));
    expect(r2.speakerClaims[0]).toMatchObject({ slotCheck: "no_canonical", verdict: "ungrounded" });
  });
  it("text slot: a superseded headline credential in the copy conflicts", async () => {
    const f = factsOf([], { canonical: { headline_credential: fact("headline_credential", "credential", "Master Trainer") },
      superseded: [fact("headline_credential", "credential", "certified coach")] });
    const r = await run(payload({ claims: [claim({ quote: "Me at forty-four, I left my job at a bank", kind: "credential", slot: "headline_credential" })] }), f);
    expect(r.speakerClaims[0].slotCheck).toBe("undetermined");
    const text = "As a certified coach I see this daily.";
    const r2 = await checkGrounding(asset(text), f, { invoke: mockInvoke(() => payload({ claims: [claim({ quote: "As a certified coach", kind: "credential", slot: "headline_credential" })], copyRead: copyReadFor(text) })) });
    expect(r2.speakerClaims[0].verdict).toBe("conflicts_with_current_fact");
  });
});

describe("certainty (overstated)", () => {
  const outcome = (over: Record<string, unknown> = {}) => claim({ quote: "You will know exactly which pattern is yours", kind: "offer_outcome", evidence: "know which pattern is theirs", ...over });
  it("a grounded offer_outcome carrying a marker its evidence lacks is overstated", async () => {
    const r = await run(payload({ claims: [outcome()] }), factsOf([fact("ladder_successMoment", "practice", "Most people know which pattern is theirs by the end.")]));
    expect(r.speakerClaims[0]).toMatchObject({ verdict: "overstated", certaintyMarkers: ["exactly"], certaintyMarkersMissingFromEvidence: ["exactly"] });
    expect(r.counts.overstated).toBe(1);
  });
  it("the same claim is grounded when the coach's fact carries the marker", async () => {
    const r = await run(payload({ claims: [outcome()] }), factsOf([fact("ladder_successMoment", "practice", "People always know which pattern is theirs, exactly.")]));
    expect(r.speakerClaims[0].verdict).toBe("grounded");
  });
  it("an ungrounded outcome stays ungrounded; a grounded biography claim with a marker stays grounded", async () => {
    const r = await run(payload({ claims: [outcome({ evidence: "" })] }));
    expect(r.speakerClaims[0].verdict).toBe("ungrounded");
    const r2 = await run(payload({ claims: [claim({ quote: "You will know exactly which pattern is yours", kind: "credential", evidence: "know which pattern is theirs" })] }),
      factsOf([fact("x", "credential", "Most people know which pattern is theirs.")]));
    expect(r2.speakerClaims[0].verdict).toBe("grounded");
  });
  it("model-reported markers count only when they are in the quote", () => {
    expect(certaintyMarkersIn("You will know which pattern is yours", ["guaranteed"])).toEqual([]);
    expect(certaintyMarkersIn("You will know, without question, which pattern", ["without question"])).toEqual(["without question"]);
  });
});

// ── E. F5 ─────────────────────────────────────────────────────────────────────────────────────────
describe("viewer financial findings", () => {
  it("records a verified quote with its attribute", async () => {
    const r = await run(payload({ fin: [{ quote: "Your savings are sitting in a current account", attribute: "savings" }] }));
    expect(r.viewerFinancialFindings).toEqual([{ field: "spoken", quote: "Your savings are sitting in a current account", attribute: "savings" }]);
    expect(r.counts.viewerFinancial).toBe(1);
  });
  it("an unverified quote is an extraction error, never a finding, and triggers one re-extraction", async () => {
    const bad = payload({ fin: [{ quote: "Your pension is empty", attribute: "savings" }] });
    const good = payload({ fin: [{ quote: "Your savings are sitting in a current account", attribute: "savings" }] });
    const invoke = mockInvoke(() => bad, () => good);
    const r = await checkGrounding(asset(), factsOf([]), { invoke });
    expect(invoke.calls).toHaveLength(2);
    expect(r.status).toBe("checked");
    expect(r.extractionErrors.unverifiedFinancialQuotes).toBe(1);
    expect(r.viewerFinancialFindings).toHaveLength(1);
  });
});

// ── F. extraction failure (A3) ────────────────────────────────────────────────────────────────────
describe("extraction failure", () => {
  it("a call that throws twice is extraction_failed, reported, and never 'no findings'", async () => {
    const invoke = mockInvoke(() => new Error("overloaded"));
    const r = await checkGrounding(asset(), factsOf([]), { invoke });
    expect(invoke.calls).toHaveLength(MAX_EXTRACTION_ATTEMPTS);
    expect(r.status).toBe("extraction_failed");
    expect(r.extractionErrors.callErrors).toBe(2);
    expect(renderRetryNote(r)).toBe("");
  });
  it("malformed twice fails; malformed then well-formed recovers", async () => {
    const r = await checkGrounding(asset(), factsOf([]), { invoke: mockInvoke(() => ({ speaker_claims: "none", viewer_financial_findings: [], copy_read: COPY_READ_OK })) });
    expect(r.status).toBe("extraction_failed");
    expect(r.extractionErrors.malformedResponses).toBe(2);
    const r2 = await checkGrounding(asset(), factsOf([]), { invoke: mockInvoke(() => "not json", () => payload({})) });
    expect(r2.status).toBe("checked");
    expect(r2.attempts.map((a) => a.outcome)).toEqual(["malformed", "ok"]);
  });
  it("an enum outside the closed set is malformed", async () => {
    const r = await run(payload({ fin: [{ quote: "Your savings are sitting in a current account", attribute: "cryptocurrency" }] }));
    expect(r.status).toBe("extraction_failed");
  });
  it("a copy_read missing its required fields is malformed", async () => {
    const r = await run({ speaker_claims: [], viewer_financial_findings: [], copy_read: { sentence_count: 5 } });
    expect(r.status).toBe("extraction_failed");
    expect(r.extractionErrors.malformedResponses).toBe(2);
  });
  it("unverifiable twice fails, keeping the last attempt's verified findings for humans", async () => {
    const resp = payload({ claims: [claim({ quote: "Me at forty-four" }), claim({ quote: "I was born in Leeds", kind: "place" })] });
    const r = await run(resp);
    expect(r.status).toBe("extraction_failed");
    expect(r.extractionErrors.unverifiedClaimQuotes).toBe(2);
    expect(r.speakerClaims).toHaveLength(1);
    expect(r.rejectedQuotes.map((q) => q.quote)).toEqual(["I was born in Leeds", "I was born in Leeds"]);
  });
  // ── §15k: SILENCE MUST FAIL, CORRECT-NEGATIVE MUST PASS. The pair is the control; either alone is not.
  it("§15k SILENT FAIL: empty lists with a copy_read that did not read the copy is silence, and fails", async () => {
    const r = await run(payload({ copyRead: { sentence_count: 5, first_sentence: "Something never written here.", last_sentence: "Nor this." } }));
    expect(r.status).toBe("extraction_failed");
    expect(r.extractionErrors.unverifiedCopyRead).toBe(2);
    expect(r.copyRead?.verified).toBe(false);
  });
  it("§15k SILENT FAIL: quoting the opening sentence as BOTH ends does not prove a full read", async () => {
    const r = await run(payload({ copyRead: { sentence_count: 5, first_sentence: COPY_READ_OK.first_sentence, last_sentence: COPY_READ_OK.first_sentence } }));
    expect(r.status).toBe("extraction_failed");
    expect(r.extractionErrors.unverifiedCopyRead).toBe(2);
  });
  it("§15k CORRECT NEGATIVE: empty lists WITH a verified copy_read is a clean read, not silence", async () => {
    const r = await run(payload({}));
    expect(r.status).toBe("checked");
    expect(r.speakerClaims).toHaveLength(0);
    expect(r.viewerFinancialFindings).toHaveLength(0);
    expect(r.copyRead?.verified).toBe(true);
    expect(r.extractionErrors.total).toBe(0);
  });
  it("§15k: a miscounted sentence_count is recorded, never gating", async () => {
    const r = await run(payload({ copyRead: { ...COPY_READ_OK, sentence_count: 99 } }));
    expect(r.status).toBe("checked");
    expect(r.copyRead?.countMatches).toBe(false);
  });
  it("empty input makes no call", async () => {
    const invoke = mockInvoke(() => payload({}));
    const r = await checkGrounding({ assetType: "script", fields: [{ name: "spoken", text: "   " }] }, factsOf([]), { invoke });
    expect(r.status).toBe("empty_input");
    expect(invoke.calls).toHaveLength(0);
  });
});

// ── G. call shape and prompt ──────────────────────────────────────────────────────────────────────
describe("the model call", () => {
  it("one strict-tool call per asset, all fields together; superseded values never reach the model", async () => {
    const invoke = mockInvoke(() => payload({ copyRead: { sentence_count: 2, first_sentence: "Headline field text.", last_sentence: "Body field text." } }));
    const f = factsOf([fact("countries", "credential", "52 countries")], { superseded: [fact("countries", "credential", "SUPERSEDED-49-MARKER")] });
    const r = await checkGrounding({ assetType: "ad", fields: [{ name: "headline", text: "Headline field text." }, { name: "body", text: "Body field text." }] }, f, { invoke });
    expect(r.status).toBe("checked");
    expect(invoke.calls).toHaveLength(1);
    const p = invoke.calls[0];
    expect(p.strictToolUse).toBe(true);
    const user = p.messages[1].content as string;
    expect(user).toContain("Headline field text.");
    expect(user).toContain("Body field text.");
    expect(user).toContain("52 countries");
    expect(user).not.toContain("SUPERSEDED-49-MARKER");
    expect(r.usage).toMatchObject({ calls: 1, inputTokens: 1000, outputTokens: 80, models: ["mock-model"] });
  });
  it("§14: the checker prompt carries no fixture copy", () => {
    const prompt = normaliseForMatch(GROUNDING_CHECKER_SYSTEM_PROMPT);
    for (const fx of GROUNDING_FIXTURES) {
      for (const s of fx.asset.fields[0].text.split(/(?<=[.!?])\s+/)) expect(prompt).not.toContain(normaliseForMatch(s));
    }
  });
  it("the checker's slot list matches coachFacts' single-valued slots", () => {
    expect([...CHECKER_SINGLE_VALUED_SLOTS]).toEqual([...SINGLE_VALUED_SLOTS]);
  });
  it("imports no database module: its only runtime import is ./llm", () => {
    const src = readFileSync(join(__dirname, "_core/groundingChecker.ts"), "utf8");
    const runtime = Array.from(src.matchAll(/^import\s+(?!type\s)[^;]*?from\s+"([^"]+)"/gm)).map((m) => m[1]);
    expect(runtime).toEqual(["./llm"]);
  });
});

// ── H. retry-safe renderer ────────────────────────────────────────────────────────────────────────
describe("renderRetryNote quotes nothing", () => {
  const s229 = GROUNDING_FIXTURES.find((f) => f.id === "k225-s229")!.asset.fields[0].text;
  const quotes = [
    "Me at forty-four, watching my youngest leave for university",
    "ideas I've been 'thinking about' since 2021",
    "someone who spent twelve years running procurement for a global firm",
  ];
  const text = `${s229} I've coached people in forty-nine countries. You will know exactly which pattern is yours. Your savings haven't moved in three years.`;
  const flagged = [
    ...quotes.map((q) => claim({ quote: q, kind: q.includes("procurement") ? "career" : q.includes("2021") ? "date" : "age" })),
    claim({ quote: "I've coached people in forty-nine countries", kind: "credential", slot: "countries" }),
    claim({ quote: "You will know exactly which pattern is yours", kind: "offer_outcome", evidence: "know which pattern" }),
  ];
  const facts = factsOf([fact("countries", "credential", "52"), fact("ladder", "practice", "Most people know which pattern is theirs")],
    { canonical: { countries: fact("countries", "credential", "52") } });
  const allQuotes = [...flagged.map((c) => c.quote as string), "Your savings haven't moved in three years"];

  it("describes every class in the abstract, with no quote, no three-word run and no figure from the flagged text", async () => {
    const r = await checkGrounding(asset(text), facts, { invoke: mockInvoke(() => payload({
      claims: flagged, fin: [{ quote: "Your savings haven't moved in three years", attribute: "savings" }], copyRead: copyReadFor(text),
    })) });
    expect(r.status).toBe("checked");
    expect(r.counts).toMatchObject({ specificBiographyUngrounded: 3, conflicts: 1, overstated: 1, viewerFinancial: 1 });
    const note = renderRetryNote(r);
    const n = normaliseForMatch(note);
    expect(note.split("\n")).toHaveLength(4);
    for (const q of allQuotes) {
      expect(n).not.toContain(normaliseForMatch(q));
      const words = normaliseForMatch(q).split(/[^a-z0-9'-]+/).filter(Boolean);
      for (let i = 0; i + 3 <= words.length; i++) expect(n).not.toContain(words.slice(i, i + 3).join(" "));
    }
    // No figure of any kind: no digit and no number word, so nothing can coincide with a copy figure.
    expect(note).not.toMatch(/\d/);
    expect(extractNumbers(note)).toEqual([]);
    for (const distinctive of ["forty-four", "youngest", "university", "procurement", "global firm", "2021", "forty-nine", "exactly", "three years"]) {
      expect(n).not.toContain(distinctive);
    }
    expect(n).toContain("work history");
  });
  it("is empty for a clean result", async () => {
    const r = await run(payload({}));
    expect(r.status).toBe("checked");
    expect(renderRetryNote(r)).toBe("");
  });
});

// ── I. fixtures: reachable expectations, and the facts the builder derives from them ──────────────
describe("fixtures", () => {
  it("every anchor occurs in its own script (each expectation is reachable, §15c)", () => {
    for (const fx of GROUNDING_FIXTURES) {
      const e = fx.expect;
      const sets = [...e.flagBiography, ...e.groundBiography, ...e.conflicts, ...e.overstated, ...e.groundedNotOverstated, ...e.financialFind, ...e.financialNotFind];
      expect(sets.length + (e.dcControl ? 1 : 0), fx.id).toBeGreaterThan(0);
      for (const s of sets) for (const a of s) expect(normaliseForMatch(fx.asset.fields[0].text), `${fx.id}: ${a}`).toContain(normaliseForMatch(a));
    }
  });
  const built = (id: string) => buildCoachFacts(GROUNDING_FIXTURES.find((f) => f.id === id)!.facts);
  it("script 229's facts are the coach's (non-empty) and carry none of the invented biography", () => {
    const f = built("k225-s229");
    expect(f.facts.length).toBeGreaterThan(0);
    const all = normaliseForMatch(f.facts.map((x) => x.value).join(" | "));
    for (const s of ["forty-four", "university", "procurement", "2021", "twelve years"]) expect(all).not.toContain(s);
    expect(f.excluded.some((x) => x.reason === "unconfirmed_rewording")).toBe(true);
  });
  it("P1 with facts carries twenty-five years and Shez; without facts carries neither", () => {
    const withF = normaliseForMatch(built("p1-with-facts").facts.map((x) => x.value).join(" | "));
    expect(withF).toContain("twenty-five years");
    expect(withF).toContain("shez");
    const without = built("p1-without-facts");
    expect(without.facts.length).toBeGreaterThan(0);
    expect(normaliseForMatch(without.facts.map((x) => x.value).join(" | "))).not.toMatch(/shez|twenty-five/);
  });
  it("the conflict fixture's canonical countries is 52 and 49 is superseded", () => {
    const f = built("conflict-countries");
    expect(f.canonical.countries?.value).toBe("52");
    expect(f.superseded.map((x) => x.value)).toContain("49");
  });
});

describe("fixture scorer", () => {
  const fx = GROUNDING_FIXTURES.find((f) => f.id === "k225-s229")!;
  const base = (over: Partial<GroundingCheckResult>): GroundingCheckResult => ({
    status: "checked", recordOnly: true, assetType: "script", assetId: "229", speakerClaims: [], viewerFinancialFindings: [], copyRead: null,
    sentenceCount: 1, counts: {} as any, extractionErrors: {} as any, rejectedQuotes: [], attempts: [],
    usage: { calls: 1, inputTokens: 0, outputTokens: 0, latencyMs: 0, models: [] }, ...over,
  });
  const sc = (quote: string, verdict: string, kind = "age", specificity = "specific") =>
    ({ quote, verdict, kind, specificity, biography: kind !== "practice" && kind !== "offer_outcome" } as any);
  it("scores recall, false positives, and silence as a miss", () => {
    const perfect = base({ speakerClaims: [
      sc("Me at forty-four", "ungrounded"), sc("my youngest leave for university", "ungrounded", "family"),
      sc("twelve years running procurement", "ungrounded", "career"), sc("since 2021", "ungrounded", "date"),
      sc("I kept running into", "ungrounded", "life_event"),
    ] });
    const s = scoreFixtureRun(fx, perfect);
    expect(s.bio).toMatchObject({ expected: 4, found: 4, flagged: 5, falsePositives: ["I kept running into"] });
    expect(scoreFixtureRun(fx, base({})).bio.found).toBe(0);
    const failed = scoreFixtureRun(fx, base({ status: "extraction_failed", speakerClaims: perfect.speakerClaims }));
    expect(failed.bio).toMatchObject({ found: 0, falsePositives: [] });
  });
  it("the D-c control fails on silence and passes only with a not_checkable claim and no flagged biography", () => {
    const dc = GROUNDING_FIXTURES.find((f) => f.id === "dc-control")!;
    expect(scoreFixtureRun(dc, base({})).dcPass).toBe(false);
    expect(scoreFixtureRun(dc, base({ speakerClaims: [sc("the morning I finally sent that first message", "not_checkable", "life_event", "unspecific")] })).dcPass).toBe(true);
    expect(scoreFixtureRun(dc, base({ speakerClaims: [
      sc("the morning I finally sent that first message", "not_checkable", "life_event", "unspecific"), sc("On Sunday", "ungrounded", "date"),
    ] })).dcPass).toBe(false);
  });
  it("F5 control-line hits are recorded as false positives", () => {
    const f5 = GROUNDING_FIXTURES.find((f) => f.id === "f5-controls")!;
    const s = scoreFixtureRun(f5, base({ viewerFinancialFindings: [
      { field: "spoken", quote: "Your savings haven't moved in three years", attribute: "savings" },
      { field: "spoken", quote: "You can't afford to get this wrong", attribute: "spending" },
    ] }));
    expect(s.f5).toMatchObject({ expected: 3, found: 1, findings: 2, controlHits: ["You can't afford to get this wrong"] });
    expect(matchesAnchor("YOUR SAVINGS", ["your savings"])).toBe(true);
  });

  // ── financialAmbiguous (Arfeen, 2026-09-22) ──────────────────────────────────────────────────
  it("the CONDITIONAL control still gates: financialNotFind is unchanged by the ambiguous class", () => {
    const f5 = GROUNDING_FIXTURES.find((f) => f.id === "f5-controls")!;
    const s = scoreFixtureRun(f5, base({ viewerFinancialFindings: [
      { field: "spoken", quote: "If you're earning well and want a plan for it, this session is for you.", attribute: "income" },
    ] }));
    expect(s.f5.controlHits).toEqual(["If you're earning well and want a plan for it, this session is for you."]);
    expect(s.f5.falsePositives).toHaveLength(1); // still counted against precision
    expect(s.f5.ambiguousHits).toEqual([]);      // and NOT reclassified as ambiguous
  });

  it("the pension line is REPORTED but counts as neither a false positive nor a control hit", () => {
    for (const id of ["p1-with-facts", "p1-without-facts"]) {
      const fx1 = GROUNDING_FIXTURES.find((f) => f.id === id)!;
      const s = scoreFixtureRun(fx1, base({ viewerFinancialFindings: [
        { field: "spoken", quote: "Nobody's building a pension behind a salary any more.", attribute: "income" },
      ] }));
      expect(s.f5.ambiguousHits).toHaveLength(1);   // visible every run
      expect(s.f5.falsePositives).toEqual([]);      // excluded from precision
      expect(s.f5.controlHits).toEqual([]);         // excluded from promotion gating
      expect(s.f5.findings).toBe(1);                // the finding itself is never hidden
    }
  });

  it("the OTHER p1 control line still gates — only the pension line moved", () => {
    const fx1 = GROUNDING_FIXTURES.find((f) => f.id === "p1-with-facts")!;
    expect(fx1.expect.financialNotFind).toEqual([["none of them is money"]]);
    expect(fx1.expect.financialAmbiguous).toEqual([["pension behind a salary"]]);
    const s = scoreFixtureRun(fx1, base({ viewerFinancialFindings: [
      { field: "spoken", quote: "None of them is money.", attribute: "income" },
    ] }));
    expect(s.f5.controlHits).toHaveLength(1);
    expect(s.f5.falsePositives).toHaveLength(1);
  });
});
