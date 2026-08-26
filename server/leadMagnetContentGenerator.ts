/**
 * leadMagnetContentGenerator — generates the ACTUAL body of a lead magnet
 * (not just its title). The format is inferred from the selected HVCO title, and
 * the body is generated from the same upstream context that makes the ads/LP, so
 * it is specific to the campaign — never generic filler.
 *
 * Content only. Delivery (file hosting, PDF/multi-page rendering, form→email/GHL
 * wiring) is a separate follow-on sprint — this module produces the structured
 * body; a delivery layer will host/render/deliver it later.
 *
 * Gating lives in the caller (orchestration): a body is generated ONLY when the
 * campaign resolves to a lead_magnet_download landing page.
 */

import { getDb } from "./db";
import { services, idealCustomerProfiles, campaignKits, heroMechanisms, coachMethods, sourceOfTruth, campaigns } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { GUARANTEE_CLAIMS_RULE, NO_RESEARCH_STATISTIC_FABRICATION_RULE } from "./_core/copywritingRules";
import { truncateAtSentence, truncateAtBlock } from "./_core/cascadeContext";

export type LeadMagnetFormat = "guide" | "checklist" | "toolkit" | "quiz";
export type ToolType = "swipe" | "template" | "sop" | "worksheet" | "script" | "checklist";

// ── Structured body shapes (stored as hvcoTitles.assetBody JSON) ──
// New bar: usable tools first, ~80% actionable / 20% teaching. Every format
// opens with a TIGHT two-sentence promise (no prose-heavy intro/takeaways) and
// closes with a nextStep bridge to the paid programme (no dead end).
export interface NextStep {
  heading: string;
  body: string;
  ctaLabel: string;
}
// howToUse: a short "what this is / how to use it / what it achieves" orientation shown at the top of the
// deliverable (2-4 sentences). Optional so existing lead-magnet bodies stay valid; populated for bonuses so the
// document tells the reader what it is on opening (Arfeen: "doesn't even tell you what it is").
export interface GuideBody {
  format: "guide";
  title: string;
  promise: string;
  howToUse?: string;
  // Solution-focused, lean (not padded): each section is directly actionable.
  sections: { heading: string; body: string }[];
  nextStep: NextStep;
}
export interface ChecklistBody {
  format: "checklist";
  title: string;
  promise: string;
  howToUse?: string;
  items: { label: string; detail: string }[];
  nextStep: NextStep;
}
export interface ToolkitBody {
  format: "toolkit";
  title: string;
  promise: string;
  howToUse?: string;
  // Right-sized to 3-4 focused, immediately-usable tools (no padding).
  tools: { name: string; type: ToolType; instructions: string; content: string }[];
  nextStep: NextStep;
}
// Quiz = a weighted, single-axis READINESS SCORECARD (not a right/wrong knowledge
// quiz). Each option carries a weight (higher = more advanced/ready); the taker's
// weights sum to a % of the max, which falls into exactly one band. Each band is a
// self-contained diagnostic: a teaser (shown before the email gate), the full
// meaning, and its own CTA. Scoring runs client-side in the rendered page; this
// module produces the rubric that scoring runs on.
export interface QuizOption {
  label: string;
  weight: number; // 0..3 — higher = stronger/more-ready position on the axis
}
export interface QuizQuestion {
  question: string;
  options: QuizOption[]; // 3-4, with at least two distinct weights (must discriminate)
}
export interface QuizBand {
  name: string;
  minPercent: number; // inclusive, 0..100
  maxPercent: number; // inclusive, 0..100 — bands partition 0..100 with no gap/overlap
  teaser: string;     // one-line hook shown BEFORE the email gate
  meaning: string;    // the full personalised diagnostic shown AFTER the gate
  cta: NextStep;      // this band's own bridge to the paid programme
}
export interface QuizBody {
  format: "quiz";
  title: string;
  promise: string;
  questions: QuizQuestion[];   // ~7
  scoring: { bands: QuizBand[] }; // 3-4 contiguous bands covering 0..100
  nextStep: NextStep;          // global fallback bridge (per-band cta takes precedence on the result)
}
export type LeadMagnetBody = GuideBody | ChecklistBody | ToolkitBody | QuizBody;

// ─────────────────────────────────────────────────────────────────────────────
// Format inference — read the chosen title, pick the format it implies.
// Positive-only: each set describes what that format's titles look like. Most
// specific first (quiz → toolkit → checklist), guide as the sensible default.
// ─────────────────────────────────────────────────────────────────────────────
const QUIZ_SIGNALS = [
  "quiz", "assessment", "scorecard", "score card", "diagnostic", "audit",
  "what's your", "whats your", "which type", "which kind", "are you", "how ready",
  "self-assessment", "self assessment", "grader", "grade your", "rate your", "test your",
];
const TOOLKIT_SIGNALS = [
  "toolkit", "tool kit", "templates", "template", "swipe", "scripts", "script",
  "kit", "bundle", "pack", "prompts", "library", "vault", "resources", "worksheet", "worksheets",
];
const CHECKLIST_SIGNALS = [
  "checklist", "check list", "cheat sheet", "cheatsheet", "cheat-sheet",
  "steps", "mistakes", "ways", "things", "tips", "signs", "rules", "do's", "donts", "don'ts",
  "questions", "reasons", "hacks", "secrets", "one-pager", "one pager",
];

/** Infer the lead-magnet format from the selected title. Defaults to "guide". */
export function inferLeadMagnetFormat(title: string): LeadMagnetFormat {
  const t = (title || "").toLowerCase();
  const has = (sigs: string[]) => sigs.some(s => t.includes(s));
  if (has(QUIZ_SIGNALS)) return "quiz";
  if (has(TOOLKIT_SIGNALS)) return "toolkit";
  if (has(CHECKLIST_SIGNALS)) return "checklist";
  return "guide"; // guide/report/playbook/blueprint/how-to and everything unmatched
}

