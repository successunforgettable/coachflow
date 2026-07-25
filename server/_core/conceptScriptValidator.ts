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
  | "script_hook_pattern_mismatch"
  | "script_length_over_budget"
  | "script_compliance_reject"
  | "script_fabricated_scarcity";

export interface ScriptHit {
  classId: ScriptStructureClass;
  description: string;
  location: string;
}

export type ScriptResult = { ok: true } | { ok: false; hits: ScriptHit[]; failContext: string };

const MIN_SCENES = 3;

function countWords(s: string | undefined): number {
  return (s ?? "").trim().split(/\s+/).filter(Boolean).length;
}

function build(hits: ScriptHit[], tail: string): ScriptResult {
  if (hits.length === 0) return { ok: true };
  const lines = hits.slice(0, 8).map((h) => `- ${h.location}: ${h.description}`);
  return { ok: false, hits, failContext: `Your previous script failed validation and must be regenerated:\n${lines.join("\n")}\n\n${tail}` };
}

export function validateScriptStructure(
  script: RawScript,
  opts: { hookPattern: string; targetSeconds: number },
): ScriptResult {
  const hits: ScriptHit[] = [];
  const scenes = script.scenes ?? [];

  if (scenes.length < MIN_SCENES) {
    hits.push({ classId: "script_too_few_scenes", description: `only ${scenes.length} scene(s); need ≥${MIN_SCENES}`, location: "scenes" });
  }

  scenes.forEach((sc, i) => {
    if (typeof sc.spokenLine !== "string" || sc.spokenLine.trim().length === 0) {
      hits.push({ classId: "script_missing_spoken_line", description: "missing or empty spokenLine", location: `scene[${i}]` });
    }
  });

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
    `Regenerate the full script so: there are ≥${MIN_SCENES} scenes; every scene has a non-empty spokenLine; the FIRST scene is the hook; the top-level hookPattern is exactly "${opts.hookPattern}"; and total spoken words fit a ${opts.targetSeconds}-second read (~${budget.target} words, hard max ${budget.max}). Keep it tight — this length runs clean across Reels, Stories and Feed.`,
  );
}

// ─── Compliance screen — same complianceFilter path the concept generator uses ───────────────────
export function screenScriptCompliance(scenes: RawScriptScene[]): ScriptResult {
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
