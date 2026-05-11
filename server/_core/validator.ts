/**
 * Post-generation validator — Phase 1 (Sprint B+1 path d, 2026-05-11).
 *
 * Architectural pivot from in-prompt rule pasting to post-generation
 * validation + retry-with-fail-context. The root cause of the 4-day
 * intermittent welcome-failure class (May 7-11) is Anthropic tool-use's
 * descriptive-not-strict input_schema enforcement: Sonnet 4.6 sometimes
 * emits `emails` as a string instead of an array, and the OpenAI-style
 * `strict: true` flag is ignored by Anthropic. This validator catches
 * shape failures post-LLM-call and builds explicit fail-context messages
 * that get injected into the next retry's user prompt so the LLM has
 * specific information about what was wrong with its previous output.
 *
 * Phase 1 scope: SHAPE validation only (email sequence). Phase 2 will add
 * fabrication-pattern checks (NO_RESEARCH_STATISTIC, PROOF_COMPOSITIONAL_
 * CEILING, GUARANTEE_TERMS misuse, COHORT canonical drift) on top of the
 * same retry-with-fail-context plumbing.
 *
 * The defensive un-stringification logic for sub-cases 1 + 2 lives here
 * too — keeps shape recovery and shape validation in one place. Sub-case
 * 3 (truncated / malformed string that won't parse even after Python-dict
 * conversion) is not recoverable by parser hardening; it returns
 * ok: false with a preview-bearing failContext that prompts the LLM to
 * retry with a literal array.
 */

export interface RawEmailFields {
  day?: number;
  subject?: string;
  previewText?: string;
  body?: string;
  cta?: string;
  ps?: string;
}

export type EmailShapeValidatorResult =
  | { ok: true; emails: RawEmailFields[] }
  | { ok: false; failContext: string; subCase: string };

/**
 * Validate + extract emails array from a parsed LLM response.
 *
 * Handles defensive un-stringification of:
 *   - Sub-case 1 (Sprint B regression-fix v2): valid JSON-encoded array
 *     string. JSON.parse recovers directly.
 *   - Sub-case 2 (Sprint B+1 regression-fix v1): Python-dict single-quote
 *     object literal. Guarded property-name + value-string conversion
 *     recovers.
 *
 * Returns ok: true with extracted emails if recovery succeeds; ok: false
 * with a specific failContext message designed for next-retry injection
 * if shape is irrecoverable.
 *
 * Shape requirements (Phase 1):
 *   - Root parsed value must be an object (or an array — legacy shape).
 *   - Must have an emails field, OR be an array (treated as emails).
 *   - emails must be an array (after un-stringification if string).
 *   - Array must be non-empty.
 *   - Each item must be an object with day, subject, body fields populated.
 *
 * Phase 2 will compose additional content-pattern checks on top of this
 * shape gate.
 */
