/**
 * Burchard Productivity Sheet — bespoke lead-magnet landing template (template #1).
 *
 * Per-reference replication of docs/landing-page-references/lead_magnet_download--brendon-burchard--productivity-sheet.png,
 * judged against the Gate-1 crop (y 0–1110) in the visual-replication report. Selected
 * by pageType === "lead_magnet_download" (wiring deferred until the template clears its gates).
 *
 * GATE-1 SCOPE: the dark navy hero only — logo, headline (with the lead-magnet name in
 * orange), sub-paragraph, 5-star trust line (non-numeric by default; operator-fill slot
 * for a real coach-supplied number — never fabricated), email field, orange download CTA,
 * and the creator/product composite in the right column. Benefit bands / tiles /
 * testimonials / footer are NOT built in this gate.
 *
 * Inline styles only (V2 renderer mandate). Words bind to cascade output; the composite
 * binds to the coach's headshot image slot (2:3). No price anywhere (locked rule).
 */
import type { LandingPageContent } from "../../../drizzle/schema";
import {
  esc, ok, imgOrOmit, sectionOrEmpty, stars, checkCircle, initials,
  highlightKeyword, highlightTerm, tileIconSet, renderDocument,
} from "./templatePrimitives";

export interface BurchardCoachInput {
  /** Coach photo — headshot slot (2:3). Composed into the card as the cutout, bottom-left. */
  headshotUrl?: string | null;
  /** Magnet cover render — value_stack slot. Composed into the card as the product, main/right. */
  productCoverUrl?: string | null;
  /** Coach logo slot — small wordmark top-left. */
  logoUrl?: string | null;
  coachName?: string | null;
  /** Lead-magnet name (hvcoTitles.title) — drives the orange emphasis span, CTA, and card title. */
  leadMagnetName?: string | null;
  /** Operator-fill real trust number (e.g. "12,400"). Null → non-numeric trust line. NEVER auto-invented. */
  trustCount?: string | null;
}

/**
 * Right-column composite — ZAP COMPOSES this card (route b), it is not a single coach
 * upload: coach photo (headshot slot) + magnet cover (value_stack slot) + template-rendered
 * chrome (eyebrow/title/subtitle + FREE badge). Landscape ~3:2, matching the reference mass.
 */
function compositeCard(coach: BurchardCoachInput, magnet: string): string {
  const title = esc(magnet).toUpperCase();
  const eyebrow = ok(coach.coachName) ? `${esc(coach.coachName).toUpperCase()}'S` : "YOUR BRAND'S";
  const subtitle = "Free instant download";

  // A real cover (coach-uploaded value_stack, or page 1 of the coach's own magnet
  // PDF auto-derived at publish time) arrives as productCoverUrl; a real headshot
  // arrives as headshotUrl. Both are the coach's genuine material.
  const hasProduct = ok(coach.productCoverUrl);
  const hasCoach = ok(coach.headshotUrl);

  // Product sits in the right column beside a coach cutout, or centres when there
  // is no cutout. When the slot is truly empty (e.g. a quiz with no PDF), it
  // degrades to a ZAP-designed cover panel (Option A) — plainly branded packaging
  // for the free download, never posing as the coach's own document.
  const productBox = hasCoach
    ? "position:absolute;top:3%;right:18px;width:56%;height:90%;"
    : "position:absolute;top:4%;left:50%;transform:translateX(-50%);width:66%;height:90%;";
  const product = hasProduct
    ? `<img src="${esc(coach.productCoverUrl)}" alt="${esc(magnet)} cover" style="${productBox}object-fit:contain;object-position:${hasCoach ? "top right" : "top center"};">`
    : `<div aria-hidden="true" style="${productBox}background:${NAVY};border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,0.22);overflow:hidden;display:flex;flex-direction:column;">
         <div style="height:8px;background:${ORANGE};"></div>
         <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px 18px;">
           <div style="font-family:${B};font-size:10px;font-weight:700;letter-spacing:0.16em;color:${ORANGE};margin-bottom:10px;">FREE DOWNLOAD</div>
           <div style="font-family:${H};font-weight:800;font-size:clamp(15px,1.7vw,22px);line-height:1.12;color:${WHITE};">${title}</div>
         </div>
       </div>`;

  // Coach photo — cutout, bottom-left. An empty slot is omitted entirely (no
  // fabricated silhouette); the product centres to fill the card instead.
  const coachImg = imgOrOmit(
    coach.headshotUrl,
    coach.coachName || "Your coach",
    "position:absolute;left:14px;bottom:0;height:80%;width:auto;max-width:46%;object-fit:cover;object-position:top center;",
  );

  return `<div style="position:relative;width:100%;max-width:560px;aspect-ratio:1.46;background:#FFFFFF;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.45);overflow:hidden;display:flex;flex-direction:column;">
    <div aria-hidden="true" style="position:absolute;top:14px;right:14px;width:54px;height:54px;border-radius:50%;background:${ORANGE};display:flex;align-items:center;justify-content:center;color:#fff;font-family:${H};font-weight:800;font-size:14px;transform:rotate(8deg);box-shadow:0 4px 10px rgba(0,0,0,0.18);z-index:3;">FREE</div>
    <div style="padding:16px 22px 6px;text-align:center;z-index:2;">
      <div style="font-family:${B};font-size:10px;font-weight:700;letter-spacing:0.12em;color:#64748B;">${eyebrow}</div>
      <div style="font-family:${H};font-weight:800;font-size:clamp(18px,1.9vw,26px);line-height:1.03;letter-spacing:-0.01em;color:${NAVY};text-transform:uppercase;margin:3px 0 4px;">${title}</div>
      <div style="font-family:${B};font-size:13px;font-weight:600;color:#2563EB;">${subtitle}</div>
    </div>
    <div style="position:relative;flex:1;">
      ${product}
      ${coachImg}
    </div>
  </div>`;
}

