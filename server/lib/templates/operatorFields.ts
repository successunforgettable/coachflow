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

// ── OPERATOR TOKEN REGISTRY (2026-07-18) ────────────────────────────────────────────────────────────
// The single source of truth that unifies the three-state model with the PlaceholderEditor: they were
// the SAME operator fact from two ends. A `[INSERT_*]` token in the LLM copy and a structured template
// field (eventSchedule.date, users.bookingUrl) are two representations of one answer. This registry maps
// each KNOWN token → its structured write-target + N/A branches + the Zappy question, so ONE captured
// answer resolves BOTH: it writes the structured field (for template bindings) AND substitutes every
// matching copy token in the prose. The generator will be constrained to only emit tokens in this
// registry (a later step); any token NOT here is handled by the fail-safe in resolveOperatorToken.

/** hard-hold: absence → review-draft. nudge: absence ships (optional). auto-fill: derived, never asked. */
export type TokenCategory = "hard-hold" | "nudge" | "auto-fill";
/** Where the answer's structured value lands. copy-only = no structured field, prose substitution only. */
export type WriteScope = "content" | "coach" | "copy-only";

export interface NaBranch {
  /** The sentinel written to the structured field (read by classifyPrice/Booking/Location). */
  sentinel: string;
  /** The chip label the coach taps ("It's free"). */
  label: string;
  /** What replaces the copy token in prose for this N/A answer ("free"), never the raw sentinel. */
  copyText: string;
}

export interface OperatorTokenSpec {
  token: string;
  /** Canonical field key, stable across UI/analytics. */
  key: string;
  category: TokenCategory;
  scope: WriteScope;
  /** Structured target: a dot-path in LandingPageContent (scope "content") or a users column (scope "coach"). Absent for copy-only. */
  path?: string;
  /** Zappy's one-at-a-time question (DATA for the intake tier, which is built on top of this registry). */
  question: string;
  /** N/A answer-branches — the first-class "not applicable" answers. Absent when the field has none. */
  na?: NaBranch[];
  /** For category "auto-fill": the existing datum the token is filled from (never asked of the coach). */
  autoFillFrom?: "coachName" | "serviceName" | "leadMagnetName";
}