// ── Context assembly (mirrors hvcoGenerator's grounding) ──
export interface MagnetContext {
  niche: string;
  title: string;
  programme: string;
  mainBenefit: string;
  /**
   * The upstream cascade block — the selected offer and, when one is selected, the coach's
   * mechanism carried with its DESCRIPTION rather than only its name. Rendered verbatim.
   */
  upstream: string;
  /** True only when a real selected mechanism resolved. Never inferred, never defaulted. */
  hasMethod: boolean;
  /** Ordered steps and the operational twist, when the tier-1 coachMethods row exists. Often "". */
  methodDetail: string;
  offerDescription: string;
  icpPains: string;
  icpGoals: string;
  icpBarriers: string;
  sot: string;
  // Optional caller-supplied brief (step 2 Layer 2): a bonus's own advertised description + the ICP obstacle
  // it solves, so the generated body MATCHES what the offer/LP already promise (never a title-only re-derivation).
  contentBrief: string;
}

/** Exported so the A/B harness and tests build context through the real path rather than a copy. */
export async function gatherContext(userId: number, serviceId: number, icpId: number | null, campaignId: number | null, title: string): Promise<MagnetContext | null> {
  const db = await getDb();
  if (!db) return null;
  const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
  if (!service) return null;

  let icp: typeof idealCustomerProfiles.$inferSelect | undefined;
  if (icpId) {
    [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, icpId)).limit(1);
  }
  if (!icp && campaignId) {
    const [c] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
    if (c?.icpId) [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, c.icpId)).limit(1);
  }
  if (!icp) [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, serviceId)).limit(1);

  // ── THE METHOD, NOT THE LABEL ON IT ─────────────────────────────────────────────────────────
  // This read used to take a single column — the mechanism's NAME — off the correct row, reached
  // through the correct foreign key. Node 5 is the node whose CONTENT is the coach's method: the
  // lead magnet teaches the method in miniature while the paid work teaches the personalised
  // execution. It was the only node told what the method is CALLED and never what it IS.
  //
  // It now routes through the same cascade helper the title generator and five other nodes use,
  // so Node 5 stops hand-rolling upstream context, and inherits two things it never had: the
  // guarded_fallback confidence caveat, and `describeOffer`'s campaign-type awareness, which
  // withholds price and guarantee facts on free campaigns.
  //
  // Both previous fallbacks are gone. The first was an LLM-invented service-node field that the
  // mechanism generator itself refuses to read, on the grounds that feeding it back in launders an
  // invention into evidence; Node 5 was doing exactly that. The second was a literal placeholder
  // string. Where no mechanism resolves, the prompt now names no method at all — see
  // `userPromptFor`, which asks for plain description instead.
  let upstream = "";
  let hasMethod = false;
  let methodDetail = "";
  if (icp?.id) {
    const { getCascadeContext } = await import("./_core/cascadeContext");
    // 1600 is the measured p90 of `mechanismDescription` across 1,095 production rows (100%
    // populated, median 1,237). The whole description crosses for roughly nine rows in ten, and
    // `truncateAtSentence` degrades the rest to a clean paragraph. Every other call site keeps 900.
    upstream = await getCascadeContext(userId, icp.id, "hvco", { mechanismChars: 1600 });
    const [kit] = await db.select().from(campaignKits)
      .where(and(eq(campaignKits.userId, userId), eq(campaignKits.icpId, icp.id))).limit(1);
    if (kit?.selectedMechanismId) {
      const [m] = await db
        .select({ id: heroMechanisms.id, coachMethodId: heroMechanisms.coachMethodId })
        .from(heroMechanisms).where(eq(heroMechanisms.id, kit.selectedMechanismId)).limit(1);
      hasMethod = !!m && upstream.length > 0;
      methodDetail = await resolveMethodDetail(db, m?.coachMethodId ?? null);
    }
  }

  const [sot] = await db.select().from(sourceOfTruth).where(eq(sourceOfTruth.userId, userId)).limit(1);
  const sotLine = sot ? [sot.coreOffer, sot.mainBenefits, sot.uniqueValue].filter(Boolean).join(" · ") : "";

  return {
    niche: (service.targetCustomer ?? service.category ?? "coaching").slice(0, 200),
    title,
    programme: (service.name ?? "").slice(0, 120),
    mainBenefit: service.mainBenefit ?? "",
    upstream,
    hasMethod,
    methodDetail,
    offerDescription: (service.description ?? "").slice(0, 400),
    icpPains: (icp?.pains ?? "").slice(0, 600),
    icpGoals: (icp?.goals ?? "").slice(0, 400),
    icpBarriers: (icp?.implementationBarriers ?? "").slice(0, 400),
    sot: sotLine.slice(0, 400),
    contentBrief: "",
  };
}

/**
 * coachMethods is DESIGNED FOR, never DEPENDED ON.
 *
 * The table is empty on production and no `heroMechanisms` row carries a `coachMethodId`, because
 * the durable walkthrough entry point that would populate it is unbuilt (Node 4 backlog item 1).
 * So this branch is unreachable in production today and is proven by unit test, not by a live run.
 * Absent, null or unreadable falls straight through to the cascade block — never an error, never a
 * prerequisite.
 */
async function resolveMethodDetail(db: any, coachMethodId: number | null): Promise<string> {
  if (coachMethodId == null) return "";
  try {
    const [row] = await db.select().from(coachMethods).where(eq(coachMethods.id, coachMethodId)).limit(1);
    return renderMethodDetail(row ?? null);
  } catch {
    return "";
  }
}

/** The subset of a coachMethods row this renders. Loose so a test can hand it a plain object. */
export type CoachMethodLike = {
  steps?: unknown;
  operationalTwist?: { kind?: string; description?: string } | null;
  oldVehicle?: string | null;
  differentiator?: string | null;
};

/** PURE. Returns "" for anything it cannot use, so the caller never has to check first. */
export function renderMethodDetail(m: CoachMethodLike | null | undefined): string {
  if (!m) return "";
  const raw = Array.isArray(m.steps) ? (m.steps as Array<{ name?: string; whatHappens?: string }>) : [];
  const steps = raw.filter((s) => s?.name?.trim() && s?.whatHappens?.trim());
  if (steps.length === 0) return "";
  const lines = [
    "How the method runs, in order: " +
      steps.map((s, i) => `${i + 1}) ${s.name!.trim()} — ${s.whatHappens!.trim()}`).join(" "),
  ];
  const twist = m.operationalTwist?.description?.trim();
  if (twist) lines.push(`What makes it different in practice: ${twist}`);
  if (m.oldVehicle?.trim()) lines.push(`What people were doing before this: ${m.oldVehicle.trim()}`);
  if (m.differentiator?.trim()) lines.push(`In the coach's own words: ${m.differentiator.trim()}`);
  return lines.join("\n");
}

