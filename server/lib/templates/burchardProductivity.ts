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

  // Product cover (value_stack) — main/right. Stand-in = a marked-up sheet.
  const product = ok(coach.productCoverUrl)
    ? `<img src="${esc(coach.productCoverUrl)}" alt="${esc(magnet)} cover" style="position:absolute;top:2%;right:16px;width:60%;height:94%;object-fit:contain;object-position:top right;">`
    : `<div aria-hidden="true" style="position:absolute;top:3%;right:18px;width:56%;height:90%;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:6px;box-shadow:0 8px 22px rgba(0,0,0,0.10);background-image:repeating-linear-gradient(0deg,transparent 0 15px,#F1C0C8 15px 16px);"></div>`;

  // Coach photo (headshot) — cutout, bottom-left, overlapping. Stand-in = head/shoulders silhouette.
  const coachImg = ok(coach.headshotUrl)
    ? `<img src="${esc(coach.headshotUrl)}" alt="${esc(coach.coachName || "Your coach")}" style="position:absolute;left:14px;bottom:0;height:80%;width:auto;max-width:46%;object-fit:cover;object-position:top center;">`
    : `<svg aria-hidden="true" viewBox="0 0 150 160" style="position:absolute;left:14px;bottom:0;height:92%;width:auto;">
         <path d="M14 160 q61 -78 122 0 z" fill="#334155"/>
         <circle cx="75" cy="52" r="42" fill="#94A3B8"/>
         <rect x="52" y="86" width="46" height="34" rx="8" fill="#94A3B8"/>
       </svg>`;

  return `<div style="position:relative;width:100%;max-width:680px;aspect-ratio:1.42;background:#FFFFFF;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.45);overflow:hidden;display:flex;flex-direction:column;">
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
const NAVY = "#1E293B";       // slate-800 page/hero background
const ORANGE = "#F88028";     // accent: emphasis, stars, CTA
const ORANGE_HOVER = "#F0731A";
const WHITE = "#FFFFFF";
const SUB = "#CBD5E1";         // slate-300 body-on-dark
const FIELD_PLACEHOLDER = "#94A3B8";
const H = "'Figtree', system-ui, sans-serif";
const B = "'Figtree', system-ui, sans-serif";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const ok = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;

/**
 * Wrap the first case-insensitive occurrence of the lead-magnet name in the orange
 * emphasis span (the reference's signature treatment). If the headline doesn't name
 * the magnet, the headline renders unchanged — no forced insertion.
 */
function highlightMagnet(headline: string, magnetName: string | null | undefined): string {
  const safe = esc(headline);
  if (!ok(magnetName)) return safe;
  const escMagnet = esc(magnetName);
  const idx = safe.toLowerCase().indexOf(escMagnet.toLowerCase());
  if (idx < 0) return safe;
  const before = safe.slice(0, idx);
  const match = safe.slice(idx, idx + escMagnet.length);
  const after = safe.slice(idx + escMagnet.length);
  return `${before}<span style="color:${ORANGE};">${match}</span>${after}`;
}

const STARS = `<span aria-hidden="true" style="color:${ORANGE};font-size:16px;letter-spacing:2px;line-height:1;">★★★★★</span>`;

/** Gate-1 hero section only. */
function heroSection(content: LandingPageContent, coach: BurchardCoachInput): string {
  const magnet = ok(coach.leadMagnetName) ? coach.leadMagnetName! : "Free Guide";
  const headlineRaw = ok(content.mainHeadline) ? content.mainHeadline : `This one ${magnet} changed how I work`;
  const headline = highlightMagnet(headlineRaw, coach.leadMagnetName);
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
  <section style="background:${NAVY};padding:40px 24px 34px;">
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
        <div style="flex:1 1 600px;min-width:300px;display:flex;justify-content:center;">
          ${composite}
        </div>
      </div>
    </div>
  </section>`;
}

// ── Gate-2: benefit bands + testimonials (navy middle section) ───────────────
const CHARCOAL = "#343137";
const CHARCOAL_BORDER = "#3F3B42";
const TESTIMONIAL_BG = "#303A4A";
const BAND_TEXT = "#E8EAED";

