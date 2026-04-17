import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import * as path from "path";
import * as fs from "fs";

// Text compositing via resvg-js + sharp.
// resvg renders SVG <text> with an embedded @font-face (base64 TTF data URI),
// so it never touches system fonts or fontconfig. sharp composites the
// rasterized text PNG onto the background. Both work in Railway's Nixpacks
// environment regardless of native binary platform detection.

const FONT_PATH = path.resolve(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf");

let fontBase64: string | null = null;
function getFontBase64(): string {
  if (!fontBase64) {
    const buf = fs.readFileSync(FONT_PATH);
    fontBase64 = buf.toString("base64");
    console.log(`[compositeHeadline] Font loaded from ${FONT_PATH} (${buf.length} bytes, base64 ${fontBase64.length} chars)`);
  }
  return fontBase64;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Simple greedy word-wrap: returns lines that each fit within maxWidth at the
// given fontSize. We approximate character width as fontSize × 0.6 (DejaVu Sans
// Bold average). This is imprecise but resvg will honour the real font metrics.
function wrapGreedy(
  text: string,
  maxWidth: number,
  fontSize: number
): string[] {
  const charWidth = fontSize * 0.55;
  const maxChars  = Math.floor(maxWidth / charWidth);
  const words     = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Find the biggest font size (stepping down by 4) that fits the headline in
// ≤ maxLines AND within the region's vertical height.
function layoutLines(
  text: string,
  maxWidth: number,
  maxBlockHeight: number,
  startFontSize: number,
  minFontSize: number,
  maxLines: number,
  lineHeightRatio: number
): { lines: string[]; fontSize: number } {
  for (let fs = startFontSize; fs >= minFontSize; fs -= 4) {
    const lines       = wrapGreedy(text, maxWidth, fs);
    const blockHeight = lines.length * fs * lineHeightRatio;
    if (lines.length <= maxLines && blockHeight <= maxBlockHeight) {
      return { lines, fontSize: fs };
    }
  }

  const lines     = wrapGreedy(text, maxWidth, minFontSize).slice(0, maxLines);
  const lastIdx   = lines.length - 1;
  const charWidth = minFontSize * 0.55;
  const maxChars  = Math.floor(maxWidth / charWidth);
  if (lines[lastIdx] && lines[lastIdx].length > maxChars) {
    lines[lastIdx] = lines[lastIdx].slice(0, maxChars - 1) + "…";
  }
  return { lines, fontSize: minFontSize };
}

// Positioning region by designStyle
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
  const b64 = getFontBase64();

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

  const strokeWidth = Math.round(fontSize * 0.12);
  const shadowBlur  = Math.round(fontSize * 0.15);
  const shadowOffY  = Math.round(fontSize * 0.04);

  // Build SVG with embedded font + text lines
  const textLines = lines.map((line, i) => {
    const y = Math.round(blockTop + lineHeight * (i + 0.5));
    const x = Math.round(W / 2);
    const escaped = escapeXml(line);
    // Paint order: stroke first, then fill — in SVG we use paint-order attribute
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central"
      font-family="ZapHeadline" font-weight="bold" font-size="${fontSize}"
      fill="white" stroke="black" stroke-width="${strokeWidth}" stroke-linejoin="round"
      paint-order="stroke fill"
      filter="url(#shadow)">${escaped}</text>`;
  }).join("\n    ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <style>
      @font-face {
        font-family: 'ZapHeadline';
        src: url('data:font/truetype;base64,${b64}') format('truetype');
        font-weight: bold;
        font-style: normal;
      }
    </style>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="${shadowOffY}" stdDeviation="${shadowBlur}" flood-color="rgba(0,0,0,0.6)" />
    </filter>
  </defs>
  ${textLines}
</svg>`;

  // Rasterize SVG to PNG via resvg (parses the embedded font, no system fonts needed)
  const resvg   = new Resvg(svg, { fitTo: { mode: "original" } });
  const textPng = resvg.render().asPng();

  console.log(`[compositeHeadline] Layout — fontSize=${fontSize}, lines=${lines.length}, textPng=${textPng.length} bytes`);

  // Composite text PNG onto background
  const result = await sharp(rawBuffer)
    .composite([{ input: Buffer.from(textPng), top: 0, left: 0 }])
    .png()
    .toBuffer();

  console.log(`[compositeHeadline] DONE — output=${result.length} bytes (input=${rawBuffer.length}, delta=${result.length - rawBuffer.length})`);
  return result;
}
