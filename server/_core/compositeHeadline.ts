import { Resvg, ResvgRenderOptions } from "@resvg/resvg-js";
import sharp from "sharp";
import * as path from "path";

// resvg renders ONLY the text bar (no embedded images).
// sharp composites the bar PNG onto the background (PNG-on-PNG, no librsvg).

const FONT_PATH = path.resolve(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf");

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Split a long headline into two roughly-equal lines at a word boundary near
// the midpoint. Headlines are typically 40–80 chars — single-line at 52px
// would be 2000–4000px wide, way off the 1080px bar.
function splitLines(text: string): [string, string | null] {
  const words = text.split(" ");
  if (words.length <= 3) return [text, null]; // too short to split

  // Find word boundary closest to mid-character
  const mid = Math.floor(text.length / 2);
  // Walk backwards from mid to find a space
  let splitPos = text.lastIndexOf(" ", mid);
  // If that would leave a very unbalanced first line, walk forward instead
  if (splitPos < text.length * 0.3) {
    splitPos = text.indexOf(" ", mid);
  }
  if (splitPos === -1) return [text, null];

  return [text.slice(0, splitPos).trim(), text.slice(splitPos + 1).trim()];
}

export async function compositeHeadline(
  rawBuffer: Buffer,
  headline: string,
  designStyle: string
): Promise<Buffer> {
  // Read actual background dimensions — Flux output varies (1024, 1280, etc.)
  const bgMeta = await sharp(rawBuffer).metadata();
  const bgW = bgMeta.width  ?? 1080;
  const bgH = bgMeta.height ?? 1080;

  // Scale typography proportionally with image width
  const scale = bgW / 1080;
  const FONT_SIZE   = Math.round(52 * scale);
  const LINE_H      = Math.round(68 * scale); // line height (includes leading)
  const PADDING_V   = Math.round(28 * scale); // top + bottom padding inside bar

  const [line1, line2] = splitLines(headline);
  const numLines = line2 ? 2 : 1;
  const barH = numLines * LINE_H + PADDING_V * 2;

  // Alphabetic baseline y positions.
  // We DON'T use dominant-baseline (poor resvg support).
  // Instead: baseline = top_of_line_content + FONT_SIZE * 0.78 (approx cap ascent ratio)
  // For line n (0-indexed): top_of_line = PADDING_V + n * LINE_H
  const baseline1 = PADDING_V + Math.round(FONT_SIZE * 0.78);
  const baseline2 = PADDING_V + LINE_H + Math.round(FONT_SIZE * 0.78);

  const esc1 = escapeXml(line1);
  const esc2 = line2 ? escapeXml(line2) : null;

  const textElements = esc2
    ? `<text x="${Math.round(bgW / 2)}" y="${baseline1}" font-family="DejaVu Sans" font-weight="bold" font-size="${FONT_SIZE}" fill="white" text-anchor="middle">${esc1}</text>
  <text x="${Math.round(bgW / 2)}" y="${baseline2}" font-family="DejaVu Sans" font-weight="bold" font-size="${FONT_SIZE}" fill="white" text-anchor="middle">${esc2}</text>`
    : `<text x="${Math.round(bgW / 2)}" y="${baseline1}" font-family="DejaVu Sans" font-weight="bold" font-size="${FONT_SIZE}" fill="white" text-anchor="middle">${esc1}</text>`;

  const barSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bgW}" height="${barH}" viewBox="0 0 ${bgW} ${barH}">
  <rect x="0" y="0" width="${bgW}" height="${barH}" fill="black"/>
  ${textElements}
</svg>`;

  const opts: ResvgRenderOptions = {
    font: {
      loadSystemFonts: false, // only bundled TTF — no system font dependency on Railway
      fontFiles: [FONT_PATH],
    },
  };

  const resvg = new Resvg(barSvg, opts);
  const rendered = resvg.render();
  const barPng = Buffer.from(rendered.asPng());

  // Bar vertical position
  const top =
    designStyle === "screenshot" ? 0 :
    designStyle === "object"     ? Math.round((bgH - barH) / 2) :
    bgH - barH; // south — person_shocked, person_intense, person_curious

  const composited = await sharp(rawBuffer)
    .composite([{ input: barPng, top, left: 0 }])
    .png()
    .toBuffer();

  return composited;
}
