/**
 * renderTestimonialCard — generates a 1080×1080 testimonial ad image.
 *
 * Renders a real client testimonial as a visual card: large quote text,
 * accent divider, client name + title. All text is fixed SVG from the
 * user's entered data — no LLM touches the quote words.
 *
 * No Flux call, no AI imagery, $0 per image, renders in <1s.
 * Reuses the existing opentype.js → resvg-js → sharp pipeline.
 */

import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import opentype, { Font } from "opentype.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

// ── Font loading (duplicated from compositeHeadline/renderQuoteCard — future cleanup) ──

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

// ── Palette (reuses the same 5 dark presets) ──

export { QUOTE_CARD_PALETTES as TESTIMONIAL_PALETTES } from "./renderQuoteCard";

// ── Text layout ──

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

export interface TestimonialCardOptions {
  quote: string;
  clientName: string;
  clientTitle?: string;
  palette?: string;
}

export async function renderTestimonialCard(options: TestimonialCardOptions): Promise<Buffer> {
  const font = getFont();
  const W = 1080;
  const H = 1080;

  const { QUOTE_CARD_PALETTES } = await import("./renderQuoteCard");
  const pal = QUOTE_CARD_PALETTES[options.palette || "charcoal"]
    ?? QUOTE_CARD_PALETTES["charcoal"];

  const maxTextWidth = W - 140;

  // ── Quote text (italic feel via quotation marks, centered) ──
  const quotedText = `\u201C${options.quote}\u201D`; // curly quotes
  const { lines: quoteLines, fontSize: quoteFontSize } = layoutCentered(
    font, quotedText, maxTextWidth, 6, 64, 28,
  );

  const quoteLineHeight = quoteFontSize * 1.25;
  const quoteBlockH = quoteLines.length * quoteLineHeight;
  // Position quote block in upper-center area, leaving room for attribution below
  const quoteTopY = (H - quoteBlockH - 100) / 2;

  const quotePaths = quoteLines.map((line, i) => {
    const advW = font.getAdvanceWidth(line, quoteFontSize);
    const x = (W - advW) / 2;
    const y = quoteTopY + quoteLineHeight * (i + 0.85);
    const glyphPath = font.getPath(line, x, y, quoteFontSize);
    return `<path d="${glyphPath.toPathData(2)}" />`;
  }).join("\n    ");

  // ── Accent divider ──
  const dividerY = quoteTopY + quoteBlockH + 30;

  // ── Client name ──
  const nameSize = 32;
  const nameText = options.clientName;
  const nameW = font.getAdvanceWidth(nameText, nameSize);
  const nameX = (W - nameW) / 2;
  const nameY = dividerY + 50;
  const namePath = font.getPath(nameText, nameX, nameY, nameSize);

  // ── Client title ──
  let titleSvg = "";
  if (options.clientTitle) {
    const titleSize = 24;
    const titleW = font.getAdvanceWidth(options.clientTitle, titleSize);
    const titleX = (W - titleW) / 2;
    const titleY = nameY + 36;
    const titlePath = font.getPath(options.clientTitle, titleX, titleY, titleSize);
    titleSvg = `<path d="${titlePath.toPathData(2)}" fill="${pal.accent}" opacity="0.8" />`;
  }

  // ── Assemble SVG ──
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${pal.bg}" />
  <g fill="white" opacity="0.9">
    ${quotePaths}
  </g>
  <rect x="${W * 0.35}" y="${dividerY}" width="${W * 0.30}" height="2" fill="${pal.accent}" opacity="0.5" />
  <path d="${namePath.toPathData(2)}" fill="white" />
  ${titleSvg}
</svg>`;

  const resvg = new Resvg(svg, { fitTo: { mode: "original" } });
  const pngData = resvg.render().asPng();

  return sharp(Buffer.from(pngData)).png().toBuffer();
}
