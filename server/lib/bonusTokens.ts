/**
 * Bonus token-fill (forward-sequence step 2, Layer 1 — the A11 BONUS win + coherence fix).
 *
 * The offer generator emits `BONUS #N: [INSERT_BONUS_N_NAME]` slots (offersGenerator.ts). The coherence fix
 * is HYBRID: the prompt now emits name-only, AND this fill does WHOLE-LINE replacement — from the NAME token to
 * end of line — so a drifted trailer (e.g. the offer describing a DFY script bank as "a live group call") can
 * never survive. The line becomes `BONUS #N: <title> — <shortLine>` (the generated bonus is the single source
 * of truth). value is coach-supplied only; absent → no value rendered, never fabricated. Any bonus token that
 * survives (a straggler slot 4/5) is stripped so zero `[INSERT_BONUS_*]` remain (A16).
 */
export interface BonusFill {
  index: number;        // 1-based bonus slot ([INSERT_BONUS_{index}_NAME])
  title: string;        // the generated bonus title
  shortLine: string;    // ~12-18 word outcome line — replaces the offer's own (contradicting) trailer
  value: string | null; // coach-supplied £ figure ONLY; null → no value rendered
}

export function applyBonusesToText(text: string, bonuses: BonusFill[]): string {
  if (!text) return text;
  let out = text;
  for (const b of bonuses) {
    const head = b.value && b.value.trim() ? `${b.title} (${b.value.trim()})` : b.title;
    const replacement = b.shortLine && b.shortLine.trim() ? `${head} — ${b.shortLine.trim()}` : head;
    // Whole-line: the NAME token to end of line — overwrites the token AND any drifted trailer with the truth.
    out = out.replace(new RegExp(`\\[INSERT_BONUS_${b.index}_NAME\\][^\\n]*`, "g"), replacement);
  }
  // Straggler cleanup — any remaining bonus tokens (slots 4/5, or a stray value) + their line-tails/parentheticals.
  return out
    .replace(/\s*\(\[INSERT_BONUS_\d+_VALUE\]\)/g, "")
    .replace(/\[INSERT_BONUS_\d+_NAME\][^\n]*/g, "")
    .replace(/\s*\[INSERT_BONUS_\d+_(?:NAME|VALUE)\]/g, "");
}
