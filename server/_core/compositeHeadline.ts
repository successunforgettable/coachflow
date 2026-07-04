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
 * the no-price-on-creatives rule, falls back to mainBenefit if a currency
 * amount survives the trim.
 */
export async function resolveAdBodyText(db: any, userId: number, serviceId: number | null | undefined): Promise<string> {
  if (serviceId == null) return "";
  const stripTokens = (s: string) => s.replace(/\[INSERT_[A-Z0-9_]+\]/g, "").replace(/\s+/g, " ").trim();
  let body = "";
  try {
    const rows = await db.select({ content: adCopy.content })
      .from(adCopy)
      .where(and(eq(adCopy.userId, userId), eq(adCopy.serviceId, serviceId), eq(adCopy.contentType, "body")))
      .orderBy(desc(adCopy.id))
      .limit(1);
    body = trimToLength(stripTokens(rows[0]?.content ?? ""), 140);
  } catch { /* fall through to mainBenefit */ }
  const hasPrice = /[£$€]\s?\d/.test(body);
  if (!body || hasPrice) {
    try {
      const [svc] = await db.select({ mainBenefit: services.mainBenefit })
        .from(services).where(eq(services.id, serviceId)).limit(1);
      body = trimToLength(stripTokens(svc?.mainBenefit ?? ""), 140);
    } catch { /* leave body as-is */ }
  }
  return body;
}

// ─── Public: the render template ─────────────────────────────────────────────
export type RenderAdCreativeInput = {
  headline: string;
  emphasis?: string;   // verbatim substring to render gold; heuristic fallback
  bodyText?: string;   // ~140-char campaign-aligned body (no price)
  ctaLabel: string;    // CAMPAIGN_TO_CTA[campaignType]
};

export async function renderAdCreative(rawBuffer: Buffer, input: RenderAdCreativeInput): Promise<Buffer> {
  const headFont = getFont("headline");
  const bodyFont = getFont("body");

  const meta = await sharp(rawBuffer).metadata();
  const W = meta.width ?? 1080;
  const H = meta.height ?? 1080;

  const padX = Math.round(W * 0.06);
  const padBottom = Math.round(H * 0.055);
  const contentW = W - padX * 2;

  // ── CTA pill (bottom) ──
  const pillLabel = (input.ctaLabel || "").trim().toUpperCase();
  const pillSize = Math.max(20, Math.round(W / 34));
  const pillLabelW = bodyFont.getAdvanceWidth(pillLabel, pillSize);
  const pillPadX = Math.round(pillSize * 1.15);
  const pillH = Math.round(pillSize * 2.4);
  const pillW = Math.round(pillLabelW + pillPadX * 2);
  const pillTop = H - padBottom - pillH;
  const pillLeft = padX;

  // ── Body block (above pill) ──
  const bodyText = (input.bodyText ?? "").trim();
  const bodySize = Math.max(18, Math.round(W / 32));
  const bodyLH = bodySize * 1.32;
  const bodyLines = bodyText ? fitLines(bodyFont, bodyText, contentW, bodySize, Math.round(bodySize * 0.8), 4).lines : [];
  const bodyBlockH = bodyLines.length * bodyLH;
  const bodyGap = Math.round(pillSize * 1.4);
  const bodyBottom = pillTop - bodyGap;
  const bodyTop = bodyBottom - bodyBlockH;

  // ── Headline (above body) — two-tone Playfair, all caps ──
  const headText = input.headline.trim().toUpperCase();
  const headStart = Math.max(40, Math.min(Math.round(W / 8), Math.round(W / 12)));
  const headMin = Math.max(30, Math.round(W / 20));
  const { lines: headLines, fontSize: headSize } = fitLines(headFont, headText, contentW, headStart, headMin, 3);
  const headLH = headSize * 1.08;
  const headBlockH = headLines.length * headLH;
  const headGap = Math.round(headSize * 0.5);
  const headBottom = (bodyLines.length ? bodyTop : pillTop) - headGap;
  const headTop = headBottom - headBlockH;

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
    let x = (W - lineW) / 2; // centered
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

  // ── Body glyphs (centered, single fill) ──
  const bodyPaths: string[] = [];
  for (let li = 0; li < bodyLines.length; li++) {
    const line = bodyLines[li];
    const lineW = bodyFont.getAdvanceWidth(line, bodySize);
    const x = (W - lineW) / 2;
    const baseY = bodyTop + li * bodyLH + bodySize * 0.8;
    bodyPaths.push(glyphPath(bodyFont, line, x, baseY, bodySize));
  }

  // ── Pill label glyphs (dark, centered in pill) ──
  const pillLabelX = pillLeft + (pillW - pillLabelW) / 2;
  const pillLabelY = pillTop + pillH / 2 + pillSize * 0.34;
  const pillLabelPath = glyphPath(bodyFont, pillLabel, pillLabelX, pillLabelY, pillSize);

  // ── Scrim: dark gradient from above the headline to the bottom ──
  const scrimTop = Math.max(0, headTop - Math.round(H * 0.06));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="${scrimTop}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0A0A0E" stop-opacity="0"/>
      <stop offset="0.55" stop-color="#0A0A0E" stop-opacity="0.72"/>
      <stop offset="1" stop-color="#0A0A0E" stop-opacity="0.92"/>
    </linearGradient>
    <filter id="soft" x="-8%" y="-8%" width="116%" height="116%">
      <feDropShadow dx="0" dy="${Math.max(1, Math.round(headSize * 0.03))}" stdDeviation="${Math.max(1, Math.round(headSize * 0.06))}" flood-color="rgba(0,0,0,0.55)"/>
    </filter>
  </defs>
  <rect x="0" y="${scrimTop}" width="${W}" height="${H - scrimTop}" fill="url(#scrim)"/>
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