export function buildMagnetContextBlock(c: MagnetContext): string {
  return [
    `Lead magnet title (the promise to deliver on): "${c.title}"`,
    c.contentBrief ? `MUST-MATCH BRIEF — the deliverable already advertised to the buyer; the content you produce must deliver exactly this, not a re-interpretation of the title: ${c.contentBrief}` : "",
    `Niche / audience: ${c.niche}`,
    c.programme ? `Paid programme name (what nextStep bridges to): ${c.programme}` : "",
    c.mainBenefit ? `Main benefit of the paid offer: ${c.mainBenefit}` : "",
    // The cascade block sits in the slot the one-line method reference used to occupy.
    c.upstream ? c.upstream.trim() : "",
    c.methodDetail ? c.methodDetail : "",
    c.offerDescription ? `Offer context: ${c.offerDescription}` : "",
    c.icpPains ? `Audience pains: ${c.icpPains}` : "",
    c.icpGoals ? `Audience goals: ${c.icpGoals}` : "",
    c.icpBarriers ? `What blocks them from acting: ${c.icpBarriers}` : "",
    c.sot ? `Brand context: ${c.sot}` : "",
  ].filter(Boolean).join("\n");
}

// A deliverable is either a pre-registration LEAD MAGNET (reader is a prospect to convert) or a post-purchase
// BONUS (reader has already enrolled — write to a buyer on the inside, help them execute, no sales pitch).
export type DeliverableMode = "lead_magnet" | "bonus";

const SYSTEM_PROMPT_LEAD_MAGNET =
  "You produce done-for-you lead-magnet content for coaches, consultants and experts at agency quality. The bar: ~80% immediately-usable tools (swipe copy, fill-in templates, SOPs, scripts, worksheets, checklists the reader uses TODAY) and only ~20% teaching. Useful beats comprehensive — right-size to solve ONE specific problem, never padded. Everything is concrete and specific to the exact niche given, with real fill-in-the-blank content or real swipe copy the reader can copy and use, never generic filler that could belong to any coach. Open with a tight promise (max two sentences: what they can DO after using it). Close with a nextStep that bridges to the paid programme — a clear next action, no dead end. Respond with valid JSON.";

const SYSTEM_PROMPT_BONUS =
  "You produce done-for-you BONUS deliverables for coaches, consultants and experts at agency quality. The reader has ALREADY enrolled in / purchased the paid programme — this is a post-purchase asset that helps them get more from what they've already committed to, so you write to a buyer on the inside who is ready to execute, never to a prospect you are trying to convince to buy. The bar: ~80% immediately-usable tools (swipe copy, fill-in templates, SOPs, scripts, worksheets, checklists the reader uses TODAY) and only ~20% teaching. Useful beats comprehensive — right-size to solve ONE specific problem, never padded. Everything is concrete and specific to the exact niche given, with real fill-in-the-blank content the reader can use, never generic filler. Open by telling the reader plainly what this is, how to use it, and what it achieves. Close with a nextStep that helps them put this to work and get the most from the programme they've joined — a concrete action, no dead end. Respond with valid JSON.";

export function systemPromptFor(mode: DeliverableMode = "lead_magnet"): string {
  // GUARANTEE_CLAIMS_RULE is PORTED, not re-derived — Track B reuse, exactly as CHECKPOINT
  // section 0-READ instructs. Node 5 writes remedy and outcome language on the same free-form
  // basis Node 8 did: every format closes on a `nextStep` bridge to the paid programme, and a
  // quiz adds a per-band CTA on top of that. Those are the same "what you will get" position
  // that produced the landing page's outcome promise, so they need the same rule.
  //
  // It already reads to the SHAPE of the promise rather than to any trade's vocabulary — it
  // names tarot, astrology and yoga alongside consulting — so it ports unchanged. Re-deriving
  // it here is what would let the two copies drift.
  //
  // NO_RESEARCH_STATISTIC_FABRICATION_RULE is PORTED for the same reason, and it closes a MISSING
  // IMPORT rather than a missing rule. `landingPageGenerator`, `emailSequenceGenerator` and
  // `whatsappSequenceGenerator` have carried it since 3d604cd; this generator took the guarantee
  // rule alone. Node 5 writes the longest asset in the kit and the only one a prospect keeps a
  // copy of, and a bridge it produced carried a population percentage nothing in the coach's
  // material supports — the class this rule exists for.
  //
  // MEASURED BEFORE IMPORTING, rather than assumed to work because it is present. Across stored
  // production rows for the three generators that inherit it, partitioned at the rule's own
  // commit: the validator's statistic patterns fire 3 times before and 0 after, and a wider sweep
  // with the group-noun restriction removed falls from 0.032 to 0.011 hits per thousand
  // characters on the landing page. Every post-rule hit was read, and none is a genuine invented
  // statistic — they are deliverable timings, the reader's own numbers, and the coach's own
  // clients in the framing the rule itself permits.
  //
  // ⚠️ IT GOES IN THE SYSTEM PROMPT, WHICH IS THE RULES LAYER, AND NOWHERE ELSE. Four statements
  // in the USER prompt already push toward concreteness, and an invented figure is the cheapest
  // way for a model to be concrete. A second voice on figures in that layer would compete with
  // them rather than reinforce them — the failure this sprint measured, where restating a
  // section's shape one line below its first statement displaced a beat entirely. One change,
  // one layer, so the next measurement says whether it was sufficient on its own.
  const base = mode === "bonus" ? SYSTEM_PROMPT_BONUS : SYSTEM_PROMPT_LEAD_MAGNET;
  return `${base}\n\n${GUARANTEE_CLAIMS_RULE}\n\n${NO_RESEARCH_STATISTIC_FABRICATION_RULE}`;
}


