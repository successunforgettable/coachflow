/**
 * Three-state operator-field resolver (2026-07-18) — the SINGLE place that classifies an
 * operator-captured field as one of three states:
 *
 *   • answered-with-a-value       — a real price / booking URL / venue
 *   • answered-as-NOT-APPLICABLE  — an EXPLICIT N/A answer ("it's free", "I book by email",
 *                                   "by application", "it's online") carried by a sentinel string
 *   • unanswered                  — genuine silence (null / empty)
 *
 * THE RULE (locked, must not erode): absence never routes to a published page. A null operator field
 * is `unanswered` → the page holds as a review-draft until the coach explicitly answers. "Free" is an
 * EXPLICIT answer (`__FREE__`), NEVER inferred from a null price — otherwise an unanswered-but-actually
 * -PAID event would silently ship as a free page. Only intake asking the question fills the field; this
 * resolver just reads whatever intake (or the review surface) stored.
 *
 * WHY SENTINEL STRINGS (approved 2026-07-18): the N/A answer is stored verbatim in the EXISTING string
 * field — `price.amount`, `users.booking_url`, `eventSchedule.venue` — so the model is additive with NO
 * migration and no new columns. A sentinel does NOT match the publish gate's `[INSERT_*]` scan, so the
 * gate reads a sentinel as "field complete"; only genuine silence still trips a token → held. Both the
 * DISCRIMINATORS (which style to render) and the PUBLISH GATE (may this go live) read this one resolver,
 * so the three-state logic lives in exactly one place. No fabrication: a null count/price/venue never
 * becomes a made-up value — it stays `unanswered` and the page waits.
 *
 * The N/A sentinels are also the intake's answer-branches later ("free or paid?" → __FREE__ / a number).
 * This module sits UNDER the intake sprint; it is not wired into intake here.
 */
import type { LandingPageContent } from "../../../drizzle/schema";

// N/A sentinels — an EXPLICIT coach answer, stored in the existing string field. Additive, no migration.
export const NA_SENTINEL = {
  /** Event price answered as "it's free" → the free (Iman) template, explicitly (never inferred). */
  FREE: "__FREE__",
  /** Sales price answered as "by application / price on a call" → "Apply / Book a call" CTA. */
  BY_APPLICATION: "__BY_APPLICATION__",
  /** Booking answered as "I take enquiries by email" → reveal an email-capture CTA (no calendar link). */
  EMAIL_CAPTURE: "__EMAIL_CAPTURE__",
  /** Event location answered as "it's online" → a graceful "Live online" (a complete answer). */
  ONLINE: "__ONLINE__",
} as const;

/**
 * NUDGE-category fields (2026-07-18, distinct from the hard-hold operator fields above). Absence here
 * does NOT block publish — the page ships gracefully (the element simply omits) and the coach is later
 * surfaced a soft, non-blocking prompt ("add a photo to make your hero stronger"). This list is DATA the
 * review/intake surface reads to know which fields to offer OPTIONALLY; no UI is built here.
 *
 *   • presenter_photo — a hero cutout strengthens webinar/event heroes but a text-only hero is legitimate
 *                       (Iman/webinar now omit the figure gracefully; Hormozi already did). Iman's
 *                       text-only hero is the weakest visually → the prime nudge candidate.
 *
 * NOT the same as the already-graceful fallbacks (checkout URL → email capture, video → poster/omit),
 * which are complete alternatives rather than a weakened page; those are noted for the intake sprint but
 * are not nudges. Contrast the HARD-HOLD fields — event date/time/timezone, event & sales price,
 * discovery booking, event location — whose absence breaks or misrepresents the page (see the gate).
 */
export const NUDGE_FIELDS = ["presenter_photo"] as const;
export type NudgeField = (typeof NUDGE_FIELDS)[number];

export type PriceNaKind = "free" | "by_application";

/** Discriminated three-state result read by both discriminators and the publish gate. */
export type FieldState<T, NA extends string = string> =
  | { status: "value"; value: T }
  | { status: "na"; kind: NA }
  | { status: "unanswered" };

const clean = (s: unknown): string => (typeof s === "string" ? s.trim() : "");

/**
 * Price — shared by event (free vs paid) and sales (real price vs by-application). A number/text amount
 * is a value; `__FREE__` / `__BY_APPLICATION__` are explicit N/A answers; anything empty is unanswered
 * (HELD — never assumed free). `currency`/`installments` ride along only with a real value.
 */
export function classifyPrice(
  price: LandingPageContent["price"] | null | undefined,
): FieldState<{ amount: string; currency?: string; installments?: string }, PriceNaKind> {
  const amount = clean(price?.amount);
  if (!amount) return { status: "unanswered" };
  if (amount === NA_SENTINEL.FREE) return { status: "na", kind: "free" };
  if (amount === NA_SENTINEL.BY_APPLICATION) return { status: "na", kind: "by_application" };
  return { status: "value", value: { amount, currency: price?.currency, installments: price?.installments } };
}

/**
 * Booking (coach `users.booking_url`) — a real URL is a value; `__EMAIL_CAPTURE__` is the explicit
 * "email me" N/A answer (reveal a capture form, the sales-checkout pattern); empty is unanswered → held.
 */
export function classifyBooking(url: string | null | undefined): FieldState<string, "email_capture"> {
  const v = clean(url);
  if (!v) return { status: "unanswered" };
  if (v === NA_SENTINEL.EMAIL_CAPTURE) return { status: "na", kind: "email_capture" };
  return { status: "value", value: v };
}

/**
 * Event location (`eventSchedule.venue`) — a real venue is a value; `__ONLINE__` is the explicit
 * "it's online" N/A answer ("Live online"); empty is unanswered → held (both Iman and Hormozi). This
 * makes "online" a first-class answer instead of an inferred default.
 */
export function classifyLocation(venue: string | null | undefined): FieldState<string, "online"> {
  const v = clean(venue);
  if (!v) return { status: "unanswered" };
  if (v === NA_SENTINEL.ONLINE) return { status: "na", kind: "online" };
  return { status: "value", value: v };
}

/**
 * The publish-gate half of the resolver: operator fields whose GENUINE SILENCE would otherwise route a
 * WRONG page live, listed as human-readable reasons the page is held. Returns [] when every required
 * field is answered (a value OR an explicit N/A). The publisher throws on a non-empty result → the page
 * stages as a review-draft with a reason a coach can act on.
 *
 * Scope: currently EVENT PRICE only — it is the one field whose silence ships a wrong page (an
 * unanswered-but-paid event as free), because free and unanswered both route to Iman which carries no
 * price token. Every other operator field already self-holds via an `[INSERT_*]` token on silence
 * (sales price, booking URL, event location, event date/time, presenter photo), so the dumb token scan
 * covers them; this semantic check is the belt-and-suspenders for the one gap, and gives a clear reason.
 */
export function unansweredRequiredOperatorFields(
  pageType: string | null | undefined,
  content: Pick<LandingPageContent, "price"> | null | undefined,
): string[] {
  const missing: string[] = [];
  if (pageType === "event_registration") {
    if (classifyPrice(content?.price).status === "unanswered") {
      missing.push("event price (is it free or paid?)");
    }
  }
  return missing;
}
