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
/**
 * The UI control the intake renders for a token (2026-07-22, Batch A / item 3). Structured controls make a
 * malformed value structurally impossible: a date/time PICKER can only emit a canonical, Date.parse-able
 * value (killing the `deriveLengthFromDate` NaN→fallback), a venue is an Online-chip-or-a-real-place, a
 * price is a chip (Free / By-application → the sentinel, written directly) or a number. "text" is the
 * default free-text box (booking URL, timezone, a credential line). NOT a free-text box with a format hint.
 */
export type OperatorInputType = "text" | "date" | "time" | "venue" | "price";

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
  /** The intake UI control (item 3). Absent → "text" (a plain free-text box). */
  inputType?: OperatorInputType;
  /** Structured target: a dot-path in LandingPageContent (scope "content") or a users column (scope "coach"). Absent for copy-only. */
  path?: string;
  /** Zappy's one-at-a-time question (DATA for the intake tier, which is built on top of this registry). */
  question: string;
  /** N/A answer-branches — the first-class "not applicable" answers. Absent when the field has none. */
  na?: NaBranch[];
  /** For category "auto-fill": the existing datum the token is filled from (never asked of the coach). */
  autoFillFrom?: "coachName" | "serviceName" | "leadMagnetName";
  /** For a NUDGE the coach skips: the graceful, non-fabricated text that replaces the copy token so the
   *  page still publishes (a hedge or a removal — never an invented specific). Hard-hold tokens have none
   *  (skipping a hard-hold leaves the page a draft). */
  skipText?: string;
}

