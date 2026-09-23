/**
 * conceptScriptValidator.ts — STRUCTURAL validation + compliance screen for a per-concept video script.
 *
 * Mirrors conceptValidator (structural + complianceFilter screen). SCOPE: STRUCTURE + Meta ad-policy
 * screening only. NO "script quality is good" judgement and NO ICP-fabrication truth check — the ICP
 * feeding this is knowingly fabricated; quality validation waits for the ICP grounding sprint.
 *
 * Structural rules:
 *   - enough scenes to be a script (≥3)
 *   - every scene has a non-empty spokenLine (the words the coach says to camera)
 *   - the FIRST scene is the hook (opening = the scroll-stopper)
 *   - the script's declared hookPattern MATCHES the concept's hookPattern (hook-match by construction)
 *   - total spoken length is within the capped target word budget (placement-safe short)
 */

import { complianceFilter } from "../lib/complianceFilter";
import { wordBudgetForSeconds } from "./conceptAxis";

export interface RawScriptScene {
  sceneNumber?: number;
  sceneType?: string;
  spokenLine?: string;
  onScreenText?: string;
  deliveryNote?: string;
}

export interface RawScript {
  hookPattern?: string;
  scenes?: RawScriptScene[];
}

export type ScriptStructureClass =
  | "script_too_few_scenes"
  | "script_missing_spoken_line"
  | "script_opening_not_hook"
  | "script_hook_too_long"
  | "script_hook_pattern_mismatch"
  | "script_length_over_budget"
  | "script_compliance_reject"
  | "script_fabricated_scarcity";

export interface ScriptHit {
  classId: ScriptStructureClass;
  description: string;
  location: string;
}

/**
 * `labels` are OBSERVED, never blocking: they are recorded on a pass and on a fail alike and change no verdict.
 * A class lives here until measurement shows the attempt budget can absorb it (label-only before blocking).
 */
export type ScriptResult =
  | { ok: true; labels: ScriptHit[] }
  | { ok: false; hits: ScriptHit[]; failContext: string; labels: ScriptHit[] };

const MIN_SCENES = 3;

function countWords(s: string | undefined): number {
  return (s ?? "").trim().split(/\s+/).filter(Boolean).length;
}

/**
 * The hook is the FIRST SENTENCE of scene 1 — not the whole scene. The prompt used to say "the opening,
 * under ~10 words" while sizing scene 1 at 30-36 words, and the bigger number won: measured over 22 generated
 * scripts the opening sentence ran a mean of 21.0 words against the coach-voice benchmark's 8.6, with 4 of 22
 * inside 10. Both halves of that contradiction are fixed together — the wording, and this check.
 */
export const HOOK_MAX_WORDS = 10;
export function firstSentenceOf(line: string | undefined): string {
  const t = String(line ?? "").trim();
  if (!t) return "";
  const m = t.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : t).trim();
}
/** Words in a line's opening sentence. The ONE count both the hook check and the gate's observer use, so a
 *  measurement of the hook can never drift from what the check itself saw. */
export function hookWordCount(line: string | undefined): number {
  return countWords(firstSentenceOf(line));
}

function build(hits: ScriptHit[], tail: string, labels: ScriptHit[] = []): ScriptResult {
  if (hits.length === 0) return { ok: true, labels };
  const lines = hits.slice(0, 8).map((h) => `- ${h.location}: ${h.description}`);
  return { ok: false, hits, failContext: `Your previous script failed validation and must be regenerated:\n${lines.join("\n")}\n\n${tail}`, labels };
}

