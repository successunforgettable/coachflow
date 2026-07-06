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

// ── Structured body shapes (stored as hvcoTitles.assetBody JSON) ──
export interface GuideBody {
  format: "guide";
  title: string;
  intro: string;
  sections: { heading: string; body: string }[];
  keyTakeaways: string[];
  cta: string;
}
export interface ChecklistBody {
  format: "checklist";
  title: string;
  intro: string;
  items: { label: string; detail: string }[];
  cta: string;
}
export interface ToolkitBody {
  format: "toolkit";
  title: string;
  intro: string;
  tools: { name: string; purpose: string; content: string }[];
  cta: string;
}
export interface QuizBody {
  format: "quiz";
  title: string;
  intro: string;
  // Reuses the existing LP quizSection {question, options, answer} shape per item.
  questions: { question: string; options: string[]; answer: string }[];
  // Score bands — interpretation of the result. Interactive scoring is delivered
  // by the deferred delivery layer; this is the content it will run on.
  scoring: { band: string; meaning: string }[];
  cta: string;
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
  "You are a done-for-you content creator who produces genuinely useful, ready-to-deliver lead-magnet content for coaches, consultants and experts. You write specific, concrete, immediately-usable material grounded in the exact niche and audience given — real steps, real examples, real language the reader recognises. Every piece delivers fully on the promise in the title so a reader would feel the free asset alone was worth their email. Respond with valid JSON.";

// ── Per-format response schemas (json_schema, strict) ──
type ResponseFormat = { type: "json_schema"; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } };
function schemaFor(format: LeadMagnetFormat): ResponseFormat {
  const s = (name: string, schema: Record<string, unknown>): ResponseFormat => ({ type: "json_schema", json_schema: { name, strict: true, schema } });
  const str = { type: "string" } as const;
  const arr = (items: Record<string, unknown>) => ({ type: "array", items });
  if (format === "guide") return s("lead_magnet_guide", {
    type: "object", additionalProperties: false,
    required: ["intro", "sections", "keyTakeaways", "cta"],
    properties: {
      intro: str,
      sections: arr({ type: "object", additionalProperties: false, required: ["heading", "body"], properties: { heading: str, body: str } }),
      keyTakeaways: arr(str),
      cta: str,
    },
  });
  if (format === "checklist") return s("lead_magnet_checklist", {
    type: "object", additionalProperties: false,
    required: ["intro", "items", "cta"],
    properties: {
      intro: str,
      items: arr({ type: "object", additionalProperties: false, required: ["label", "detail"], properties: { label: str, detail: str } }),
      cta: str,
    },
  });
  if (format === "toolkit") return s("lead_magnet_toolkit", {
    type: "object", additionalProperties: false,
    required: ["intro", "tools", "cta"],
    properties: {
      intro: str,
      tools: arr({ type: "object", additionalProperties: false, required: ["name", "purpose", "content"], properties: { name: str, purpose: str, content: str } }),
      cta: str,
    },
  });
  return s("lead_magnet_quiz", {
    type: "object", additionalProperties: false,
    required: ["intro", "questions", "scoring", "cta"],
    properties: {
      intro: str,
      questions: arr({ type: "object", additionalProperties: false, required: ["question", "options", "answer"], properties: { question: str, options: arr(str), answer: str } }),
      scoring: arr({ type: "object", additionalProperties: false, required: ["band", "meaning"], properties: { band: str, meaning: str } }),
      cta: str,
    },
  });
}

function userPromptFor(format: LeadMagnetFormat, c: MagnetContext): string {
  const ctx = contextBlock(c);
  const common = `Create the full content of this lead magnet, delivering completely on its title. Make everything specific to this exact niche and audience — concrete steps, real examples, the words this audience actually uses. No generic filler that could belong to any coach.\n\n${ctx}\n\n`;
  if (format === "guide") return `${common}Produce a GUIDE: a short intro that frames why this matters for them; 4-6 sections, each a clear heading and 2-4 substantive paragraphs of genuinely useful teaching; 3-5 key takeaways; and a closing CTA that invites the next step without hard selling.\nReturn JSON: { "intro", "sections":[{"heading","body"}], "keyTakeaways":[...], "cta" }.`;
  if (format === "checklist") return `${common}Produce a CHECKLIST / cheat-sheet: a one-line intro; 8-12 checklist items, each a short actionable label plus a one-to-two-sentence detail that makes it doable today; and a closing CTA.\nReturn JSON: { "intro", "items":[{"label","detail"}], "cta" }.`;
  if (format === "toolkit") return `${common}Produce a TOOLKIT: a short intro; 4-6 ready-to-use tools (a template, script, swipe, worksheet or prompt), each with a name, a one-line purpose, and the actual usable content (fill-in-the-blank templates or example scripts they can copy); and a closing CTA.\nReturn JSON: { "intro", "tools":[{"name","purpose","content"}], "cta" }.`;
  return `${common}Produce a QUIZ / assessment: a short intro explaining what it reveals; 5-8 questions, each with 3-4 options and the option that indicates the strongest position ("answer"); 3-4 score bands interpreting the outcome (band label + what it means + a nudge toward the offer); and a closing CTA. Keep it genuinely diagnostic, not a disguised pitch.\nReturn JSON: { "intro", "questions":[{"question","options":[...],"answer"}], "scoring":[{"band","meaning"}], "cta" }.`;
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
      // Minimal shape guard per format — retry rather than store junk.
      const ok =
        (format === "guide" && Array.isArray((body as GuideBody).sections) && (body as GuideBody).sections.length > 0) ||
        (format === "checklist" && Array.isArray((body as ChecklistBody).items) && (body as ChecklistBody).items.length > 0) ||
        (format === "toolkit" && Array.isArray((body as ToolkitBody).tools) && (body as ToolkitBody).tools.length > 0) ||
        (format === "quiz" && Array.isArray((body as QuizBody).questions) && (body as QuizBody).questions.length > 0);
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
