import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import sharp from "sharp";
import * as path from "path";

// @napi-rs/canvas ships prebuilt linux-x64-gnu binaries with libcairo BUNDLED.
// No system font packages needed. We load our own TTF via GlobalFonts.registerFromPath().
// Canvas 2D ctx.fillText() is completely reliable — no SVG rendering, no librsvg.

const FONT_PATH   = path.resolve(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf");
const FONT_FAMILY = "ZapHeadline"; // unique name avoids any system font collision

let fontLoaded = false;
function ensureFont(): void {
  if (!fontLoaded) {
    GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY);
    fontLoaded = true;
    console.log(`[compositeHeadline] Font registered from ${FONT_PATH}`);
  }
}

// Word-wrap: split text into at most 2 lines that fit within maxWidth pixels.
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (let wi = 0; wi < words.length; wi++) {
    const word      = words[wi];
    const candidate = current ? `${current} ${word}` : word;

    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (lines.length >= 1) {
        // Already have 2 lines — pack remaining words into line 2
        lines.push(words.slice(wi).join(" "));
        return lines.slice(0, 2);
      }
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

export async function compositeHeadline(
  rawBuffer: Buffer,
  headline: string,
  designStyle: string
): Promise<Buffer> {
  ensureFont();

  const meta = await sharp(rawBuffer).metadata();
  const bgW  = meta.width  ?? 1080;
  const bgH  = meta.height ?? 1080;

  // Scale typography proportionally with image width
  const scale     = bgW / 1080;
  const FONT_SIZE = Math.round(56 * scale);
  const PADDING_H = Math.round(32 * scale);
  const PADDING_V = Math.round(26 * scale);
  const LINE_GAP  = Math.round(10 * scale);

  // Measure text with a scratch canvas before committing to bar height
  const scratch = createCanvas(bgW, 200);
  const sctx    = scratch.getContext("2d") as unknown as CanvasRenderingContext2D;
  sctx.font     = `bold ${FONT_SIZE}px "${FONT_FAMILY}"`;

  const lines = wrapLines(sctx, headline, bgW - PADDING_H * 2);
  const lineH = FONT_SIZE + LINE_GAP;
  const barH  = lines.length * lineH + PADDING_V * 2;

  // Draw the bar canvas
  const canvas = createCanvas(bgW, barH);
  const ctx    = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  // Solid black background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, bgW, barH);

  // White bold text, horizontally centred, top-aligned within each line slot
  ctx.fillStyle    = "#ffffff";
  ctx.font         = `bold ${FONT_SIZE}px "${FONT_FAMILY}"`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], bgW / 2, PADDING_V + i * lineH);
  }

  const barPng = canvas.toBuffer("image/png");

  // Composite bar PNG onto background using sharp (PNG-on-PNG via libvips, no librsvg)
  const top =
    designStyle === "screenshot" ? 0 :
    designStyle === "object"     ? Math.round((bgH - barH) / 2) :
    bgH - barH; // south — person_shocked, person_intense, person_curious

  return sharp(rawBuffer)
    .composite([{ input: barPng, top, left: 0 }])
    .png()
    .toBuffer();
}
