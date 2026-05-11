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

// ─── Phase 2: WhatsApp sequence shape validator ────────────────────────────────
// Mirrors validateEmailSequenceShape architecture. Required item fields differ
// (day, message, cta vs day, subject, body) per the WHATSAPP_SEQUENCE_RESPONSE_
// FORMAT schema. Some WA generator variants emit `text` as a legacy alias for
// `message` — both are accepted as valid (RawWhatsappMessageFields has both).

export interface RawWhatsappMessageFields {
  day?: number;
  message?: string;
  text?: string;
  cta?: string;
}

export type WhatsappShapeValidatorResult =
  | { ok: true; messages: RawWhatsappMessageFields[] }
  | { ok: false; failContext: string; subCase: string };

export function validateWhatsappSequenceShape(parsed: unknown): WhatsappShapeValidatorResult {
  if (parsed == null || typeof parsed !== "object") {
    return {
      ok: false,
      subCase: "non_object_root",
      failContext: `Your previous response was not a JSON object (parsed as ${typeof parsed}). Return a JSON object with a "messages" key whose value is an array of WhatsApp message objects.`,
    };
  }

  let messagesCandidate: unknown = Array.isArray(parsed)
    ? parsed
    : (parsed as Record<string, unknown>).messages;

  if (messagesCandidate === undefined) {
    const topKeys = Object.keys(parsed as Record<string, unknown>);
    return {
      ok: false,
      subCase: "messages_field_missing",
      failContext: `Your previous response had top-level keys [${topKeys.join(", ")}] but did not include a "messages" key. Return a JSON object with a "messages" key whose value is an array of message objects.`,
    };
  }

  // Defensive un-stringification — same sub-cases 1 + 2 logic as email helper.
  if (typeof messagesCandidate === "string") {
    const recovered = tryUnstringifyArray(messagesCandidate);
    if (recovered === null) {
      const preview = messagesCandidate.slice(0, 200);
      return {
        ok: false,
        subCase: "messages_string_unrecoverable",
        failContext: `Your previous response had "messages" as a string value (preview: ${preview}${messagesCandidate.length > 200 ? "..." : ""}), not as a JSON array literal. CRITICAL: output the messages field as a literal JSON array of message objects, like this: {"messages": [{"day": 0, "message": "...", "cta": "..."}, ...]}. Do NOT stringify the array. Do NOT use Python-dict-style single quotes — use proper JSON double quotes throughout.`,
      };
    }
    messagesCandidate = recovered;
  }

  if (!Array.isArray(messagesCandidate)) {
    return {
      ok: false,
      subCase: "messages_wrong_type",
      failContext: `Your previous response had "messages" as a ${typeof messagesCandidate} value, not as an array. Return "messages" as an array of message objects.`,
    };
  }

  if (messagesCandidate.length === 0) {
    return {
      ok: false,
      subCase: "messages_empty_array",
      failContext: `Your previous response returned an empty messages array. The sequence requires at least one message — produce the full sequence per the instructions.`,
    };
  }

  for (let i = 0; i < messagesCandidate.length; i++) {
    const item = messagesCandidate[i];
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
      return {
        ok: false,
        subCase: "message_item_not_object",
        failContext: `Message at index ${i} in your previous response was not an object (was ${item === null ? "null" : Array.isArray(item) ? "array" : typeof item}). Each message must be a JSON object with day, message (or text), and cta fields.`,
      };
    }
    const obj = item as Record<string, unknown>;
    // Either `message` or `text` satisfies the body requirement.
    const hasBody = (typeof obj.message === "string" && obj.message.trim() !== "")
      || (typeof obj.text === "string" && obj.text.trim() !== "");
    const dayOk = obj.day !== undefined && obj.day !== null;
    if (!hasBody || !dayOk) {
      const missing: string[] = [];
      if (!dayOk) missing.push("day");
      if (!hasBody) missing.push("message");
      return {
        ok: false,
        subCase: "message_item_missing_required",
        failContext: `Message at index ${i} in your previous response was missing required field(s): ${missing.join(", ")}. Each message must include day (number) and message (non-empty string).`,
      };
    }
  }

  return { ok: true, messages: messagesCandidate as RawWhatsappMessageFields[] };
}

/** Internal shape-recovery helper shared by email + WhatsApp shape validators. */
function tryUnstringifyArray(raw: string): unknown[] | null {
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v;
  } catch { /* fall through */ }

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

