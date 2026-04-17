import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import opentype, { Font } from "opentype.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

// Text compositing pipeline:
//   1. opentype.js parses the TTF and converts each headline line into raw SVG
//      path data (<path d="..."/>). No font lookup is ever needed by the
//      rasterizer — text is just vector shapes.
//   2. resvg-js rasterizes that SVG to a transparent PNG.
//   3. sharp composites the text PNG over the background image.

// Resolve the font path relative to this module's on-disk location, not
// process.cwd(). cwd can shift under process managers / different start scripts,
// which would silently break the font load. Module-relative is stable.
// Esbuild bundled output lives at /app/dist/, source lives at server/_core/,
// so we try both offsets and fall back to cwd for safety.
const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
const FONT_PATH = (() => {
  const candidates = [
    path.resolve(__moduleDir, "../assets/fonts/DejaVuSans-Bold.ttf"),    // prod: dist/ → ../assets
    path.resolve(__moduleDir, "../../assets/fonts/DejaVuSans-Bold.ttf"), // dev: server/_core/ → ../../assets
    path.resolve(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf"),     // fallback
  ];
  return candidates.find(p => fs.existsSync(p)) ?? candidates[0];
})();

let cachedFont: Font | null = null;
function getFont(): Font {
  if (cachedFont) return cachedFont;

  const buf = fs.readFileSync(FONT_PATH);
  const magic = buf.slice(0, 4).toString("hex");
  if (magic !== "00010000" && magic !== "4f54544f") {
    throw new Error(
      `[compositeHeadline] Font file at ${FONT_PATH} is not a valid TTF/OTF — first 4 bytes are 0x${magic}. The file may be a corrupted download or HTML error page saved as a TTF.`
    );
  }

  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  cachedFont = opentype.parse(arrayBuffer);
  console.log(`[compositeHeadline] Font parsed: ${FONT_PATH} (${buf.length} bytes, ${cachedFont.glyphs.length} glyphs)`);
  return cachedFont;
}

function wrapGreedy(
  font: Font,
  text: string,
  maxWidth: number,
  fontSize: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.getAdvanceWidth(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Font-scale cascade: try decreasing font sizes until the headline fits in
// ≤ maxLines AND the block height fits within maxBlockHeight. Only truncate
// as a last resort at the absolute minimum font size, at a whole-word boundary,
// with "..." appended.
function layoutLines(
  font: Font,
  text: string,
  maxWidth: number,
  maxBlockHeight: number,
  startFontSize: number,
  minFontSize: number,
  maxLines: number,
  lineHeightRatio: number
): { lines: string[]; fontSize: number; didTruncate: boolean } {
  for (let fs = startFontSize; fs >= minFontSize; fs -= 4) {
    const lines = wrapGreedy(font, text, maxWidth, fs);
    const blockHeight = lines.length * fs * lineHeightRatio;
    // Per-line width check: wrapGreedy pushes an over-long single word onto its
    // own line, so line count can pass while the line itself overflows. Catch
    // that by measuring every wrapped line against maxWidth at this font size.
    const everyLineFits = lines.every(line => font.getAdvanceWidth(line, fs) <= maxWidth);
    if (lines.length <= maxLines && blockHeight <= maxBlockHeight && everyLineFits) {
      return { lines, fontSize: fs, didTruncate: false };
    }
  }

  // At minimum font size — wrap and truncate to maxLines if needed
  const allLines = wrapGreedy(font, text, maxWidth, minFontSize);

  if (allLines.length <= maxLines) {
    return { lines: allLines, fontSize: minFontSize, didTruncate: false };
  }

  // Truncate: keep first (maxLines - 1) lines intact, build last line from
  // remaining words, cutting at the last whole word that fits, then append "..."
  const kept = allLines.slice(0, maxLines - 1);
  const remainingWords = text.split(/\s+/).filter(Boolean);
  // Find the words that are on lines after the kept ones
  let wordIndex = 0;
  for (const line of kept) {
    const lineWords = line.split(/\s+/).filter(Boolean);
    wordIndex += lineWords.length;
  }
  const lastLineWords = remainingWords.slice(wordIndex);

  let lastLine = "";
  for (const word of lastLineWords) {
    const candidate = lastLine ? `${lastLine} ${word}` : word;
    if (font.getAdvanceWidth(candidate + "...", minFontSize) <= maxWidth) {
      lastLine = candidate;
    } else {
      break;
    }
  }
  if (lastLine) {
    lastLine = lastLine + "...";
  } else {
    // Edge case: even a single word + "..." doesn't fit — just use the word truncated
    lastLine = lastLineWords[0] ? lastLineWords[0].slice(0, 20) + "..." : "...";
  }

  kept.push(lastLine);
  return { lines: kept, fontSize: minFontSize, didTruncate: true };
}

export async function compositeHeadline(
  rawBuffer: Buffer,
  headline: string,
  _designStyle: string
): Promise<Buffer> {
  const font = getFont();

  const meta = await sharp(rawBuffer).metadata();
  const W    = meta.width  ?? 1080;
  const H    = meta.height ?? 1080;

  // Lower-third region: text block always sits between 60% and 95% of image height
  const regionTop    = H * 0.60;
  const regionBottom = H * 0.95;
  const regionHeight = regionBottom - regionTop; // 35% of H

  const LINE_HEIGHT_RATIO = 1.1;
  const MAX_LINES         = 3;
  const maxTextWidth      = W - 160; // 80px padding each side

  // Font-size cascade: start at W/14 clamped [48, 140], shrink to 28 before truncating
  const startFontSize = Math.max(48, Math.min(140, Math.round(W / 14)));
  const MIN_FONT_SIZE = 28;

  const uppercased = headline.toUpperCase();

  const { lines, fontSize, didTruncate } = layoutLines(
    font,
    uppercased,
    maxTextWidth,
    regionHeight,
    startFontSize,
    MIN_FONT_SIZE,
    MAX_LINES,
    LINE_HEIGHT_RATIO
  );

  const lineHeight  = fontSize * LINE_HEIGHT_RATIO;
  const blockHeight = lines.length * lineHeight;
  const blockTopY   = regionTop + (regionHeight - blockHeight) / 2;

  if (didTruncate) {
    console.warn(
      `[compositeHeadline][WARN] TRUNCATED: original="${headline}" rendered="${lines.join(" ⏎ ")}" fontSize=${fontSize} lines=${lines.length} blockTopY=${Math.round(blockTopY)} imageHeight=${H}`
    );
  } else {
    console.log(
      `[compositeHeadline] fontSize=${fontSize} lines=${lines.length} truncated=false blockTopY=${Math.round(blockTopY)} imageHeight=${H}`
    );
  }

  const strokeWidth = Math.max(2, Math.round(fontSize * 0.12));
  const shadowBlur  = Math.max(2, Math.round(fontSize * 0.15));
  const shadowOffY  = Math.max(1, Math.round(fontSize * 0.04));

  const pathElements = lines.map((line, i) => {
    const advanceWidth = font.getAdvanceWidth(line, fontSize);
    const x = (W - advanceWidth) / 2;
    const lineCenter = blockTopY + lineHeight * (i + 0.5);
    const y = lineCenter + fontSize * 0.35;
    const glyphPath = font.getPath(line, x, y, fontSize);
    return `<path d="${glyphPath.toPathData(2)}" />`;
  }).join("\n    ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="${shadowOffY}" stdDeviation="${shadowBlur}" flood-color="rgba(0,0,0,0.6)" />
    </filter>
  </defs>
  <g fill="white" stroke="black" stroke-width="${strokeWidth}" stroke-linejoin="round" paint-order="stroke fill" filter="url(#shadow)">
    ${pathElements}
  </g>
</svg>`;

  const resvg   = new Resvg(svg, { fitTo: { mode: "original" } });
  const textPng = resvg.render().asPng();

  const result = await sharp(rawBuffer)
    .composite([{ input: Buffer.from(textPng), top: 0, left: 0 }])
    .png()
    .toBuffer();

  return result;
}