// ─────────────────────────────────────────────────────────────────────────────
// SIZE LIMITS — bound at generation, repair after, never reject.
//
// Two derivations only, and no external figure is used anywhere, including in these comments:
//   1. where the prompt already states a range, that range becomes the bound — enforcing what we
//      already ask for invents nothing;
//   2. where the prompt states a SHAPE rather than a count, the cap is placed at the OUTLIER
//      THRESHOLD of the field's own measured distribution.
//
// ⚠️ The first version of this set applied rule 2 wrongly and must not be reinstated. It sized
// `section.body` at what one section needs to DO its job — the intended CENTRE — which put the cap
// on the median and truncated half the corpus by construction: 89 of 137 measured sections, 65%.
// A cap that trims a tail has to sit ABOVE the centre, and the target belongs in the prompt.
//
// THE DERIVATION, re-run over every guide section this rebuild has generated — 137 sections across
// 24 bodies, measured before any trim. Production carries no guide body at all (its 8 populated
// `assetBody` rows are 6 toolkit and 2 checklist), so the generated corpus is the only one there
// is, and it is the current generator's own output.
//
//   Q1 1,287 · median 1,577 · Q3 1,858 · IQR 571 · max 4,492 characters
//
// An outlier is a point beyond the upper fence, Q3 + 1.5 x IQR = 2,714.5. Rounded UP to the
// nearest hundred — up, so nothing sitting at the fence is trimmed by a rounding artefact —
// that is 2,800, and it trims 7 of 137 sections, 5.1%. The sections it now leaves alone include
// the 2,720-character sector-filter checklist the first set cut to 819. The 4,492-character
// fill-in template is still caught, which is the point of having a cap.
//
// `promise` and the headings keep the caps derived from the prompt's own stated shape.
//
// CHECKLIST — held out of the first set, landed here on its own evidence.
//
// It was held out because the cap proposed for it had never once agreed with the output: the
// SHORTEST of the 20 items then in existence measured 309 characters against a proposed 300, so
// every item would have been trimmed. That was an unmeasured cap, not a long output, and the whole
// corpus was bonus-mode besides — the lead-magnet path had never produced a checklist at all.
//
// It now has its own corpus: 173 items across 15 bodies, ALL generated at the shipping length
// target, spanning both modes — 119 lead-magnet across two titles, 54 bonus across two briefs.
//
//   item.detail  Q1 411.0 · Q3 472.0 · IQR 61.0 · fence 563.5 -> 570   trims 2/173 (1.2%)
//   item.label   Q1  64.0 · Q3  86.0 · IQR 22.0 · fence 119.0 -> 120   trims 1/173 (0.6%)
//
// 🔑 THE LEGACY 20-25% BONUS TRIM RATE WAS A PROPERTY OF THE ABANDONED CLAUSE, NOT OF BONUS MODE,
// and establishing that is what unblocked these caps. `applyBodyBounds` takes a format rather than
// a mode, so one cap governs both, and every bonus item in existence was old-clause output with the
// widest spread of any corpus (IQR 171.8, max 743). Regenerating the SAME TWO BRIEFS at the target
// — same title, same description, same obstacle, only the clause changed — took the trim rate from
// 25% to 1.9% and the IQR from 171.8 to 52.0. The modes sit 1.5 words apart with identical spread.
//
// `promise` and the array range are the prompt's own stated shape, promoted rather than invented.
//
// `nextStep` is DELIBERATELY UNCAPPED. It is under 9% of a body's words, and it carries the
// bridge — the beat that only began working when the mechanism arrived. Cap where the length is.
// ─────────────────────────────────────────────────────────────────────────────
export const BOUNDS = {
  guide:     { promise: 320, sections: { minItems: 3, maxItems: 6,  heading: 120, body: 2800 } },
  checklist: { promise: 320, items:    { minItems: 7, maxItems: 15, label: 120, detail: 570 } },
  toolkit:   { promise: 320, tools:    { minItems: 3, maxItems: 4,  name: 80, instructions: 180, content: 4000 } },
  quiz:      { promise: 320,
               questions: { minItems: 5, maxItems: 12, optionsMin: 3, optionsMax: 4, question: 300, label: 150 },
               bands:     { minItems: 3, maxItems: 5, meaning: 600, teaser: 200 } },
} as const;

export type BoundRepair = { field: string; kind: "items" | "length"; from: number; to: number };

/**
 * Deterministic repair. THE POINT: an upper bound must never become a new way for a body to come
 * back null on the path every coach hits. A rejection would retry and can end at `null`; a repair
 * always succeeds. Lower bounds are therefore never enforced here — they live in the schema and
 * the prompt only, and the caller's acceptance test is deliberately left as it was.
 *
 * Array trims keep the FIRST entries. The root-cause diagnosis now opens the body, so cutting from
 * the end preserves it.
 *
 * STRUCTURED fields cut on a BLOCK boundary; prose fields cut on a sentence. The deliverables — a
 * fill-in template, a checklist the reader ticks, a swipe message they paste — live in
 * `sections[].body` and `tools[].content`, and none of a bold label, a bullet, a checkbox row or a
 * table row ends in sentence punctuation. Cutting those at a sentence boundary severed three
 * artefacts, one of them a swipe message stopped mid-message, and left another 40% under its own
 * cap. Always returning something is not the same as always returning something USABLE, and a
 * repair that damages the deliverable is not a repair.
 *
 * ⚠️ QUIZ COUNTS ARE NEVER TRIMMED. Bands must partition 0..100 contiguously and a question's
 * options must carry differing weights — both are invariants `validateQuizBody` enforces. Dropping
 * a band leaves the last one short of 100 and dropping options can erase weight variation, so a
 * count repair there would GUARANTEE the validator failure that ends in the null this exists to
 * prevent. Only the quiz's prose fields, which carry no invariant, are capped.
 */
