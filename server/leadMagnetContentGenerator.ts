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
import { services, idealCustomerProfiles, campaignKits, heroMechanisms, sourceOfTruth, campaigns } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

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
export interface GuideBody {
  format: "guide";
  title: string;
  promise: string;
  // Solution-focused, lean (not padded): each section is directly actionable.
  sections: { heading: string; body: string }[];
  nextStep: NextStep;
}
export interface ChecklistBody {
  format: "checklist";
  title: string;
  promise: string;
  items: { label: string; detail: string }[];
  nextStep: NextStep;
}
export interface ToolkitBody {
  format: "toolkit";
  title: string;
  promise: string;
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
interface MagnetContext {
  niche: string;
  title: string;
  programme: string;
  mainBenefit: string;
  mechanism: string;
  offerDescription: string;
  icpPains: string;
  icpGoals: string;
  icpBarriers: string;
  sot: string;
}

async function gatherContext(userId: number, serviceId: number, icpId: number | null, campaignId: number | null, title: string): Promise<MagnetContext | null> {
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

  let mechanism = service.uniqueMechanismSuggestion || "";
  if (icp?.id) {
    const [kit] = await db.select().from(campaignKits)
      .where(and(eq(campaignKits.userId, userId), eq(campaignKits.icpId, icp.id))).limit(1);
    if (kit?.selectedMechanismId) {
      const [m] = await db.select({ name: heroMechanisms.mechanismName }).from(heroMechanisms)
        .where(eq(heroMechanisms.id, kit.selectedMechanismId)).limit(1);
      if (m?.name) mechanism = m.name;
    }
  }

  const [sot] = await db.select().from(sourceOfTruth).where(eq(sourceOfTruth.userId, userId)).limit(1);
  const sotLine = sot ? [sot.coreOffer, sot.mainBenefits, sot.uniqueValue].filter(Boolean).join(" · ") : "";

  return {
    niche: (service.targetCustomer ?? service.category ?? "coaching").slice(0, 200),
    title,
    programme: (service.name ?? "").slice(0, 120),
    mainBenefit: service.mainBenefit ?? "",
    mechanism: mechanism || "the method",
    offerDescription: (service.description ?? "").slice(0, 400),
    icpPains: (icp?.pains ?? "").slice(0, 600),
    icpGoals: (icp?.goals ?? "").slice(0, 400),
    icpBarriers: (icp?.implementationBarriers ?? "").slice(0, 400),
    sot: sotLine.slice(0, 400),
  };
}

function contextBlock(c: MagnetContext): string {
  return [
    `Lead magnet title (the promise to deliver on): "${c.title}"`,
    `Niche / audience: ${c.niche}`,
    c.programme ? `Paid programme name (what nextStep bridges to): ${c.programme}` : "",
    c.mainBenefit ? `Main benefit of the paid offer: ${c.mainBenefit}` : "",
    c.mechanism ? `The named method behind it: ${c.mechanism}` : "",
    c.offerDescription ? `Offer context: ${c.offerDescription}` : "",
    c.icpPains ? `Audience pains: ${c.icpPains}` : "",
    c.icpGoals ? `Audience goals: ${c.icpGoals}` : "",
    c.icpBarriers ? `What blocks them from acting: ${c.icpBarriers}` : "",
    c.sot ? `Brand context: ${c.sot}` : "",
  ].filter(Boolean).join("\n");
}

const SYSTEM_PROMPT =
  "You produce done-for-you lead-magnet content for coaches, consultants and experts at agency quality. The bar: ~80% immediately-usable tools (swipe copy, fill-in templates, SOPs, scripts, worksheets, checklists the reader uses TODAY) and only ~20% teaching. Useful beats comprehensive — right-size to solve ONE specific problem, never padded. Everything is concrete and specific to the exact niche given, with real fill-in-the-blank content or real swipe copy the reader can copy and use, never generic filler that could belong to any coach. Open with a tight promise (max two sentences: what they can DO after using it). Close with a nextStep that bridges to the paid programme — a clear next action, no dead end. Respond with valid JSON.";

// ── Per-format response schemas (json_schema, strict) ──
type ResponseFormat = { type: "json_schema"; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } };
function schemaFor(format: LeadMagnetFormat): ResponseFormat {
  const s = (name: string, schema: Record<string, unknown>): ResponseFormat => ({ type: "json_schema", json_schema: { name, strict: true, schema } });
  const str = { type: "string" } as const;
  const arr = (items: Record<string, unknown>) => ({ type: "array", items });
  // Shared nextStep bridge — required on every format.
  const nextStep = { type: "object", additionalProperties: false, required: ["heading", "body", "ctaLabel"], properties: { heading: str, body: str, ctaLabel: str } };
  if (format === "guide") return s("lead_magnet_guide", {
    type: "object", additionalProperties: false,
    required: ["promise", "sections", "nextStep"],
    properties: {
      promise: str,
      sections: arr({ type: "object", additionalProperties: false, required: ["heading", "body"], properties: { heading: str, body: str } }),
      nextStep,
    },
  });
  if (format === "checklist") return s("lead_magnet_checklist", {
    type: "object", additionalProperties: false,
    required: ["promise", "items", "nextStep"],
    properties: {
      promise: str,
      items: arr({ type: "object", additionalProperties: false, required: ["label", "detail"], properties: { label: str, detail: str } }),
      nextStep,
    },
  });
  if (format === "toolkit") return s("lead_magnet_toolkit", {
    type: "object", additionalProperties: false,
    required: ["promise", "tools", "nextStep"],
    properties: {
      promise: str,
      tools: arr({ type: "object", additionalProperties: false, required: ["name", "type", "instructions", "content"], properties: {
        name: str,
        type: { type: "string", enum: ["swipe", "template", "sop", "worksheet", "script", "checklist"] },
        instructions: str,
        content: str,
      } }),
      nextStep,
    },
  });
  const pct = { type: "integer", minimum: 0, maximum: 100 } as const;
  return s("lead_magnet_quiz", {
    type: "object", additionalProperties: false,
    required: ["promise", "questions", "scoring", "nextStep"],
    properties: {
      promise: str,
      questions: arr({
        type: "object", additionalProperties: false, required: ["question", "options"],
        properties: {
          question: str,
          options: arr({
            type: "object", additionalProperties: false, required: ["label", "weight"],
            properties: { label: str, weight: { type: "integer", minimum: 0, maximum: 3 } },
          }),
        },
      }),
      scoring: {
        type: "object", additionalProperties: false, required: ["bands"],
        properties: {
          bands: arr({
            type: "object", additionalProperties: false,
            required: ["name", "minPercent", "maxPercent", "teaser", "meaning", "cta"],
            properties: { name: str, minPercent: pct, maxPercent: pct, teaser: str, meaning: str, cta: nextStep },
          }),
        },
      },
      nextStep,
    },
  });
}

