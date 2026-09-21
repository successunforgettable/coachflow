/** lib-controls — the two sprint-0b controls, read from source at run time (§15f: never from a printed figure). */
import { readFileSync } from "fs";

export const COACH_NINE_PATH = "docs/andromeda/worked-examples/final-shoot-2026-09-10/1-script-and-talent-brief.md";

/** The coach-voice nine (D-n calibration set): P1–P3, E1–E3, W1–W3, body between `### Script` and the next rule/heading. */
export function readCoachNine(path = COACH_NINE_PATH): Array<{ id: string; text: string }> {
  const md = readFileSync(path, "utf8");
  const out: Array<{ id: string; text: string }> = [];
  const re = /^# ((?:P|E|W)\d) — [^\n]*$/gm;
  const heads: Array<{ id: string; index: number; len: number }> = [];
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(md)) !== null) heads.push({ id: mm[1], index: mm.index, len: mm[0].length });
  heads.forEach((h, i) => {
    const start = h.index + h.len;
    const end = i + 1 < heads.length ? heads[i + 1].index : md.length;
    const block = md.slice(start, end);
    const m = block.match(/###\s*Script\s*\n([\s\S]*?)(?:\n---|\n#|$)/);
    if (!m) return;
    const text = m[1].split("\n").map((l) => l.trim())
      .filter((l) => l && !l.startsWith("**") && !l.startsWith(">") && !l.startsWith("#"))
      .join(" ").replace(/\s+/g, " ").trim();
    if (text) out.push({ id: h.id, text });
  });
  return out;
}
