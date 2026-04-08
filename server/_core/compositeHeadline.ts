// cache-bust: fonts-dejavu-core
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
 * Font rendering:
 *   Railway nixpacks Ubuntu has no fontconfig config file, so librsvg's SVG
 *   <text> renderer gets no fonts and produces invisible zero-height glyphs.
 *
 *   Fix applied at module load (two-level):
 *   1. Write a minimal /tmp/fc-conf/fonts.conf and set FONTCONFIG_FILE so
 *      fontconfig can scan /usr/share/fonts (where Ubuntu font packages land).
 *   2. Find a bold TTF by direct filesystem path search and embed it as a
 *      data: URI inside SVG @font-face — this bypasses fontconfig name
 *      resolution entirely so the font works regardless of config state.
 *
 * Fallback: if compositing fails for any reason the original imageBuffer is
 * returned unchanged — generation never blocks.
 */
import sharp from "sharp";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// ── Level-1 fix: write a minimal fontconfig.conf so fontconfig finds /usr/share/fonts ──
(function bootstrapFontconfig() {
  // If FONTCONFIG_FILE already points at a real file, leave it alone.
  if (process.env.FONTCONFIG_FILE && existsSync(process.env.FONTCONFIG_FILE)) return;
  try {
    const dir = join(tmpdir(), "fc-conf");
    mkdirSync(dir, { recursive: true });
    const cachedir = join(tmpdir(), "fc-cache");
    mkdirSync(cachedir, { recursive: true });
    const conf = join(dir, "fonts.conf");
    writeFileSync(
      conf,
      [
        '<?xml version="1.0"?>',
        '<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">',
        "<fontconfig>",
        "  <!-- Standard Ubuntu font directories -->",
        "  <dir>/usr/share/fonts</dir>",
        "  <dir>/usr/local/share/fonts</dir>",
        `  <cachedir>${cachedir}</cachedir>`,
        "  <match target=\"pattern\">",
        "    <test qual=\"any\" name=\"family\"><string>sans-serif</string></test>",
        "    <edit name=\"family\" mode=\"prepend_first\"><string>DejaVu Sans</string></edit>",
        "  </match>",
        "</fontconfig>",
      ].join("\n"),
    );
    process.env.FONTCONFIG_FILE = conf;
    console.log("[compositeHeadline] fontconfig initialised →", conf);
  } catch (err) {
    console.warn("[compositeHeadline] fontconfig init failed:", err);
  }
})();

// ── Level-2 fix: embed a bold TTF as a data: URI in SVG @font-face ──────────
// Bypasses fontconfig name resolution — librsvg loads font bytes from the SVG
// string itself, no filesystem lookup needed after the initial file read.
const BOLD_TTF_CANDIDATES = [
  // Ubuntu / Debian (fonts-dejavu-core package)
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
let _embeddedFontUri: string | null | undefined = undefined;

function getEmbeddedFontUri(): string | null {
  if (_embeddedFontUri !== undefined) return _embeddedFontUri;
  for (const p of BOLD_TTF_CANDIDATES) {
    try {
      if (existsSync(p)) {
        const b64 = readFileSync(p).toString("base64");
        _embeddedFontUri = `data:font/truetype;base64,${b64}`;
        console.log("[compositeHeadline] embedded bold TTF from:", p);
        return _embeddedFontUri;
      }
    } catch { /* try next */ }
  }
  _embeddedFontUri = null;
  console.warn(
    "[compositeHeadline] WARNING: no bold TTF found at any candidate path.",
    "Text will use system font fallback (may be invisible if no fonts installed).",
    "To fix permanently, add nixpacks.toml: aptPkgs = [\"fonts-dejavu-core\"]",
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

    // Dynamic font sizing — avoids textLength/lengthAdjust squeeze
    const EM_RATIO = 0.58;
    const maxFs    = Math.round(barH * 0.44);
    const minFs    = Math.round(barH * 0.22);

    function fitFontSize(text: string): number {
      const natural = text.length * maxFs * EM_RATIO;
      if (natural <= textW) return maxFs;
      const scaled = Math.round(textW / (text.length * EM_RATIO));
      return Math.max(scaled, minFs);
    }

    // Single-line first; split to two lines only if still squished at minFs
    let lines: string[] = [safe];
    let fontSize = fitFontSize(safe);

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

    // ── Build SVG ────────────────────────────────────────────────────────────
    // If a bold TTF was found, embed it as a data: URI in @font-face so
    // librsvg loads the font bytes directly from the SVG string — no fontconfig
    // name resolution needed. Otherwise fall back to a generic font stack.
    const fontUri = getEmbeddedFontUri();
    const FAMILY  = fontUri ? "ZH" : "DejaVu Sans,Liberation Sans,FreeSans,sans-serif";

    const fontFaceBlock = fontUri
      ? `<defs><style>@font-face{` +
        `font-family:"ZH";` +
        `src:url("${fontUri}") format("truetype");` +
        `font-weight:bold;` +
        `}</style></defs>`
      : "";

    function buildTextNodes(): string {
      const attrs =
        `text-anchor="middle" font-family="${FAMILY}" font-size="${fontSize}"` +
        ` font-weight="bold" fill="white"`;
      if (lines.length === 1) {
        const y = Math.round(barH * 0.66);
        return `<text x="${cx}" y="${y}" ${attrs}>${lines[0]}</text>`;
      }
      const y1 = Math.round(barH * 0.40);
      const y2 = Math.round(barH * 0.80);
      return (
        `<text x="${cx}" y="${y1}" ${attrs}>${lines[0]}</text>` +
        `<text x="${cx}" y="${y2}" ${attrs}>${lines[1]}</text>`
      );
    }

    const buildSvg = (bgColor: string): Buffer =>
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${barH}">` +
        fontFaceBlock +
        `<rect width="${W}" height="${barH}" fill="${bgColor}"/>` +
        buildTextNodes() +
        `</svg>`,
      );

    let result: Buffer;

    if (designStyle === "screenshot") {
      result = await sharp(imageBuffer)
        .composite([{ input: buildSvg("rgba(0,0,0,0.82)"), gravity: "north" }])
        .png().toBuffer();
    } else if (designStyle === "object") {
      result = await sharp(imageBuffer)
        .composite([{ input: buildSvg("rgba(0,0,0,0.77)"), gravity: "center" }])
        .png().toBuffer();
    } else {
      // person_shocked, person_intense, person_curious, and any future style
      result = await sharp(imageBuffer)
        .composite([{ input: buildSvg("rgba(0,0,0,0.75)"), gravity: "south" }])
        .png().toBuffer();
    }

    console.log("[compositeHeadline] SUCCESS: text rendered, buffer size:", result.length);
    return result;

  } catch (err) {
    console.error("[compositeHeadline] FAILED:", err);
    return imageBuffer;
  }
}
