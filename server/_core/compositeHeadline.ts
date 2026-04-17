import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import * as path from "path";

// @napi-rs/canvas ships prebuilt linux-x64-gnu binaries with libcairo BUNDLED.
// We register DejaVuSans-Bold.ttf as the "ZapHeadline" family and draw directly
// onto the background image — no black bar, text IS part of the composite.

const FONT_PATH   = path.resolve(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf");
const FONT_FAMILY = "ZapHeadline";

let fontLoaded = false;
function ensureFont(): void {
  if (!fontLoaded) {
    GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY);
    fontLoaded = true;
    console.log(`[compositeHeadline] Font registered from ${FONT_PATH}`);
  }
}

function wrapGreedy(
  ctx: CanvasRenderingContext2D,
  words: string[],
  maxWidth: number
): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Find the largest font size that fits the text in ≤ maxLines.
// If the text won't fit even at minFontSize, truncate the last line with an ellipsis.
function layoutLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startFontSize: number,
  minFontSize: number,
  fontFamily: string,
  maxLines: number
): { lines: string[]; fontSize: number } {
  const words = text.split(/\s+/).filter(Boolean);

  for (let fs = startFontSize; fs >= minFontSize; fs -= 4) {
    ctx.font = `900 ${fs}px "${fontFamily}"`;
    const lines = wrapGreedy(ctx, words, maxWidth);
    const fits =
      lines.length <= maxLines &&
      lines.every(l => ctx.measureText(l).width <= maxWidth);
    if (fits) return { lines, fontSize: fs };
  }

  ctx.font = `900 ${minFontSize}px "${fontFamily}"`;
  const allLines  = wrapGreedy(ctx, words, maxWidth);
  const truncated = allLines.slice(0, maxLines);
  if (allLines.length > maxLines) {
    let last = truncated[maxLines - 1];
    while (ctx.measureText(last + "…").width > maxWidth && last.length > 0) {
      last = last.slice(0, -1).trimEnd();
    }
    truncated[maxLines - 1] = last + "…";
  }
  return { lines: truncated, fontSize: minFontSize };
}

export async function compositeHeadline(
  rawBuffer: Buffer,
  headline: string,
  _designStyle: string
): Promise<Buffer> {
  ensureFont();

  const img = await loadImage(rawBuffer);
  const W   = img.width;
  const H   = img.height;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  // Paint background image at its native dimensions
  ctx.drawImage(img as any, 0, 0, W, H);

  // Font size scales with image width, clamped
  const baseFontSize = Math.max(48, Math.min(140, Math.round(W / 14)));
  const MIN_FONT_SIZE = 48;

  const uppercased   = headline.toUpperCase();
  const maxTextWidth = W - 160; // 80px padding each side

  const { lines, fontSize } = layoutLines(
    ctx,
    uppercased,
    maxTextWidth,
    baseFontSize,
    MIN_FONT_SIZE,
    FONT_FAMILY,
    3
  );

  const lineHeight  = fontSize * 1.1;
  const blockHeight = lines.length * lineHeight;

  // Lower ~37.5% of the image — leave 2% bottom margin
  const regionTop    = H * 0.625;
  const regionBottom = H * 0.98;
  const regionHeight = regionBottom - regionTop;
  const blockTop     = regionTop + (regionHeight - blockHeight) / 2;

  ctx.font         = `900 ${fontSize}px "${FONT_FAMILY}"`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";

  // Subtle drop shadow applies to both stroke and fill passes
  ctx.shadowColor   = "rgba(0,0,0,0.6)";
  ctx.shadowBlur    = fontSize * 0.15;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = fontSize * 0.04;

  // Black stroke for readability on any background, white fill on top
  ctx.strokeStyle = "#000000";
  ctx.lineJoin    = "round";
  ctx.lineWidth   = fontSize * 0.08;
  ctx.fillStyle   = "#ffffff";

  const centerX = W / 2;
  for (let i = 0; i < lines.length; i++) {
    const y = blockTop + lineHeight * (i + 0.5);
    ctx.strokeText(lines[i], centerX, y);
    ctx.fillText(lines[i], centerX, y);
  }

  // Clear shadow state so nothing bleeds into subsequent draws on this context
  ctx.shadowColor   = "transparent";
  ctx.shadowBlur    = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  return canvas.toBuffer("image/png");
}