export function validateScriptStructure(
  script: RawScript,
  opts: { hookPattern: string; targetSeconds: number },
): ScriptResult {
  const hits: ScriptHit[] = [];
  /** Observed, never blocking. See ScriptResult. */
  const labels: ScriptHit[] = [];
  // `?? []` guards null/undefined only. The model can return `scenes` as an OBJECT, a STRING or a NUMBER —
  // `json_schema` is steering on the Anthropic tool-use path, never enforcement (§15i) — and a wrong TYPE sailed
  // straight through into `.forEach`, killing the whole generation with "scenes.forEach is not a function".
  // Measured live in the sprint-0b run: 2 of 24 arm-(a) cells. A non-array now reads as no scenes, which the very
  // next check turns into `script_too_few_scenes` — a normal gate failure that RETRIES, instead of a crash that
  // escapes the attempt loop and skips recordComplianceGate.
  const scenes = Array.isArray(script.scenes) ? script.scenes : [];

  if (scenes.length < MIN_SCENES) {
    hits.push({ classId: "script_too_few_scenes", description: `only ${scenes.length} scene(s); need ≥${MIN_SCENES}`, location: "scenes" });
  }

  scenes.forEach((sc, i) => {
    if (typeof sc.spokenLine !== "string" || sc.spokenLine.trim().length === 0) {
      hits.push({ classId: "script_missing_spoken_line", description: "missing or empty spokenLine", location: `scene[${i}]` });
    }
  });

  // THE HOOK — the first sentence of scene 1, not the whole scene.
  // 🟡 LABEL-ONLY (Arfeen, 2026-09-22). As a BLOCKING check it produced the right copy and far too little of
  // it: hook ≤ 10 went 18% → 100%, and generations completing within the 3-attempt budget went 22/24 → 11/24.
  // It is recorded on every attempt and blocks nothing. Promotion to blocking waits on the steering converging
  // — the measure to watch is how often it fires on the FIRST attempt (19/24 when last measured blocking).
  if (scenes.length > 0) {
    const hookWords = hookWordCount(scenes[0].spokenLine);
    if (hookWords > HOOK_MAX_WORDS) {
      labels.push({
        classId: "script_hook_too_long",
        // A count, never the sentence itself: a retry note never shows the model its own flagged text
        // (the 2026-09-16 quoting ruling).
        description: `the opening sentence runs ${hookWords} words; the hook is ${HOOK_MAX_WORDS} or fewer`,
        location: "scene[0].spokenLine",
      });
    }
  }

  if (scenes.length > 0 && (scenes[0].sceneType ?? "").toLowerCase() !== "hook") {
    hits.push({ classId: "script_opening_not_hook", description: `opening scene is "${scenes[0].sceneType ?? ""}", must be "hook"`, location: "scene[0]" });
  }

  if ((script.hookPattern ?? "") !== opts.hookPattern) {
    hits.push({
      classId: "script_hook_pattern_mismatch",
      description: `script hookPattern "${script.hookPattern ?? ""}" ≠ concept hookPattern "${opts.hookPattern}"`,
      location: "hookPattern",
    });
  }

  const totalWords = scenes.reduce((n, sc) => n + countWords(sc.spokenLine), 0);
  const budget = wordBudgetForSeconds(opts.targetSeconds);
  if (totalWords > budget.max) {
    hits.push({
      classId: "script_length_over_budget",
      description: `${totalWords} spoken words exceeds the ${opts.targetSeconds}s budget (max ${budget.max})`,
      location: "scenes",
    });
  }

  return build(
    hits,
    `Regenerate the full script so: there are ≥${MIN_SCENES} scenes; every scene has a non-empty spokenLine; the FIRST scene is the hook; the opening SENTENCE of scene 1 is ${HOOK_MAX_WORDS} words or fewer, with the rest of scene 1 carrying on in its own sentences after it; the top-level hookPattern is exactly "${opts.hookPattern}"; and total spoken words fit a ${opts.targetSeconds}-second read (~${budget.target} words, hard max ${budget.max}). Keep it tight — this length runs clean across Reels, Stories and Feed.`,
    labels,
  );
}

// ─── Compliance screen — same complianceFilter path the concept generator uses ───────────────────
export function screenScriptCompliance(scenesIn: RawScriptScene[]): ScriptResult {
  // Same free guard as validateScriptStructure: a wrong type reads as no scenes, never as a crash (§15j).
  const scenes = Array.isArray(scenesIn) ? scenesIn : [];
  const hits: ScriptHit[] = [];
  scenes.forEach((sc, i) => {
    for (const field of ["spokenLine", "onScreenText"] as const) {
      const text = sc[field];
      if (typeof text !== "string" || text.trim().length === 0) continue;
      const verdict = complianceFilter(text);
      if (verdict.classification !== "VALID") {
        const isScarcity = /scarcity|expires|deadline|gone\s+forever|countdown/i.test(verdict.flaggedTerms.join(" ") + " " + text);
        hits.push({
          classId: isScarcity ? "script_fabricated_scarcity" : "script_compliance_reject",
          description: `${verdict.classification} — ${verdict.flaggedTerms.join("; ") || "policy-flagged copy"}`,
          location: `scene[${i}].${field}`,
        });
      }
    }
  });
  return build(
    hits,
    `Remove all fabricated urgency and scarcity: no "expires tonight", "gone forever", fake countdowns, or guaranteed-income claims. For a direct_offer_urgency hook, use ONLY a genuine coach-supplied deadline; if none exists, use a non-urgency close.`,
  );
}