// ── Reference palette (sampled from the frozen capture) ──────────────────────
const NAVY = "#161E2A";       // slate-800 page/hero background
const ORANGE = "#F97316";     // accent: emphasis, stars, CTA
const ORANGE_HOVER = "#F37231";
const WHITE = "#FFFFFF";
const SUB = "#595959";         // slate-300 body-on-dark
const FIELD_PLACEHOLDER = "#94A3B8";
const H = "'Fira Sans', system-ui, -apple-system, sans-serif";
const B = "'Open Sans', system-ui, -apple-system, sans-serif";

const STARS = stars(ORANGE);

/** Gate-1 hero section only. */
function heroSection(content: LandingPageContent, coach: BurchardCoachInput): string {
  const magnet = ok(coach.leadMagnetName) ? coach.leadMagnetName! : "Free Guide";
  const headlineRaw = ok(content.mainHeadline) ? content.mainHeadline : `This one ${magnet} changed how I work`;
  const headline = highlightTerm(headlineRaw, coach.leadMagnetName, ORANGE);
  const sub = ok(content.subheadline)
    ? esc(content.subheadline)
    : `Get instant access to the simple tool that helps you stay on track and get more done.`;
  const cta = ok(content.primaryCta) ? esc(content.primaryCta) : `Download Free ${esc(magnet)}`;
  // Trust line: real number if the coach supplied one (operator-fill), else non-numeric. Never fabricated.
  const trustLine = ok(coach.trustCount)
    ? `Trusted by over ${esc(coach.trustCount)} high achievers`
    : `Trusted by high achievers`;

  // Reference right column = a DESIGNED landscape (~3:2) product composite ZAP assembles.
  const composite = compositeCard(coach, magnet);

  const logo = ok(coach.logoUrl)
    ? `<img src="${esc(coach.logoUrl)}" alt="${esc(coach.coachName || "Logo")}" style="height:26px;width:auto;display:block;">`
    : `<span style="font-family:${H};font-weight:800;font-size:18px;color:${WHITE};letter-spacing:-0.01em;">${esc(coach.coachName || "yourbrand")}</span>`;

  return `
  <section style="background:${NAVY};padding:30px 24px 22px;">
    <div style="max-width:1050px;margin:0 auto;">
      <div style="margin:0 0 40px;">${logo}</div>
      <div style="display:flex;flex-wrap:wrap;align-items:flex-start;gap:44px;">
        <!-- LEFT: copy + form -->
        <div style="flex:1 1 400px;min-width:320px;">
          <h1 style="font-family:${H};font-weight:800;font-size:clamp(26px,2vw,34px);line-height:1.15;letter-spacing:-0.02em;color:${WHITE};margin:0 0 18px;">${headline}</h1>
          <p style="font-family:${B};font-weight:400;font-size:16px;line-height:1.5;color:${SUB};margin:0 0 20px;max-width:34rem;">${sub}</p>
          <div style="display:flex;align-items:center;gap:10px;margin:0 0 22px;">
            ${STARS}
            <span style="font-family:${B};font-size:14px;font-weight:500;color:${SUB};">${trustLine}</span>
          </div>
          <form style="margin:0;max-width:560px;" onsubmit="return false;">
            <input type="email" placeholder="Email Address" aria-label="Email Address" style="width:100%;box-sizing:border-box;padding:15px 18px;font-family:${B};font-size:16px;color:${NAVY};background:${WHITE};border:none;border-radius:8px;margin:0 0 12px;outline:none;">
            <button type="submit" style="width:100%;box-sizing:border-box;padding:16px 20px;font-family:${B};font-weight:700;font-size:16px;color:${WHITE};background:${ORANGE};border:none;border-radius:8px;cursor:pointer;letter-spacing:0.01em;transition:background 0.15s ease;" onmouseover="this.style.background='${ORANGE_HOVER}'" onmouseout="this.style.background='${ORANGE}'">${cta}</button>
          </form>
        </div>
        <!-- RIGHT: creator/product composite -->
        <div style="flex:1 1 520px;min-width:280px;display:flex;justify-content:center;">
          ${composite}
        </div>
      </div>
    </div>
  </section>`;
}

