/**
 * renderComparisonCard — pure-render ✗/✓ "us vs them" comparison card.
 *
 * No Flux, $0/image, <1s. Same opentype.js → resvg-js → sharp pipeline as
 * renderQuoteCard. Playfair headline on a palette-tinted dark header band, a
 * light body for maximum ✗/✓ legibility, gold dividers/accents, red ✗ and
 * green ✓ marks (semantic — fixed regardless of palette).
 *
 * Ratio-aware:
 *   • 4:5  (1080×1350) → two columns: red ✗ (old way) left, green ✓ (offer) right.
 *   • 9:16 (1080×1920) → vertical restack: a full-width "WITHOUT {method}" block
 *     above a full-width "WITH {method}" block, inside the Reels/Stories UI-safe
 *     zone (top 0.11·H / bottom 0.20·H, matching compositeHeadline).
 *
 * The ✗/✓ pairs come from generateComparisonPairs (never parsed from prose), so
 * each ✓ answers its ✗ on the same dimension. Rows font-cascade + hard-clamp so
 * variable-length items stay legible — the two-column 4:5 is the tight case.
 */

import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import opentype, { Font } from "opentype.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { QUOTE_CARD_PALETTES } from "./renderQuoteCard";
import type { ComparisonPair } from "./comparisonPairs";

// ── Fonts (Playfair headline + DejaVu body, both already shipped) ──
const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
function resolveFontPath(file: string): string {
  const candidates = [
    path.resolve(__moduleDir, `../assets/fonts/${file}`),
    path.resolve(__moduleDir, `../../assets/fonts/${file}`),
    path.resolve(process.cwd(), `assets/fonts/${file}`),
  ];
  return candidates.find(p => fs.existsSync(p)) ?? candidates[0];
}
const FONT_FILES = { headline: "PlayfairDisplay-ExtraBold.ttf", body: "DejaVuSans-Bold.ttf" } as const;
const fontCache: Partial<Record<"headline" | "body", Font>> = {};
function getFont(kind: "headline" | "body"): Font {
  const cached = fontCache[kind];
  if (cached) return cached;
  const buf = fs.readFileSync(resolveFontPath(FONT_FILES[kind]));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const font = opentype.parse(ab);
  fontCache[kind] = font;
  return font;
}

// ── Colours — premium gold-on-dark editorial register (matches editorialPrompt) ──
const GOLD = "#D4A24A";       // headline method + dividers + column headers
const HEAD_INK = "#F6F1E6";   // warm near-white for the "The old way vs." line
const ROW_US = "#F4EFE4";     // bright warm white — the offer side reads brightest
const ROW_THEM = "#B4AC9C";   // dimmed warm grey — the old-way side sits back
const RED = "#E05A3F";   // semantic ✗ disc — fixed (lifted for contrast on dark)
const GREEN = "#33A867"; // semantic ✓ disc — fixed

// ── Text helpers (mirrors renderQuoteCard / compositeHeadline) ──
function wrapGreedy(font: Font, text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.getAdvanceWidth(candidate, fontSize) <= maxWidth) current = candidate;
    else { if (current) lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}
function fitLines(
  font: Font, text: string, maxWidth: number, startSize: number, minSize: number, maxLines: number,
): { lines: string[]; fontSize: number } {
  for (let fs = startSize; fs >= minSize; fs -= 2) {
    const lines = wrapGreedy(font, text, maxWidth, fs);
    if (lines.length <= maxLines && lines.every(l => font.getAdvanceWidth(l, fs) <= maxWidth)) {
      return { lines, fontSize: fs };
    }
  }
  const all = wrapGreedy(font, text, maxWidth, minSize);
  if (all.length <= maxLines) return { lines: all, fontSize: minSize };
  const kept = all.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
  return { lines: kept, fontSize: minSize };
}
function centeredLine(font: Font, text: string, cx: number, y: number, fontSize: number, fill: string): string {
  const w = font.getAdvanceWidth(text, fontSize);
  return `<path d="${font.getPath(text, cx - w / 2, y, fontSize).toPathData(2)}" fill="${fill}" />`;
}
function leftLines(font: Font, lines: string[], x: number, topY: number, fontSize: number, fill: string): string {
  const lh = fontSize * 1.18;
  return lines.map((l, i) =>
    `<path d="${font.getPath(l, x, topY + lh * (i + 0.82), fontSize).toPathData(2)}" fill="${fill}" />`
  ).join("\n  ");
}

