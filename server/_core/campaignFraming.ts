import type { CampaignType } from "./campaignCta";
import type { LandingPageContent } from "../../drizzle/schema";
import { classifyPrice } from "../lib/templates/operatorFields";

/**
 * CAMPAIGN FRAMING — the one place that knows what a campaign type MEANS.
 *
 * Three facts about a campaign used to live in three files and drift apart:
 *   - campaignType → landing-page type          (was _core/orchestration.ts)
 *   - campaignType → landing-page copy framing  (was landingPageGenerator.ts, 4 of 7 values)
 *   - campaignType → does money change hands    (did not exist; the offer node assumed "yes")
 *
 * They are one fact wearing three field names, and the drift was measurable: the landing-page
 * framing map carried FOUR of the seven campaign types, so `discovery_call`, `lead_magnet` and
 * `in_person_event` fell through to `course_launch` and a FREE discovery page was generated
 * against "Enrolment is the decision point … CTA language: Enrol now".
 *
 * Every map here is typed `Record<CampaignType, …>`, so an eighth campaign type is a COMPILE
 * ERROR rather than a silent fallthrough. That type-level completeness is the actual fix; the
 * three missing entries are only the symptom that was visible.
 */

// ── campaignType → landing-page type ────────────────────────────────────────────────────────
/**
 * Moved here from `_core/orchestration.ts` unchanged. `orchestration.ts` re-exports both this
 * and `pageTypeForCampaign` so every existing importer keeps working untouched.
 *
 * The single chain that also tells us whether a campaign converts on a downloadable
 * (lead_magnet_download) vs a registration/call/purchase.
 */
export type LpPageTypeName =
  | "sales_page"
  | "webinar_registration"
  | "discovery_call_booking"
  | "lead_magnet_download"
  | "event_registration";

export const CAMPAIGN_TO_PAGE_TYPE: Record<CampaignType, LpPageTypeName> = {
  webinar: "webinar_registration",
  discovery_call: "discovery_call_booking",
  lead_magnet: "lead_magnet_download",
  in_person_event: "event_registration",
  course_launch: "sales_page",
  product_launch: "sales_page",
  challenge: "sales_page",
};

export function pageTypeForCampaign(campaignType?: string | null): LpPageTypeName {
  return campaignType
    ? (CAMPAIGN_TO_PAGE_TYPE[campaignType as CampaignType] ?? "sales_page")
    : "sales_page";
}

// ── OFFER MODE — does this campaign convert on a FREE next step, or on a PAID purchase? ──────
/**
 * ZAP's coaches almost always convert on a FREE next step — a webinar, a training, a free call,
 * a report, a lead magnet — and sell the high-ticket programme LATER, off-page, after that free
 * step. On that path the offer node's job is the PROGRAMME CONTEXT that makes attending worth
 * it (the transformation, the mechanism, the value equation) and NOT a price or a refund
 * guarantee: there is nothing to buy in the room and therefore nothing to refund.
 *
 * `paid` is the genuinely-paid case — a course or product launch, or an event the coach has
 * given a real price. It gets the full paid offer.
 */
export type OfferMode = "free_event" | "paid";

/**
 * The default when a campaign carries no type at all. Deliberately `course_launch` — the same
 * fallback every other generator already uses (`landingPageGenerator.ts`, `hvcoGenerator.ts`,
 * `emailSequenceGenerator.ts`, `whatsappSequenceGenerator.ts`, `headlinesGenerator.ts`,
 * `adCopyGenerator.ts`), so introducing offer-mode awareness changes NOTHING on the
 * no-campaign-type path.
 *
 * 📌 The product truth argues this should be a free type, since free is the overwhelming
 * majority. That flip is a one-line change and a DELIBERATE product decision, held separately
 * rather than smuggled in here. It is safe to hold precisely because `describeOffer` suppresses
 * price/guarantee independently, keyed off the PAGE's own campaign type — so a wrong default
 * here cannot put a price on a free page.
 */
export const DEFAULT_CAMPAIGN_TYPE: CampaignType = "course_launch";

/**
 * Resolve whether this campaign's offer is a free-event offer or a paid one.
 *
 * An operator-captured price OVERRIDES the campaign-type default in BOTH directions, because
 * the operator's own answer outranks an inference:
 *   - a real amount on an event  → `paid`       (this is the seam the deferred tripwire lands on)
 *   - the explicit `__FREE__`    → `free_event` (even on a type that usually charges)
 * Silence never implies either — it falls through to the campaign-type default, which is the
 * same three-state discipline `operatorFields.classifyPrice` already enforces at publish.
 */
