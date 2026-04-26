/**
 * Schema-aware JSON-leak detector.
 *
 * Detects the LLM failure mode where a model emits valid-but-leaky JSON: a
 * string field's value contains substrings matching another field's key
 * syntax (`"<otherKey>":`), indicating the model accidentally escaped a
 * closing quote and continued writing what looked like the next field.
 * `JSON.parse` accepts this — the document is well-formed at the JSON level
 * — but the field's content is then a string containing literal JSON-like
 * syntax that, when rendered as plain text in the UI, displays leaked
 * downstream-field syntax inline.
 *
 * Why this works: schema field names are camelCase identifiers
 * (`mainHeadline`, `problemAgitation`, `quizSection`, ...) that do not
 * appear in normal English prose. A string value containing the substring
 * `"problemAgitation":` is essentially impossible in legitimate output.
 * False positive rate is effectively zero on the schemas this codebase
 * uses.
 *
 * INTENTIONALLY TEMPORARY — Option A only. Deleted in the same commit that
 * lands Option B (Anthropic tool-use migration in invokeClaudeAPI). Do not
 * build new dependencies on this module; it is a band-aid.
 */

export interface LeakDetectionResult {
  leaked: boolean;
  /** Top-level field whose value contains the leaked key syntax. */
  field?: string;
  /** The key-syntax pattern detected, e.g. `"headline":`. */
  pattern?: string;
}

/**
 * Walk `parsed` for top-level string fields. For each string value,
 * check whether it contains a substring matching `"<knownKey>":` for any
 * sibling field name in `knownKeys`. Returns the first leak found.
 *
 * `parsed` is treated leniently — non-objects and arrays return clean.
 * The detector is not a schema validator; it only flags the specific
 * leak pattern.
 */
export function detectJsonLeak(
  parsed: unknown,
  knownKeys: readonly string[],
): LeakDetectionResult {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { leaked: false };
  }
  const obj = parsed as Record<string, unknown>;
  for (const fieldName of knownKeys) {
    const value = obj[fieldName];
    if (typeof value !== "string") continue;
    for (const otherKey of knownKeys) {
      if (otherKey === fieldName) continue;
      const pattern = `"${otherKey}":`;
      if (value.includes(pattern)) {
        return { leaked: true, field: fieldName, pattern };
      }
    }
  }
  return { leaked: false };
}
