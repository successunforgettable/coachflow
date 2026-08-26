/**
 * Size limits: bound at generation, REPAIR after, never reject.
 *
 * The schema bounds are a hint on this provider, not a grammar — `response_format` becomes an
 * Anthropic forced tool call, which validates types and required fields, not lengths. So every
 * upper bound is paired with a deterministic repair, and no bound may introduce a new way for a
 * body to come back null on the path every coach hits.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyBodyBounds, BOUNDS, schemaFor, userPromptFor, systemPromptFor } from "./leadMagnetContentGenerator";
import { NO_RESEARCH_STATISTIC_FABRICATION_RULE } from "./_core/copywritingRules";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ") + ".";
const long = (chars: number) => "Sentence one is here. ".repeat(Math.ceil(chars / 22)).slice(0, chars);

describe("BOUNDS", () => {
  it("declares a bound set for every format", () => {
    for (const f of ["guide", "checklist", "toolkit", "quiz"]) expect(BOUNDS).toHaveProperty(f);
  });
  it("carries the derived numbers", () => {
    expect(BOUNDS.guide.sections.maxItems).toBe(6);
    // The section cap sits ABOVE the centre, at the measured distribution's own outlier
    // threshold. A cap placed ON the centre truncates half the corpus by definition, which is
    // what the first set did.
    expect(BOUNDS.guide.sections.body).toBe(2800);
    expect(BOUNDS.guide.promise).toBe(320);
    expect(BOUNDS.toolkit.tools.maxItems).toBe(4);
    expect(BOUNDS.toolkit.tools.content).toBe(4000);
  });

  it("carries the checklist numbers, derived at the shipping target across both modes", () => {
    // 173 items, 15 bodies, all at the shipping length target: 119 lead-magnet across two titles
    // and 54 bonus across two briefs. Fences 563.5 and 119.0, rounded UP to the nearest ten —
    // below 1,000 the step is ten, at or above it the step is a hundred, so rounding never
    // relocates a cap off the distribution it came from.
    expect(BOUNDS.checklist.items.detail).toBe(570);
    expect(BOUNDS.checklist.items.label).toBe(120);
    expect(BOUNDS.checklist.promise).toBe(320);
  });
});

describe("applyBodyBounds — guide", () => {
  const over = () => ({
    format: "guide" as const, title: "t", promise: long(900),
    sections: Array.from({ length: 9 }, (_, i) => ({ heading: `Heading number ${i} ` + words(40), body: long(3000) })),
    nextStep: { heading: "h", body: long(4000), ctaLabel: "c" },
  });

  it("trims the section array to maxItems and keeps the FIRST entries", () => {
    const { body, repairs } = applyBodyBounds(over() as any, "guide");
    expect(body.sections).toHaveLength(6);
    expect(body.sections[0].heading).toContain("Heading number 0");
    expect(body.sections[5].heading).toContain("Heading number 5");
    expect(repairs.some(r => r.field === "sections" && r.kind === "items")).toBe(true);
  });

  it("caps every bounded string", () => {
    const { body } = applyBodyBounds(over() as any, "guide");
    expect(body.promise.length).toBeLessThanOrEqual(BOUNDS.guide.promise);
    for (const s of body.sections) {
      expect(s.body.length).toBeLessThanOrEqual(BOUNDS.guide.sections.body);
      expect(s.heading.length).toBeLessThanOrEqual(BOUNDS.guide.sections.heading);
    }
  });

  it("leaves nextStep.body UNCAPPED — the bridge is the beat a cap would damage", () => {
    const { body } = applyBodyBounds(over() as any, "guide");
    expect(body.nextStep.body.length).toBe(4000);
    expect(BOUNDS.guide).not.toHaveProperty("nextStep");
  });

  it("cuts on a sentence boundary where one fits", () => {
    const { body } = applyBodyBounds(over() as any, "guide");
    expect(body.sections[0].body.trimEnd().endsWith(".")).toBe(true);
  });

  it("reports every repair it made, with before and after sizes", () => {
    const { repairs } = applyBodyBounds(over() as any, "guide");
    expect(repairs.length).toBeGreaterThan(0);
    for (const r of repairs) {
      expect(r.to).toBeLessThan(r.from);
      expect(typeof r.field).toBe("string");
    }
  });

  it("returns an in-bounds body untouched and reports NO repairs", () => {
    const ok = { format: "guide", title: "t", promise: "Short promise.",
      sections: [{ heading: "H", body: "Body." }, { heading: "H2", body: "Body two." }],
      nextStep: { heading: "h", body: "b", ctaLabel: "c" } };
    const { body, repairs } = applyBodyBounds(JSON.parse(JSON.stringify(ok)) as any, "guide");
    expect(repairs).toHaveLength(0);
    expect(body).toEqual(ok);
  });
});

describe("applyBodyBounds — checklist and toolkit", () => {
  it("trims a checklist to 15 items and caps label, detail and promise", () => {
    const b: any = { format: "checklist", title: "t", promise: long(900),
      items: Array.from({ length: 20 }, () => ({ label: words(40), detail: long(900) })),
      nextStep: { heading: "h", body: "b", ctaLabel: "c" } };
    const { body, repairs } = applyBodyBounds(b, "checklist");
    expect(body.items).toHaveLength(BOUNDS.checklist.items.maxItems);
    for (const it of body.items) {
      expect(it.label.length).toBeLessThanOrEqual(BOUNDS.checklist.items.label);
      expect(it.detail.length).toBeLessThanOrEqual(BOUNDS.checklist.items.detail);
    }
    expect(body.promise.length).toBeLessThanOrEqual(BOUNDS.checklist.promise);
    expect(repairs.length).toBeGreaterThan(0);
  });

  it("leaves a checklist inside the bounds EXACTLY as it arrived", () => {
    // The cap sits at the corpus outlier fence, so ordinary output must pass through untouched.
    // 173 items across 15 bodies at the shipping target trimmed 2 — this is that, as a test.
    const b: any = { format: "checklist", title: "t", promise: "p",
      items: Array.from({ length: 12 }, () => ({ label: "Run the audit on your CV headline", detail: long(440) })),
      nextStep: { heading: "h", body: "b", ctaLabel: "c" } };
    const before = JSON.parse(JSON.stringify(b));
    const { body, repairs } = applyBodyBounds(b, "checklist");
    expect(repairs).toHaveLength(0);
    expect(body).toEqual(before);
  });

  it("does NOT fall through to the quiz branch when the format is checklist", () => {
    // The quiz branch is the catch-all `else`. Quiz caps no arrays by design, so a checklist
    // routed into it would keep all 20 items. Item trimming is what distinguishes the branches.
    const b: any = { format: "checklist", title: "t", promise: "p",
      items: Array.from({ length: 20 }, () => ({ label: "l", detail: "d" })), nextStep: {} };
    const { body } = applyBodyBounds(b, "checklist");
    expect(body.items).toHaveLength(15);
  });

  it("nextStep stays uncapped on checklist, as on every other format", () => {
    const b: any = { format: "checklist", title: "t", promise: "p", items: [{ label: "l", detail: "d" }],
      nextStep: { heading: "h", body: long(2000), ctaLabel: "c" } };
    const { body } = applyBodyBounds(b, "checklist");
    expect(body.nextStep.body.length).toBe(2000);
  });

  it("trims toolkit tools to 4 and caps content, the field carrying most compliance noise", () => {
    const b: any = { format: "toolkit", title: "t", promise: "p",
      tools: Array.from({ length: 6 }, () => ({ name: words(30), type: "swipe", instructions: long(700), content: long(9000) })),
      nextStep: { heading: "h", body: "b", ctaLabel: "c" } };
    const { body } = applyBodyBounds(b, "toolkit");
    expect(body.tools).toHaveLength(4);
    for (const t of body.tools) {
      expect(t.content.length).toBeLessThanOrEqual(BOUNDS.toolkit.tools.content);
      expect(t.instructions.length).toBeLessThanOrEqual(BOUNDS.toolkit.tools.instructions);
    }
  });
});

describe("applyBodyBounds — quiz counts are NEVER trimmed", () => {
  /**
   * Bands must partition 0..100 contiguously and questions' options must carry differing weights.
   * Dropping a band would leave the last one short of 100 and dropping options can erase weight
   * variation — either makes `validateQuizBody` fail, which retries and can end at a null body.
   * A count repair here would CAUSE the failure mode the repair exists to prevent.
   */
  const quiz: any = () => ({
    format: "quiz", title: "t", promise: "p",
    questions: Array.from({ length: 14 }, () => ({ question: "q", options: [
      { label: "a", weight: 0 }, { label: "b", weight: 1 }, { label: "c", weight: 2 }, { label: "d", weight: 3 }, { label: "e", weight: 3 }] })),
    scoring: { bands: [
      { name: "n", minPercent: 0, maxPercent: 33, teaser: long(600), meaning: long(2000), cta: { heading: "h", body: "b", ctaLabel: "c" } },
      { name: "n", minPercent: 34, maxPercent: 66, teaser: "t", meaning: "m", cta: { heading: "h", body: "b", ctaLabel: "c" } },
      { name: "n", minPercent: 67, maxPercent: 100, teaser: "t", meaning: "m", cta: { heading: "h", body: "b", ctaLabel: "c" } }] },
    nextStep: { heading: "h", body: "b", ctaLabel: "c" },
  });

  it("keeps every question, option and band", () => {
    const { body } = applyBodyBounds(quiz(), "quiz");
    expect(body.questions).toHaveLength(14);
    expect(body.questions[0].options).toHaveLength(5);
    expect(body.scoring.bands).toHaveLength(3);
  });

  it("preserves the 0..100 partition exactly", () => {
    const { body } = applyBodyBounds(quiz(), "quiz");
    const b = body.scoring.bands;
    expect(b[0].minPercent).toBe(0);
    expect(b[b.length - 1].maxPercent).toBe(100);
  });

  it("still caps the band's prose fields, which carry no invariant", () => {
    const { body } = applyBodyBounds(quiz(), "quiz");
    expect(body.scoring.bands[0].meaning.length).toBeLessThanOrEqual(BOUNDS.quiz.bands.meaning);
    expect(body.scoring.bands[0].teaser.length).toBeLessThanOrEqual(BOUNDS.quiz.bands.teaser);
  });
});