// ── Gate-2: benefit bands + testimonials (navy middle section) ───────────────
const CHARCOAL = "#1F2937";
const CHARCOAL_BORDER = "#3F3B42";
const TESTIMONIAL_BG = "#303A4A";
const BAND_TEXT = "#E8EAED";

const CHECK = checkCircle(ORANGE);

function gate2Section(content: LandingPageContent): string {
  const outline = Array.isArray(content.consultationOutline) ? content.consultationOutline : [];
  const testimonials = Array.isArray(content.testimonials) ? content.testimonials : [];
  if (outline.length === 0 && testimonials.length === 0) return "";

  const bands = outline.slice(0, 3).map((item) => `
        <div style="background:${CHARCOAL};border:1px solid ${CHARCOAL_BORDER};border-radius:10px;padding:13px 20px;display:flex;align-items:center;gap:13px;">
          ${CHECK}
          <span style="font-family:${B};font-size:15px;font-weight:500;color:${BAND_TEXT};line-height:1.4;">${highlightKeyword(String(item.description ?? ""), String(item.title ?? ""), ORANGE)}</span>
        </div>`).join("");

  // Real-or-nothing: render only when the coach actually has testimonials.
  const quotes = testimonials.slice(0, 2).map((t) => `
        <div style="background:${TESTIMONIAL_BG};border-radius:10px;padding:13px 18px;display:flex;gap:16px;align-items:flex-start;">
          <div aria-hidden="true" style="flex-shrink:0;width:44px;height:44px;border-radius:50%;background:#475569;display:flex;align-items:center;justify-content:center;font-family:${H};font-weight:700;font-size:16px;color:#E2E8F0;text-transform:uppercase;">${esc(initials(String(t.name ?? "")))}</div>
          <div>
            <p style="font-family:${B};font-size:15px;font-weight:400;color:#E2E8F0;line-height:1.5;margin:0 0 8px;">&ldquo;${esc(t.quote ?? "")}&rdquo;</p>
            <div style="font-family:${B};font-size:14px;font-weight:700;color:${ORANGE};">${esc(t.name ?? "")}</div>
          </div>
        </div>`).join("");

  return `
  <section style="background:${NAVY};padding:0 24px 30px;">
    <div style="max-width:1050px;margin:0 auto;display:flex;flex-direction:column;gap:11px;">
      ${bands}
      ${quotes ? `<div style="height:6px;"></div>${quotes}` : ""}
    </div>
  </section>`;
}

// ── Gate-3: cream lower section (heading + tile grid + CTA card + footer) ─────
const CREAM = "#FDF7F0"; // sampled from the reference's lower band (was a shade too orange-tan)
const TILE_BORDER = "#F1E4D3";
const FOOTER_BG = "#1B2538";
const FOOTER_TEXT = "#94A3B8";

// Small orange glyphs, cycled per tile for visual variety.
const TILE_ICONS = tileIconSet(ORANGE);

