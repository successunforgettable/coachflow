import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import opentype, { Font } from "opentype.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { adCopy, services } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Ad-creative render template (Stage 2 — successor to the bare white-outline
 * headline compositor). One designed layer over the Flux photo, applied to
 * EVERY photo style incl. tabloid. Pipeline unchanged: opentype.js emits glyph
 * paths → resvg rasterises the SVG → sharp composites over the background.
 *
 * The layer, bottom-anchored, over a dark gradient scrim (the in-render
 * legibility guarantee — never trusted to Flux):
 *   scrim → two-tone Playfair headline → Instrument body block → gold CTA pill.
 * No host lockup (product decision: AI subjects only). No price.
 */

/**
 * ─── THE TEXT-SAFE ZONE — ONE DEFINITION, SHARED WITH THE PHOTO PROMPT ───────
 *
 * ⚠️ THIS EXISTS BECAUSE FIX 3 FAILED ON 2026-08-05. The photo prompt reserved a band in English
 * ("the lower portion is calm") and the compositor reserved a band in pixels, and the two were
 * written independently. They disagreed: the finished ad laid its headline straight across the
 * work surface the scene had been told to keep clear. Moving the scene again would not fix that —
 * only making both halves read the SAME definition fixes it.
 *
 * ── MEASURED, NOT TAKEN FROM RESEARCH ────────────────────────────────────────
 * The banked safe-zone figures ([SEPARATION §3] 4:5 top 14% / bottom 20%; [COHERENCE §4] Center
 * Band) describe META'S UI overlaying the ad. They say nothing about how much canvas OUR OWN type
 * consumes. That is a property of this file, so it is measured from this file — by pushing a flat
 * synthetic plate through renderAdCreative at worst-case content and finding the topmost glyph.
 * `scripts/measure-text-safe-zone.ts` performs that measurement; the layer suite re-runs it as a
 * regression test, so this constant cannot drift from reality unnoticed.
 *
 * ── IT IS NOT RATIO-INVARIANT, WHICH IS WHY THIS IS A FUNCTION AND NOT A SCALAR ──
 * Measured topmost-glyph fraction: 4:5 = 0.6445 · 1:1 = 0.5693 · 9:16 = 0.5875. Identical across
 * SIZES within a ratio (1024x1280 vs 1440x1800 differ by 0.0001) but 5.7pp apart between 4:5 and
 * 9:16. A single exported scalar would silently mis-reserve `makeVertical`'s 9:16 path.
 *
 * The reason is structural, which is what makes it derivable:
 *   • the text block's own height depends only on WIDTH — fonts and wrapping scale off W
 *   • its offset from the bottom edge is padBottom, which depends on HEIGHT, and for vertical
 *     canvases jumps to H*0.20 for Stories UI clearance
 *
 *     textBlockHeight ≈ TEXT_BLOCK_H_PER_W * W        (1024→385px, 1440→541px)
 *     reservedFromBottom = textBlockHeight + padBottom(H)
 *
 * Predicting 9:16 from that gives textTop 1130 against 1128 measured — two pixels.
 */
export const TEXT_BLOCK_H_PER_W = 0.376;

/** Mirrors renderAdCreative's own padBottom. Kept adjacent so the two cannot drift apart. */
function padBottomFor(W: number, H: number): number {
  const vertical = H / W >= 1.5;
  return Math.max(Math.round(H * 0.055), vertical ? Math.round(H * 0.20) : 0);
}

/**
 * The band at the bottom of the canvas that the compositor will write into, as fractions of H.
 * `reservedFrac` is measured from the SCRIM top, not the glyph top: the scrim darkens the picture
 * and is the honest edge of "the compositor has taken this area".
 *
 * A photo prompt that keeps focal content above `1 - reservedFrac` will not be written over.
 */
export function textSafeZoneFor(W: number, H: number): {
  textTopFrac: number; scrimTopFrac: number; reservedFrac: number;
} {
  const textTopPx = H - (TEXT_BLOCK_H_PER_W * W + padBottomFor(W, H));
  const scrimTopPx = Math.max(0, textTopPx - H * 0.14); // matches scrimTop for zone:"lower"
  const scrimTopFrac = scrimTopPx / H;
  return { textTopFrac: textTopPx / H, scrimTopFrac, reservedFrac: 1 - scrimTopFrac };
}

/**
 * The same reservation expressed as the words a diffusion prompt can act on. This is the coupling:
 * the scene's zone clause is CHOSEN FROM the measured number rather than written independently.
 * Bands are deliberately coarse — a model cannot act on "the lower 47.4%".
 */
