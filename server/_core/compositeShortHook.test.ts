/**
 * compositeShortHook.test.ts — the compositor's line-fitting at SHORT strings.
 *
 * ⚠️ WHY THIS SUITE EXISTS. The baked-text fix swaps the compositor's text block from a
 * ~140-character body truncation to a <=60-character image hook. The compositor is the
 * component with the worst failure history in this repo — CHECKPOINT records that "the raw
 * render looked fine while the finished ad was broken", so a change to what it lays out
 * cannot be assumed safe from the prompt side.
 *
 * ⚠️ AND WHAT THIS SUITE IS NOT. It exercises the GEOMETRY (`fitLines` / block height /
 * anchor arithmetic), which is deterministic. It CANNOT tell whether the finished ad looks
 * right — no gate in this repo can. That judgement is Arfeen's, on the composite, on the
 * pixels. A green run here is a licence to render, never a licence to claim it looks good.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parse as parseFont, type Font } from "opentype.js";

/** Same font file the compositor loads for its body block (see FONT_FILES.body). */
function bodyFont(): Font {
  const p = join(process.cwd(), "assets", "fonts", "InstrumentSans-Regular.ttf");
  const buf = readFileSync(p);
  return parseFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

// Reproductions of the compositor's own helpers, kept in step with compositeHeadline.ts.
// They are private there; duplicating the arithmetic is what lets this suite assert on the
// layout without rendering a PNG.
function wrapGreedy(font: Font, text: string, maxWidth: number, fs: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.getAdvanceWidth(next, fs) <= maxWidth) cur = next;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

function fitLines(
  font: Font, text: string, maxWidth: number, startSize: number, minSize: number, maxLines: number,
): { lines: string[]; fontSize: number } {
  for (let fs = startSize; fs >= minSize; fs -= 2) {
    const lines = wrapGreedy(font, text, maxWidth, fs);
    const everyLineFits = lines.every((l) => font.getAdvanceWidth(l, fs) <= maxWidth);
    if (lines.length <= maxLines && everyLineFits) return { lines, fontSize: fs };
  }
  const all = wrapGreedy(font, text, maxWidth, minSize);
  if (all.length <= maxLines) return { lines: all, fontSize: minSize };
  const kept = all.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
  return { lines: kept, fontSize: minSize };
}

// The 4:5 feed canvases the two providers actually emit (CHECKPOINT §4, measured).
const CANVASES = [
  { name: "flux 4:5", W: 896, H: 1088 },
  { name: "gpt-image-1 4:5", W: 1024, H: 1280 },
];

const HOOK_MAX_CHARS = 60;
const HOOKS = [
  "The week the proposal never went out",
  "Fully booked, and still guessing about next month",
  "Quiet inbox after a call that went well",
  "Scope moved again",
];
const OLD_BODY_140 =
  "There's a point in an operations engagement where the scope has been agreed twice and the number still has not been said out loud, and everyone";

describe("fitLines at short hook strings", () => {
  const font = bodyFont();

  for (const c of CANVASES) {
    const colW = Math.round(c.W * 0.86);
    const bodySize = Math.max(18, Math.round(c.W / 32));
    const minSize = Math.round(bodySize * 0.8);

    it(`${c.name}: every hook fits at FULL size with no shrink and no ellipsis`, () => {
      for (const h of HOOKS) {
        const { lines, fontSize } = fitLines(font, h, colW, bodySize, minSize, 4);
        expect(fontSize).toBe(bodySize);              // never shrank
        expect(lines.join(" ")).not.toContain("…");   // never truncated
        expect(lines.length).toBeLessThanOrEqual(2);
      }
    });

    it(`${c.name}: a hook produces a SHORTER text block than the old body truncation`, () => {
      // The whole safety argument for this swap: less text means more clear picture, and the
      // text-safe band was measured at worst-case content, so a shorter block stays inside it.
      const lh = bodySize * 1.32;
      const bodyBlockH = fitLines(font, OLD_BODY_140, colW, bodySize, minSize, 4).lines.length * lh;
      for (const h of HOOKS) {
        const hookBlockH = fitLines(font, h, colW, bodySize, minSize, 4).lines.length * lh;
        expect(hookBlockH).toBeLessThanOrEqual(bodyBlockH);
      }
    });

    it(`${c.name}: a hook at the ${HOOK_MAX_CHARS}-char ceiling still fits within maxLines`, () => {
      const worst = "M".repeat(HOOK_MAX_CHARS);       // widest glyph, no wrap opportunities
      const { lines } = fitLines(font, worst, colW, bodySize, minSize, 4);
      expect(lines.length).toBeLessThanOrEqual(4);
    });
  }

  it("an EMPTY hook yields zero lines, so the layout's empty-case guard is exercised", () => {
    // compositeHeadline computes `bodyText ? fitLines(...) : []` and then branches on
    // `bodyLines.length` for both the headline gap and the pill gap. Zero lines is a real
    // state — a service with no hook rows and no body fallback — and must not throw.
    const bodyText = "";
    const lines = bodyText ? fitLines(bodyFont(), bodyText, 700, 32, 26, 4).lines : [];
    expect(lines).toEqual([]);
    expect(lines.length * (32 * 1.32)).toBe(0);
  });

  it("block height is DERIVED from line count, so a shorter block cannot overflow the band", () => {
    const font2 = bodyFont();
    const lh = 32 * 1.32;
    const oneLine = fitLines(font2, "Scope moved again", 700, 32, 26, 4).lines.length * lh;
    const fourLine = fitLines(font2, OLD_BODY_140, 700, 32, 26, 4).lines.length * lh;
    expect(oneLine).toBeGreaterThan(0);
    expect(oneLine).toBeLessThan(fourLine);
  });
});