function gate3Section(content: LandingPageContent, serviceName: string, coach: BurchardCoachInput): string {
  const magnet = ok(coach.leadMagnetName) ? coach.leadMagnetName! : "Free Guide";
  const cta = ok(content.primaryCta) ? esc(content.primaryCta) : `Download Free ${esc(magnet)}`;
  const brand = ok(coach.coachName) ? esc(coach.coachName) : esc(serviceName || "Your Brand");
  const year = new Date().getFullYear();
  const tiles = Array.isArray(content.featureHighlights) ? content.featureHighlights.filter(ok).slice(0, 8) : [];

  const tileGrid = sectionOrEmpty(tiles.length > 0, `
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;max-width:900px;margin:0 auto 20px;">
        ${tiles.map((line, i) => `
        <div style="background:#FFFFFF;border:1px solid ${TILE_BORDER};border-radius:10px;padding:13px 18px;display:flex;align-items:center;gap:14px;box-shadow:0 4px 14px rgba(20,30,45,0.05);">
          <span style="flex-shrink:0;line-height:0;">${TILE_ICONS[i % TILE_ICONS.length]}</span>
          <span style="font-family:${B};font-size:14px;font-weight:500;color:${NAVY};line-height:1.4;">${esc(line)}</span>
        </div>`).join("")}
      </div>`);

  return `
  <section style="background:${CREAM};padding:32px 24px 38px;">
    <div style="max-width:1050px;margin:0 auto;">
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,2.4vw,34px);line-height:1.2;letter-spacing:-0.01em;color:${NAVY};text-align:center;margin:0 auto 12px;max-width:780px;">Everything you need, in one simple <span style="color:${ORANGE};">${esc(magnet)}</span>.</h2>
      <p style="font-family:${B};font-size:16px;color:#64748B;text-align:center;margin:0 auto 18px;max-width:620px;">Use it every day and stay on track.</p>
      ${tileGrid}
      <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:2px solid ${ORANGE};border-radius:14px;padding:20px 24px 18px;box-shadow:0 12px 30px rgba(20,30,45,0.10);">
        <h3 style="font-family:${H};font-weight:800;font-size:22px;color:${NAVY};text-align:center;margin:0 0 12px;">Get Your Free ${esc(magnet)} Now!</h3>
        <form style="margin:0;" onsubmit="return false;">
          <input type="email" placeholder="Email Address" aria-label="Email Address" style="width:100%;box-sizing:border-box;padding:14px 16px;font-family:${B};font-size:16px;color:${NAVY};background:#FFFFFF;border:1px solid #E2E8F0;border-radius:8px;margin:0 0 10px;outline:none;">
          <button type="submit" style="width:100%;box-sizing:border-box;padding:15px 20px;font-family:${B};font-weight:700;font-size:15px;color:#FFFFFF;background:${ORANGE};border:none;border-radius:8px;cursor:pointer;" onmouseover="this.style.background='${ORANGE_HOVER}'" onmouseout="this.style.background='${ORANGE}'">${cta}</button>
        </form>
      </div>
    </div>
  </section>
  <footer style="background:${FOOTER_BG};padding:22px 24px;text-align:center;">
    <div style="font-family:${B};font-size:12px;color:${FOOTER_TEXT};line-height:1.7;">
      &copy; ${year} ${brand}. All rights reserved.<br>
      <a href="#" style="color:${FOOTER_TEXT};text-decoration:none;">Privacy Policy</a> &middot; <a href="#" style="color:${FOOTER_TEXT};text-decoration:none;">Terms</a>
    </div>
  </footer>
  <!-- Footer legal links are placeholders (#). Wire to the coach's real Privacy/Terms
       URLs at brand-capture / publish time — carry-forward, not this gate. -->`;
}

/**
 * Full page builder. GATE-1 + GATE-2 + GATE-3: hero + benefit bands + testimonials +
 * cream tile grid + bottom CTA + footer — the full template.
 */
export function buildBurchardProductivityHtml(
  content: LandingPageContent,
  serviceName: string,
  coach: BurchardCoachInput = {},
): string {
  return renderDocument({
    title: content.mainHeadline || serviceName,
    fontHref: "https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700;800&family=Open+Sans:wght@400;500;600;700&display=swap",
    bodyBg: NAVY,
    body: [
      heroSection(content, coach),
      gate2Section(content),
      gate3Section(content, serviceName, coach),
    ].join("\n"),
  });
}
