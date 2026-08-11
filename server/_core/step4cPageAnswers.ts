/**
 * step4cPageAnswers.ts — the canned operator answers that let the 4c THROWAWAY landing page
 * clear its own publish gate, plus the assertion that proves it did.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────
 *
 * The 2026-08-10 `--publish` attempt died at `runLandingPagePublish` with
 * *"Landing page has 1 unfilled placeholder: [INSERT_PRICE]"* — before a single Graph call, so
 * nothing reached the ad account. The gate (`landingPagePublisher.ts`) scans the RENDERED HTML
 * for `[INSERT_*]` and throws.
 *
 * 🔑 **Seeding `placeholderValues` would NOT have fixed it.** That registry is read at the Meta
 * and GHL export points (`buildResolvedMap`), and the landing-page publisher never consults it.
 * The only thing that clears a token on a PAGE is writing the answer INTO the stored content —
 * which is what the coach-facing operator intake does through `applyOperatorAnswer`. So the
 * harness answers the page's questions through that exact same function rather than patching
 * JSON behind its back: a test-only shortcut would prove the page publishes under conditions no
 * coach ever reaches.
 *
 * ── WHY A TABLE AND NOT A HARDCODED PRICE ───────────────────────────────────────────────────
 *
 * The run failed on ONE token, but the generator can bake others (venue, booking URL, a
 * credential line), and the publisher throws a SECOND, separate error for unanswered structured
 * fields. Hardcoding the price buys exactly one more attempt. Asking the page what it needs and
 * answering everything buys all of them.
 *
 * ⚠️ **NEVER an N/A sentinel.** `__FREE__` is a real coach answer that changes which template
 * renders (free Iman vs paid Hormozi), so a harness that answered "free" would be silently
 * testing a different page from the one a paying campaign ships. `assertNoSentinelAnswers`
 * enforces that at module level, not by convention.
 *
 * Pure and dependency-free, so every rule here is exercised with fakes.
 */

/** An N/A sentinel, e.g. `__FREE__` — a real coach answer, and never a harness answer. */
const SENTINEL_RE = /^__[A-Z_]+__$/;

/** Any operator token, in the exact shape the publish gate scans for. */
export const OPERATOR_TOKEN_RE = /\[INSERT_[A-Z_0-9]+\]/g;

/**
 * The canned answers, keyed by token. Values are plausible, concrete and consistent with the
 * throwaway brief (an operations-consulting retainer offer) — a page answered with nonsense
 * would still publish, but it would also be scanned by Meta at review time, so it is written to
 * read like a real page.
 *
 * 📌 The price is a REAL amount in the ad account's own currency. It is not `__FREE__` and not
 * `__BY_APPLICATION__`: both are legitimate coach answers that route the page differently, and
 * the run is meant to exercise the ordinary paid case.
 */
export const CANNED_OPERATOR_ANSWERS: Readonly<Record<string, string>> = Object.freeze({
  // Structured, hard-hold — these also write their dot-path field (price.amount, eventSchedule.*).
  "[INSERT_PRICE]": "AED 4,500",
  "[INSERT_EVENT_DATE]": "September 24, 2026",
  "[INSERT_EVENT_TIME]": "11:00 am",
  "[INSERT_EVENT_TIMEZONE]": "GST",
  "[INSERT_EVENT_VENUE]": "Live online",
  "[INSERT_BOOKING_URL]": "https://zapcampaigns.com/p/zz-4c-throwaway-booking",
  // Copy-only, hard-hold.
  "[INSERT_COACH_CREDENTIAL]": "18 years redesigning consulting engagements",
  // Copy-only nudges — answered rather than skipped, because a skip leaves prose the gate is
  // happy with but a human would not be, and this page is read by Meta's reviewer.
  "[INSERT_REPLAY_AVAILABILITY]": "yes, the replay is available for 48 hours",
  "[INSERT_EVENT_AGENDA]": "scoping the retainer, pricing it, and the first client conversation",
  "[INSERT_BOOKING_DURATION]": "30 minutes",
  "[INSERT_BOOKING_TIME]": "weekday mornings",
  "[INSERT_ROOM_OR_FLOOR_INFO]": "joining details are emailed on registration",
  "[INSERT_PARKING_INFO]": "not applicable — this session runs online",
  "[INSERT_DRESS_CODE]": "come as you are",
  "[INSERT_DIETARY_NOTES]": "not applicable — this session runs online",
  // Auto-fill tokens. The registry marks these "never asked of the coach", but NOTHING on the
  // server actually fills them, so one baked into the copy would survive every intake answer and
  // trip the publish gate. The harness answers them itself rather than discovering that at the
  // gate for a second time.
  "[INSERT_HOST_NAME]": "the ZAP team",
  "[INSERT_EVENT_NAME]": "The Scope-First Session",
  "[INSERT_LEAD_MAGNET_NAME]": "The Scope-First Sequence",
});

