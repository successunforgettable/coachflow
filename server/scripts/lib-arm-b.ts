/**
 * lib-arm-b — sprint 0b arm (b): the drafting prompt with the WORD-BUDGET ARITHMETIC removed, and nothing else.
 *
 * Derived FROM production's own prompt (a transform, never a rebuild) so the two arms differ in exactly one
 * dimension: where the budget is enforced. Arm (a) states it in the prompt AND gates it; arm (b) only gates it —
 * `conceptScriptValidator.ts` already fails `script_length_over_budget` past the ceiling and already writes the
 * post-hoc trim note, so arm (b) needs no new retry machinery.
 *
 * Every substitution ASSERTS it matched. A transform that silently no-ops would make arm (b) identical to arm (a)
 * and produce a confident null result (§15c).
 */
const LENGTH_PARA =
  /LENGTH — this is a (\d+)-SECOND script\. Total spoken words: HARD FLOOR \d+, HARD CEILING \d+, aim ~\d+\.\nBOTH numbers are non-negotiable[^\n]*\nYou have (\d+) scenes\. Each scene is ONE spoken line of \d+[–-]\d+ words, aiming ~\d+\. Holding EVERY scene inside that range is exactly what lands the total between \d+ and \d+\.\nCount as you write\. Every word costs a fraction of a second on camera\. /;

const SCENE_MAP_BULLET =
  /^- Total spoken words: HARD FLOOR \d+, HARD CEILING \d+, aim ~\d+\. BOTH bounds are non-negotiable[^\n]*\n/m;

export function armBPrompt(built: string): string {
  if (!LENGTH_PARA.test(built)) throw new Error("arm (b): the LENGTH paragraph did not match — the prompt changed shape");
  if (!SCENE_MAP_BULLET.test(built)) throw new Error("arm (b): the SCENE MAP word-budget bullet did not match");
  let p = built.replace(
    LENGTH_PARA,
    "LENGTH — this is a $1-SECOND script: it runs about $1 seconds read aloud at a natural speaking pace.\nYou have $2 scenes. ",
  );
  p = p.replace(SCENE_MAP_BULLET, "");
  // The arithmetic is gone; the craft is not.
  for (const leak of ["HARD FLOOR", "HARD CEILING", "Count as you write", "Each scene is ONE spoken line of"])
    if (p.includes(leak)) throw new Error(`arm (b): "${leak}" survived the transform`);
  for (const keep of ["Tight means FEWER", "one idea per breath", "Scene 1 is the HOOK", "Include a TURN beat"])
    if (!p.includes(keep)) throw new Error(`arm (b): craft line "${keep}" was lost — the arms differ by more than the budget`);
  if (p.length >= built.length) throw new Error("arm (b): transform did not shorten the prompt");
  return p;
}