// Canonical names only (the generator's forbidden aliases — BOOKING_LINK, LAUNCH_DATE, DEADLINE,
// REGISTRATION_DATE, CTA_DESTINATION, NEXT_PROGRAM_NAME, COHORT_DATE, DOWNLOAD_LINK — are NOT here; the
// generator constraint step maps/rejects them).
export const OPERATOR_TOKEN_REGISTRY: Record<string, OperatorTokenSpec> = {
  // ── Structured, hard-hold, no N/A (a live event genuinely has a date/time/tz) ──
  "[INSERT_EVENT_DATE]": { token: "[INSERT_EVENT_DATE]", key: "event_date", category: "hard-hold", scope: "content", path: "eventSchedule.date", question: "When's your event — what date?" },
  "[INSERT_EVENT_TIME]": { token: "[INSERT_EVENT_TIME]", key: "event_time", category: "hard-hold", scope: "content", path: "eventSchedule.time", question: "What time does it start?" },
  "[INSERT_EVENT_TIMEZONE]": { token: "[INSERT_EVENT_TIMEZONE]", key: "event_timezone", category: "hard-hold", scope: "content", path: "eventSchedule.timezone", question: "Which timezone is that in?" },
  // ── Structured, hard-hold, WITH N/A first-class ──
  "[INSERT_EVENT_VENUE]": {
    token: "[INSERT_EVENT_VENUE]", key: "event_location", category: "hard-hold", scope: "content", path: "eventSchedule.venue",
    question: "Is it in person or online? If in person, where?",
    na: [{ sentinel: NA_SENTINEL.ONLINE, label: "It's online", copyText: "online" }],
  },
  "[INSERT_BOOKING_URL]": {
    token: "[INSERT_BOOKING_URL]", key: "booking", category: "hard-hold", scope: "coach", path: "bookingUrl",
    question: "How do people book a call with you — a calendar link, or do they email you?",
    na: [{ sentinel: NA_SENTINEL.EMAIL_CAPTURE, label: "By email", copyText: "using the form on this page" }],
  },
  "[INSERT_PRICE]": {
    token: "[INSERT_PRICE]", key: "price", category: "hard-hold", scope: "content", path: "price.amount",
    question: "What's the price — a set amount, free, or by application?",
    na: [
      { sentinel: NA_SENTINEL.FREE, label: "It's free", copyText: "free" },
      { sentinel: NA_SENTINEL.BY_APPLICATION, label: "By application", copyText: "by application" },
    ],
  },
  // ── Copy-only, nudge (strengthen/complete the prose; absence ships) ──
  "[INSERT_REPLAY_AVAILABILITY]": { token: "[INSERT_REPLAY_AVAILABILITY]", key: "replay", category: "nudge", scope: "copy-only", question: "Will there be a replay? (e.g. “yes, for 48 hours” or “no, live only”)" },
  "[INSERT_EVENT_AGENDA]": { token: "[INSERT_EVENT_AGENDA]", key: "agenda", category: "nudge", scope: "copy-only", question: "Anything specific on the agenda you want named?" },
  "[INSERT_BOOKING_DURATION]": { token: "[INSERT_BOOKING_DURATION]", key: "booking_duration", category: "nudge", scope: "copy-only", question: "How long is the call? (e.g. 30 minutes)" },
  "[INSERT_BOOKING_TIME]": { token: "[INSERT_BOOKING_TIME]", key: "booking_time", category: "nudge", scope: "copy-only", question: "What times are you usually available?" },
  "[INSERT_ROOM_OR_FLOOR_INFO]": { token: "[INSERT_ROOM_OR_FLOOR_INFO]", key: "room_info", category: "nudge", scope: "copy-only", question: "Any room / floor detail for the venue? (optional)" },
  "[INSERT_PARKING_INFO]": { token: "[INSERT_PARKING_INFO]", key: "parking_info", category: "nudge", scope: "copy-only", question: "Any parking info to share? (optional)" },
  "[INSERT_DRESS_CODE]": { token: "[INSERT_DRESS_CODE]", key: "dress_code", category: "nudge", scope: "copy-only", question: "Is there a dress code? (optional)" },
  "[INSERT_DIETARY_NOTES]": { token: "[INSERT_DIETARY_NOTES]", key: "dietary_notes", category: "nudge", scope: "copy-only", question: "Any catering / dietary notes? (optional)" },
  // ── Auto-fill (derived from data ZAP already has — never asked of the coach) ──
  "[INSERT_HOST_NAME]": { token: "[INSERT_HOST_NAME]", key: "host_name", category: "auto-fill", scope: "copy-only", autoFillFrom: "coachName", question: "" },
  "[INSERT_EVENT_NAME]": { token: "[INSERT_EVENT_NAME]", key: "event_name", category: "auto-fill", scope: "copy-only", autoFillFrom: "serviceName", question: "" },
  "[INSERT_LEAD_MAGNET_NAME]": { token: "[INSERT_LEAD_MAGNET_NAME]", key: "lead_magnet_name", category: "auto-fill", scope: "copy-only", autoFillFrom: "leadMagnetName", question: "" },
};

/** Every token the generator is ALLOWED to emit (the constraint set for the generation step). */
export const KNOWN_OPERATOR_TOKENS: string[] = Object.keys(OPERATOR_TOKEN_REGISTRY);

/** The resolution of one captured answer — the two effects, computed purely (the mutation layer applies them). */
export interface TokenResolution {
  /** false → the token is NOT in the registry (fail-safe): no structured write, copy still gets filled. */
  known: boolean;
  token: string;
  spec?: OperatorTokenSpec;
  /** true when the answer matched one of the token's N/A branches. */
  isNa: boolean;
  /** The structured field write (null for copy-only or unknown tokens). For N/A, `value` is the sentinel. */
  structured: { scope: WriteScope; path: string; value: string } | null;
  /** The prose substitution to apply — ALWAYS present (this is what clears the baked copy token). */
  copy: { token: string; text: string };
}