export function applyBodyBounds(
  body: any,
  format: LeadMagnetFormat,
): { body: any; repairs: BoundRepair[] } {
  const repairs: BoundRepair[] = [];
  if (!body || typeof body !== "object") return { body, repairs };

  // Prose cuts on a sentence; structured content cuts on a block. Nothing else differs.
  const capStr = (obj: any, key: string, max: number, label: string) => {
    const v = obj?.[key];
    if (typeof v !== "string" || v.length <= max) return;
    obj[key] = truncateAtSentence(v, max);
    repairs.push({ field: label, kind: "length", from: v.length, to: obj[key].length });
  };
  const capBlock = (obj: any, key: string, max: number, label: string) => {
    const v = obj?.[key];
    if (typeof v !== "string" || v.length <= max) return;
    obj[key] = truncateAtBlock(v, max);
    repairs.push({ field: label, kind: "length", from: v.length, to: obj[key].length });
  };
  const capArr = (obj: any, key: string, max: number, label: string) => {
    const v = obj?.[key];
    if (!Array.isArray(v) || v.length <= max) return;
    obj[key] = v.slice(0, max);
    repairs.push({ field: label, kind: "items", from: v.length, to: max });
  };

  try {
    if (format === "guide") {
      const B = BOUNDS.guide;
      capStr(body, "promise", B.promise, "promise");
      capArr(body, "sections", B.sections.maxItems, "sections");
      for (const sec of Array.isArray(body.sections) ? body.sections : []) {
        capStr(sec, "heading", B.sections.heading, "sections[].heading");
        capBlock(sec, "body", B.sections.body, "sections[].body");
      }
    } else if (format === "toolkit") {
      const B = BOUNDS.toolkit;
      capStr(body, "promise", B.promise, "promise");
      capArr(body, "tools", B.tools.maxItems, "tools");
      for (const t of Array.isArray(body.tools) ? body.tools : []) {
        capStr(t, "name", B.tools.name, "tools[].name");
        capStr(t, "instructions", B.tools.instructions, "tools[].instructions");
        capBlock(t, "content", B.tools.content, "tools[].content");
      }
    } else if (format === "checklist") {
      const B = BOUNDS.checklist;
      capStr(body, "promise", B.promise, "promise");
      capArr(body, "items", B.items.maxItems, "items");
      for (const it of Array.isArray(body.items) ? body.items : []) {
        capStr(it, "label", B.items.label, "items[].label");
        // Block-safe, though it falls back to the sentence cut in practice: 0 of 173 measured
        // details carry a newline, and the renderer emits this field as a single paragraph. The
        // block instrument costs nothing and covers the day one of them carries a list.
        capBlock(it, "detail", B.items.detail, "items[].detail");
      }
    } else if (format === "quiz") {
      const B = BOUNDS.quiz;
      capStr(body, "promise", B.promise, "promise");
      // counts untouched — see the warning above
      for (const b of Array.isArray(body?.scoring?.bands) ? body.scoring.bands : []) {
        capStr(b, "teaser", B.bands.teaser, "bands[].teaser");
        capStr(b, "meaning", B.bands.meaning, "bands[].meaning");
      }
    }
    // Quiz is matched explicitly rather than left as the catch-all. It was made explicit while
    // checklist was held out, and it stays explicit: the catch-all `else` is the shape that would
    // silently route a new or renamed format into the quiz branch.
  } catch {
    // A repair that cannot run leaves the body exactly as it arrived. Never throw into the cascade.
  }
  return { body, repairs };
}

// ── Per-format response schemas (json_schema, strict) ──
type ResponseFormat = { type: "json_schema"; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } };
export function schemaFor(format: LeadMagnetFormat, mode: DeliverableMode = "lead_magnet"): ResponseFormat {
  const s = (name: string, schema: Record<string, unknown>): ResponseFormat => ({ type: "json_schema", json_schema: { name, strict: true, schema } });
  const str = { type: "string" } as const;
  const arr = (items: Record<string, unknown>) => ({ type: "array", items });
  // Bounded variants. On this provider `response_format` becomes an Anthropic forced tool call,
  // which validates types and required fields — bounds are a strong hint to the model rather than
  // a grammar it is held to. That is why every upper bound here is paired with `applyBodyBounds`.
  const arrB = (items: Record<string, unknown>, minItems: number, maxItems: number) => ({ type: "array", minItems, maxItems, items });
  const strB = (maxLength: number) => ({ type: "string", maxLength });
  // Shared nextStep bridge — required on every format.
  const nextStep = { type: "object", additionalProperties: false, required: ["heading", "body", "ctaLabel"], properties: { heading: str, body: str, ctaLabel: str } };
  const bonus = mode === "bonus";
  // Bonus mode adds a required howToUse orientation (what it is / how to use / what it achieves), rendered at the
  // top of the deliverable. Injected into the static-format schemas (guide/checklist/toolkit) only.
  const withHowTo = (required: string[], properties: Record<string, unknown>) =>
    bonus
      ? { required: ["howToUse", ...required], properties: { howToUse: str, ...properties } }
      : { required, properties };
  if (format === "guide") { const g = withHowTo(["promise", "sections", "nextStep"], {
      promise: strB(BOUNDS.guide.promise),
      sections: arrB({ type: "object", additionalProperties: false, required: ["heading", "body"],
        properties: { heading: strB(BOUNDS.guide.sections.heading), body: strB(BOUNDS.guide.sections.body) } },
        BOUNDS.guide.sections.minItems, BOUNDS.guide.sections.maxItems),
      nextStep,
    }); return s("lead_magnet_guide", { type: "object", additionalProperties: false, ...g }); }
  if (format === "checklist") { const g = withHowTo(["promise", "items", "nextStep"], {
      promise: strB(BOUNDS.checklist.promise),
      items: arrB({ type: "object", additionalProperties: false, required: ["label", "detail"],
        properties: { label: strB(BOUNDS.checklist.items.label), detail: strB(BOUNDS.checklist.items.detail) } },
        BOUNDS.checklist.items.minItems, BOUNDS.checklist.items.maxItems),
      nextStep,
    }); return s("lead_magnet_checklist", { type: "object", additionalProperties: false, ...g }); }
  if (format === "toolkit") { const g = withHowTo(["promise", "tools", "nextStep"], {
      promise: strB(BOUNDS.toolkit.promise),
      tools: arrB({ type: "object", additionalProperties: false, required: ["name", "type", "instructions", "content"], properties: {
        name: strB(BOUNDS.toolkit.tools.name),
        type: { type: "string", enum: ["swipe", "template", "sop", "worksheet", "script", "checklist"] },
        instructions: strB(BOUNDS.toolkit.tools.instructions),
        content: strB(BOUNDS.toolkit.tools.content),
      } }, BOUNDS.toolkit.tools.minItems, BOUNDS.toolkit.tools.maxItems),
      nextStep,
    }); return s("lead_magnet_toolkit", { type: "object", additionalProperties: false, ...g }); }
  const pct = { type: "integer", minimum: 0, maximum: 100 } as const;
  return s("lead_magnet_quiz", {
    type: "object", additionalProperties: false,
    required: ["promise", "questions", "scoring", "nextStep"],
    properties: {
      promise: strB(BOUNDS.quiz.promise),
      // These mirror `validateQuizBody` exactly. Nothing new is invented: the validator is already
      // the agreed contract, and putting the same numbers in the schema turns a post-hoc REJECTION
      // — which retries and can end at a null body — into a constraint the model sees up front.
      questions: arrB({
        type: "object", additionalProperties: false, required: ["question", "options"],
        properties: {
          question: strB(BOUNDS.quiz.questions.question),
          options: arrB({
            type: "object", additionalProperties: false, required: ["label", "weight"],
            properties: { label: strB(BOUNDS.quiz.questions.label), weight: { type: "integer", minimum: 0, maximum: 3 } },
          }, BOUNDS.quiz.questions.optionsMin, BOUNDS.quiz.questions.optionsMax),
        },
      }, BOUNDS.quiz.questions.minItems, BOUNDS.quiz.questions.maxItems),
      scoring: {
        type: "object", additionalProperties: false, required: ["bands"],
        properties: {
          bands: arrB({
            type: "object", additionalProperties: false,
            required: ["name", "minPercent", "maxPercent", "teaser", "meaning", "cta"],
            properties: { name: str, minPercent: pct, maxPercent: pct,
              teaser: strB(BOUNDS.quiz.bands.teaser), meaning: strB(BOUNDS.quiz.bands.meaning), cta: nextStep },
          }, BOUNDS.quiz.bands.minItems, BOUNDS.quiz.bands.maxItems),
        },
      },
      nextStep,
    },
  });
}

