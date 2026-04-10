/**
 * R2b — Two-pass image pipeline: sharp headline compositor.
 *
 * AI image models (Flux, DALL-E, etc.) cannot reliably render text inside images —
 * spelling errors and hallucinated glyphs appear on every generation.
 * This module composites the headline as real typography onto the generated
 * image buffer using sharp/libvips (Pango/HarfBuzz), producing a publish-ready creative.
 *
 * No SVG, no librsvg — uses sharp's native text input with fontfile parameter.
 * This goes through libvips → Pango → HarfBuzz, completely bypassing librsvg.
 *
 * Design-style layout rules:
 *   screenshot      → dark bar at top   (readable over laptop/dashboard shots)
 *   object          → dark bar centered (draws eye to the object beneath text)
 *   person_shocked  → dark bar at south (face and expression stay unobstructed)
 *   person_intense  → dark bar at south
 *   person_curious  → dark bar at south
 *   (any other)     → dark bar at south (safe default)
 *
 * Fallback: if compositing fails for any reason the original imageBuffer is
 * returned unchanged — generation never blocks.
 */
import sharp from "sharp";
import { existsSync } from "fs";

// ── Bold TTF candidates — searched once per process ──────────────────────────
const BOLD_TTF_CANDIDATES = [
  // Ubuntu / Debian (fonts-dejavu-core package — installed via nixpacks.toml)
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  // Ubuntu (fonts-liberation package)
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
  // Ubuntu (ttf-freefont / fonts-freefont-ttf)
  "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
  // Ubuntu (fonts-ubuntu)
  "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf",
  // Ubuntu (fonts-noto)
  "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
  // Alpine / musl
  "/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf",
  // Catch-all
  "/usr/share/fonts/DejaVuSans-Bold.ttf",
];

// Cached once per process — `undefined` = not yet searched, `null` = not found
let _fontFilePath: string | null | undefined = undefined;

function getFontFilePath(): string | null {
  if (_fontFilePath !== undefined) return _fontFilePath;
  for (const p of BOLD_TTF_CANDIDATES) {
    try {
      if (existsSync(p)) {
        _fontFilePath = p;
        console.log("[compositeHeadline] found bold TTF at:", p);
        return _fontFilePath;
      }
    } catch { /* try next */ }
  }
  _fontFilePath = null;
  console.warn(
    "[compositeHeadline] WARNING: no bold TTF found at any candidate path.",
    "Text rendering will use Pango default fonts.",
  );
  return null;
}

export async function compositeHeadline(
  imageBuffer: Buffer,
  headline: string,
  designStyle: string,
): Promise<Buffer> {
  try {
    const meta = await sharp(imageBuffer).metadata();
    const W = meta.width  ?? 1080;
    const H = meta.height ?? 1080;

    const barH  = Math.round(H * 0.18);   // bar = 18% of image height
    const pad   = Math.round(W * 0.04);   // 4% padding each side
    const textW = W - pad * 2;            // usable text width

    // Determine bar background colour per design style
    let barAlpha: number;
    let gravity: "north" | "center" | "south";
    if (designStyle === "screenshot") {
      barAlpha = 0.82;
      gravity  = "north";
    } else if (designStyle === "object") {
      barAlpha = 0.77;
      gravity  = "center";
    } else {
      // person_shocked, person_intense, person_curious, any future style
      barAlpha = 0.75;
      gravity  = "south";
    }

    // ── Step 1: create the dark semi-transparent bar (no SVG) ────────────────
    // sharp.create with channels:4 gives us an RGBA buffer — no SVG/librsvg involved.
    const alphaInt = Math.round(barAlpha * 255);
    const barBuf = await sharp({
      create: {
        width:      W,
        height:     barH,
        channels:   4,
        background: { r: 0, g: 0, b: 0, alpha: alphaInt },
      },
    }).png().toBuffer();

    // ── Step 2: render white headline text via Pango/HarfBuzz ────────────────
    // sharp({ text: ... }) uses libvips text rendering (Pango + HarfBuzz).
    // This is entirely separate from the SVG pipeline — librsvg is NOT involved.
    const fontFilePath = getFontFilePath();

    // Pango markup: wrap in <span> to set colour to white and enable bold.
    // We use Pango markup (not plain text) so we can set foreground colour inline.
    const safePlain = headline
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

    const pangoText = `<span foreground="white" weight="bold">${safePlain}</span>`;

    const textOptions: sharp.TextOptions = {
      text:  pangoText,
      width: textW,
      // Leave height unconstrained — let Pango wrap naturally; we'll centre-align
      rgba:  true,
      align: "centre",
      dpi:   144,       // 2× DPI produces crisper glyphs on 1080px canvas
    };

    // fontfile overrides the Pango font search — uses the TTF directly.
    if (fontFilePath) {
      textOptions.fontfile = fontFilePath;
      textOptions.font     = "DejaVu Sans Bold";
    }

    const textRaw = await sharp({ text: textOptions }).png().toBuffer();

    // Measure the rendered text so we can centre it vertically in the bar
    const textMeta = await sharp(textRaw).metadata();
    const tW = textMeta.width  ?? textW;
    const tH = textMeta.height ?? Math.round(barH * 0.55);

    // Clamp text height so it always fits inside the bar with padding
    const maxTextH = Math.round(barH * 0.80);
    let finalTextBuf = textRaw;
    if (tH > maxTextH) {
      finalTextBuf = await sharp(textRaw)
        .resize({ height: maxTextH, fit: "inside" })
        .png().toBuffer();
    }

    const finalTextMeta = await sharp(finalTextBuf).metadata();
    const ftW = finalTextMeta.width  ?? tW;
    const ftH = finalTextMeta.height ?? tH;

    // Centre text horizontally and vertically inside the bar
    const textLeft = Math.round((W    - ftW) / 2);
    const textTop  = Math.round((barH - ftH) / 2);

    // ── Step 3: composite text onto bar ─────────────────────────────────────
    const barWithText = await sharp(barBuf)
      .composite([{
        input: finalTextBuf,
        left:  Math.max(0, textLeft),
        top:   Math.max(0, textTop),
      }])
      .png().toBuffer();

    // ── Step 4: composite bar+text onto the main image ───────────────────────
    const result = await sharp(imageBuffer)
      .composite([{ input: barWithText, gravity }])
      .png().toBuffer();

    console.log("[compositeHeadline] SUCCESS: text rendered, buffer size:", result.length);
    return result;

  } catch (err) {
    console.error("[compositeHeadline] FAILED:", err);
    return imageBuffer;
  }
}