export function reservedBandWording(W: number, H: number): string {
  const { reservedFrac } = textSafeZoneFor(W, H);
  if (reservedFrac >= 0.50) return "the lower three-fifths";
  if (reservedFrac >= 0.42) return "the lower half";
  return "the lower third";
}

// ─── Palette (matched to the reference set) ──────────────────────────────────
const GOLD = "#D4A24A";
const WHITE = "#FFFFFF";
const BODY_INK = "#EAE3D6"; // warm off-white, editorial
const PILL_INK = "#0E0E12"; // near-black on the gold pill

// ─── Font loading — keyed 2-font cache ───────────────────────────────────────
const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
function resolveFontPath(file: string): string {
  const candidates = [
    path.resolve(__moduleDir, `../assets/fonts/${file}`),    // prod: dist/ → ../assets
    path.resolve(__moduleDir, `../../assets/fonts/${file}`), // dev: server/_core/ → ../../assets
    path.resolve(process.cwd(), `assets/fonts/${file}`),     // fallback
  ];
  return candidates.find(p => fs.existsSync(p)) ?? candidates[0];
}
const FONT_FILES: Record<"headline" | "body", string> = {
  headline: "PlayfairDisplay-ExtraBold.ttf",
  body: "InstrumentSans-Regular.ttf",
};
const fontCache: Partial<Record<"headline" | "body", Font>> = {};
function getFont(kind: "headline" | "body"): Font {
  const cached = fontCache[kind];
  if (cached) return cached;
  const p = resolveFontPath(FONT_FILES[kind]);
  const buf = fs.readFileSync(p);
  const magic = buf.slice(0, 4).toString("hex");
  if (magic !== "00010000" && magic !== "4f54544f") {
    throw new Error(`[renderAdCreative] Font ${p} is not a valid TTF/OTF — first 4 bytes 0x${magic}.`);
  }
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const font = opentype.parse(ab);
  fontCache[kind] = font;
  console.log(`[renderAdCreative] Font ${kind} parsed: ${p} (${font.glyphs.length} glyphs)`);
  return font;
}

// ─── Text layout helpers ─────────────────────────────────────────────────────
function wrapGreedy(font: Font, text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.getAdvanceWidth(candidate, fontSize) <= maxWidth) current = candidate;
    else { if (current) lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}

/** Font-size cascade: shrink until it fits maxWidth within maxLines. */
function fitLines(
  font: Font, text: string, maxWidth: number, startSize: number, minSize: number, maxLines: number,
): { lines: string[]; fontSize: number } {
  for (let fs = startSize; fs >= minSize; fs -= 2) {
    const lines = wrapGreedy(font, text, maxWidth, fs);
    const everyLineFits = lines.every(l => font.getAdvanceWidth(l, fs) <= maxWidth);
    if (lines.length <= maxLines && everyLineFits) return { lines, fontSize: fs };
  }
  // Min size — accept overflow lines, truncate to maxLines with an ellipsis.
  const all = wrapGreedy(font, text, maxWidth, minSize);
  if (all.length <= maxLines) return { lines: all, fontSize: minSize };
  const kept = all.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
  return { lines: kept, fontSize: minSize };
}

/**
 * Deterministic accent heuristic — fallback when the generator did not emit an
 * emphasis (recomposite / legacy / wizard headlines) or its emphasis is not a
 * substring. Picks the final clause (after the last separator) or the last few
 * words, so it is reproducible from the headline string alone (parity-safe).
 */
export function deriveAccent(headline: string): string {
  const h = headline.trim();
  const sepIdx = Math.max(
    h.lastIndexOf(":"), h.lastIndexOf(" — "), h.lastIndexOf(" – "), h.lastIndexOf(" - "),
    h.lastIndexOf(", "), h.lastIndexOf(". "),
  );
  if (sepIdx > 0) {
    const clause = h.slice(sepIdx).replace(/^[\s:,.\-–—]+/, "").trim();
    const wc = clause.split(/\s+/).filter(Boolean).length;
    if (clause.length >= 5 && wc >= 1 && wc <= 5) return clause;
  }
  const words = h.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return h;
  const n = Math.min(3, words.length - 1);
  return words.slice(words.length - n).join(" ");
}

/** SVG <path> element for one string positioned with its baseline at (x, y). */
function glyphPath(font: Font, ch: string, x: number, y: number, size: number): string {
  return `<path d="${font.getPath(ch, x, y, size).toPathData(2)}"/>`;
}

