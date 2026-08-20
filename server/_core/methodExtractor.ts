import { invokeLLM } from "./llm";

/**
 * THE METHOD EXTRACTOR — one brain, fed two ways.
 *
 * The problem it exists to solve: nothing in ZAP has ever captured HOW A COACH ACTUALLY WORKS.
 * `services.uniqueMechanismSuggestion` is LLM-invented at the service node and unconditionally
 * overwritten (`routers/services.ts`, "Always overwrite deep-research fields"), so the mechanism
 * node has been inventing a method on top of an invented name. That is why the mechanisms read
 * as confusing: there is no real thing underneath them.
 *
 * 🔑 SOURCE-AGNOSTIC BY CONSTRUCTION. This module takes LABELLED RAW MATERIAL and knows nothing
 * about where it came from. A guided conversation and a service description arrive in the same
 * shape — `{ label, text }[]` — and go through the same distillation. There is deliberately no
 * `mode` parameter and no branch on source: two code paths producing "the method" would drift,
 * which is the failure shape this codebase has now recorded five times.
 *
 * 🔴 IT NEVER INVENTS. If the material does not contain a real method, `extractMethod` returns
 * null and the CALLER decides what to do — which on the cascade path means the guarded fallback
 * in `mechanismStandard.ts`, run explicitly and tagged as such. Silent invention inside the
 * extractor would destroy the one thing the source tier is for.
 */

export type MethodSourceTier = "coach_stated" | "extracted" | "guarded_fallback";

export interface MethodStep {
  /** A short handle for the move — 2-5 words, plain, describing what happens. */
  name: string;
  /** What the client or coach actually DOES at this step, in the coach's own terms. */
  whatHappens: string;
}

export interface OperationalTwist {
  /**
   * The three genuine twists available to a solo B2C provider (Module 1 of the technical report).
   * `none` is a first-class answer: a coach whose process is genuinely standard is better served
   * by the Unspoken Mechanism route — tell the untold story of the ordinary process — than by a
   * twist invented to fill this field. Inventing one here IS the Mr. Butterworth Trap.
   */
  kind: "sequence" | "isolation" | "synthesis" | "none";
  description: string;
}

export interface DistilledMethod {
  steps: MethodStep[];
  operationalTwist: OperationalTwist | null;
  /** Unique Mechanism of the PROBLEM — the structural reason the old vehicle fails. */
  ump: string | null;
  /** Unique Mechanism of the SOLUTION — the countermeasure that answers the UMP. */
  ums: string | null;
  /** What the client was doing before. The thing blame shifts onto, never the client. */
  oldVehicle: string | null;
  /** From the optional, skippable "what do you do differently" beat. */
  differentiator: string | null;
  sourceTier: MethodSourceTier;
  confidence: "high" | "medium" | "low";
  /** Verbatim fragments from the raw material, one or more per step. Never paraphrased. */
  evidence: string[];
}

export interface RawMaterial {
  /** Where this text came from, e.g. "coach: walkthrough", "service.description". */
  label: string;
  text: string;
}

/**
 * SUBSTANCE FLOOR — the gate between "we have a method" and "we are about to invent one".
 *
 * Deliberately about SHAPE, not length: a coach who answers in twelve concrete words has given
 * more than one who writes three vague paragraphs. Two ordered moves is the minimum that can
 * honestly be called a sequence, and every step must be traceable to something actually said.
 */
export function hasSubstance(m: DistilledMethod | null): m is DistilledMethod {
  if (!m) return false;
  if (m.steps.length < 2) return false;
  if (m.steps.some((s) => !s.name?.trim() || !s.whatHappens?.trim())) return false;
  if (m.evidence.length < 1) return false;
  return true;
}

/** Total usable characters across the supplied material — the cheap pre-check before spending a call. */
export function rawMaterialWeight(raw: RawMaterial[]): number {
  return raw.reduce((n, r) => n + (r.text?.trim().length ?? 0), 0);
}

const EXTRACTOR_SYSTEM = `You distil how a practitioner actually works into a clean, ordered method.

You are a careful listener, not a copywriter. You never improve, dramatise or complete what you
were given. Every step you return corresponds to something present in the supplied material, and
you carry a verbatim fragment as evidence for it. Where the material does not say how someone
works, you return an empty steps array — that is a correct and useful answer, and it is always
better than a plausible invention.

Return ONLY valid JSON.`;

/**
 * Distil labelled raw material into a structured method.
 *
 * @param tier what the CALLER knows about the provenance of this material. The extractor does not
 *   infer it: only the caller knows whether a human was on the other end of the conversation.
 */