export function userPromptFor(format: LeadMagnetFormat, c: MagnetContext, mode: DeliverableMode = "lead_magnet"): string {
  const ctx = buildMagnetContextBlock(c);
  const programme = c.programme || "the paid programme";
  const bonus = mode === "bonus";
  // Two positive directives, one per branch. A prohibition primes the shape it forbids
  // (CLAUDE.md §14), so neither says what to avoid.
  //
  // WITH a method: the description is SOURCE MATERIAL to teach FROM. Naming that explicitly is
  // load-bearing, not decoration. A `mechanismDescription` can itself close on an illustrative
  // vignette carrying invented names and quotes, and a body that reads the description as an
  // example of how to WRITE will produce its own — which lands fabricated people and real named
  // organisations in the longest asset ZAP generates and the only one a prospect keeps a copy of.
  //
  // WITHOUT one: describe the approach plainly rather than naming a method that does not exist.
  const methodDirective = c.hasMethod
    ? `Treat the method above as source material to teach from: explain what it says goes wrong for this reader and what its sequence puts right, in your own words, using examples you build from the audience described here.\n\n`
    : `Write about the approach in plain descriptive terms, using only the situation, audience and outcome given above.\n\n`;
  // Bonus: write to a buyer who has already enrolled; the nextStep helps them execute inside the programme they
  // joined (no sales pitch); and it opens with a howToUse orientation. Lead magnet: unchanged conversion bridge.
  const common = bonus
    ? `Create this BONUS deliverable to the 80/20 bar — usable tools first, minimal teaching, right-sized to solve ONE specific problem. Everything specific to this exact niche and audience — real fill-in content, the words this audience actually uses. No generic filler, no padding.\n\nThe reader has already enrolled in "${programme}" — write to a buyer on the inside who is ready to execute, not a prospect you are trying to convert.\n\n${ctx}\n\n${methodDirective}Begin with a "howToUse": 2-4 sentences stating plainly what this document is, how to use it, and what it achieves. Then a TIGHT promise: max two sentences on what they can DO with this. End with a nextStep that helps them put this to work and get the most from "${programme}" — a heading, a short body orienting them to the next action inside the programme they have joined, and a concrete ctaLabel about USING it (for example "Start With Step 1"). No dead end.\n\n`
    : `Create this lead magnet to the 80/20 bar — usable tools first, minimal teaching, right-sized to solve ONE specific problem. Everything specific to this exact niche and audience — real fill-in content, real swipe copy, the words this audience actually uses. No generic filler, no padding.\n\n${ctx}\n\n${methodDirective}Open with a TIGHT promise: max two sentences on what they can DO after using this (not teaching). End with a nextStep that bridges to "${programme}" — a heading, a short body that connects this free win to the paid outcome, and a concrete ctaLabel (e.g. "Book My Free Call"). No dead end.\n\n`;
  const howToJson = bonus ? `"howToUse", ` : "";
  // ⚠️ THE LENGTH TARGET LIVES HERE, and this is the load-bearing half of the size work.
  // A schema cap can only remove text that has already been written, and removing it damages the
  // artefacts the format exists to deliver. A target moves the CENTRE at generation, which is the
  // only place length can come down without cutting anything.
  //
  // 200 words is this generator's own lower quartile — measured across the 137 guide sections it
  // produced this rebuild, Q1 is 207 words — so it is the length at which a quarter of sections
  // already carry the full shape asked for below, stated as the target for all of them rather
  // than as the exception. The schema cap sits at more than twice it and catches outliers only.
  //
  // ⚠️ It states a LENGTH and nothing else, and that restraint is measured rather than tidy. A
  // first version added the section's shape to it — "the move, how to run it, and one worked
  // example" — which reads as a template for a DOING step, and across five rows it pushed the
  // root-cause diagnosis out of the opening section that had held it in five of five before. The
  // shape is already stated in the line above; saying it twice cost a beat.
  if (format === "guide") return `${common}Produce a GUIDE: 3-6 solution-focused sections, each a clear heading and lean, directly-actionable content (steps, a mini-framework, an example the reader applies) — not padded prose. Useful beats comprehensive.\nWrite each section to about 200 words. Where a section carries a usable artefact — a fill-in template, a checklist, swipe copy — give the artefact the room and keep the teaching around it to a line or two.\nReturn JSON: { ${howToJson}"promise", "sections":[{"heading","body"}], "nextStep":{"heading","body","ctaLabel"} }.`;
  // ⚠️ THE CHECKLIST DETAIL LENGTH. This line asked for a "one-to-two-sentence detail" and never
  // once received one: across every checklist body that exists — 20 items, 2 bodies — 4 of 20 were
  // within it, the median ran to 3.5 sentences, and the SHORTEST detail measured 309 characters
  // against a median of 420. The count was not a target the output missed; it was one the output
  // could not hit while obeying the bar stated above it. The system prompt asks for ~80%
  // immediately-usable tools and "real fill-in-the-blank content", `common` repeats it, and 16 of
  // the 20 details carry a quoted fill-in template — a template plus its stop condition does not
  // fit in two sentences. Three statements of the shape against one of the count, and the count
  // lost every time.
  //
  // THE NUMBER IS SET FROM MEASURED OVERSHOOT, not from a quartile. This generator lands 15-20%
  // above any stated word target: the guide asks 200 and produces 227; this line asked 70 and
  // produced 83. 60 is the target that puts the centre near 73 words — where lead-magnet output
  // sat under the old clause — while keeping the spread a target buys. Checklist is the format
  // that can least afford to grow: it exists to be the shortest, most scannable asset produced.
  //
  // ⚠️ THE GAIN IS PREDICTABILITY, NOT LENGTH. Two readings were offered for this change before it
  // was measured and BOTH ARE RETIRED. It does not free the 80/20 bar — fill-in-template items went
  // DOWN, 55/61 to 51/61, when the count was removed. It is not length-neutral — at a target of 70
  // the median detail ran 477 -> 523 characters, longer than the clause it replaced. What the
  // target actually buys is SPREAD: IQR 126 -> 69 characters. That is the difference between an
  // instruction the model can meet and one it can only ignore, and it is the whole case for it.
  //
  // ⚠️ The COUNT moved and nothing else did. The shape is already stated three times upstream, so
  // adding shape words here would be a silent edit to all three — the failure that pushed the
  // root-cause diagnosis out of the guide's opening section. Held by test.
  //
  // 📌 The cap on this field sits at 570 characters — the corpus outlier fence, more than the
  // target's own width over again. The target moves the centre; the cap catches a runaway. Putting
  // a cap ON the centre is the error the first section.body bound made. See BOUNDS.
  if (format === "checklist") return `${common}Produce a CHECKLIST / cheat-sheet: 7-15 concrete action items, each a short actionable label plus a detail of about 60 words that makes it doable today. Every item is something they DO, not something they learn.\nReturn JSON: { ${howToJson}"promise", "items":[{"label","detail"}], "nextStep":{"heading","body","ctaLabel"} }.`;
  if (format === "toolkit") return `${common}Produce a TOOLKIT: 3-4 focused, immediately-usable tools (no more — lean, not a swipe-file dump). Each tool has a name, a type (one of: swipe, template, sop, worksheet, script, checklist), one-line usage instructions, and the ACTUAL usable content (real fill-in-the-blank templates / swipe copy / step-by-step SOP the reader copies and uses today). Structure the content as clean markdown — headings, bold labels, ordered steps, and tables where useful — and write any fill-in field in [SQUARE BRACKETS].\nReturn JSON: { ${howToJson}"promise", "tools":[{"name","type","instructions","content"}], "nextStep":{"heading","body","ctaLabel"} }.`;
  return `${common}Produce a READINESS SCORECARD — a weighted, single-axis self-assessment that diagnoses where this prospect stands on their journey toward the outcome "${programme}" delivers. Genuinely diagnostic, never a disguised pitch.

Build it so the scoring is self-consistent and discriminating:
- 7 questions (6-8 acceptable). Each question probes ONE real dimension of readiness for this niche, in the audience's own words.
- Each question has 3-4 options laid out from least-ready to most-ready. Give each option a "weight" from 0 to 3: 0 = furthest from the outcome, 3 = strongest/most-ready position. Within each question the options MUST carry at least two different weights, and across the scorecard the full 0-3 range is used — so the total genuinely separates people.
- The taker's chosen weights sum to a percentage of the maximum possible. Define 3-4 bands that PARTITION 0-100 exactly: the first band starts at 0, the last ends at 100, and each band begins one point above the previous band's end (contiguous, no gaps, no overlaps). Example spans: 0-33, 34-66, 67-100.
- Each band is a complete diagnostic result: a "name" (the readiness stage, e.g. "Foundations", "Momentum", "Scale-Ready"), a one-line "teaser" (the hook a prospect sees before unlocking), a "meaning" (2-4 sentences reflecting where they are and what to focus on next — speaks to THAT band specifically), and its own "cta" bridging to "${programme}" (heading, short body connecting their result to the paid outcome, concrete ctaLabel). A low-band CTA meets them where they are; a high-band CTA matches their momentum.

Return JSON: { "promise", "questions":[{"question","options":[{"label","weight"}]}], "scoring":{"bands":[{"name","minPercent","maxPercent","teaser","meaning","cta":{"heading","body","ctaLabel"}}]}, "nextStep":{"heading","body","ctaLabel"} }.`;
}

