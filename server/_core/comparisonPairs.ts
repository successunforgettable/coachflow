/**
 * generateComparisonPairs — the ✗/✓ micro-call for the comparison-card ad style.
 *
 * Mirrors generateEditorialSceneBriefs (editorialPrompt.ts): one batched LLM call,
 * a strict JSON schema, per-slot validation, and a grounded fallback so a batch
 * NEVER breaks. Reads the structured service + ICP + mechanism context that the
 * adCreatives orchestration case already has in hand — no new data plumbing.
 *
 * The card lives or dies on PARALLELISM: each `us` must answer its `them` on the
 * SAME dimension, both short enough to read in a two-column layout. That symmetry
 * can only come from generating the pairs together — never by parsing prose.
 */

export interface ComparisonPair {
  them: string; // the old way / alternative on one dimension — plainly stated
  us: string;   // the offer's answer on that EXACT dimension
}

/** Structured inputs — all already assembled in the adCreatives orchestration case. */
export interface ComparisonPairInput {
  niche: string;
  mechanismName: string;           // the named method/system (the "us" identity)
  mainBenefit?: string;            // services.mainBenefit
  valueProposition?: string;       // active offer angle valueProposition (prose)
  painPoints?: string;             // services.painPoints
  failedSolutions?: string;        // services.failedSolutions — what the old way is
  icpPains?: string;               // idealCustomerProfiles.pains
  icpFrustrations?: string;        // idealCustomerProfiles.frustrations
  icpObjections?: string;          // idealCustomerProfiles.objections
}

// Length budget per side. Lines are written COMPLETE at their natural length and
// the card sizes to fit them — we never cut mid-thought. TARGET is the guidance
// given to the model; HARD_CAP is only a safety reject (a whole line that runs
// far past the budget is dropped, never truncated) so no dangling phrase ships.
const TARGET_WORDS = 7;
// Only reject a genuine run-on. Complete lines a little over the ~7-word target
// are KEPT — the renderer sizes rows to fit them (never cuts), so we don't throw
// away campaign-specific pairs and fall back to the generic set.
const HARD_CAP = 80;
const MIN_PAIRS = 4;
const MAX_PAIRS = 5;

const SYSTEM_PROMPT =
  "You are a direct-response conversion copywriter who builds high-contrast comparison graphics — the 'old way vs the new way' checklist that makes the right choice obvious at a glance. You write in the customer's own plain language, always specific to their world, never generic filler. Each row contrasts ONE concrete dimension: the left side names plainly what the old way or the usual alternative leaves them with on that dimension, and the right side names what this offer delivers on the exact same dimension. Every line is a COMPLETE, self-contained thought that reads perfectly on its own — a whole idea with its own subject and payoff, ending on a strong concrete word. Lines are tight and punchy, about seven words, and they finish the thought within that space rather than trailing off; each one lands cleanly on its final word. You keep the two sides truly parallel: same topic, opposite outcome, mirrored length. Respond with valid JSON.";

const RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "comparison_pairs",
    strict: true,
    schema: {
      type: "object",
      properties: {
        pairs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              them: { type: "string" },
              us: { type: "string" },
            },
            required: ["them", "us"],
            additionalProperties: false,
          },
        },
      },
      required: ["pairs"],
      additionalProperties: false,
    },
  },
};

/** Normalize a side: strip any leading ✗/✓/bullet the model added + collapse whitespace. Never truncates. */
function normalizeSide(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/^[\s✗✓✔✕xX×•\-–—]+/, "").replace(/\s+/g, " ").trim();
}

/**
 * Keep a pair only if BOTH sides are complete lines within budget. A side that
 * runs past HARD_CAP is a run-on — drop the whole pair (MIN_PAIRS + fallback keep
 * the card full) rather than ship a truncated, dangling phrase.
 */
function validatePair(p: unknown): ComparisonPair | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const them = normalizeSide(o.them);
  const us = normalizeSide(o.us);
  if (them.length < 3 || us.length < 3) return null;
  if (them.length > HARD_CAP || us.length > HARD_CAP) return null;
  return { them, us };
}