// ── ✗/✓ mark as a filled disc + white stroke (font-independent) ──
function mark(type: "cross" | "check", cx: number, cy: number, r: number): string {
  const color = type === "cross" ? RED : GREEN;
  const sw = Math.round(r * 0.22);
  const glyph = type === "cross"
    ? `<path d="M ${cx - r * 0.42} ${cy - r * 0.42} L ${cx + r * 0.42} ${cy + r * 0.42} M ${cx + r * 0.42} ${cy - r * 0.42} L ${cx - r * 0.42} ${cy + r * 0.42}" stroke="#fff" stroke-width="${sw}" stroke-linecap="round" fill="none" />`
    : `<path d="M ${cx - r * 0.46} ${cy + r * 0.02} L ${cx - r * 0.08} ${cy + r * 0.4} L ${cx + r * 0.5} ${cy - r * 0.42}" stroke="#fff" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" fill="none" />`;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" />${glyph}`;
}

/** One ✗/✓ row: disc at left, text block vertically centred to the disc. Returns svg + consumed height. */
function renderRow(
  bodyFont: Font, type: "cross" | "check", text: string, x: number, topY: number, cellW: number,
  discR: number, startSize: number, minSize: number, textFill: string,
): { svg: string; height: number } {
  const gap = Math.round(discR * 1.5);
  const textX = x + discR * 2 + gap;
  const textW = cellW - (discR * 2 + gap);
  const { lines, fontSize } = fitLines(bodyFont, text, textW, startSize, minSize, 3);
  const lh = fontSize * 1.18;
  const textH = lines.length * lh;
  const rowH = Math.max(discR * 2, textH);
  const discCy = topY + rowH / 2;
  const textTopY = topY + (rowH - textH) / 2;
  return {
    svg: `${mark(type, x + discR, discCy, discR)}\n  ${leftLines(bodyFont, lines, textX, textTopY, fontSize, textFill)}`,
    height: rowH,
  };
}

// ── Options ──
export interface ComparisonCardOptions {
  method: string;            // the offer's named method — the "us" identity
  pairs: ComparisonPair[];   // {them, us}[]
  headline?: string;         // Playfair hook; default "The old way vs. {method}"
  palette?: string;          // key from QUOTE_CARD_PALETTES (tints the header band)
  width?: number;            // default 1080
  height?: number;           // default 1350 (4:5). 1920 → 9:16 restack.
}

