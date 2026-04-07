/**
 * R2b — Two-pass image pipeline: sharp headline compositor.
 *
 * AI image models (Flux, DALL-E, etc.) cannot reliably render text inside images —
 * spelling errors and hallucinated glyphs appear on every generation.
 * This module composites the headline as real SVG typography onto the generated
 * image buffer using sharp/libvips, producing a publish-ready creative.
 *
 * Design-style layout rules:
 *   screenshot      → dark bar at top   (readable over laptop/dashboard shots)
 *   object          → dark bar centered (draws eye to the object beneath text)
 *   person_shocked  → dark bar at south (face and expression stay unobstructed)
 *   person_intense  → dark bar at south
 *   person_curious  → dark bar at south
 *   (any other)     → dark bar at south (safe default)
 *
 * Text rendering:
 *   - SVG text with textLength + lengthAdjust="spacingAndGlyphs" guarantees the
 *     headline fits the bar width regardless of character count.
 *   - Font stack: Arial Black → Arial → Helvetica → sans-serif (all present on
 *     Railway Linux nixpacks via the sharp prebuilt binary environment).
 *   - Bar height = 18% of image height — correct proportion for 1080×1080,
 *     1200×628, and 1080×1920 formats.
 *
 * Fallback: if compositing fails for any reason (e.g. SVG parse error),
 * the original imageBuffer is returned unchanged — generation never blocks.
 */
import sharp from "sharp";

/**
 * Composite a headline string onto an image buffer using SVG text overlay.
 *
 * @param imageBuffer  Raw PNG/JPEG buffer from the AI image generator
 * @param headline     Uppercase headline string (from HEADLINE_FORMULAS)
 * @param designStyle  One of the five adCreatives design styles
 * @returns            New PNG buffer with headline composited in
 */
export async function compositeHeadline(
  imageBuffer: Buffer,
  headline: string,
  designStyle: string,
): Promise<Buffer> {
  try {
    const meta = await sharp(imageBuffer).metadata();
    const W = meta.width  ?? 1080;
    const H = meta.height ?? 1080;

    // Sanitise XML special characters so the SVG is always valid
    const safe = headline
      .replace(/&/g,  "&amp;")
      .replace(/</g,  "&lt;")
      .replace(/>/g,  "&gt;")
      .replace(/"/g,  "&quot;");

    const barH    = Math.round(H * 0.18);       // bar = 18% of image height
    const pad     = Math.round(W * 0.05);        // 5% horizontal padding each side
    const textW   = W - pad * 2;                 // available text width
    const fontSize = Math.round(barH * 0.44);   // font size relative to bar height
    const textY   = Math.round(barH * 0.66);    // vertical anchor inside bar

    /**
     * Build an SVG buffer: a filled rectangle with a single bold text element.
     * textLength + lengthAdjust forces the text to exactly fill the available width —
     * short headlines expand, long headlines compress, no overflow ever.
     */
    const buildSvg = (bgColor: string): Buffer =>
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${barH}">` +
        `<rect width="${W}" height="${barH}" fill="${bgColor}"/>` +
        `<text` +
        ` x="${pad}" y="${textY}"` +
        ` font-family="Arial Black,Arial,Helvetica,sans-serif"` +
        ` font-size="${fontSize}"` +
        ` font-weight="900"` +
        ` fill="white"` +
        ` textLength="${textW}"` +
        ` lengthAdjust="spacingAndGlyphs"` +
        `>${safe}</text>` +
        `</svg>`
      );

    if (designStyle === "screenshot") {
      // Top bar — sits above the laptop/dashboard scene
      return sharp(imageBuffer)
        .composite([{ input: buildSvg("rgba(0,0,0,0.80)"), gravity: "north" }])
        .png()
        .toBuffer();
    }

    if (designStyle === "object") {
      // Centred bar — text floats over the object, drawing the eye in
      return sharp(imageBuffer)
        .composite([{ input: buildSvg("rgba(0,0,0,0.75)"), gravity: "center" }])
        .png()
        .toBuffer();
    }

    // Default: person_shocked, person_intense, person_curious — south bar
    // Keeps the face/expression in the upper portion, text at the bottom
    return sharp(imageBuffer)
      .composite([{ input: buildSvg("rgba(0,0,0,0.72)"), gravity: "south" }])
      .png()
      .toBuffer();

  } catch (err) {
    // Never block generation — return the original buffer if compositing fails
    console.error("[compositeHeadline] SVG composite failed, returning original buffer:", err);
    return imageBuffer;
  }
}