export function resolveOfferMode(input: {
  campaignType?: string | null;
  campaignFacts?: { price?: LandingPageContent["price"] } | null;
}): OfferMode {
  const priced = classifyPrice(input.campaignFacts?.price);
  if (priced.status === "value") return "paid";
  if (priced.status === "na" && priced.kind === "free") return "free_event";

  const type = (input.campaignType ?? DEFAULT_CAMPAIGN_TYPE) as CampaignType;
  return pageTypeForCampaign(type) === "sales_page" ? "paid" : "free_event";
}

/** The free next step's own noun, for copy that has to name what the reader is registering for. */
export const FREE_STEP_NOUN: Record<CampaignType, string> = {
  webinar: "live training",
  discovery_call: "call",
  lead_magnet: "guide",
  in_person_event: "event",
  challenge: "challenge",
  course_launch: "programme",
  product_launch: "programme",
};

// ── campaignType → landing-page copy framing ────────────────────────────────────────────────
/**
 * Moved here from `landingPageGenerator.ts`, where it carried only FOUR of the seven values.
 * The four originals are preserved VERBATIM so no shipped page's framing changes; the three
 * additions are new and are written free-appropriate, matching what `PAGETYPE_PROMPTS` already
 * instructs for the same page types (no enrolment deadline on a free call, no fabricated
 * urgency on a lead magnet, real room capacity on an event).
 */
export const LP_CAMPAIGN_FRAMING: Record<CampaignType, string> = {
  webinar: `CAMPAIGN TYPE: Webinar
Framing: Show-up urgency — the live event is the vehicle. Copy must give a compelling reason to attend live, not just register.
Urgency mechanism: Date and time of the webinar. Limited seats available.
CTA language: Register now / Save your seat / Join us live on [date]`,

  challenge: `CAMPAIGN TYPE: Challenge
Framing: Community commitment — joining a group doing this together. Daily wins build momentum.
Urgency mechanism: Challenge start date. Community closes when the challenge begins.
CTA language: Join the challenge / Claim your spot / Start with us on [date]`,

  course_launch: `CAMPAIGN TYPE: Course Launch
Framing: Transformation journey — who they are now vs who they will become. Enrolment is the decision point.
Urgency mechanism: Enrolment deadline. Cohort size is limited.
CTA language: Enrol now / Join the programme / Claim your place before [date]`,

  product_launch: `CAMPAIGN TYPE: Product Launch
Framing: Early access and founding member status. First to experience something new.
Urgency mechanism: Launch day price increase. Founding member pricing closes on launch day.
CTA language: Get early access / Become a founding member / Lock in launch pricing`,

  discovery_call: `CAMPAIGN TYPE: Free Discovery Call
Framing: A fit-check, not a pitch. The page sets the expectation that this is a 1:1 conversation to find out whether the work applies. The reader should finish it thinking "this is for people serious about this outcome — let me see whether I qualify."
Urgency mechanism: The coach's real calendar capacity — how many calls genuinely fit in a week. Never an enrolment deadline, a cohort close, or a cart timer; those belong to a purchase and this page sells nothing.
CTA language: Book a call / Apply for a call / Reserve your slot`,

  lead_magnet: `CAMPAIGN TYPE: Free Lead Magnet
Framing: One specific, concrete asset. The reader should finish the page thinking "this is exactly the guide I needed — let me grab it before I lose the tab." The asset itself carries the page; its usefulness is the whole argument.
Urgency mechanism: None. The asset is genuinely free and stays available, so the page runs with no deadline, no countdown and no limited-spots line. Its integrity comes from the asset being worth having.
CTA language: Get the free guide / Download free / Send it to me`,

  in_person_event: `CAMPAIGN TYPE: In-Person Event
Framing: Physical-presence value — the room itself is the value, and being there beats any recording.
Urgency mechanism: The real capacity of the room and the fixed event date. Both are facts about the venue and the diary, carried only when the operator has supplied them.
CTA language: Reserve your seat / Register now / Save my spot`,
};

/** Framing for one campaign type, with the shared default for an unknown/absent value. */
export function lpFramingForCampaign(campaignType?: string | null): string {
  const type = (campaignType ?? DEFAULT_CAMPAIGN_TYPE) as CampaignType;
  return LP_CAMPAIGN_FRAMING[type] ?? LP_CAMPAIGN_FRAMING[DEFAULT_CAMPAIGN_TYPE];
}
