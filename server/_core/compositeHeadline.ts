import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import opentype, { Font } from "opentype.js";
import * as path from "path";
import * as fs from "fs";

// Text compositing pipeline:
//   1. opentype.js parses the TTF and converts each headline line into raw SVG
//      path data (<path d="..."/>). No font lookup is ever needed by the
//      rasterizer — text is just vector shapes.
//   2. resvg-js rasterizes that SVG to a transparent PNG.
//   3. sharp composites the text PNG over the background image.
// This approach sidesteps every font-loading failure mode we've hit: no system
// fonts, no fontconfig, no @font-face, no WASM font-buffer support required.

const FONT_PATH = path.resolve(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf");

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

  // opentype.parse takes an ArrayBuffer — convert cleanly from Node Buffer
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  cachedFont = opentype.parse(arrayBuffer);
  console.log(`[compositeHeadline] Font parsed: ${FONT_PATH} (${buf.length} bytes, ${cachedFont.glyphs.length} glyphs)`);
  return cachedFont;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Greedy word-wrap using opentype's real glyph metrics (no character-width approximation)
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

// Pick the largest font size that fits the text in ≤ maxLines and ≤ maxBlockHeight.
// Truncate the last line with an ellipsis if even minFontSize overflows.
function layoutLines(
  font: Font,
  text: string,
  maxWidth: number,
  maxBlockHeight: number,
  startFontSize: number,
  minFontSize: number,
  maxLines: number,
  lineHeightRatio: number
): { lines: string[]; fontSize: number } {
  for (let fs = startFontSize; fs >= minFontSize; fs -= 4) {
    const lines = wrapGreedy(font, text, maxWidth, fs);
    const blockHeight = lines.length * fs * lineHeightRatio;
    if (lines.length <= maxLines && blockHeight <= maxBlockHeight) {
      return { lines, fontSize: fs };
    }
  }

  const lines = wrapGreedy(font, text, maxWidth, minFontSize).slice(0, maxLines);
  const lastIdx = lines.length - 1;
  if (lines[lastIdx] && font.getAdvanceWidth(lines[lastIdx], minFontSize) > maxWidth) {
    let last = lines[lastIdx];
    while (last.length > 1 && font.getAdvanceWidth(last + "…", minFontSize) > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lastIdx] = last.trimEnd() + "…";
  }
  return { lines, fontSize: minFontSize };
}

function regionForStyle(
  H: number,
  designStyle: string
): { top: number; bottom: number } {
  switch (designStyle) {
    case "screenshot":
      return { top: H * 0.04, bottom: H * 0.42 };
    case "object":
      return { top: H * 0.32, bottom: H * 0.68 };
    default:
      return { top: H * 0.58, bottom: H * 0.96 };
  }
}

export async function compositeHeadline(
  rawBuffer: Buffer,
  headline: string,
  designStyle: string
): Promise<Buffer> {
  const font = getFont();

  const meta = await sharp(rawBuffer).metadata();
  const W    = meta.width  ?? 1080;
  const H    = meta.height ?? 1080;

  console.log(`[compositeHeadline] START — "${headline.slice(0, 60)}", style=${designStyle}, ${W}×${H}`);

  const baseFontSize  = Math.max(64, Math.min(180, Math.round(W / 10)));
  const MIN_FONT_SIZE = 56;
  const LINE_HEIGHT   = 1.12;
  const MAX_LINES     = 3;
  const uppercased    = headline.toUpperCase();
  const maxTextWidth  = W - 160;

  const region       = regionForStyle(H, designStyle);
  const regionHeight = region.bottom - region.top;

  const { lines, fontSize } = layoutLines(
    font,
    uppercased,
    maxTextWidth,
    regionHeight,
    baseFontSize,
    MIN_FONT_SIZE,
    MAX_LINES,
    LINE_HEIGHT
  );

  const lineHeight  = fontSize * LINE_HEIGHT;
  const blockHeight = lines.length * lineHeight;
  const blockTop    = region.top + (regionHeight - blockHeight) / 2;

  const strokeWidth = Math.max(2, Math.round(fontSize * 0.12));
  const shadowBlur  = Math.max(2, Math.round(fontSize * 0.15));
  const shadowOffY  = Math.max(1, Math.round(fontSize * 0.04));

  // Convert each line to SVG path data, centered on the image's horizontal axis
  const pathElements = lines.map((line, i) => {
    const advanceWidth = font.getAdvanceWidth(line, fontSize);
    const x = (W - advanceWidth) / 2;
    // Baseline y — opentype positions text on the baseline, not the center.
    // Approximate baseline as the bottom 80% of the line's slot so x-height sits roughly centered.
    const lineCenter = blockTop + lineHeight * (i + 0.5);
    const y = lineCenter + fontSize * 0.35; // shift to put the cap-height roughly centered
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

  console.log(`[compositeHeadline] Layout — fontSize=${fontSize}, lines=${lines.length}, textPng=${textPng.length} bytes`);

  const result = await sharp(rawBuffer)
    .composite([{ input: Buffer.from(textPng), top: 0, left: 0 }])
    .png()
    .toBuffer();

  console.log(`[compositeHeadline] DONE — output=${result.length} bytes (input=${rawBuffer.length}, delta=${result.length - rawBuffer.length})`);
  return result;
}