export async function renderComparisonCard(options: ComparisonCardOptions): Promise<Buffer> {
  const headFont = getFont("headline");
  const bodyFont = getFont("body");
  const W = options.width ?? 1080;
  const H = options.height ?? 1350;
  const pal = QUOTE_CARD_PALETTES[options.palette || "charcoal"] ?? QUOTE_CARD_PALETTES.charcoal;
  const method = (options.method || "our method").trim();
  const pairs = options.pairs.slice(0, 5);
  const vertical = H / W >= 1.5;

  // Short display label — a mechanism can arrive as a long descriptive paragraph;
  // take the lead phrase (before a dash/parenthesis) then trim to a word boundary
  // under ~30 chars so the headline and column headers never truncate mid-word.
  const shortMethod = (() => {
    const lead = method.split(/\s+[—–-]\s+|\s*[(:]/)[0].trim();
    if (lead.length <= 30) return lead || "our method";
    const cut = lead.slice(0, 30);
    const sp = cut.lastIndexOf(" ");
    return (sp > 10 ? cut.slice(0, sp) : cut).trim() || "our method";
  })();
  const methodUpper = shortMethod.toUpperCase();
  const withLabel = `WITH ${methodUpper}`;
  const withoutLabel = `WITHOUT ${methodUpper}`;

  const padX = Math.round(W * 0.065);

  // ── Headline: two-tier Playfair — "The old way vs." (near-white) over the method
  //    (gold), the editorial signature. A caller-supplied headline renders as one
  //    near-white block. Gold hairline beneath. Whole card is dark (no band).
  const uiSafeTop = vertical ? Math.round(H * 0.11) : 0;
  const uiSafeBottom = vertical ? Math.round(H * 0.20) : 0;
  // Vertical packs 10 rows into the safe zone → a tighter, smaller headline.
  const headTop = uiSafeTop + Math.round(H * (vertical ? 0.02 : 0.045));
  const prefixMax = vertical ? 38 : 46;
  const methodMax = vertical ? 62 : 84;
  const methodMin = vertical ? 38 : 46;
  let headlineSvg = "";
  let headlineBottom = headTop;
  if (options.headline) {
    const { lines, fontSize } = fitLines(headFont, options.headline.trim(), W - padX * 2, vertical ? 60 : 74, 40, 3);
    const lh = fontSize * 1.14;
    headlineSvg = lines.map((l, i) => centeredLine(headFont, l, W / 2, headTop + lh * (i + 0.85), fontSize, HEAD_INK)).join("\n  ");
    headlineBottom = headTop + lines.length * lh;
  } else {
    const { fontSize: pfs } = fitLines(headFont, "The old way vs.", W - padX * 2, prefixMax, 28, 1);
    const prefixY = headTop + pfs * 0.9;
    const prefixSvg = centeredLine(headFont, "The old way vs.", W / 2, prefixY, pfs, HEAD_INK);
    const { lines: ml, fontSize: mfs } = fitLines(headFont, shortMethod, W - padX * 2, methodMax, methodMin, 2);
    const mlh = mfs * 1.1;
    const methodTop = prefixY + Math.round(H * 0.016);
    const methodSvg = ml.map((l, i) => centeredLine(headFont, l, W / 2, methodTop + mlh * (i + 0.85), mfs, GOLD)).join("\n  ");
    headlineSvg = `${prefixSvg}\n  ${methodSvg}`;
    headlineBottom = methodTop + ml.length * mlh;
  }
  const ruleY = headlineBottom + Math.round(H * 0.016);
  const goldRule = `<rect x="${W * 0.5 - 90}" y="${ruleY}" width="180" height="4" rx="2" fill="${GOLD}" />`;
  const bandH = ruleY + Math.round(H * 0.01); // content anchor below the rule

  let bodySvg = "";

  if (!vertical) {
    // ── 4:5 two-column ──
    const centerGap = Math.round(W * 0.05);
    const colW = (W - padX * 2 - centerGap) / 2;
    const leftX = padX;
    const rightX = padX + colW + centerGap;
    const discR = 26;

    // Column headers — short + fit-to-column so they never overrun/collide.
    const headerY = bandH + Math.round(H * 0.05);
    const fitHeader = (text: string, cx: number, fill: string) => {
      const { lines, fontSize } = fitLines(bodyFont, text, colW, 26, 15, 1);
      return centeredLine(bodyFont, lines[0], cx, headerY, fontSize, fill);
    };
    const colHeaderSvg =
      fitHeader("THE OLD WAY", leftX + colW / 2, GOLD) +
      "\n  " + fitHeader(withLabel, rightX + colW / 2, GOLD);

    // Measure rows, then distribute evenly below the headers with a capped gap
    // (rows sit directly under their column header; even top/bottom breathing room).
    const rowsTopMin = headerY + Math.round(H * 0.03);
    const availH = H - uiSafeBottom - rowsTopMin - Math.round(H * 0.02);
    const rowHeights = pairs.map(p => Math.max(
      renderRow(bodyFont, "cross", p.them, leftX, 0, colW, discR, 34, 22, ROW_THEM).height,
      renderRow(bodyFont, "check", p.us, rightX, 0, colW, discR, 34, 22, ROW_US).height,
    ));
    const sumH = rowHeights.reduce((a, b) => a + b, 0);
    const gap = Math.max(Math.round(H * 0.014), Math.min(Math.round(H * 0.05), (availH - sumH) / (pairs.length + 1)));

    let y = rowsTopMin + gap;
    const firstRowTop = y;
    const rowSvgs: string[] = [];
    pairs.forEach((p, i) => {
      rowSvgs.push(renderRow(bodyFont, "cross", p.them, leftX, y, colW, discR, 34, 22, ROW_THEM).svg);
      rowSvgs.push(renderRow(bodyFont, "check", p.us, rightX, y, colW, discR, 34, 22, ROW_US).svg);
      y += rowHeights[i] + gap;
    });
    const dividerX = padX + colW + centerGap / 2;
    const divTop = firstRowTop - 14;
    const divHeight = Math.max(0, (y - gap) + 14 - divTop); // last row bottom (y advanced one gap past it) + pad
    const divider = `<rect x="${dividerX - 1.5}" y="${divTop}" width="3" height="${divHeight}" rx="1.5" fill="${GOLD}" opacity="0.55" />`;
    bodySvg = `${colHeaderSvg}\n  ${divider}\n  ${rowSvgs.join("\n  ")}`;
  } else {
    // ── 9:16 vertical restack: WITHOUT block over WITH block, full-width rows ──
    const colW = W - padX * 2;
    const discR = 28;
    const headerGap = Math.round(H * 0.02);
    const rowGap = Math.round(H * 0.012);
    const blockGap = Math.round(H * 0.024);
    const contentTop = bandH + Math.round(H * 0.025);
    const safeBottom = H - uiSafeBottom - Math.round(H * 0.01);
    const availV = safeBottom - contentTop;

    // Fit-loop: pick the largest row font size at which BOTH blocks (2 headers +
    // 10 rows + all gaps) fit inside the safe zone — guarantees no bottom overflow
    // regardless of how many lines each complete phrase wraps to.
    const measure = (size: number) => {
      let total = 2 * (30 + headerGap) + blockGap; // 2 headers + gap between blocks
      for (const p of pairs) {
        total += renderRow(bodyFont, "cross", p.them, padX, 0, colW, discR, size, Math.max(18, size - 8), ROW_THEM).height + rowGap;
        total += renderRow(bodyFont, "check", p.us, padX, 0, colW, discR, size, Math.max(18, size - 8), ROW_US).height + rowGap;
      }
      return total;
    };
    let rowSize = 38;
    for (let s = 38; s >= 22; s -= 2) { rowSize = s; if (measure(s) <= availV) break; }
    const rowMin = Math.max(18, rowSize - 8);

    const block = (label: string, type: "cross" | "check", side: (p: ComparisonPair) => string, startY: number): { svg: string; endY: number } => {
      const textFill = type === "cross" ? ROW_THEM : ROW_US;
      const parts: string[] = [centeredLine(bodyFont, label, W / 2, startY, 30, GOLD)];
      let y = startY + headerGap;
      for (const p of pairs) {
        const row = renderRow(bodyFont, type, side(p), padX, y, colW, discR, rowSize, rowMin, textFill);
        parts.push(row.svg);
        y += row.height + rowGap;
      }
      return { svg: parts.join("\n  "), endY: y };
    };

    const b1 = block(withoutLabel, "cross", p => p.them, contentTop + 30);
    const midRuleY = b1.endY + Math.round(H * 0.004);
    const midRule = `<rect x="${W * 0.5 - 80}" y="${midRuleY}" width="160" height="3" rx="1.5" fill="${GOLD}" opacity="0.7" />`;
    const b2 = block(withLabel, "check", p => p.us, midRuleY + blockGap + 30);
    bodySvg = `${b1.svg}\n  ${midRule}\n  ${b2.svg}`;
  }

  // Full dark card with a faint gold top hairline — premium editorial register.
  const topHair = `<rect x="0" y="0" width="${W}" height="${Math.round(H * 0.006)}" fill="${GOLD}" opacity="0.85" />`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${pal.bg}" />
  ${topHair}
  ${headlineSvg}
  ${goldRule}
  ${bodySvg}
</svg>`;

  const resvg = new Resvg(svg, { fitTo: { mode: "original" } });
  const pngData = resvg.render().asPng();
  return sharp(Buffer.from(pngData)).png().toBuffer();
}