/**
 * Rubric validator for a generated quiz body — the sprint's quality gate. A
 * scorecard that a coach's prospect takes must not misdiagnose them, so this
 * rejects degenerate output: too few questions, options that don't discriminate
 * (equal weights within a question, or no weight variation at all), and bands that
 * leave gaps, overlap, fail to cover 0..100, or are missing name/teaser/meaning/cta.
 * Returns a reason on failure so the generator logs why it retried.
 */
export function validateQuizBody(body: QuizBody): { ok: boolean; reason?: string } {
  const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

  if (!nonEmpty(body?.promise)) return { ok: false, reason: "blank promise" };

  const qs = body?.questions;
  if (!Array.isArray(qs) || qs.length < 5) return { ok: false, reason: `need >=5 questions, got ${qs?.length ?? 0}` };
  if (qs.length > 12) return { ok: false, reason: `too many questions (${qs.length})` };
  const allWeights = new Set<number>();
  for (let i = 0; i < qs.length; i++) {
    if (!nonEmpty(qs[i]?.question)) return { ok: false, reason: `question ${i + 1} blank` };
    const opts = qs[i]?.options;
    if (!Array.isArray(opts) || opts.length < 3) return { ok: false, reason: `question ${i + 1} needs >=3 options` };
    const ws = new Set<number>();
    for (const o of opts) {
      if (!nonEmpty(o?.label)) return { ok: false, reason: `question ${i + 1} has a blank option` };
      if (typeof o?.weight !== "number" || !Number.isFinite(o.weight) || o.weight < 0 || o.weight > 3) {
        return { ok: false, reason: `question ${i + 1} option weight out of range` };
      }
      ws.add(o.weight); allWeights.add(o.weight);
    }
    if (ws.size < 2) return { ok: false, reason: `question ${i + 1} options don't discriminate (equal weights)` };
  }
  if (allWeights.size < 2) return { ok: false, reason: "no weight variation across the scorecard" };

  const bands = body?.scoring?.bands;
  if (!Array.isArray(bands) || bands.length < 3) return { ok: false, reason: `need >=3 bands, got ${bands?.length ?? 0}` };
  if (bands.length > 5) return { ok: false, reason: `too many bands (${bands.length})` };
  const okInt = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 100;
  const sorted = [...bands].sort((a, b) => a.minPercent - b.minPercent);
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    if (!okInt(b?.minPercent) || !okInt(b?.maxPercent)) return { ok: false, reason: `band ${i + 1} percent out of range` };
    if (b.minPercent > b.maxPercent) return { ok: false, reason: `band ${i + 1} min>max` };
    if (!nonEmpty(b?.name) || !nonEmpty(b?.teaser) || !nonEmpty(b?.meaning)) return { ok: false, reason: `band ${i + 1} missing name/teaser/meaning` };
    const cta = b?.cta;
    if (!nonEmpty(cta?.heading) || !nonEmpty(cta?.body) || !nonEmpty(cta?.ctaLabel)) return { ok: false, reason: `band ${i + 1} missing cta` };
  }
  if (sorted[0].minPercent !== 0) return { ok: false, reason: "bands must start at 0" };
  if (sorted[sorted.length - 1].maxPercent !== 100) return { ok: false, reason: "bands must end at 100" };
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].minPercent !== sorted[i - 1].maxPercent + 1) {
      return { ok: false, reason: `bands not contiguous (gap/overlap) at band ${i + 1}` };
    }
  }
  return { ok: true };
}