export function validateEmailSequenceShape(parsed: unknown): EmailShapeValidatorResult {
  // 1. Root must be an object or an array.
  if (parsed == null || typeof parsed !== "object") {
    return {
      ok: false,
      subCase: "non_object_root",
      failContext: `Your previous response was not a JSON object (parsed as ${typeof parsed}). Return a JSON object with an "emails" key whose value is an array of email objects.`,
    };
  }

  // 2. Extract emails candidate. Legacy shape: root is the array directly.
  let emailsCandidate: unknown = Array.isArray(parsed)
    ? parsed
    : (parsed as Record<string, unknown>).emails;

  // 3. emails field present?
  if (emailsCandidate === undefined) {
    const topKeys = Object.keys(parsed as Record<string, unknown>);
    return {
      ok: false,
      subCase: "emails_field_missing",
      failContext: `Your previous response had top-level keys [${topKeys.join(", ")}] but did not include an "emails" key. Return a JSON object with an "emails" key whose value is an array of email objects.`,
    };
  }

  // 4. If emails is a string, attempt defensive un-stringification.
  if (typeof emailsCandidate === "string") {
    const recovered = tryUnstringifyEmails(emailsCandidate);
    if (recovered === null) {
      const preview = emailsCandidate.slice(0, 200);
      return {
        ok: false,
        subCase: "emails_string_unrecoverable",
        failContext: `Your previous response had "emails" as a string value (preview: ${preview}${emailsCandidate.length > 200 ? "..." : ""}), not as a JSON array literal. CRITICAL: output the emails field as a literal JSON array of email objects, like this: {"emails": [{"day": 1, "subject": "...", "previewText": "...", "body": "...", "cta": "...", "ps": "..."}, ...]}. Do NOT stringify the array. Do NOT use Python-dict-style single quotes — use proper JSON double quotes throughout.`,
      };
    }
    emailsCandidate = recovered;
  }

  // 5. Must be array.
  if (!Array.isArray(emailsCandidate)) {
    return {
      ok: false,
      subCase: "emails_wrong_type",
      failContext: `Your previous response had "emails" as a ${typeof emailsCandidate} value, not as an array. Return "emails" as an array of email objects.`,
    };
  }

  // 6. Array must be non-empty.
  if (emailsCandidate.length === 0) {
    return {
      ok: false,
      subCase: "emails_empty_array",
      failContext: `Your previous response returned an empty emails array. The sequence requires at least one email — produce the full sequence per the instructions.`,
    };
  }

  // 7. Each item must be an object with required fields populated.
  for (let i = 0; i < emailsCandidate.length; i++) {
    const item = emailsCandidate[i];
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
      return {
        ok: false,
        subCase: "email_item_not_object",
        failContext: `Email at index ${i} in your previous response was not an object (was ${item === null ? "null" : Array.isArray(item) ? "array" : typeof item}). Each email must be a JSON object with day, subject, previewText, body, cta, and ps fields.`,
      };
    }
    const obj = item as Record<string, unknown>;
    const requiredKeys: Array<keyof RawEmailFields> = ["day", "subject", "body"];
    const missing = requiredKeys.filter(k => {
      const v = obj[k];
      return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    });
    if (missing.length > 0) {
      return {
        ok: false,
        subCase: "email_item_missing_required",
        failContext: `Email at index ${i} in your previous response was missing required field(s): ${missing.join(", ")}. Each email must include day (number), subject (non-empty string), previewText (string), body (non-empty string), cta (string), and ps (string).`,
      };
    }
  }

  return { ok: true, emails: emailsCandidate as RawEmailFields[] };
}

/**
 * Defensive un-stringification of an emails-as-string value.
 *
 * Sub-case 1 (Sprint B regression-fix v2): valid JSON-encoded array
 *   string. Returns the parsed array directly.
 * Sub-case 2 (Sprint B+1 regression-fix v1): Python-dict single-quote
 *   object literal. Guarded property-name + value-string conversion
 *   recovers. Guard requires the string to LOOK like a single-quoted
 *   dict (starts with [ or { and contains a single-quoted word-char key)
 *   before attempting conversion — avoids touching strings with
 *   legitimate apostrophes.
 *
 * Returns the recovered array if either sub-case is handleable, or null
 * if the string is irrecoverable (sub-case 3: truncated / malformed /
 * unescaped inner quotes / mixed quoting). The caller (validator) builds
 * an explicit failContext on null return.
 */
function tryUnstringifyEmails(raw: string): unknown[] | null {
  // Sub-case 1: valid JSON-encoded array string.
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v;
  } catch { /* fall through */ }

  // Sub-case 2: Python-dict single-quote object literal.
  const looksLikePyDict = /^\s*[\[{].*?'[a-zA-Z_]\w*'\s*:/.test(raw);
  if (looksLikePyDict) {
    const converted = raw
      .replace(/'(\w+)'\s*:/g, '"$1":')
      .replace(/:\s*'([^']*)'/g, ': "$1"');
    try {
      const v = JSON.parse(converted);
      if (Array.isArray(v)) return v;
    } catch { /* fall through */ }
  }

  return null;
}