// ─── Phase 2: Fabrication-pattern catalog ──────────────────────────────────────
// Pattern catalog seeded from kit 11 + kit 13 audit evidence (Sprint B+1
// validator-build-window investigation). Each entry is a regex with a human
// description for failContext + a class label for log/diagnostic correlation.
// Patterns marked TOKEN_OVERRIDABLE skip when their canonical operator-fill
// token appears in the same body — the LLM is using the anchoring correctly,
// not fabricating.
//
// Class-by-class rationale:
//
// - FAMILY_COMPOSITION: kit 11 evidence — "with a 10-month-old", "with a partner
//   on shift work". Composite proofs should anchor on role + situation, not
//   biographical scaffolding (PROOF_COMPOSITIONAL_CEILING_RULE class).
// - PARTNER_SPECIFICS: kit 11 evidence — "a partner on shift work".
// - EMPLOYER_SPECIFICS: anticipated based on rule scope — "at Big-4", "at Y
//   Combinator". Not yet observed in audited kits, but rule covers it.
// - DIRECT_QUOTED_SPEECH: kit 11 evidence — "she told me X". Composite
//   testimony framed as attributed dialogue.
// - INVENTED_TENURE: kit 13 WA Msg 2 evidence — "twelve years of domain
//   depth". Years-of-experience claims with no operator-supplied basis
//   (NO_CREDENTIAL_FABRICATION_RULE class).
// - PROGRAMME_DURATION_DRIFT: kit 13 WA Msg 2 evidence — "inside eight
//   weeks of The Calm Authority's Boardroom Pressure Calibration Protocol",
//   despite service.description being a 60-min keynote + 90-min workshop.
//   TOKEN_OVERRIDABLE on [INSERT_PROGRAMME_DURATION].
// - NAMED_RESEARCH_SOURCE: kit 11 evidence (LP) — closed there by
//   NO_RESEARCH_STATISTIC_FABRICATION_RULE. Phase 2 extends coverage to
//   email + WA + LP testimonials so any leakage is also caught.
// - X_OF_Y_DEMOGRAPHIC: kit 11 evidence — "fewer than 1 in 8".

export type FabricationClass =
  | "family_composition"
  | "partner_specifics"
  | "employer_specifics"
  | "direct_quoted_speech"
  | "invented_tenure"
  | "programme_duration_drift"
  | "named_research_source"
  | "x_of_y_demographic";

interface PatternDef {
  pattern: RegExp;
  classId: FabricationClass;
  description: string;
  tokenOverrideAnyOf?: string[]; // if any of these substrings is in body, skip
}

