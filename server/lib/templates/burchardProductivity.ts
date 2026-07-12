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
  <section style="background:${NAVY};padding:40px 24px 64px;">
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

/**
 * Full page builder. GATE-1: only the hero is rendered; downstream sections are
 * deliberately omitted until their own gates.
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
</body>
</html>`;
}