export async function extractMethod(input: {
  rawMaterial: RawMaterial[];
  tier: Exclude<MethodSourceTier, "guarded_fallback">;
  /** The coach's field, for vocabulary only — never a source of method facts. */
  niche: string;
}): Promise<DistilledMethod | null> {
  const material = input.rawMaterial.filter((r) => r.text?.trim());
  if (material.length === 0) return null;

  const block = material.map((r) => `[${r.label}]\n${r.text.trim()}`).join("\n\n");

  const prompt = `Read the material below and distil the METHOD it describes — the actual sequence
of things this practitioner has people do.

FIELD (for vocabulary only, never a source of facts): ${input.niche}

MATERIAL
========
${block}
========

Return JSON with exactly these keys:

{
  "steps": [ { "name": "2-5 plain words naming the move", "whatHappens": "what the person actually does at this step, in the practitioner's own terms" } ],
  "operationalTwist": { "kind": "sequence" | "isolation" | "synthesis" | "none", "description": "one sentence" } | null,
  "ump": "the structural reason the usual approach fails these people — a property of the approach, never of the person" | null,
  "ums": "the specific thing this method does that answers that failure" | null,
  "oldVehicle": "what these people were doing before they arrived" | null,
  "differentiator": "what the practitioner says they do differently, if the material says" | null,
  "evidence": [ "verbatim fragment from the material above, copied exactly" ]
}

HOW TO READ THE MATERIAL

- steps: between 2 and 5, in the order they happen. Name them for WHAT HAPPENS, in plain words a
  client would recognise. Where the material describes six or more moves, group them into the
  natural phases rather than listing everything.
- operationalTwist: choose the kind ONLY when the material shows it.
  - "sequence"  — the usual steps are reordered, or one is moved, to remove a snag or reach a
                  result sooner.
  - "isolation" — one narrow part of a general process is pulled out and made the whole focus.
  - "synthesis" — two established disciplines are genuinely combined into one process.
  - "none"      — the process is a standard one, competently run. This is a common and perfectly
                  good answer. A practitioner whose real edge is care and rigour is served by
                  saying so, and a twist asserted here that the material does not show would make
                  the whole mechanism false.
- ump: describe the failure as a property of the APPROACH — what it structurally leaves out, what
  it was never built to handle. Never as a property of the person's character, discipline or
  effort.
- evidence: copy fragments EXACTLY as they appear above. If you cannot find a fragment supporting
  a step, that step does not belong in the list.

WHEN THE MATERIAL DOES NOT DESCRIBE A METHOD
Return "steps": [] and "evidence": []. Material that describes who the practitioner helps, what
they promise, or how good the results are, but never how the work is done, contains no method.
Saying so is the correct answer.`;

  let parsed: any;
  try {
    const res = await invokeLLM({
      messages: [
        { role: "system", content: EXTRACTOR_SYSTEM },
        { role: "user", content: prompt },
      ],
    });
    const content = typeof res.choices[0].message.content === "string"
      ? res.choices[0].message.content
      : JSON.stringify(res.choices[0].message.content);
    parsed = JSON.parse(stripFence(content));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const steps: MethodStep[] = Array.isArray(parsed.steps)
    ? parsed.steps
        .filter((s: any) => s && typeof s.name === "string" && typeof s.whatHappens === "string")
        .slice(0, 5)
        .map((s: any) => ({ name: String(s.name).trim(), whatHappens: String(s.whatHappens).trim() }))
    : [];

  const evidence: string[] = Array.isArray(parsed.evidence)
    ? parsed.evidence.filter((e: any) => typeof e === "string" && e.trim()).map((e: string) => e.trim())
    : [];

  // ── EVIDENCE MUST BE REAL ─────────────────────────────────────────────────────────────────────
  // A fragment the extractor "quotes" that does not appear in the material is a fabrication
  // wearing the costume of a citation, and it would be the single most damaging thing this module
  // could produce — every downstream honesty check reads `evidence` as ground truth. Verified
  // deterministically here rather than trusted, on normalised whitespace so formatting differences
  // do not cause false rejections.
  const haystack = normalise(material.map((r) => r.text).join(" "));
  const realEvidence = evidence.filter((e) => haystack.includes(normalise(e)));

  const twist = parsed.operationalTwist && typeof parsed.operationalTwist === "object"
    && ["sequence", "isolation", "synthesis", "none"].includes(parsed.operationalTwist.kind)
      ? { kind: parsed.operationalTwist.kind, description: String(parsed.operationalTwist.description ?? "").trim() }
      : null;

  const method: DistilledMethod = {
    steps,
    operationalTwist: twist,
    ump: str(parsed.ump),
    ums: str(parsed.ums),
    oldVehicle: str(parsed.oldVehicle),
    differentiator: str(parsed.differentiator),
    sourceTier: input.tier,
    confidence: gradeConfidence(steps, realEvidence, twist, input.tier),
    evidence: realEvidence,
  };

  return hasSubstance(method) ? method : null;
}

/**
 * Confidence is about how much of this came from a human, and how well-evidenced it is.
 * A conversation outranks mined material at equal detail, because someone actually said it.
 */
function gradeConfidence(
  steps: MethodStep[],
  evidence: string[],
  twist: OperationalTwist | null,
  tier: Exclude<MethodSourceTier, "guarded_fallback">,
): "high" | "medium" | "low" {
  const wellEvidenced = evidence.length >= steps.length;
  const rich = steps.length >= 3 && !!twist;
  if (tier === "coach_stated" && wellEvidenced && rich) return "high";
  if (tier === "coach_stated" && wellEvidenced) return "medium";
  if (tier === "extracted" && wellEvidenced && rich) return "medium";
  return "low";
}

function str(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}
function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
function stripFence(content: string): string {
  const t = content.trim();
  if (t.startsWith("```json") && t.endsWith("```")) return t.slice(7, -3).trim();
  if (t.startsWith("```") && t.endsWith("```")) return t.slice(3, -3).trim();
  return t;
}