const FABRICATION_PATTERNS: PatternDef[] = [
  // FAMILY_COMPOSITION
  {
    pattern: /\bwith\s+(?:a|her|his|their)\s+\d+-?(?:month|year)-old\b/i,
    classId: "family_composition",
    description: "Invented family composition (specific child age) — composite proofs must anchor on role + situation only, never biographical scaffolding.",
  },
  {
    pattern: /\bwith\s+(?:\d+|two|three|four|five|six)\s+(?:kids|children|babies)\s+under\s+\d+\b/i,
    classId: "family_composition",
    description: "Invented family composition (children count + age) — composite proofs must anchor on role + situation only.",
  },
  {
    pattern: /\bnewly\s+(?:single|divorced|married|widowed|separated|engaged)\b/i,
    classId: "family_composition",
    description: "Invented relationship status for composite — anchor on role + situation only.",
  },

  // PARTNER_SPECIFICS
  {
    pattern: /\b(?:a partner|a spouse|her partner|his partner|their partner)\s+(?:on|in|at|working|doing)\s+(?:shift|night|long|extended|the\s+)/i,
    classId: "partner_specifics",
    description: "Invented partner profession or schedule — composite proofs do not include partner specifics.",
  },

  // EMPLOYER_SPECIFICS
  {
    pattern: /\bat\s+(?:a\s+)?(?:Big[- ]4|FAANG|MAANG|Y[\s-]*Combinator|Fortune[\s-]*500|Series\s+[A-D])\b/i,
    classId: "employer_specifics",
    description: "Invented employer specifics — composite proofs anchor on role + niche context only, not specific firm class.",
  },

  // DIRECT_QUOTED_SPEECH (composite proofs)
  {
    pattern: /\b(?:she|he|they)\s+(?:told\s+me|said\s+to\s+me|whispered|admitted|confessed|explained\s+to\s+me)\b/i,
    classId: "direct_quoted_speech",
    description: "Direct quoted speech attributed to anonymised composite — composites cannot speak in dialogue; describe their situation instead.",
  },

  // INVENTED_TENURE
  {
    pattern: /\b(?:\d+|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\+?[\s-]+years?\s+(?:of|in)\s+(?:domain\s+depth|experience|industry|working|practice|leading|building)\b/i,
    classId: "invented_tenure",
    description: "Invented years-of-experience claim — do not assign specific tenure to anonymised composites or to the host without operator-supplied verification.",
  },
  {
    pattern: /\b(?:after|with|over)\s+(?:\d+|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\+?\s+years\s+(?:working|coaching|consulting|leading|in\s+the)\b/i,
    classId: "invented_tenure",
    description: "Invented years-of-experience framing — do not assign specific tenure without operator-supplied verification.",
  },
  {
    // Bare "for N years" tenure claim — covers kit 13 LP testimonial shape:
    // "I have been presenting to boards for eleven years". The previous two
    // patterns required specific tenure-context nouns/verbs; this catches
    // the general "for [number] years" structure when N is a real tenure
    // word-form (avoids false positives on small numbers like "for 2 hours").
    pattern: /\bfor\s+(?:five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|\d+)\s+years\b/i,
    classId: "invented_tenure",
    description: "Bare \"for N years\" tenure claim — composite testimonials should not specify duration of professional experience.",
  },

  // PROGRAMME_DURATION_DRIFT (token-overridable)
  {
    pattern: /\b(?:inside|over|across|within|after|during)\s+(?:\d+|three|four|five|six|seven|eight|nine|ten|eleven|twelve|sixteen)[\s-]?(?:weeks?|months?)\s+of\s+(?:the\s+|this\s+|our\s+|my\s+)?[A-Z]/i,
    classId: "programme_duration_drift",
    description: "Invented programme duration. Use the [INSERT_PROGRAMME_DURATION] token instead — do not specify a number of weeks/months without operator-supplied verification.",
    tokenOverrideAnyOf: ["[INSERT_PROGRAMME_DURATION]"],
  },
  {
    pattern: /\b(?:\d+|three|four|five|six|seven|eight|nine|ten|eleven|twelve|sixteen)[\s-]?(?:week|month)[\s-](?:programme|program|course|cohort|coaching|sprint|engagement|protocol)\b/i,
    classId: "programme_duration_drift",
    description: "Invented programme length descriptor (e.g. \"12-week programme\"). Use [INSERT_PROGRAMME_DURATION] token instead.",
    tokenOverrideAnyOf: ["[INSERT_PROGRAMME_DURATION]"],
  },

  // NAMED_RESEARCH_SOURCE — extending NO_RESEARCH_STATISTIC_FABRICATION_RULE
  // from LP to email + WA + LP testimonials.
  {
    pattern: /\b(?:Harvard|Stanford|MIT|Princeton|Yale|Oxford|Cambridge|Gallup|Pew|McKinsey|Deloitte|BCG|Bain|Forbes|HBR|Wharton|INSEAD)\s+(?:study|research|survey|report|data|paper|finds?|shows?|indicates?|tells?\s+us)\b/i,
    classId: "named_research_source",
    description: "Invented research-source attribution — do not cite named institutions or publications without operator-supplied verification.",
  },
  {
    pattern: /\b(?:research|studies|the\s+science|the\s+data|neuroscience|behavioural\s+science|psychology)\s+(?:shows?|finds?|tells?\s+us|indicates?|says?|confirms?)\b/i,
    classId: "named_research_source",
    description: "Research-shaped attribution without operator-supplied source. Use first-person experiential framing (\"many of the people I work with\") or explicit hypothetical framing (\"imagine you're someone who\") instead.",
  },

  // X_OF_Y_DEMOGRAPHIC
  {
    pattern: /\b(?:fewer than|less than|only|nearly|almost|over|more than)\s+\d+\s+in\s+\d+\s+(?:people|adults|women|men|professionals|leaders|founders|coaches|workers|parents|consultants|clients)\b/i,
    classId: "x_of_y_demographic",
    description: "Invented X-of-Y demographic ratio (\"1 in 8 women\") — do not fabricate population-level statistics.",
  },
  {
    pattern: /\b(?:above|over|nearly|almost|fewer than|less than)\s+\d+\s*%\s+of\s+(?:people|adults|women|men|professionals|leaders|founders|coaches|workers|parents|consultants|clients)\b/i,
    classId: "x_of_y_demographic",
    description: "Invented percentage of population — do not fabricate \"N% of [group]\" statistics.",
  },
];

export interface FabricationHit {
  classId: FabricationClass;
  description: string;
  matched: string;
  location: string; // e.g. "email[2].body" or "testimonial[0].quote"
}

export type FabricationCheckResult =
  | { ok: true }
  | { ok: false; failContext: string; hits: FabricationHit[] };

/** Internal — check a single body text for all patterns. */
function detectFabricationsInBody(body: string, location: string): FabricationHit[] {
  if (!body || typeof body !== "string") return [];
  const hits: FabricationHit[] = [];
  for (const pd of FABRICATION_PATTERNS) {
    // Token-presence override: skip if any override token is present in body.
    if (pd.tokenOverrideAnyOf?.some(tok => body.includes(tok))) continue;
    const m = body.match(pd.pattern);
    if (m) {
      hits.push({
        classId: pd.classId,
        description: pd.description,
        matched: m[0],
        location,
      });
    }
  }
  return hits;
}

/** Build a retry failContext message from hits — caps at top-N to keep retry prompt bounded. */
function buildFabricationFailContext(hits: FabricationHit[], maxHits = 3): string {
  if (hits.length === 0) return "";
  const top = hits.slice(0, maxHits);
  const lines = top.map(h => `- ${h.location}: matched "${h.matched}" — ${h.description}`);
  const more = hits.length > maxHits ? `\n(plus ${hits.length - maxHits} additional hit${hits.length - maxHits === 1 ? "" : "s"} not shown)` : "";
  return `Your previous response contained fabricated content that must not appear in published copy:\n${lines.join("\n")}${more}\n\nRegenerate the response with these specific phrasings removed. Use role + situational anchor only for composite proofs. Do not invent biographical scaffolding, tenure, programme duration, or research-source attributions. Where you would have referenced a duration, use the [INSERT_PROGRAMME_DURATION] token verbatim.`;
}

/** Email-sequence fabrication check. Reads each email's body, subject, previewText, and ps for patterns. */
export function validateEmailFabricationPatterns(emails: RawEmailFields[]): FabricationCheckResult {
  const allHits: FabricationHit[] = [];
  for (let i = 0; i < emails.length; i++) {
    const e = emails[i];
    if (e.body) allHits.push(...detectFabricationsInBody(e.body, `email[${i}].body`));
    if (e.subject) allHits.push(...detectFabricationsInBody(e.subject, `email[${i}].subject`));
    if (e.previewText) allHits.push(...detectFabricationsInBody(e.previewText, `email[${i}].previewText`));
    if (e.ps) allHits.push(...detectFabricationsInBody(e.ps, `email[${i}].ps`));
  }
  if (allHits.length === 0) return { ok: true };
  return { ok: false, hits: allHits, failContext: buildFabricationFailContext(allHits) };
}

/** WhatsApp-sequence fabrication check. Reads each message's message/text body. */
export function validateWhatsappFabricationPatterns(messages: RawWhatsappMessageFields[]): FabricationCheckResult {
  const allHits: FabricationHit[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const body = m.message || m.text || "";
    if (body) allHits.push(...detectFabricationsInBody(body, `message[${i}]`));
  }
  if (allHits.length === 0) return { ok: true };
  return { ok: false, hits: allHits, failContext: buildFabricationFailContext(allHits) };
}

/** Landing-page testimonials fabrication check. Reads each testimonial's quote + headline. */
export interface RawTestimonial {
  headline?: string;
  quote?: string;
  name?: string;
  location?: string;
}

export function validateLandingPageTestimonialsFabrication(testimonials: RawTestimonial[]): FabricationCheckResult {
  if (!Array.isArray(testimonials)) return { ok: true };
  const allHits: FabricationHit[] = [];
  for (let i = 0; i < testimonials.length; i++) {
    const t = testimonials[i];
    if (t.quote) allHits.push(...detectFabricationsInBody(t.quote, `testimonial[${i}].quote`));
    if (t.headline) allHits.push(...detectFabricationsInBody(t.headline, `testimonial[${i}].headline`));
  }
  if (allHits.length === 0) return { ok: true };
  return { ok: false, hits: allHits, failContext: buildFabricationFailContext(allHits) };
}