/**
 * Generate a lead-magnet body from the selected title + campaign context.
 * Returns null on any failure (caller leaves assetBody NULL — never throws into
 * the orchestration cascade). Format is inferred from the title unless overridden.
 */
export async function generateLeadMagnetContent(input: {
  userId: number;
  serviceId: number;
  icpId?: number | null;
  campaignId?: number | null;
  title: string;
  formatOverride?: LeadMagnetFormat;
  contentBrief?: string;
  /** "bonus" → post-purchase framing (buyer already enrolled) + howToUse orientation. Default "lead_magnet". */
  mode?: DeliverableMode;
}): Promise<LeadMagnetBody | null> {
  const format = input.formatOverride ?? inferLeadMagnetFormat(input.title);
  const mode: DeliverableMode = input.mode ?? "lead_magnet";
  const c = await gatherContext(input.userId, input.serviceId, input.icpId ?? null, input.campaignId ?? null, input.title);
  if (!c) return null;
  if (input.contentBrief) c.contentBrief = input.contentBrief.slice(0, 800);

  const { invokeLLM } = await import("./_core/llm");
  // Up to 2 attempts: the model occasionally returns a thin/empty array on the
  // first pass for long/complex titles. A retry recovers it — important because
  // this is a launch-critical deliverable and the caller runs the generator once.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPromptFor(mode) },
          { role: "user", content: userPromptFor(format, c, mode) },
        ],
        response_format: schemaFor(format, mode),
      });
      const content = response.choices[0].message.content;
      const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      const raw = { format, title: input.title, ...parsed } as LeadMagnetBody;
      // Repair, never reject. An upper bound must not become a new way to reach `return null`.
      const { body, repairs } = applyBodyBounds(raw, format);
      if (repairs.length > 0) {
        console.log(
          `[leadMagnetBounds] ${format} "${input.title}" repaired ${repairs.length}: ` +
          repairs.map((r) => `${r.field}(${r.kind} ${r.from}->${r.to})`).join(" "),
        );
      }
      // Shape guard per format — retry rather than store junk. Quiz runs the full
      // rubric validator (non-degenerate scoring is this format's whole value).
      const quizCheck = format === "quiz" ? validateQuizBody(body as QuizBody) : null;
      if (quizCheck && !quizCheck.ok) {
        console.warn(`[leadMagnetContent] quiz rubric rejected (attempt ${attempt}) for "${input.title}": ${quizCheck.reason}`);
      }
      const ok =
        (format === "guide" && Array.isArray((body as GuideBody).sections) && (body as GuideBody).sections.length > 0) ||
        (format === "checklist" && Array.isArray((body as ChecklistBody).items) && (body as ChecklistBody).items.length > 0) ||
        (format === "toolkit" && Array.isArray((body as ToolkitBody).tools) && (body as ToolkitBody).tools.length > 0) ||
        (format === "quiz" && !!quizCheck?.ok);
      if (ok) {
        console.log(`[leadMagnetContent] generated ${format} body for "${input.title}"${attempt > 1 ? ` (attempt ${attempt})` : ""}`);
        return body;
      }
      console.warn(`[leadMagnetContent] thin/invalid ${format} body (attempt ${attempt}) for "${input.title}"`);
    } catch (err) {
      console.warn(`[leadMagnetContent] generation error (attempt ${attempt}) for "${input.title}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.warn(`[leadMagnetContent] no valid ${format} body after retries for "${input.title}" — leaving unset`);
  return null;
}