describe("repair NEVER produces a null or empty body", () => {
  it("a body exceeding every upper bound is repaired and RETURNED, still acceptable", () => {
    const b: any = { format: "guide", title: "t", promise: long(9000),
      sections: Array.from({ length: 30 }, () => ({ heading: long(500), body: long(9000) })),
      nextStep: { heading: "h", body: long(9000), ctaLabel: "c" } };
    const { body } = applyBodyBounds(b, "guide");
    expect(body).not.toBeNull();
    // the acceptance predicate the generator uses, unchanged
    expect(Array.isArray(body.sections) && body.sections.length > 0).toBe(true);
  });

  it("never empties an array, even at absurd input", () => {
    const { body } = applyBodyBounds({ format: "toolkit", title: "t", promise: "p", tools: [{ name: long(999), type: "swipe", instructions: long(999), content: long(9999) }], nextStep: {} } as any, "toolkit");
    expect(body.tools.length).toBeGreaterThan(0);
    expect(body.tools[0].content.length).toBeGreaterThan(0);
  });

  it("tolerates malformed input rather than throwing", () => {
    for (const bad of [{}, { format: "guide" }, { format: "guide", sections: "nope" }, null, undefined]) {
      expect(() => applyBodyBounds(bad as any, "guide")).not.toThrow();
    }
  });

  it("the acceptance threshold is NOT tightened to the new minimum", () => {
    const src = readFileSync(join(__dirname, "leadMagnetContentGenerator.ts"), "utf8");
    expect(src).toContain("sections.length > 0");
    expect(src).not.toMatch(/sections\.length\s*>=\s*3/);
  });
});

