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

    const barH  = Math.round(H * 0.18);   // bar = 18% of image height
    const pad   = Math.round(W * 0.04);   // 4% padding each side
    const textW = W - pad * 2;            // usable text width
    const cx    = W / 2;                  // horizontal centre

    /**
     * Dynamic font sizing — avoids the textLength/lengthAdjust squeeze that
     * made long headlines render as illegible hair-thin glyphs.
     *
     * Approach:
     *   1. Estimate natural text width using a conservative 0.58em-per-char ratio
     *      for bold sans-serif (slightly over-estimates to stay safe).
     *   2. If the headline fits at max size, use max size.
     *   3. If not, scale font down until it fits, honouring a minimum readable floor.
     *   4. If the floor is hit and text still overflows, word-wrap into two lines and
     *      re-calculate font size against the longer of the two.
     *
     * Font stack uses cross-platform fonts available on Railway Linux (nixpacks
     * Ubuntu) via librsvg: DejaVu Sans Bold, Liberation Sans Bold, FreeSans,
     * with generic sans-serif as final fallback.
     */
    const FONT     = "DejaVu Sans,Liberation Sans,FreeSans,Arial,sans-serif";
    const EM_RATIO = 0.58;                              // approx char-width / font-size for bold sans
    const maxFs    = Math.round(barH * 0.44);
    const minFs    = Math.round(barH * 0.22);

    function fitFontSize(text: string): number {
      const natural = text.length * maxFs * EM_RATIO;
      if (natural <= textW) return maxFs;
      const scaled = Math.round(textW / (text.length * EM_RATIO));
      return Math.max(scaled, minFs);
    }

    // Try single-line first
    let lines: string[] = [safe];
    let fontSize = fitFontSize(safe);

    // If still squished at minFs, split into two lines at the nearest mid-word
    if (fontSize <= minFs && headline.length > 20) {
      const mid = Math.floor(headline.length / 2);
      let splitAt = mid;
      for (let d = 1; d <= 25; d++) {
        if (headline[mid - d] === " ") { splitAt = mid - d; break; }
        if (headline[mid + d] === " ") { splitAt = mid + d; break; }
      }
      const l1 = safe.slice(0, splitAt).trim();
      const l2 = safe.slice(splitAt).trim();
      lines    = [l1, l2];
      const longestLine = l1.length >= l2.length ? l1 : l2;
      fontSize = fitFontSize(longestLine);
    }

    /**
     * Build SVG text node(s).
     * Single line: vertically centred in the bar.
     * Two lines: stacked at 38% and 76% of bar height.
     */
    function buildTextNodes(): string {
      if (lines.length === 1) {
        const y = Math.round(barH * 0.66);
        return (
          `<text x="${cx}" y="${y}" text-anchor="middle"` +
          ` font-family="${FONT}" font-size="${fontSize}" font-weight="bold" fill="white"` +
          `>${lines[0]}</text>`
        );
      }
      const y1 = Math.round(barH * 0.40);
      const y2 = Math.round(barH * 0.80);
      return (
        `<text x="${cx}" y="${y1}" text-anchor="middle"` +
        ` font-family="${FONT}" font-size="${fontSize}" font-weight="bold" fill="white"` +
        `>${lines[0]}</text>` +
        `<text x="${cx}" y="${y2}" text-anchor="middle"` +
        ` font-family="${FONT}" font-size="${fontSize}" font-weight="bold" fill="white"` +
        `>${lines[1]}</text>`
      );
    }

    const buildSvg = (bgColor: string): Buffer =>
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${barH}">` +
        `<rect width="${W}" height="${barH}" fill="${bgColor}"/>` +
        buildTextNodes() +
        `</svg>`
      );

    if (designStyle === "screenshot") {
      // Top bar — sits above the laptop/dashboard scene
      return sharp(imageBuffer)
        .composite([{ input: buildSvg("rgba(0,0,0,0.82)"), gravity: "north" }])
        .png()
        .toBuffer();
    }

    if (designStyle === "object") {
      // Centred bar — text floats over the object, drawing the eye in
      return sharp(imageBuffer)
        .composite([{ input: buildSvg("rgba(0,0,0,0.77)"), gravity: "center" }])
        .png()
        .toBuffer();
    }

    // Default: person_shocked, person_intense, person_curious — south bar
    // Keeps the face/expression in the upper portion, text at the bottom
    return sharp(imageBuffer)
      .composite([{ input: buildSvg("rgba(0,0,0,0.75)"), gravity: "south" }])
      .png()
      .toBuffer();

  } catch (err) {
    // Never block generation — return the original buffer if compositing fails
    console.error("[compositeHeadline] SVG composite failed, returning original buffer:", err);
    return imageBuffer;
  }
}