/**
 * The generic fallback for a token with no canned answer — a stray the generator invented.
 *
 * It is deliberately a HEDGE and never an invented specific: the harness has no idea what a
 * token it has never seen is asking for, and a made-up date or number on a page Meta reviews is
 * the fabrication class this project spends most of its gates preventing. "confirmed by email"
 * reads as prose, clears the token, and claims nothing.
 */
export const GENERIC_FALLBACK_ANSWER = "confirmed by email";

export type PlannedAnswer = {
  token: string;
  answer: string;
  /** "canned" — a table hit. "fallback" — an unrecognised token got the hedge. */
  source: "canned" | "fallback";
};

/** Every distinct operator token present anywhere in a content object, in first-seen order. */
export function collectTokens(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") {
    const found = node.match(OPERATOR_TOKEN_RE);
    if (found) for (const t of found) if (!out.includes(t)) out.push(t);
  } else if (Array.isArray(node)) {
    for (const n of node) collectTokens(n, out);
  } else if (node && typeof node === "object") {
    for (const k of Object.keys(node as Record<string, unknown>)) {
      collectTokens((node as Record<string, unknown>)[k], out);
    }
  }
  return out;
}

/** The answer for one token: the table, else the hedge. */
export function cannedAnswerFor(token: string): PlannedAnswer {
  const hit = CANNED_OPERATOR_ANSWERS[token];
  return hit
    ? { token, answer: hit, source: "canned" }
    : { token, answer: GENERIC_FALLBACK_ANSWER, source: "fallback" };
}

/**
 * The answer plan for one page: the union of the tokens BAKED IN THE COPY and the tokens the
 * page's own question-deriver asks for.
 *
 * Both halves are needed and neither subsumes the other. A structured hold (an unanswered sales
 * price) is asked for without any token being present in the prose; an auto-fill token is baked
 * in the prose and deliberately never asked. Answering only one half leaves the other to the
 * publish gate, which is precisely the failure this fixes.
 */
export function planOperatorAnswers(
  bakedTokens: readonly string[],
  askedTokens: readonly string[],
): PlannedAnswer[] {
  const seen = new Set<string>();
  const plan: PlannedAnswer[] = [];
  for (const token of [...bakedTokens, ...askedTokens]) {
    if (!token || seen.has(token)) continue;
    seen.add(token);
    plan.push(cannedAnswerFor(token));
  }
  return plan;
}

/**
 * A harness answer must never be an N/A sentinel. Asserted over the whole table at plan time so
 * a future edit that types `__FREE__` into the price fails loudly here instead of quietly
 * publishing a different template.
 */
export function assertNoSentinelAnswers(plan: readonly PlannedAnswer[]): void {
  const offenders = plan.filter((p) => SENTINEL_RE.test(p.answer.trim()));
  if (offenders.length > 0) {
    throw new Error(
      `REFUSING to answer with an N/A sentinel: ${offenders.map((o) => `${o.token}=${o.answer}`).join(", ")}. ` +
      `A sentinel is a real coach answer that routes the page to a DIFFERENT template — the harness ` +
      `must answer with an ordinary value so the run exercises the ordinary paid page.`,
    );
  }
  const empty = plan.filter((p) => p.answer.trim() === "");
  if (empty.length > 0) {
    throw new Error(
      `REFUSING to answer ${empty.map((e) => e.token).join(", ")} with an empty string: the token would ` +
      `vanish from the prose leaving a gap, and the structured field would read as unanswered.`,
    );
  }
}

/**
 * THE PROOF THAT FIX 1 WORKED, run against the RENDERED page rather than the stored content.
 *
 * The stored content clearing is necessary but not sufficient — the gate scans HTML, and a
 * template can emit a token of its own for a structured field it considers unanswered. So the
 * harness re-renders and asserts on the same string the publisher will scan, and stops the run
 * here rather than letting `runLandingPagePublish` discover it after more work.
 */
export function assertNoOperatorTokens(rendered: string, where: string): void {
  const found = rendered.match(OPERATOR_TOKEN_RE);
  if (!found || found.length === 0) return;
  const unique = Array.from(new Set(found));
  throw new Error(
    `STOP — ${where} still carries ${unique.length} unfilled operator token${unique.length === 1 ? "" : "s"}: ` +
    `${unique.join(", ")}. The publish gate would reject this page. Add the token to ` +
    `CANNED_OPERATOR_ANSWERS in step4cPageAnswers.ts rather than loosening the gate.`,
  );
}