// ─── Public: resolve the campaign-aligned body text (reused ad-copy) ─────────
function trimToLength(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (lastSentence > max * 0.5) return cut.slice(0, lastSentence + 1).trim();
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).trim()}…`;
}

/**
 * Body-copy source: reuse the selected ad-copy primary text (~140 chars,
 * campaign-aligned), mainBenefit fallback. Strips operator-fill tokens and, per
 * the no-price-on-creatives rule, drops any candidate where a currency amount
 * survives the trim.
 *
 * P8 fix (2026-07-29): returns the DECK, not one row. The prior `.limit(1)`
 * meant every variation in a batch composited the identical body line even
 * when the generator had produced several — measured on prod, 3 body rows
 * exist per service and two were discarded on every batch. Callers rotate by
 * variation index. Ordered newest-first so index 0 is the row the old
 * single-value behaviour returned (parity for recomposite paths).
 */
export async function resolveAdBodyTexts(
  db: any, userId: number, serviceId: number | null | undefined, limit = 5,
): Promise<string[]> {
  if (serviceId == null) return [];
  // Robust to markdown-escaped underscores in stored copy (e.g. "[INSERT\_X]").
  const stripTokens = (s: string) => s.replace(/\[INSERT[^\]]*\]/gi, "").replace(/\s+/g, " ").trim();
  const hasPrice = (s: string) => /[£$€]\s?\d/.test(s);
  let bodies: string[] = [];
  try {
    const rows = await db.select({ content: adCopy.content })
      .from(adCopy)
      .where(and(eq(adCopy.userId, userId), eq(adCopy.serviceId, serviceId), eq(adCopy.contentType, "body")))
      .orderBy(desc(adCopy.id))
      .limit(limit);
    bodies = (rows ?? [])
      .map((r: { content: string | null }) => trimToLength(stripTokens(r?.content ?? ""), 140))
      .filter((b: string) => b.length > 0 && !hasPrice(b));
  } catch { /* fall through to mainBenefit */ }
  if (bodies.length === 0) {
    try {
      const [svc] = await db.select({ mainBenefit: services.mainBenefit })
        .from(services).where(eq(services.id, serviceId)).limit(1);
      const fallback = trimToLength(stripTokens(svc?.mainBenefit ?? ""), 140);
      if (fallback) bodies = [fallback];
    } catch { /* leave empty */ }
  }
  return bodies;
}

/**
 * Single-body convenience wrapper — unchanged contract for the recomposite and
 * single-creative paths, which render one creative and want the same row the
 * batch's index-0 variation used.
 */
export async function resolveAdBodyText(db: any, userId: number, serviceId: number | null | undefined): Promise<string> {
  const bodies = await resolveAdBodyTexts(db, userId, serviceId, 1);
  return bodies[0] ?? "";
}

// ─── Public: the render template ─────────────────────────────────────────────
export type RenderAdCreativeInput = {
  headline: string;
  emphasis?: string;   // verbatim substring to render gold; heuristic fallback
  bodyText?: string;   // ~140-char campaign-aligned body (no price)
  ctaLabel: string;    // CAMPAIGN_TO_CTA[campaignType]
  // Composition zone — the compositor half of a two-sided contract with the
  // photo prompt, which is told to leave this zone clean.
  //   "left"   = editorial, text in the reserved left column (subject right)
  //   "bottom" = editorial, left-aligned lower third
  //   "lower"  = TABLOID (2026-07-29). Centered and bottom-anchored exactly as
  //              before, so the tabloid look is unchanged, but it now declares
  //              the reserved band and gets a scrim that actually covers it.
  //   undefined = legacy tabloid, no contract. Kept so the recomposite and
  //              wizard-single paths render byte-identically to what they
  //              already produced; new batches pass "lower".
  zone?: "left" | "bottom" | "lower";
};

export async function renderAdCreative(rawBuffer: Buffer, input: RenderAdCreativeInput): Promise<Buffer> {
  const headFont = getFont("headline");
  const bodyFont = getFont("body");

  const meta = await sharp(rawBuffer).metadata();
  const W = meta.width ?? 1080;
  const H = meta.height ?? 1080;

  // Ratio-aware canvas. Tall verticals (9:16, ratio ≥ 1.5) are Stories/Reels/
  // TikTok/Shorts placements: the platform overlays its own UI over the top ~10%
  // (profile/username) and bottom ~20% (caption + action buttons). Keep the copy
  // clear of those bands so it is never obscured — this is the whole reason a
  // 9:16 is a reflow, not a crop of the feed image. 4:5 and 1:1 keep prior pads
  // exactly (byte-identical feed behaviour).
  const vertical = H / W >= 1.5;
  const uiSafeTop = vertical ? Math.round(H * 0.11) : 0;
  const uiSafeBottom = vertical ? Math.round(H * 0.20) : 0;

  const padX = Math.round(W * 0.06);
  const padBottom = Math.max(Math.round(H * 0.055), uiSafeBottom);
  const padTop = Math.max(Math.round(H * 0.07), uiSafeTop);
  const contentW = W - padX * 2;

  // ── Composition contract: zone drives column, alignment, anchor, scrim.
  //    undefined = tabloid (centered, bottom-anchored, full-width, bottom scrim)
  //    "bottom"  = editorial, left-aligned, bottom-anchored, bottom scrim
  //    "left"    = editorial, left-aligned, TOP-anchored, left column, left scrim
  const zone = input.zone;
  // "lower" keeps the tabloid centring — it changes the CONTRACT and the scrim,
  // never the layout, so a fixed creative still reads as a tabloid creative.
  const align: "center" | "left" = zone === undefined || zone === "lower" ? "center" : "left";
  // On a tall vertical the copy always sits in the lower safe zone (above the
  // bottom UI band, clear of the top one) — the natural vertical-ad anchor and
  // it keeps the CTA in thumb reach. On feed ratios the "left" zone keeps its
  // top anchor, everything else bottom (unchanged).
  const anchor: "top" | "bottom" = vertical ? "bottom" : zone === "left" ? "top" : "bottom";
  const colX = padX;
  const colW = zone === "left" ? Math.round(W * 0.50) : contentW;
  const lineX = (lineW: number) => (align === "center" ? (W - lineW) / 2 : colX);

  // ── Sizes (independent of anchor) ──
  const pillLabel = (input.ctaLabel || "").trim().toUpperCase();
  const pillSize = Math.max(20, Math.round(W / 34));
  const pillLabelW = bodyFont.getAdvanceWidth(pillLabel, pillSize);
  const pillPadX = Math.round(pillSize * 1.15);
  const pillH = Math.round(pillSize * 2.4);
  const pillW = Math.round(pillLabelW + pillPadX * 2);
  const pillGap = Math.round(pillSize * 1.4);

  const bodyText = (input.bodyText ?? "").trim();
  const bodySize = Math.max(18, Math.round(W / 32));
  const bodyLH = bodySize * 1.32;
  const bodyLines = bodyText ? fitLines(bodyFont, bodyText, colW, bodySize, Math.round(bodySize * 0.8), 4).lines : [];
  const bodyBlockH = bodyLines.length * bodyLH;

  const headText = input.headline.trim().toUpperCase();
  const headStart = Math.max(40, Math.min(Math.round(W / 8), Math.round(W / 12)));
  const headMin = Math.max(30, Math.round(W / 20));
  const { lines: headLines, fontSize: headSize } = fitLines(headFont, headText, colW, headStart, headMin, 3);
  const headLH = headSize * 1.08;
  const headBlockH = headLines.length * headLH;
  const headGap = Math.round(headSize * 0.5);

  // ── Positions by anchor ──
  let headTop: number, bodyTop: number, pillTop: number;
  if (anchor === "bottom") {
    pillTop = H - padBottom - pillH;
    const bodyBottom = pillTop - pillGap;
    bodyTop = bodyBottom - bodyBlockH;
    const headBottom = (bodyLines.length ? bodyTop : pillTop) - headGap;
    headTop = headBottom - headBlockH;
  } else {
    headTop = padTop;
    bodyTop = headTop + headBlockH + headGap;
    pillTop = bodyTop + bodyBlockH + (bodyLines.length ? pillGap : headGap);
  }
  const pillLeft = colX;

  // ── Accent range over the normalised (line-joined) headline ──
  const normalised = headLines.join(" ");
  let accent = (input.emphasis ?? "").trim().toUpperCase();
  let accentStart = accent ? normalised.indexOf(accent) : -1;
  if (accentStart < 0) { // generator emphasis missing / not a substring → heuristic
    accent = deriveAccent(headText).toUpperCase();
    accentStart = normalised.indexOf(accent);
  }
  const accentEnd = accentStart >= 0 ? accentStart + accent.length : -1;

  // ── Emit headline glyphs, per-glyph gold/white by global char index ──
  const whitePaths: string[] = [];
  const goldPaths: string[] = [];
  let globalIdx = 0;
  for (let li = 0; li < headLines.length; li++) {
    const line = headLines[li];
    const lineW = headFont.getAdvanceWidth(line, headSize);
    let x = lineX(lineW);
    const baseY = headTop + li * headLH + headSize * 0.82;
    for (let ci = 0; ci < line.length; ci++) {
      const ch = line[ci];
      const gi = globalIdx + ci;
      if (ch !== " ") {
        const d = glyphPath(headFont, ch, x, baseY, headSize);
        if (accentStart >= 0 && gi >= accentStart && gi < accentEnd) goldPaths.push(d);
        else whitePaths.push(d);
      }
      x += headFont.getAdvanceWidth(ch, headSize);
    }
    globalIdx += line.length + 1; // +1 for the join space
  }

  // ── Body glyphs ──
  const bodyPaths: string[] = [];
  for (let li = 0; li < bodyLines.length; li++) {
    const line = bodyLines[li];
    const lineW = bodyFont.getAdvanceWidth(line, bodySize);
    const baseY = bodyTop + li * bodyLH + bodySize * 0.8;
    bodyPaths.push(glyphPath(bodyFont, line, lineX(lineW), baseY, bodySize));
  }

  // ── Pill label glyphs (dark, centered in pill) ──
  const pillLabelX = pillLeft + (pillW - pillLabelW) / 2;
  const pillLabelY = pillTop + pillH / 2 + pillSize * 0.34;
  const pillLabelPath = glyphPath(bodyFont, pillLabel, pillLabelX, pillLabelY, pillSize);

  // ── Scrim ──
  // The legibility half of the contract. The legacy gradient began at
  // `headTop - 0.06H` with stop-opacity 0 and only reached 0.72 at 55% down, so
  // the FIRST headline line rendered against a scrim that was still effectively
  // transparent — text straight onto an undarkened face. "lower" starts the
  // gradient higher and ramps early, so the whole reserved band carries contrast
  // before any glyph lands on it. Legacy geometry is untouched for zone
  // undefined / "bottom" / "left".
  const scrimTop = Math.max(0, headTop - Math.round(H * (zone === "lower" ? 0.14 : 0.06)));
  const scrimDef = zone === "left"
    ? `<linearGradient id="scrim" x1="0" y1="0" x2="${W}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0A0A0E" stop-opacity="0.92"/>
      <stop offset="0.42" stop-color="#0A0A0E" stop-opacity="0.6"/>
      <stop offset="0.72" stop-color="#0A0A0E" stop-opacity="0"/>
    </linearGradient>`
    : zone === "lower"
    ? `<linearGradient id="scrim" x1="0" y1="${scrimTop}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0A0A0E" stop-opacity="0"/>
      <stop offset="0.25" stop-color="#0A0A0E" stop-opacity="0.62"/>
      <stop offset="0.5" stop-color="#0A0A0E" stop-opacity="0.82"/>
      <stop offset="1" stop-color="#0A0A0E" stop-opacity="0.94"/>
    </linearGradient>`
    : `<linearGradient id="scrim" x1="0" y1="${scrimTop}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0A0A0E" stop-opacity="0"/>
      <stop offset="0.55" stop-color="#0A0A0E" stop-opacity="0.72"/>
      <stop offset="1" stop-color="#0A0A0E" stop-opacity="0.92"/>
    </linearGradient>`;
  const scrimRect = zone === "left"
    ? `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#scrim)"/>`
    : `<rect x="0" y="${scrimTop}" width="${W}" height="${H - scrimTop}" fill="url(#scrim)"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    ${scrimDef}
    <filter id="soft" x="-8%" y="-8%" width="116%" height="116%">
      <feDropShadow dx="0" dy="${Math.max(1, Math.round(headSize * 0.03))}" stdDeviation="${Math.max(1, Math.round(headSize * 0.06))}" flood-color="rgba(0,0,0,0.55)"/>
    </filter>
  </defs>
  ${scrimRect}
  <g filter="url(#soft)">
    <g fill="${WHITE}">${whitePaths.join("")}</g>
    <g fill="${GOLD}">${goldPaths.join("")}</g>
    <g fill="${BODY_INK}">${bodyPaths.join("")}</g>
  </g>
  <rect x="${pillLeft}" y="${pillTop}" width="${pillW}" height="${pillH}" rx="${Math.round(pillH / 2)}" ry="${Math.round(pillH / 2)}" fill="${GOLD}"/>
  <g fill="${PILL_INK}">${pillLabelPath}</g>
</svg>`;

  const resvg = new Resvg(svg, { fitTo: { mode: "original" } });
  const overlayPng = resvg.render().asPng();

  return sharp(rawBuffer)
    .composite([{ input: Buffer.from(overlayPng), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
