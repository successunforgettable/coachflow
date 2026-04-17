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
    const ok = GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY);
    fontLoaded = true;
    console.log(`[compositeHeadline] Font registered from ${FONT_PATH} — registerFromPath returned: ${ok}`);
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

// Find the largest font size that fits within maxLines AND within maxBlockHeight.
// If the text won't fit even at minFontSize, truncate the last line with an ellipsis.
function layoutLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxBlockHeight: number,
  startFontSize: number,
  minFontSize: number,
  fontFamily: string,
  maxLines: number,
  lineHeightRatio: number
): { lines: string[]; fontSize: number } {
  const words = text.split(/\s+/).filter(Boolean);

  for (let fs = startFontSize; fs >= minFontSize; fs -= 4) {
    ctx.font = `bold ${fs}px "${fontFamily}"`;
    const lines       = wrapGreedy(ctx, words, maxWidth);
    const blockHeight = lines.length * fs * lineHeightRatio;
    const fits =
      lines.length <= maxLines &&
      blockHeight <= maxBlockHeight &&
      lines.every(l => ctx.measureText(l).width <= maxWidth);
    if (fits) return { lines, fontSize: fs };
  }

  ctx.font = `bold ${minFontSize}px "${fontFamily}"`;
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

// Positioning region as fractions of image height, keyed by designStyle.
// screenshot → upper band (so UI screenshots stay visible in the lower part)
// object     → centred band
// person_*   → lower band (so the subject's face stays uncovered)
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
  ensureFont();

  console.log(`[compositeHeadline] START — headline: "${headline.slice(0, 60)}", style: ${designStyle}, inputSize: ${rawBuffer.length}`);

  const img = await loadImage(rawBuffer);
  const W   = img.width;
  const H   = img.height;

  console.log(`[compositeHeadline] Image loaded — ${W}×${H}`);

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  // Paint background image at its native dimensions
  ctx.drawImage(img as any, 0, 0, W, H);

  // Sanity-check font rendering — if measureText returns 0 for a known word,
  // the font did not load for rendering (even if registerFromPath returned true).
  ctx.font = `bold 100px "${FONT_FAMILY}"`;
  const probeWidth = ctx.measureText("HELLO").width;
  console.log(`[compositeHeadline] Font probe — measureText("HELLO") at bold 100px = ${probeWidth.toFixed(1)}px`);
  if (probeWidth < 10) {
    throw new Error(`[compositeHeadline] Font "${FONT_FAMILY}" is not rendering (measureText returned ${probeWidth}). Check that ${FONT_PATH} is accessible and @napi-rs/canvas can load it.`);
  }

  // Big, poster-style sizing — scales with width, clamped
  const baseFontSize  = Math.max(64, Math.min(180, Math.round(W / 10)));
  const MIN_FONT_SIZE = 56;
  const LINE_HEIGHT   = 1.08;
  const MAX_LINES     = 3;

  const uppercased   = headline.toUpperCase();
  const maxTextWidth = W - 160; // 80px padding each side

  const region       = regionForStyle(H, designStyle);
  const regionHeight = region.bottom - region.top;

  const { lines, fontSize } = layoutLines(
    ctx,
    uppercased,
    maxTextWidth,
    regionHeight,
    baseFontSize,
    MIN_FONT_SIZE,
    FONT_FAMILY,
    MAX_LINES,
    LINE_HEIGHT
  );

  const lineHeight  = fontSize * LINE_HEIGHT;
  const blockHeight = lines.length * lineHeight;
  const blockTop    = region.top + (regionHeight - blockHeight) / 2;

  console.log(`[compositeHeadline] Layout — fontSize: ${fontSize}, lines: ${lines.length}, region: ${Math.round(region.top)}-${Math.round(region.bottom)}, blockTop: ${Math.round(blockTop)}`);

  ctx.font         = `bold ${fontSize}px "${FONT_FAMILY}"`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";

  // Subtle drop shadow applies to both stroke and fill passes
  ctx.shadowColor   = "rgba(0,0,0,0.6)";
  ctx.shadowBlur    = fontSize * 0.15;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = fontSize * 0.04;

  // Thick black stroke for readability on any background, white fill on top
  ctx.strokeStyle = "#000000";
  ctx.lineJoin    = "round";
  ctx.lineWidth   = fontSize * 0.12;
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

  const outBuf = canvas.toBuffer("image/png");
  console.log(`[compositeHeadline] DONE — outputSize: ${outBuf.length} (input was ${rawBuffer.length}, delta: ${outBuf.length - rawBuffer.length})`);
  return outBuf;
}