function userPromptFor(format: LeadMagnetFormat, c: MagnetContext): string {
  const ctx = contextBlock(c);
  const programme = c.programme || "the paid programme";
  const common = `Create this lead magnet to the 80/20 bar — usable tools first, minimal teaching, right-sized to solve ONE specific problem. Everything specific to this exact niche and audience — real fill-in content, real swipe copy, the words this audience actually uses. No generic filler, no padding.\n\n${ctx}\n\nOpen with a TIGHT promise: max two sentences on what they can DO after using this (not teaching). End with a nextStep that bridges to "${programme}" — a heading, a short body that connects this free win to the paid outcome, and a concrete ctaLabel (e.g. "Book My Free Call"). No dead end.\n\n`;
  if (format === "guide") return `${common}Produce a GUIDE: 3-6 solution-focused sections, each a clear heading and lean, directly-actionable content (steps, a mini-framework, an example the reader applies) — not padded prose. Useful beats comprehensive.\nReturn JSON: { "promise", "sections":[{"heading","body"}], "nextStep":{"heading","body","ctaLabel"} }.`;
  if (format === "checklist") return `${common}Produce a CHECKLIST / cheat-sheet: 7-15 concrete action items, each a short actionable label plus a one-to-two-sentence detail that makes it doable today. Every item is something they DO, not something they learn.\nReturn JSON: { "promise", "items":[{"label","detail"}], "nextStep":{"heading","body","ctaLabel"} }.`;
  if (format === "toolkit") return `${common}Produce a TOOLKIT: 3-4 focused, immediately-usable tools (no more — lean, not a swipe-file dump). Each tool has a name, a type (one of: swipe, template, sop, worksheet, script, checklist), one-line usage instructions, and the ACTUAL usable content (real fill-in-the-blank templates / swipe copy / step-by-step SOP the reader copies and uses today).\nReturn JSON: { "promise", "tools":[{"name","type","instructions","content"}], "nextStep":{"heading","body","ctaLabel"} }.`;
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
}): Promise<LeadMagnetBody | null> {
  const format = input.formatOverride ?? inferLeadMagnetFormat(input.title);
  const c = await gatherContext(input.userId, input.serviceId, input.icpId ?? null, input.campaignId ?? null, input.title);
  if (!c) return null;

  const { invokeLLM } = await import("./_core/llm");
  // Up to 2 attempts: the model occasionally returns a thin/empty array on the
  // first pass for long/complex titles. A retry recovers it — important because
  // this is a launch-critical deliverable and the caller runs the generator once.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPromptFor(format, c) },
        ],
        response_format: schemaFor(format),
      });
      const content = response.choices[0].message.content;
      const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      const body = { format, title: input.title, ...parsed } as LeadMagnetBody;
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