/**
 * Resolve ONE captured answer for ONE token into its two effects. Pure. `answer` is either a real value
 * (a date, a URL, a price) or one of the token's N/A sentinels (`__FREE__` etc.). For an N/A answer the
 * structured field is written the SENTINEL (so the template renders the N/A affordance) while the copy is
 * substituted with the human `copyText` (never the raw sentinel). Unknown token → the fail-safe: no
 * structured write, but the copy is still filled with the raw answer so nothing is left as a dead token.
 */
export function resolveOperatorToken(token: string, answer: string): TokenResolution {
  const spec = OPERATOR_TOKEN_REGISTRY[token];
  const text = clean(answer);
  if (!spec) {
    // FAIL-SAFE: a token the registry doesn't know (the generator slipped one through). Never a silent
    // block — the intake asks a generic "fill this in", and the raw answer fills the copy.
    return { known: false, token, isNa: false, structured: null, copy: { token, text } };
  }
  const na = spec.na?.find((n) => n.sentinel === answer);
  if (na) {
    const structured = spec.scope === "copy-only" || !spec.path ? null : { scope: spec.scope, path: spec.path, value: na.sentinel };
    return { known: true, token, spec, isNa: true, structured, copy: { token, text: na.copyText } };
  }
  const structured = spec.scope === "copy-only" || !spec.path ? null : { scope: spec.scope, path: spec.path, value: text };
  return { known: true, token, spec, isNa: false, structured, copy: { token, text } };
}

/** Replace every occurrence of one token across all string fields of a content object (deep, immutable). */
function substituteTokenDeep<T>(node: T, token: string, replacement: string): T {
  if (typeof node === "string") return node.split(token).join(replacement) as unknown as T;
  if (Array.isArray(node)) return node.map((n) => substituteTokenDeep(n, token, replacement)) as unknown as T;
  if (node && typeof node === "object") {
    const out: any = {};
    for (const k in node as any) out[k] = substituteTokenDeep((node as any)[k], token, replacement);
    return out;
  }
  return node;
}

/** Set a dot-path (e.g. "eventSchedule.date", "price.amount") on a cloned object, creating parents. */
function setPath<T extends Record<string, any>>(obj: T, path: string, value: string): T {
  const clone: any = JSON.parse(JSON.stringify(obj ?? {}));
  const parts = path.split(".");
  let cur = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] == null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
  return clone;
}

/** The result of applying one answer: the new content + (if coach-scoped) the users column to write. */
export interface AppliedAnswer {
  content: LandingPageContent;
  /** Present when the answer targets a coach-level column (booking/video/checkout) rather than content. */
  coachColumn?: { column: string; value: string };
  resolution: TokenResolution;
}

/**
 * Apply ONE captured answer to a content object — the unified action the intake and the PlaceholderEditor
 * both call. It ALWAYS substitutes the copy token in the prose, and — for a content-scoped field — sets
 * the structured field; a coach-scoped field is returned as `coachColumn` for the mutation to persist on
 * the users row. Pure: returns new content, mutates nothing.
 */
export function applyOperatorAnswer(
  content: LandingPageContent,
  token: string,
  answer: string,
): AppliedAnswer {
  const resolution = resolveOperatorToken(token, answer);
  let next = substituteTokenDeep(content, resolution.copy.token, resolution.copy.text);
  let coachColumn: { column: string; value: string } | undefined;
  if (resolution.structured) {
    if (resolution.structured.scope === "content") {
      next = setPath(next as any, resolution.structured.path, resolution.structured.value);
    } else if (resolution.structured.scope === "coach") {
      coachColumn = { column: resolution.structured.path, value: resolution.structured.value };
    }
  }
  return { content: next, coachColumn, resolution };
}
