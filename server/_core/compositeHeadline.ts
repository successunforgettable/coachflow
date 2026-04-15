import { Resvg, ResvgRenderOptions } from "@resvg/resvg-js";
import * as fs from "fs";
import * as path from "path";

// Load font once at module level — synchronous read, cached for all calls
const FONT_PATH = path.resolve(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf");
let _fontData: Buffer | null = null;
function getFontData(): Buffer {
  if (!_fontData) {
    _fontData = fs.readFileSync(FONT_PATH);
  }
  return _fontData;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function compositeHeadline(
  rawBuffer: Buffer,
  headline: string,
  designStyle: string
): Promise<Buffer> {
  const W = 1080;
  const H = 1080;
  const BAR_H = 200;

  // Bar position based on design style
  const barY =
    designStyle === "screenshot" ? 0 :
    designStyle === "object"     ? Math.round((H - BAR_H) / 2) :
    H - BAR_H; // south: person_shocked, person_intense, person_curious

  const textY = barY + Math.round(BAR_H / 2);

  const base64 = rawBuffer.toString("base64");
  // Detect image format from magic bytes
  const mime =
    rawBuffer[0] === 0x89 ? "image/png" :
    rawBuffer[0] === 0xff ? "image/jpeg" :
    "image/png";

  const escaped = escapeXml(headline);

  // Ensure font is loaded (warm cache)
  getFontData();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <image href="data:${mime};base64,${base64}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="${barY}" width="${W}" height="${BAR_H}" fill="black"/>
  <text
    x="${W / 2}"
    y="${textY}"
    font-family="DejaVu Sans"
    font-weight="bold"
    font-size="72"
    fill="white"
    text-anchor="middle"
    dominant-baseline="middle"
  >${escaped}</text>
</svg>`;

  const opts: ResvgRenderOptions = {
    font: {
      loadSystemFonts: false, // only use our bundled font
      fontFiles: [FONT_PATH],
    },
  };

  const resvg = new Resvg(svg, opts);
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}
