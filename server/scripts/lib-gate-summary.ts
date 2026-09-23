/**
 * lib-gate-summary — turns one generation's onGate records into the per-cell figures a measurement reports.
 *
 * Why this exists: sprint0b-two-arm read only the BLOCKING `labels` of a FAILED first pass. Once
 * `script_hook_too_long` became label-only (60ec85f) it lives in `axes.observedLabels`, recorded on a pass and a
 * fail alike — so the old extraction reported 0 hook hits whatever the model did (§15k: silence passing as a
 * result). This reads observed labels on EVERY attempt, and the first attempt's hook word count, so the hook
 * rate is an observation rather than an absence.
 */
import type { ScriptGateRecord } from "../conceptScriptGenerator";
import { HOOK_MAX_WORDS } from "../_core/conceptScriptValidator";

export type GateSummary = {
  attempts: number;
  firstPassOk: boolean | null;
  /** Blocking labels on the first attempt (empty on a pass). */
  firstPassBlockingLabels: string[];
  /** Label-only observations on the first attempt — present on a pass as well as a fail. */
  firstPassObservedLabels: string[];
  /** Observed labels for every gated attempt, in order. */
  observedLabelsByAttempt: string[][];
  /** Scene 1's opening-sentence word count on the first attempt; null when that attempt had nothing to count. */
  firstPassHookWords: number | null;
  /** True when the first attempt carried `script_hook_too_long`, read from the gate's own labels. */
  firstPassHookTooLong: boolean;
  /** The label and the count disagree — the instrument is broken; never report a rate from such a cell. */
  hookInstrumentMismatch: boolean;
};

const split = (s: string) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

export function summariseGate(records: ScriptGateRecord[]): GateSummary {
  const gated = records.filter((g) => g.ok !== null);
  const first = gated[0];
  const observedLabelsByAttempt = gated.map((g) => [...(g.axes?.observedLabels ?? [])]);
  const firstPassObservedLabels = observedLabelsByAttempt[0] ?? [];
  const firstPassHookWords = first?.axes?.hookWords ?? null;
  const firstPassHookTooLong = firstPassObservedLabels.includes("script_hook_too_long");
  const hookInstrumentMismatch =
    firstPassHookWords !== null && firstPassHookTooLong !== firstPassHookWords > HOOK_MAX_WORDS;
  return {
    attempts: gated.length,
    firstPassOk: first ? first.ok : null,
    firstPassBlockingLabels: first && !first.ok ? split(first.labels) : [],
    firstPassObservedLabels,
    observedLabelsByAttempt,
    firstPassHookWords,
    firstPassHookTooLong,
    hookInstrumentMismatch,
  };
}