const CHECK = `<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" style="flex-shrink:0;"><circle cx="12" cy="12" r="10.5" fill="none" stroke="${ORANGE}" stroke-width="1.6"/><path d="M7.5 12.3 l3 3 l6.2 -6.6" fill="none" stroke="${ORANGE}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Emphasise the benefit keyword (uppercased, orange) where it appears in the sentence. */
function highlightKeyword(sentence: string, keyword: string): string {
  const safe = esc(sentence);
  if (!ok(keyword)) return safe;
  const k = esc(keyword);
  const idx = safe.toLowerCase().indexOf(k.toLowerCase());
  const span = (t: string) => `<span style="color:${ORANGE};font-weight:700;text-transform:uppercase;">${t}</span>`;
  if (idx < 0) return `${span(k)} — ${safe}`; // keyword not embedded → lead with it
  return safe.slice(0, idx) + span(safe.slice(idx, idx + k.length)) + safe.slice(idx + k.length);
}

/** Initials monogram from the real testimonial name — no fabricated photo. */
function initials(name: string): string {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

function gate2Section(content: LandingPageContent): string {
  const outline = Array.isArray(content.consultationOutline) ? content.consultationOutline : [];
  const testimonials = Array.isArray(content.testimonials) ? content.testimonials : [];
  if (outline.length === 0 && testimonials.length === 0) return "";

  const bands = outline.slice(0, 3).map((item) => `
        <div style="background:${CHARCOAL};border:1px solid ${CHARCOAL_BORDER};border-radius:10px;padding:17px 22px;display:flex;align-items:center;gap:14px;">
          ${CHECK}
          <span style="font-family:${B};font-size:15px;font-weight:500;color:${BAND_TEXT};line-height:1.4;">${highlightKeyword(String(item.description ?? ""), String(item.title ?? ""))}</span>
        </div>`).join("");

  // Real-or-nothing: render only when the coach actually has testimonials.
  const quotes = testimonials.slice(0, 2).map((t) => `
        <div style="background:${TESTIMONIAL_BG};border-radius:10px;padding:22px 26px;display:flex;gap:16px;align-items:flex-start;">
          <div aria-hidden="true" style="flex-shrink:0;width:44px;height:44px;border-radius:50%;background:#475569;display:flex;align-items:center;justify-content:center;font-family:${H};font-weight:700;font-size:16px;color:#E2E8F0;text-transform:uppercase;">${esc(initials(String(t.name ?? "")))}</div>
          <div>
            <p style="font-family:${B};font-size:15px;font-weight:400;color:#E2E8F0;line-height:1.5;margin:0 0 8px;">&ldquo;${esc(t.quote ?? "")}&rdquo;</p>
            <div style="font-family:${B};font-size:14px;font-weight:700;color:${ORANGE};">${esc(t.name ?? "")}</div>
          </div>
        </div>`).join("");

  return `
  <section style="background:${NAVY};padding:0 24px 60px;">
    <div style="max-width:1050px;margin:0 auto;display:flex;flex-direction:column;gap:14px;">
      ${bands}
      ${quotes ? `<div style="height:6px;"></div>${quotes}` : ""}
    </div>
  </section>`;
}

// ── Gate-3: cream lower section (heading + tile grid + CTA card + footer) ─────
const CREAM = "#FFF7ED";
const TILE_BORDER = "#F1E4D3";
const FOOTER_BG = "#1B2538";
const FOOTER_TEXT = "#94A3B8";

// Small orange glyphs, cycled per tile for visual variety.
const TILE_ICONS = [
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${ORANGE}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>`,
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${ORANGE}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9"/></svg>`,
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${ORANGE}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>`,
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${ORANGE}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="${ORANGE}"/></svg>`,
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${ORANGE}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>`,
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${ORANGE}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 3 14.5 9 21 9.5 16 13.5 17.5 20 12 16.5 6.5 20 8 13.5 3 9.5 9.5 9"/></svg>`,
];

function gate3Section(content: LandingPageContent, serviceName: string, coach: BurchardCoachInput): string {
  const magnet = ok(coach.leadMagnetName) ? coach.leadMagnetName! : "Free Guide";
  const cta = ok(content.primaryCta) ? esc(content.primaryCta) : `Download Free ${esc(magnet)}`;
  const brand = ok(coach.coachName) ? esc(coach.coachName) : esc(serviceName || "Your Brand");
  const year = new Date().getFullYear();
  const tiles = Array.isArray(content.featureHighlights) ? content.featureHighlights.filter(ok).slice(0, 8) : [];

  const tileGrid = tiles.length > 0 ? `
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;max-width:900px;margin:0 auto 52px;">
        ${tiles.map((line, i) => `
        <div style="background:#FFFFFF;border:1px solid ${TILE_BORDER};border-radius:10px;padding:18px 20px;display:flex;align-items:center;gap:14px;box-shadow:0 4px 14px rgba(20,30,45,0.05);">
          <span style="flex-shrink:0;line-height:0;">${TILE_ICONS[i % TILE_ICONS.length]}</span>
          <span style="font-family:${B};font-size:14px;font-weight:500;color:${NAVY};line-height:1.4;">${esc(line)}</span>
        </div>`).join("")}
      </div>` : "";

  return `
  <section style="background:${CREAM};padding:64px 24px 72px;">
    <div style="max-width:1050px;margin:0 auto;">
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,2.4vw,34px);line-height:1.2;letter-spacing:-0.01em;color:${NAVY};text-align:center;margin:0 auto 12px;max-width:780px;">Everything you need, in one simple <span style="color:${ORANGE};">${esc(magnet)}</span>.</h2>
      <p style="font-family:${B};font-size:16px;color:#64748B;text-align:center;margin:0 auto 48px;max-width:620px;">Use it every day and stay on track.</p>
      ${tileGrid}
      <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:2px solid ${ORANGE};border-radius:14px;padding:28px 28px 26px;box-shadow:0 14px 34px rgba(20,30,45,0.10);">
        <h3 style="font-family:${H};font-weight:800;font-size:22px;color:${NAVY};text-align:center;margin:0 0 16px;">Get Your Free ${esc(magnet)} Now!</h3>
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
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(content.mainHeadline || serviceName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;}body{margin:0;background:${NAVY};}</style>
</head>
<body>
${heroSection(content, coach)}
${gate2Section(content)}
${gate3Section(content, serviceName, coach)}
</body>
</html>`;
}