describe("schemaFor carries the bounds so the model is guided at generation", () => {
  it("guide", () => {
    const s: any = schemaFor("guide").json_schema.schema;
    expect(s.properties.sections.maxItems).toBe(6);
    expect(s.properties.sections.minItems).toBe(3);
    expect(s.properties.sections.items.properties.body.maxLength).toBe(2800);
    expect(s.properties.nextStep.properties.body.maxLength).toBeUndefined();
  });
  it("checklist", () => {
    const s: any = schemaFor("checklist").json_schema.schema;
    expect(s.properties.items.minItems).toBe(7);
    expect(s.properties.items.maxItems).toBe(15);
    expect(s.properties.items.items.properties.detail.maxLength).toBe(570);
    expect(s.properties.items.items.properties.label.maxLength).toBe(120);
    expect(s.properties.promise.maxLength).toBe(320);
    expect(s.properties.nextStep.properties.body.maxLength).toBeUndefined();
  });
  it("quiz mirrors the existing validator", () => {
    const s: any = schemaFor("quiz").json_schema.schema;
    expect(s.properties.questions.minItems).toBe(5);
    expect(s.properties.questions.maxItems).toBe(12);
    expect(s.properties.scoring.properties.bands.minItems).toBe(3);
    expect(s.properties.scoring.properties.bands.maxItems).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED fields cut on a BLOCK boundary; PROSE fields keep the sentence cut.
//
// `sections[].body` and `tools[].content` are where the deliverables live — fill-in templates,
// checklists the reader ticks, swipe copy they paste. The first build cut them with
// `truncateAtSentence` and severed three of them, including a swipe message stopped halfway.
// A repair that damages the deliverable is not a repair.
// ─────────────────────────────────────────────────────────────────────────────
const SWIPE = [
  "**Message 1 — the opener**",
  "",
  "Hi [NAME], I am in the process of making a considered move into [TARGET SECTOR]. Worth a short call?",
  "",
  "**Message 2 — the follow-up**",
  "",
  "Following up on the note below. I am in the process of making a considered move into [TARGET SECTOR]. Fifteen minutes?",
  "",
  "**Message 3 — the close**",
  "",
  "Last note from me. I am in the process of making a considered move into [TARGET SECTOR]. Happy to send context first.",
].join("\n");

const TEMPLATE = [
  "## Fill this in",
  "",
  '"In my highest-leverage moments the thing I was actually doing was ______"',
  "",
  '"The people who paid for it described it as ______"',
  "",
  "## Then do this",
  "",
  "Run the sentence three times before you shortlist anything.",
].join("\n");

const wholeBlocksOnly = (out: string, src: string) => {
  // every non-empty line the trim kept must appear, whole, in the source
  const srcLines = src.split("\n");
  for (const line of out.split("\n")) if (line.trim() !== "") expect(srcLines).toContain(line);
};

describe("structured fields cut on a block boundary", () => {
  it("a guide section carrying swipe copy is never severed mid-message", () => {
    const b: any = { format: "guide", title: "t", promise: "p",
      sections: [{ heading: "Swipe Copy", body: SWIPE.repeat(12) }], nextStep: {} };
    const { body } = applyBodyBounds(b, "guide");
    const out = body.sections[0].body;
    expect(out.length).toBeLessThanOrEqual(BOUNDS.guide.sections.body);
    wholeBlocksOnly(out, SWIPE.repeat(12));
    // the specific severing observed: this opener kept, its own message cut away after it
    const severed = /making a considered move into \[TARGET SECTOR\]\.$/.test(out.trimEnd())
      && !out.trimEnd().endsWith("Worth a short call?")
      && !out.trimEnd().endsWith("Fifteen minutes?");
    expect(severed).toBe(false);
  });

  it("a toolkit tool's template is kept whole, never cut inside its blanks", () => {
    const b: any = { format: "toolkit", title: "t", promise: "p",
      tools: [{ name: "n", type: "template", instructions: "i", content: TEMPLATE.repeat(20) }], nextStep: {} };
    const { body } = applyBodyBounds(b, "toolkit");
    const out = body.tools[0].content;
    expect(out.length).toBeLessThanOrEqual(BOUNDS.toolkit.tools.content);
    wholeBlocksOnly(out, TEMPLATE.repeat(20));
  });

  it("a checklist inside a guide section stops between items, never inside one", () => {
    const items = Array.from({ length: 200 }, (_, i) => `□ Filter for a sector where signal number ${i} already reads as adjacent`).join("\n");
    const { body } = applyBodyBounds({ format: "guide", title: "t", promise: "p",
      sections: [{ heading: "h", body: items }], nextStep: {} } as any, "guide");
    wholeBlocksOnly(body.sections[0].body, items);
  });

  it("PROSE fields keep the sentence cut", () => {
    const prose = "First sentence here. Second sentence here. Third sentence here. ".repeat(20);
    const { body } = applyBodyBounds({ format: "guide", title: "t", promise: prose,
      sections: [], nextStep: {} } as any, "guide");
    expect(body.promise.trimEnd().endsWith(".")).toBe(true);
    expect(body.promise.length).toBeLessThanOrEqual(BOUNDS.guide.promise);
  });

  it("still never empties a structured field, whatever the content", () => {
    for (const content of ["- one single bullet far longer than the cap allows for by a wide margin", "unbroken prose with no block and no sentence end at all"]) {
      const { body } = applyBodyBounds({ format: "toolkit", title: "t", promise: "p",
        tools: [{ name: "n", type: "swipe", instructions: "i", content: content.repeat(200) }], nextStep: {} } as any, "toolkit");
      expect(body.tools[0].content.length).toBeGreaterThan(0);
    }
  });
});

describe("the length target lives in the PROMPT, not only in the trim", () => {
  it("the guide prompt states a per-section length target", () => {
    const p = userPromptFor("guide", { niche: "n", audience: "a", outcome: "o", programme: "prog" } as any);
    expect(p).toMatch(/about 200 words/i);
  });

  it("the schema cap sits well above the prompt target — the trim catches outliers, the prompt moves the centre", () => {
    // ~200 words is roughly 1,200 characters at the measured character-per-word rate; the cap is
    // more than twice that, which is what makes it an outlier bound rather than a second target.
    expect(BOUNDS.guide.sections.body).toBeGreaterThan(2 * 1200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NUMERIC SOURCE-BOUNDEDNESS — inherited, not re-derived.
//
// The rule already existed. Node 5's body generator simply never imported it: it took
// GUARANTEE_CLAIMS_RULE alone while landingPage, emailSequence and whatsappSequence took both.
// That is a missing import rather than a missing rule, so this is an import and nothing else —
// the shared rule is not modified, no local variant is written, and methodDirective is untouched.
//
// It lands in the SYSTEM prompt, beside the guarantee rule, which is the rules layer. The four
// statements pulling toward concreteness live in the USER prompt. Different layers, so this adds
// no instruction competing with them — and adding a second voice on the same topic is precisely
// the failure this sprint documented.
// ─────────────────────────────────────────────────────────────────────────────
describe("the body generator inherits the shared numeric rule", () => {
  const marker = "NO RESEARCH STATISTIC FABRICATION";

  it("carries it in the lead-magnet system prompt", () => {
    expect(systemPromptFor("lead_magnet")).toContain(marker);
  });

  it("carries it in the bonus system prompt — a bonus is generated copy too", () => {
    expect(systemPromptFor("bonus")).toContain(marker);
  });

  it("keeps the guarantee rule alongside it rather than replacing it", () => {
    const p = systemPromptFor("lead_magnet");
    expect(p).toContain("GUARANTEE AND REMEDY CLAIMS");
    expect(p).toContain(marker);
  });

  it("carries the rule's positive ladder, which is what redirects the model", () => {
    const p = systemPromptFor("lead_magnet");
    expect(p).toContain("Real statistics supplied in input fields");
    expect(p).toContain("many of the people I work with");
  });

  it("is the SHARED rule verbatim — no local variant, no re-derivation", () => {
    expect(systemPromptFor("lead_magnet")).toContain(NO_RESEARCH_STATISTIC_FABRICATION_RULE);
  });

  it("adds nothing to the USER prompt, where the concreteness statements live", () => {
    // The import must not become a second voice on figures in the layer that already asks for
    // "real" and "specific". Those four statements stay exactly as they are.
    for (const f of ["guide", "checklist", "toolkit", "quiz"] as const) {
      const u = userPromptFor(f, { niche:"n", audience:"a", outcome:"o", programme:"p" } as any);
      expect(u).not.toContain(marker);
      expect(u).not.toMatch(/statistic/i);
    }
  });

  it("leaves methodDirective untouched — it is not the slot for this", () => {
    const withMethod = userPromptFor("guide", { niche:"n", audience:"a", outcome:"o", programme:"p", hasMethod:true, methodDetail:"M" } as any);
    expect(withMethod).toContain("Treat the method above as source material to teach from");
    expect(withMethod).not.toMatch(/figure|statistic/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE CHECKLIST DETAIL LENGTH — a false instruction removed, not a new one added.
//
// The format line asked for a "one-to-two-sentence detail". Measured over every checklist body
// that exists (20 items, 2 bodies), only 4 of 20 were within it: median 3.5 sentences, minimum
// 309 characters, median 420. That is not drift. Three instructions ABOVE the format line state
// what the detail must contain — the system prompt's 80/20 bar and its "real fill-in-the-blank
// content", and `common`'s "real fill-in content, real swipe copy" — and 16 of the 20 details
// carry a quoted fill-in template. A template plus its stop condition does not fit in two
// sentences, so the count could never be satisfied while obeying the bar. The thrice-stated
// instruction won and the once-stated count lost.
//
// The fix is the COUNT ONLY, and the number is set from this generator's MEASURED OVERSHOOT rather
// than from a quartile. Asked for 200 words the guide produces 227; asked for 70 the checklist
// produced 83 — both 15-20% over. 60 is therefore the target that lands the centre near 73 words,
// where lead-magnet output sat under the old clause.
//
// ⚠️ THE GAIN IS PREDICTABILITY, NOT LENGTH, and the two readings that were offered for it are
// both retired by measurement. It does not free the 80/20 bar: fill-in-template items went DOWN
// 55/61 to 51/61 when the count was removed. It is not length-neutral either: at 70 the median
// detail ran 477 -> 523 characters, longer, not equal. What the target actually buys is SPREAD —
// IQR 126 -> 69 characters — which is the difference between an instruction the model can meet and
// one it can only ignore.
//
// ⚠️ The clause keeps its existing wording. Adding shape words to a length instruction is a
// silent edit to the three that already state the shape, which is the failure that cost the
// guide its root-cause opener. These tests exist to hold that line.
// ─────────────────────────────────────────────────────────────────────────────
describe("the checklist detail states a length the output can actually meet", () => {
  const ctx = { niche: "n", audience: "a", outcome: "o", programme: "prog" } as any;

  for (const mode of ["lead_magnet", "bonus"] as const) {
    it(`states a word target for the detail in ${mode} mode`, () => {
      expect(userPromptFor("checklist", ctx, mode)).toMatch(/about 60 words/i);
    });

    it(`no longer states a sentence count for the detail in ${mode} mode`, () => {
      expect(userPromptFor("checklist", ctx, mode)).not.toMatch(/one-to-two-sentence/i);
    });
  }

  it("changes the COUNT and nothing else — the surrounding clause is untouched", () => {
    const p = userPromptFor("checklist", ctx);
    expect(p).toContain("each a short actionable label plus a ");
    expect(p).toContain(" that makes it doable today. Every item is something they DO, not something they learn.");
  });

  it("adds NO shape words to the length clause", () => {
    // The whole point: the slot between "plus a" and "that makes it doable today" carries a
    // length and nothing else. Anything describing WHAT the detail contains belongs upstream,
    // where it is already stated three times.
    const p = userPromptFor("checklist", ctx);
    const slot = p.split("each a short actionable label plus a ")[1].split(" that makes it doable today")[0];
    expect(slot).toBe("detail of about 60 words");
  });

  it("the shape the detail must carry is still stated UPSTREAM, where it always was", () => {
    // If a future change moves these into the format line, the length clause stops being a
    // length clause and the competition starts again.
    expect(systemPromptFor("lead_magnet")).toContain("real fill-in-the-blank content");
    expect(userPromptFor("checklist", ctx)).toContain("real fill-in content, real swipe copy");
    expect(userPromptFor("checklist", ctx)).toContain("Every item is something they DO");
  });

  it("the array bound is the prompt's own range, promoted rather than invented", () => {
    expect(userPromptFor("checklist", ctx)).toContain("7-15 concrete action items");
    expect(BOUNDS.checklist.items.minItems).toBe(7);
    expect(BOUNDS.checklist.items.maxItems).toBe(15);
  });

  it("the detail cap sits ABOVE the prompt target — it trims outliers, it is not a second target", () => {
    // 60 words is roughly 380 characters at the measured character-per-word rate of this corpus.
    // The cap must sit clear of that, or it becomes the centre and truncates half the output —
    // the error that put the first section.body cap on the median.
    expect(BOUNDS.checklist.items.detail).toBeGreaterThan(380 * 1.4);
  });
});