// Canonical names only (the generator's forbidden aliases — BOOKING_LINK, LAUNCH_DATE, DEADLINE,
// REGISTRATION_DATE, CTA_DESTINATION, NEXT_PROGRAM_NAME, COHORT_DATE, DOWNLOAD_LINK — are NOT here; the
// generator constraint step maps/rejects them).
export const OPERATOR_TOKEN_REGISTRY: Record<string, OperatorTokenSpec> = {
  // ── Structured, hard-hold, no N/A (a live event genuinely has a date/time/tz) ──
  "[INSERT_EVENT_DATE]": { token: "[INSERT_EVENT_DATE]", key: "event_date", category: "hard-hold", scope: "content", inputType: "date", path: "eventSchedule.date", question: "When's your event — what date?" },
  "[INSERT_EVENT_TIME]": { token: "[INSERT_EVENT_TIME]", key: "event_time", category: "hard-hold", scope: "content", inputType: "time", path: "eventSchedule.time", question: "What time does it start?" },
  "[INSERT_EVENT_TIMEZONE]": { token: "[INSERT_EVENT_TIMEZONE]", key: "event_timezone", category: "hard-hold", scope: "content", path: "eventSchedule.timezone", question: "Which timezone is that in?" },
  // ── Structured, hard-hold, WITH N/A first-class ──
  "[INSERT_EVENT_VENUE]": {
    token: "[INSERT_EVENT_VENUE]", key: "event_location", category: "hard-hold", scope: "content", inputType: "venue", path: "eventSchedule.venue",
    question: "Is it in person or online? If in person, where?",
    na: [{ sentinel: NA_SENTINEL.ONLINE, label: "It's online", copyText: "online" }],
  },
  "[INSERT_BOOKING_URL]": {
    token: "[INSERT_BOOKING_URL]", key: "booking", category: "hard-hold", scope: "coach", path: "bookingUrl",
    question: "How do people book a call with you — a calendar link, or do they email you?",
    na: [{ sentinel: NA_SENTINEL.EMAIL_CAPTURE, label: "By email", copyText: "using the form on this page" }],
  },
  "[INSERT_PRICE]": {
    token: "[INSERT_PRICE]", key: "price", category: "hard-hold", scope: "content", inputType: "price", path: "price.amount",
    question: "What's the price — a set amount, free, or by application?",
    na: [
      { sentinel: NA_SENTINEL.FREE, label: "It's free", copyText: "free" },
      { sentinel: NA_SENTINEL.BY_APPLICATION, label: "By application", copyText: "by application" },
    ],
  },
  // ── Copy-only, hard-hold: the coach's headline credential line (2026-07-22, registered in Batch A so
  // Way 2's per-node copy scan (Batch C) surfaces it with a real question instead of the generic fail-safe;
  // it does NOT change the upfront facts step — campaignFacts carry no copy, so it is never asked there). ──
  "[INSERT_COACH_CREDENTIAL]": { token: "[INSERT_COACH_CREDENTIAL]", key: "coach_credential", category: "hard-hold", scope: "copy-only", question: "What's your headline credential — the one-line proof of why you're the person to learn this from? (e.g. “20-year executive coach”, “ex-Google product lead”)" },
  // ── Copy-only, nudge (strengthen/complete the prose; absence ships) ──
  "[INSERT_REPLAY_AVAILABILITY]": { token: "[INSERT_REPLAY_AVAILABILITY]", key: "replay", category: "nudge", scope: "copy-only", question: "Will there be a replay? (e.g. “yes, for 48 hours” or “no, live only”)", skipText: "Replay availability will be confirmed by email." },
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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * A native `<input type="date">` value ("2026-08-28") → a human, Date.parse-able string ("August 28, 2026").
 * The picker only ever emits ISO, so the stored/rendered date is always parseable (fixing the WhatsApp/email
 * `deriveLengthFromDate("28th august 2026") → NaN → fallback-3` bug) AND reads naturally on the page. Any
 * non-ISO input (a typed date the front-load parser already handled) passes through unchanged. Pure.
 */
export function canonicalEventDate(value: string): string {
  const v = clean(value);
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return v || value;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return v;
  return `${MONTH_NAMES[mo - 1]} ${d}, ${y}`;
}

/**
 * A native `<input type="time">` value ("14:30") → a human 12-hour string ("2:30 pm"). Non-`HH:MM` passes
 * through. Pure.
 */
export function canonicalEventTime(value: string): string {
  const v = clean(value);
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return v || value;
  const h = Number(m[1]), mm = Number(m[2]);
  if (h > 23 || mm > 59) return v;
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

/**
 * Normalize a captured answer to its canonical stored form BEFORE it is resolved (2026-07-22, item 2 — the
 * safety net). Runs at the SINGLE `applyOperatorAnswer` chokepoint, so every intake path (facts step, LP
 * intake, edit flow) gets it without per-callsite duplication. Two jobs:
 *   (1) map a typed N/A phrase to its sentinel for the case a value still arrives as free text (the
 *       structured chips write the sentinel directly, so this only catches a typed fallback): a PRICE of
 *       "free"/"£0"/"no charge" → __FREE__, "by application"/"apply" → __BY_APPLICATION__; a VENUE of
 *       "online"/"virtual" → __ONLINE__.
 *   (2) canonicalize a picker's raw value — an ISO date / a 24h time — to a human, Date.parse-able string.
 * A value that is already a sentinel/skip, or matches nothing, passes through untouched. Pure + idempotent.
 */
export function normalizeOperatorAnswer(token: string, answer: string): string {
  const raw = clean(answer);
  if (!raw) return answer;
  if (raw === "__SKIP__" || /^__[A-Z_]+__$/.test(raw)) return raw; // already a sentinel/skip
  const lc = raw.toLowerCase().replace(/[.!,\s]+$/g, "").trim();
  if (token === "[INSERT_PRICE]") {
    if (/^(free|no charge|no cost|complimentary|£0(?:\.0{1,2})?|\$0(?:\.0{1,2})?|0(?:\.0{1,2})?)$/.test(lc)) return NA_SENTINEL.FREE;
    if (/^(by application|application only|on application|price on application|apply(?: only)?|poa)$/.test(lc)) return NA_SENTINEL.BY_APPLICATION;
    return raw;
  }
  if (token === "[INSERT_EVENT_VENUE]") {
    if (/^(online|virtual|remote|on ?line|via zoom|zoom|livestream|live stream)$/.test(lc)) return NA_SENTINEL.ONLINE;
    return raw;
  }
  if (token === "[INSERT_EVENT_DATE]") return canonicalEventDate(raw);
  if (token === "[INSERT_EVENT_TIME]") return canonicalEventTime(raw);
  return raw;
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
  // item 2 — the single chokepoint: normalize a typed N/A phrase to its sentinel and canonicalize a
  // picker's raw date/time BEFORE resolving, so every caller (facts step, LP intake, edit flow) is covered.
  const resolution = resolveOperatorToken(token, normalizeOperatorAnswer(token, answer));
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

/** The facts ZAP ALREADY HOLDS, keyed by the registry's own `autoFillFrom` values. */
export interface AutoFillFacts {
  coachName?: string | null;
  serviceName?: string | null;
  leadMagnetName?: string | null;
}

/**
 * Fill every `category: "auto-fill"` token from data ZAP already holds.
 *
 * 🔴 WHY THIS EXISTS. `autoFillFrom` has been DECLARED on the registry since Batch A and read by
 * NOTHING — a dead field. `[INSERT_HOST_NAME]` and `[INSERT_EVENT_NAME]` are documented as
 * "never asked of the coach — filled server-side", `deriveOperatorQuestions` duly skips them
 * (`spec.category === "auto-fill"` → continue), and then no code ever filled them. So they were
 * never asked AND never answered, and survived all the way to the publish gate, which throws on
 * any surviving `[INSERT_*]`. Measured on production 2026-08-28: `[INSERT_HOST_NAME]` survives on
 * 5 of 24 `webinar_registration` pages, `[INSERT_EVENT_NAME]` on 0 of 24.
 *
 * An ABSENT fact leaves the token in place ON PURPOSE. Substituting an empty string would blank
 * the copy and delete the gate's only signal that something is missing — the page would publish
 * with a hole in it and tell nobody. A surviving token is a caught failure; a silent hole is not.
 */
export function resolveAutoFillTokens<T>(content: T, facts: AutoFillFacts): { content: T; filled: string[] } {
  let next = content;
  const filled: string[] = [];
  for (const spec of Object.values(OPERATOR_TOKEN_REGISTRY)) {
    if (spec.category !== "auto-fill" || !spec.autoFillFrom) continue;
    const value = clean(facts[spec.autoFillFrom]);
    if (!value) continue;
    next = substituteTokenDeep(next, spec.token, value);
    filled.push(spec.token);
  }
  return { content: next, filled };
}

/**
 * Substitute ONE copy token with text the caller has derived from a fact it holds. Deliberately
 * thin: the only way to replace a token with something other than a registry `skipText`, so every
 * such substitution is a visible call rather than an ad-hoc `String.replace` scattered upstream.
 */
export function substituteCopyToken<T>(content: T, token: string, text: string): T {
  return substituteTokenDeep(content, token, text);
}

/**
 * Apply a SKIP to a nudge/copy-only token — substitute the token with its graceful `skipText` (a hedge
 * or removal, never a fabricated specific) so the page can still publish. Only valid for non-hard-hold
 * tokens (the caller must not offer skip on a hard-hold — skipping one leaves the page a draft).
 */
export function applyOperatorSkip(content: LandingPageContent, token: string): LandingPageContent {
  const spec = OPERATOR_TOKEN_REGISTRY[token];
  const skipText = spec?.skipText ?? ""; // unknown/agenda/logistics → remove the token
  return substituteTokenDeep(content, token, skipText);
}

/**
 * Heuristic split of a front-loaded datetime answer ("August 12 at 11am GMT") into its parts, so the
 * coach who says it all at once isn't re-asked "what time?". Never fabricates — an absent part stays
 * undefined. Timezone (named or GMT±n) and time (11am / 11:00 / 14:00) are extracted; the remainder,
 * stripped of connectives, is the date.
 */
export function parseEventDateTime(text: string): { date?: string; time?: string; timezone?: string } {
  const raw = clean(text);
  if (!raw) return {};
  let rest = raw;
  const tzRe = /\b(?:GMT|UTC)[+-]\d{1,2}(?::\d{2})?\b|\b(GMT|UTC|BST|EST|EDT|CST|CDT|MST|MDT|PST|PDT|PT|ET|CT|MT|IST|CET|CEST|EET|AEST|AEDT|SGT|JST|HKT)\b/i;
  const tzM = rest.match(tzRe);
  const timezone = tzM ? tzM[0].toUpperCase() : undefined;
  if (tzM) rest = rest.slice(0, tzM.index) + rest.slice(tzM.index! + tzM[0].length);
  const timeRe = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b/i;
  const tM = rest.match(timeRe);
  const time = tM ? tM[0].replace(/\s+/g, "").replace(/(am|pm)/i, (m) => " " + m.toLowerCase()).trim() : undefined;
  if (tM) rest = rest.slice(0, tM.index) + rest.slice(tM.index! + tM[0].length);
  let date = rest.replace(/\b(?:at|on|starting|start(?:s|ing)?|from)\b/gi, " ").replace(/[,·]/g, " ").replace(/\s+/g, " ").trim();
  date = date.replace(/^[-–—\s]+|[-–—\s]+$/g, "").trim();
  return { date: date || undefined, time, timezone };
}

/**
 * Expand ONE captured answer into all the (token, value) writes it implies — front-loading. A plain
 * value on the DATE question is parsed; any time/timezone found is applied to their own tokens too, so
 * the redundant questions are skipped. N/A sentinels and skips (and every non-date token) pass through
 * as a single write. Returns the list of writes the mutation then applies through applyOperatorAnswer.
 */
export function expandOperatorAnswer(token: string, answer: string): { token: string; value: string }[] {
  const isSentinelOrSkip = answer === "__SKIP__" || /^__[A-Z_]+__$/.test(clean(answer));
  if (token !== "[INSERT_EVENT_DATE]" || isSentinelOrSkip) return [{ token, value: answer }];
  const p = parseEventDateTime(answer);
  const out: { token: string; value: string }[] = [{ token: "[INSERT_EVENT_DATE]", value: p.date ?? clean(answer) }];
  if (p.time) out.push({ token: "[INSERT_EVENT_TIME]", value: p.time });
  if (p.timezone) out.push({ token: "[INSERT_EVENT_TIMEZONE]", value: p.timezone });
  return out;
}

// ── deriveOperatorQuestions — "what does THIS page need answered?" (token-driven) ────────────────────
// Two sources, unioned: (1) baked `[INSERT_*]` tokens the LLM wrote into the copy (webinar date/time/tz,
// replay, logistics — caught by scanning the content strings), and (2) per-pageType STRUCTURED holds a
// template emits at render when its field is unanswered (sales/event price, event venue, discovery
// booking — which are NOT baked into copy). Each maps to its OPERATOR_TOKEN_REGISTRY entry → the Zappy
// question. Auto-fill tokens (host/event/magnet name) are excluded (filled server-side). N/A branches
// ride along as chips. Pure + testable — the tRPC layer renders nothing, it just reads this.

/** The per-pageType hard-hold operator fields a template EMITS when unanswered (not baked in copy). */
const PAGETYPE_REQUIRED_TOKENS: Record<string, string[]> = {
  webinar_registration: ["[INSERT_EVENT_DATE]", "[INSERT_EVENT_TIME]", "[INSERT_EVENT_TIMEZONE]"],
  event_registration: ["[INSERT_EVENT_DATE]", "[INSERT_EVENT_VENUE]", "[INSERT_PRICE]"],
  sales_page: ["[INSERT_PRICE]"],
  discovery_call_booking: ["[INSERT_BOOKING_URL]"],
  lead_magnet_download: [],
};

/** Is a token's STRUCTURED field genuinely unanswered (a value OR an N/A sentinel both count as answered)? */
function tokenStructurallyUnanswered(
  token: string,
  content: Pick<LandingPageContent, "eventSchedule" | "price"> | null | undefined,
  coach: { bookingUrl?: string | null } | null | undefined,
): boolean {
  const es = content?.eventSchedule ?? {};
  switch (token) {
    case "[INSERT_EVENT_DATE]": return !clean(es.date);
    case "[INSERT_EVENT_TIME]": return !clean(es.time);
    case "[INSERT_EVENT_TIMEZONE]": return !clean(es.timezone);
    case "[INSERT_EVENT_VENUE]": return classifyLocation(es.venue).status === "unanswered";
    case "[INSERT_PRICE]": return classifyPrice(content?.price).status === "unanswered";
    case "[INSERT_BOOKING_URL]": return classifyBooking(coach?.bookingUrl).status === "unanswered";
    default: return true;
  }
}

export interface OperatorQuestion {
  token: string;
  key: string;
  question: string;
  category: TokenCategory;
  scope: WriteScope;
  /** The UI control the intake renders (item 3). "text" for anything without a structured control. */
  inputType: OperatorInputType;
  /** N/A answer-branches → the chips ("It's free" → __FREE__). Empty for fields with no N/A. */
  naBranches: { sentinel: string; label: string }[];
  /** false → not in the registry: a stray token the generator slipped through (generic "fill this in"). */
  known: boolean;
}

/** Stable ask order: the gating facts first, then optional nudges; unknown stray tokens last. */
const QUESTION_ORDER = [
  "[INSERT_EVENT_DATE]", "[INSERT_EVENT_TIME]", "[INSERT_EVENT_TIMEZONE]", "[INSERT_EVENT_VENUE]",
  "[INSERT_PRICE]", "[INSERT_BOOKING_URL]",
];

function collectBakedTokens(node: unknown, out: Set<string>): void {
  if (typeof node === "string") {
    const m = node.match(/\[INSERT_[A-Z_0-9]+\]/g);
    if (m) for (const t of m) out.add(t);
  } else if (Array.isArray(node)) {
    for (const n of node) collectBakedTokens(n, out);
  } else if (node && typeof node === "object") {
    for (const k in node as any) collectBakedTokens((node as any)[k], out);
  }
}

/**
 * The token-driven question list for one page: the operator tokens it actually needs, each with its
 * Zappy question + N/A branches, ordered gating-first. Excludes auto-fill tokens (filled server-side).
 * A baked token that isn't in the registry still surfaces (known:false) so the generic fail-safe asks it.
 */
export function deriveOperatorQuestions(
  pageType: string | null | undefined,
  content: LandingPageContent | null | undefined,
  coach: { bookingUrl?: string | null } | null | undefined,
): OperatorQuestion[] {
  const needed = new Set<string>();
  // (1) baked copy tokens actually present in the content
  collectBakedTokens(content ?? {}, needed);
  // (2) per-pageType structured holds whose field is unanswered
  for (const token of PAGETYPE_REQUIRED_TOKENS[pageType ?? ""] ?? []) {
    if (tokenStructurallyUnanswered(token, content, coach)) needed.add(token);
  }

  const questions: OperatorQuestion[] = [];
  for (const token of Array.from(needed)) {
    const spec = OPERATOR_TOKEN_REGISTRY[token];
    if (spec?.category === "auto-fill") continue; // never asked — filled from data ZAP already has
    if (!spec) {
      questions.push({ token, key: token, question: `This page has a blank: what should go where it says ${token}?`, category: "nudge", scope: "copy-only", inputType: "text", naBranches: [], known: false });
      continue;
    }
    // Price branches are pageType-aware: "It's free" only where free is a real answer (an event — a free
    // webinar is normal). A sales page sells something, so free is a contradiction the coach shouldn't
    // have to resolve → only "By application" (or a typed price). Other N/A fields pass their branches through.
    let na = spec.na ?? [];
    if (token === "[INSERT_PRICE]") {
      na = na.filter((n) =>
        pageType === "event_registration" ? n.sentinel === NA_SENTINEL.FREE
        : pageType === "sales_page" ? n.sentinel === NA_SENTINEL.BY_APPLICATION
        : true,
      );
    }
    questions.push({
      token, key: spec.key, question: spec.question, category: spec.category, scope: spec.scope,
      inputType: spec.inputType ?? "text",
      naBranches: na.map((n) => ({ sentinel: n.sentinel, label: n.label })), known: true,
    });
  }

  // Order: gating (QUESTION_ORDER) → other hard-hold → nudge → unknown; stable within group.
  const rank = (q: OperatorQuestion) => {
    const i = QUESTION_ORDER.indexOf(q.token);
    if (i >= 0) return i;
    if (!q.known) return 900;
    return q.category === "hard-hold" ? 100 : 500;
  };
  return questions.sort((a, b) => rank(a) - rank(b));
}

// ── EDIT FLOW — "change my answer" (re-answer an already-answered operator field) ────────────────────
// The first answer replaced the [INSERT_*] token with the value, so the token is GONE — a re-answer can't
// find it. To CHANGE an answered field we substitute the OLD copy text → the NEW copy text (computed from
// the old structured value + the new answer via the same resolveOperatorToken path), and re-set the
// structured field. Same resolve path as the first answer → never a partial update, never fabrication.

const FIELD_LABELS: Record<string, string> = {
  "[INSERT_EVENT_DATE]": "Event date", "[INSERT_EVENT_TIME]": "Start time", "[INSERT_EVENT_TIMEZONE]": "Timezone",
  "[INSERT_EVENT_VENUE]": "Location", "[INSERT_PRICE]": "Price", "[INSERT_BOOKING_URL]": "Booking",
};

/** A friendly display of a structured value/sentinel for the edit list ("__ONLINE__" → "Online"). */
function friendlyValue(token: string, structuredValue: string): string {
  const v = clean(structuredValue);
  const na = OPERATOR_TOKEN_REGISTRY[token]?.na?.find((n) => n.sentinel === v);
  return na ? na.label : v;
}

export interface AnsweredOperatorField {
  token: string;
  key: string;
  label: string;
  /** Human-readable current answer ("Dubai", "Online", "By email", "Free"). */
  current: string;
  /** The UI control the edit surface renders (item 3) — so editing later matches the intake control. */
  inputType: OperatorInputType;
  /** N/A branches (chips) so the coach can re-answer as an N/A too. */
  naBranches: { sentinel: string; label: string }[];
}

/**
 * The operator fields this page has ALREADY answered — what the coach can re-open and change. Mirrors
 * deriveOperatorQuestions but for ANSWERED fields (a value OR an N/A sentinel present in the structured
 * field). Auto-fill and copy-only tokens are excluded (only the hard-hold operator facts are editable).
 */
export function deriveAnsweredOperatorFields(
  pageType: string | null | undefined,
  content: LandingPageContent | null | undefined,
  coach: { bookingUrl?: string | null } | null | undefined,
): AnsweredOperatorField[] {
  const es = content?.eventSchedule ?? {};
  const currentOf = (token: string): string => {
    switch (token) {
      case "[INSERT_EVENT_DATE]": return clean(es.date);
      case "[INSERT_EVENT_TIME]": return clean(es.time);
      case "[INSERT_EVENT_TIMEZONE]": return clean(es.timezone);
      case "[INSERT_EVENT_VENUE]": return clean(es.venue);
      case "[INSERT_PRICE]": return clean(content?.price?.amount);
      case "[INSERT_BOOKING_URL]": return clean(coach?.bookingUrl);
      default: return "";
    }
  };
  const out: AnsweredOperatorField[] = [];
  for (const token of PAGETYPE_REQUIRED_TOKENS[pageType ?? ""] ?? []) {
    const cur = currentOf(token);
    if (!cur) continue; // unanswered → it's a QUESTION, not an editable field
    const spec = OPERATOR_TOKEN_REGISTRY[token];
    // Price branches are pageType-aware (same rule as the questions): free only on events, etc.
    let na = spec?.na ?? [];
    if (token === "[INSERT_PRICE]") {
      na = na.filter((n) => pageType === "event_registration" ? n.sentinel === NA_SENTINEL.FREE : pageType === "sales_page" ? n.sentinel === NA_SENTINEL.BY_APPLICATION : true);
    }
    out.push({
      token, key: spec?.key ?? token, label: FIELD_LABELS[token] ?? spec?.key ?? token,
      current: friendlyValue(token, cur), inputType: spec?.inputType ?? "text",
      naBranches: na.map((n) => ({ sentinel: n.sentinel, label: n.label })),
    });
  }
  return out;
}

/**
 * Re-answer an already-answered field. `oldStructuredValue` is the field's CURRENT stored value/sentinel.
 * Runs the new answer through the full resolve path (structured field + copy) AND replaces the OLD copy
 * text with the NEW copy text across the prose (because the original token was already consumed by the
 * first answer). No prior value → identical to a first answer. Pure; returns new content + any coach column.
 */
export function reapplyOperatorAnswer(
  content: LandingPageContent,
  token: string,
  oldStructuredValue: string | null | undefined,
  newAnswer: string,
): AppliedAnswer {
  const applied = applyOperatorAnswer(content, token, newAnswer); // re-sets the structured field (+ token no-op if already consumed)
  const oldClean = clean(oldStructuredValue);
  if (!oldClean) return applied; // first answer — nothing to replace
  const oldCopy = resolveOperatorToken(token, oldClean).copy.text;
  const newCopy = applied.resolution.copy.text;
  if (oldCopy && oldCopy !== newCopy) {
    return { ...applied, content: substituteTokenDeep(applied.content, oldCopy, newCopy) };
  }
  return applied;
}