/**
 * Grounded fallback if the micro-call fails or returns too few valid pairs. Built
 * from the real inputs (mechanism, benefit, pains) so even the safety net stays
 * specific to this campaign — never lorem-ipsum. Logged loudly when used.
 */
function fallbackPairs(input: ComparisonPairInput): ComparisonPair[] {
  const benefit = normalizeSide(input.mainBenefit) || normalizeSide(input.valueProposition) || "A clear, proven path forward";
  return [
    { them: "Generic advice with no real plan", us: benefit.length <= HARD_CAP ? benefit : "A clear, proven path forward" },
    { them: "Endless guesswork and trial-and-error", us: "A proven step-by-step system" },
    { them: "Slow, scattered, unpredictable results", us: "A clear path to real momentum" },
    { them: "Left on your own when stuck", us: "Guided support at every step" },
  ];
}

/**
 * One batched LLM call → 4-5 parallel ✗/✓ pairs. Never throws — falls back to a
 * grounded set on any error or thin result. Returns MIN_PAIRS..MAX_PAIRS pairs.
 */
export async function generateComparisonPairs(input: ComparisonPairInput): Promise<ComparisonPair[]> {
  const { invokeLLM } = await import("./llm");

  const ctxLine = (label: string, v?: string) =>
    v && v.trim() ? `${label}: ${v.replace(/\s+/g, " ").trim().slice(0, 400)}` : "";
  const context = [
    ctxLine("Niche", input.niche),
    ctxLine("The offer's named method", input.mechanismName),
    ctxLine("Main benefit delivered", input.mainBenefit),
    ctxLine("Value proposition", input.valueProposition),
    ctxLine("What the customer struggles with (pains)", input.icpPains || input.painPoints),
    ctxLine("Their daily frustrations", input.icpFrustrations),
    ctxLine("What they've tried before that failed (the old way)", input.failedSolutions),
    ctxLine("Their objections", input.icpObjections),
  ].filter(Boolean).join("\n");

  const userPrompt = `Build a "${input.niche}" us-vs-them comparison checklist for an offer whose method is "${input.mechanismName}".

Use the real context below to write ${MAX_PAIRS} contrast rows. For each row:
- them: what the old way / usual alternative leaves them with on one concrete dimension, in their plain words
- us: what THIS offer delivers on that same dimension
Write each side as a COMPLETE, self-contained line of about ${TARGET_WORDS} words that reads perfectly on its own — a whole thought that lands on a strong final word. Never trail off or leave a phrase hanging (no line ending on a dangling preposition like "under", "with", "that", and no reference that points to something not on the line). If a thought needs more than a few words to finish cleanly, tighten the wording so the complete idea fits — do not cut it short. Keep the two sides truly parallel (same topic, opposite outcome, mirrored length) and specific to this niche — pull the tension straight from their pains, frustrations and what they've already tried.

Context:
${context || "(sparse — infer sensible specifics for this niche)"}

Return JSON: { "pairs": [ { "them", "us" }, ... ] } with ${MAX_PAIRS} rows, most compelling first.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: RESPONSE_FORMAT,
    });
    const content = response.choices[0].message.content;
    const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    const raw = Array.isArray(parsed?.pairs) ? parsed.pairs : [];
    const valid = raw.map(validatePair).filter((p: ComparisonPair | null): p is ComparisonPair => p !== null);
    if (valid.length >= MIN_PAIRS) {
      const out = valid.slice(0, MAX_PAIRS);
      console.log(`[comparisonPairs] ${out.length} pairs (${valid.length} valid from LLM)`);
      return out;
    }
    console.warn(`[comparisonPairs] only ${valid.length} valid pairs (<${MIN_PAIRS}), using grounded fallback`);
    return fallbackPairs(input);
  } catch (err) {
    console.warn(`[comparisonPairs] micro-call failed, using grounded fallback: ${err instanceof Error ? err.message : String(err)}`);
    return fallbackPairs(input);
  }
}
