/**
 * renderQuoteCard — generates a 1080×1080 quote-card ad image.
 *
 * Pure typography: headline text on a curated dark background colour.
 * No Flux call, no AI imagery, $0 per image, renders in <1s.
 * Reuses the existing opentype.js → resvg-js → sharp pipeline.
 */

import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import opentype, { Font } from "opentype.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

// ── Font loading (shared with compositeHeadline.ts) ──

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
const FONT_PATH = (() => {
  const candidates = [
    path.resolve(__moduleDir, "../assets/fonts/DejaVuSans-Bold.ttf"),
    path.resolve(__moduleDir, "../../assets/fonts/DejaVuSans-Bold.ttf"),
    path.resolve(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf"),
  ];
  return candidates.find(p => fs.existsSync(p)) ?? candidates[0];
})();

let cachedFont: Font | null = null;
function getFont(): Font {
  if (cachedFont) return cachedFont;
  const buf = fs.readFileSync(FONT_PATH);
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  cachedFont = opentype.parse(arrayBuffer);
  return cachedFont;
}

// ── Colour palette — curated dark presets that make white text pop ──

export const QUOTE_CARD_PALETTES: Record<string, { bg: string; accent: string; label: string }> = {
  charcoal: { bg: "#1a1a2e", accent: "#e94560", label: "Charcoal" },
  navy:     { bg: "#0a1628", accent: "#4ea8de", label: "Navy" },
  forest:   { bg: "#0b2418", accent: "#52b788", label: "Forest" },
  slate:    { bg: "#1e293b", accent: "#94a3b8", label: "Slate" },
  burgundy: { bg: "#2d0a1e", accent: "#e76f8b", label: "Burgundy" },
};

const DEFAULT_PALETTE = "charcoal";

// ── Text layout (simplified from compositeHeadline — centre-positioned) ──

function wrapGreedy(font: Font, text: string, maxWidth: number, fontSize: number): string[] {
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

function layoutCentered(
  font: Font, text: string, maxWidth: number, maxLines: number,
  startFontSize: number, minFontSize: number,
): { lines: string[]; fontSize: number } {
  for (let fs = startFontSize; fs >= minFontSize; fs -= 4) {
    const lines = wrapGreedy(font, text, maxWidth, fs);
    if (lines.length <= maxLines && lines.every(l => font.getAdvanceWidth(l, fs) <= maxWidth)) {
      return { lines, fontSize: fs };
    }
  }
  const lines = wrapGreedy(font, text, maxWidth, minFontSize);
  return { lines: lines.slice(0, maxLines), fontSize: minFontSize };
}

// ── Renderer ──

export interface QuoteCardOptions {
  headline: string;
  attribution?: string;
  palette?: string; // key from QUOTE_CARD_PALETTES
}

export async function renderQuoteCard(options: QuoteCardOptions): Promise<Buffer> {
  const font = getFont();
  const W = 1080;
  const H = 1080;
  const pal = QUOTE_CARD_PALETTES[options.palette || DEFAULT_PALETTE]
    ?? QUOTE_CARD_PALETTES[DEFAULT_PALETTE];

  const uppercased = options.headline.toUpperCase();
  const maxTextWidth = W - 160;

  const { lines, fontSize } = layoutCentered(
    font, uppercased, maxTextWidth, 4, 96, 36,
  );

  const lineHeight = fontSize * 1.15;
  const blockHeight = lines.length * lineHeight;
  const blockTopY = (H - blockHeight) / 2 - 20; // slight upward offset for attribution below

  // Build headline SVG paths
  const headlinePaths = lines.map((line, i) => {
    const advW = font.getAdvanceWidth(line, fontSize);
    const x = (W - advW) / 2;
    const y = blockTopY + lineHeight * (i + 0.85);
    const glyphPath = font.getPath(line, x, y, fontSize);
    return `<path d="${glyphPath.toPathData(2)}" />`;
  }).join("\n    ");

  // Attribution line (smaller, accent colour)
  let attributionSvg = "";
  if (options.attribution) {
    const attrSize = 28;
    const attrText = options.attribution;
    const attrW = font.getAdvanceWidth(attrText, attrSize);
    const attrX = (W - attrW) / 2;
    const attrY = blockTopY + blockHeight + 60;
    const attrPath = font.getPath(attrText, attrX, attrY, attrSize);
    attributionSvg = `<path d="${attrPath.toPathData(2)}" fill="${pal.accent}" />`;
  }

  // Accent line (thin horizontal divider above attribution)
  const accentY = blockTopY + blockHeight + 20;
  const accentLine = options.attribution
    ? `<rect x="${W * 0.35}" y="${accentY}" width="${W * 0.30}" height="2" fill="${pal.accent}" opacity="0.6" />`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${pal.bg}" />
  ${accentLine}
  <g fill="white">
    ${headlinePaths}
  </g>
  ${attributionSvg}
</svg>`;

  const resvg = new Resvg(svg, { fitTo: { mode: "original" } });
  const pngData = resvg.render().asPng();

  return sharp(Buffer.from(pngData)).png().toBuffer();
}
