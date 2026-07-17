/**
 * Discovery — the Burchard design LANGUAGE applied to a discovery-call / booking flow.
 * Template #2. Same visual system as the frozen Burchard Productivity lead-magnet reference
 * (docs/landing-page-references/lead_magnet_download--brendon-burchard-productivity.png):
 * navy/orange/Fira Sans, the white creator/product composite, charcoal benefit bands + navy
 * testimonials, cream lower section, navy footer. The page drives BOOKING A CALL, not a
 * download, so it differs from lead-magnet in exactly the places the flow differs:
 *   - the hero CTA is a REAL <a href={bookingUrl}> "Book a Discovery Call" (no email form —
 *     booking pages send straight to the calendar, which captures contact at the booking step).
 *   - there is no magnet, so the composite's product side is an honest "Your Free Discovery
 *     Call" card (real call framing, NEVER a fabricated product — same honesty rule as the
 *     lead-magnet empty-cover fix).
 *   - benefit bands bind to consultationOutline ("what we'll cover on the call").
 *   - no "what's inside" tile grid (a call has no contents) and no FAQ in v1.
 *
 * Bespoke builder on the shared Phase-0 primitives; NOT a config engine. Honesty patterns
 * inherited from Burchard: non-numeric trust, real-or-nothing testimonials with monogram
 * avatars, graceful empty-states, no fabricated duration / URL / price.
 *
 * bookingUrl absent → the CTA emits the [INSERT_BOOKING_URL] token so the publish
 * placeholder hard-gate blocks the page (defense-in-depth for review-draft-when-absent).
 */
import type { LandingPageContent } from "../../../drizzle/schema";
import {
  esc, ok, imgOrOmit, stars, checkCircle, initials,
  highlightKeyword, ctaLink, renderDocument,
} from "./templatePrimitives";

export interface DiscoveryCoachInput {
  /** Coach photo — headshot slot (2:3). Composed into the call card as the cutout. */
  headshotUrl?: string | null;
  /** Coach logo slot — small wordmark top-left. */
  logoUrl?: string | null;
  coachName?: string | null;
  /** The coach's real booking/calendar URL (per-coach). Null → CTA emits [INSERT_BOOKING_URL]. */
  bookingUrl?: string | null;
  /** Operator-fill real trust number. Null → non-numeric trust line. NEVER auto-invented. */
  trustCount?: string | null;
}

// ── Palette — the same design language as the frozen Burchard Productivity reference ──
const NAVY = "#161E2A";
const ORANGE = "#F97316";
const ORANGE_HOVER = "#F37231";
const WHITE = "#FFFFFF";
const SUB = "#595959";
const H = "'Fira Sans', system-ui, -apple-system, sans-serif";
const B = "'Open Sans', system-ui, -apple-system, sans-serif";
const CHARCOAL = "#1F2937";
const CHARCOAL_BORDER = "#3F3B42";
const TESTIMONIAL_BG = "#303A4A";
const BAND_TEXT = "#E8EAED";
const CREAM = "#FDF7F0"; // sampled from the Burchard reference's lower band (matches lead-magnet)
const FOOTER_BG = "#1B2538";
const FOOTER_TEXT = "#94A3B8";

const BOOKING_URL_TOKEN = "[INSERT_BOOKING_URL]";
const CHECK = checkCircle(ORANGE);
const STARS = stars(ORANGE);

const CAL_GLYPH = `<svg aria-hidden="true" viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="${ORANGE}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/><path d="M8.5 14l2.2 2.2 4.5-4.6"/></svg>`;

function bookingHref(coach: DiscoveryCoachInput): string {
  return ok(coach.bookingUrl) ? coach.bookingUrl!.trim() : BOOKING_URL_TOKEN;
}

/**
 * Right-column composite — coach photo cutout (bottom-left) + an honest "Your Free
 * Discovery Call" card in place of the lead-magnet's magnet cover. Mirrors the Burchard
 * composite mass; the product panel is real call framing (name + 1:1-with-coach), not a
 * fabricated product. Empty headshot → cutout omitted (no fabricated face), panel centres.
 */
function callComposite(coach: DiscoveryCoachInput): string {
  const eyebrow = ok(coach.coachName) ? `${esc(coach.coachName).toUpperCase()}'S` : "YOUR BRAND'S";
  const withCoach = ok(coach.coachName) ? `1:1 with ${esc(coach.coachName)}` : "A 1:1 conversation";
  const hasCoach = ok(coach.headshotUrl);

  const panelBox = hasCoach
    ? "position:absolute;top:3%;right:18px;width:56%;height:90%;"
    : "position:absolute;top:4%;left:50%;transform:translateX(-50%);width:66%;height:90%;";
  const panel = `<div aria-hidden="true" style="${panelBox}background:${NAVY};border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,0.22);overflow:hidden;display:flex;flex-direction:column;">
         <div style="height:8px;background:${ORANGE};"></div>
         <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px 18px;">
           <div style="margin-bottom:12px;line-height:0;">${CAL_GLYPH}</div>
           <div style="font-family:${B};font-size:10px;font-weight:700;letter-spacing:0.16em;color:${ORANGE};margin-bottom:8px;">1:1 STRATEGY CALL</div>
           <div style="font-family:${H};font-weight:800;font-size:clamp(14px,1.6vw,20px);line-height:1.14;color:${WHITE};">Book a time that works for you</div>
         </div>
       </div>`;

  const coachImg = imgOrOmit(
    coach.headshotUrl,
    coach.coachName || "Your coach",
    "position:absolute;left:14px;bottom:0;height:80%;width:auto;max-width:46%;object-fit:cover;object-position:top center;",
  );

  return `<div style="position:relative;width:100%;max-width:560px;aspect-ratio:1.46;background:${WHITE};border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.45);overflow:hidden;display:flex;flex-direction:column;">
    <div aria-hidden="true" style="position:absolute;top:14px;right:14px;width:54px;height:54px;border-radius:50%;background:${ORANGE};display:flex;align-items:center;justify-content:center;color:#fff;font-family:${H};font-weight:800;font-size:14px;transform:rotate(8deg);box-shadow:0 4px 10px rgba(0,0,0,0.18);z-index:3;">FREE</div>
    <div style="padding:16px 22px 6px;text-align:center;z-index:2;">
      <div style="font-family:${B};font-size:10px;font-weight:700;letter-spacing:0.12em;color:#64748B;">${eyebrow}</div>
      <div style="font-family:${H};font-weight:800;font-size:clamp(18px,1.9vw,26px);line-height:1.03;letter-spacing:-0.01em;color:${NAVY};text-transform:uppercase;margin:3px 0 4px;">Free Discovery Call</div>
      <div style="font-family:${B};font-size:13px;font-weight:600;color:#2563EB;">${withCoach}</div>
    </div>
    <div style="position:relative;flex:1;">
      ${panel}
      ${coachImg}
    </div>
  </div>`;
}

/** Gate-1 equivalent: navy hero — copy + booking CTA on the left, call composite on the right. */
function heroSection(content: LandingPageContent, coach: DiscoveryCoachInput): string {
  const headline = ok(content.mainHeadline) ? esc(content.mainHeadline) : "Let's find out if I can help you get there";
  const sub = ok(content.subheadline)
    ? esc(content.subheadline)
    : "Book a free 1:1 call. We'll look at where you are, where you want to be, and whether working together is the right next step.";
  const cta = ok(content.primaryCta) ? content.primaryCta : "Book a Discovery Call";
  // Trust line: real number only if the coach supplied one (operator-fill), else non-numeric.
  const trustLine = ok(coach.trustCount)
    ? `Trusted by over ${esc(coach.trustCount)} clients`
    : "Trusted by people serious about their next step";

  const composite = callComposite(coach);
  const logo = ok(coach.logoUrl)
    ? `<img src="${esc(coach.logoUrl)}" alt="${esc(coach.coachName || "Logo")}" style="height:26px;width:auto;display:block;">`
    : `<span style="font-family:${H};font-weight:800;font-size:18px;color:${WHITE};letter-spacing:-0.01em;">${esc(coach.coachName || "yourbrand")}</span>`;

  const ctaBtn = ctaLink(
    bookingHref(coach),
    cta,
    `display:inline-block;box-sizing:border-box;padding:16px 40px;font-family:${B};font-weight:700;font-size:16px;color:${WHITE};background:${ORANGE};border-radius:8px;text-decoration:none;letter-spacing:0.01em;`,
  );

  return `
  <section style="background:${NAVY};padding:30px 24px 22px;">
    <div style="max-width:1050px;margin:0 auto;">
      <div style="margin:0 0 40px;">${logo}</div>
      <div style="display:flex;flex-wrap:wrap;align-items:flex-start;gap:44px;">
        <!-- LEFT: copy + booking CTA -->
        <div style="flex:1 1 400px;min-width:320px;">
          <h1 style="font-family:${H};font-weight:800;font-size:clamp(26px,2vw,34px);line-height:1.15;letter-spacing:-0.02em;color:${WHITE};margin:0 0 18px;">${headline}</h1>
          <p style="font-family:${B};font-weight:400;font-size:16px;line-height:1.5;color:${SUB};margin:0 0 20px;max-width:34rem;">${sub}</p>
          <div style="display:flex;align-items:center;gap:10px;margin:0 0 24px;">
            ${STARS}
            <span style="font-family:${B};font-size:14px;font-weight:500;color:${SUB};">${trustLine}</span>
          </div>
          <div>${ctaBtn}</div>
        </div>
        <!-- RIGHT: call composite -->
        <div style="flex:1 1 600px;min-width:300px;display:flex;justify-content:center;">
          ${composite}
        </div>
      </div>
    </div>
  </section>`;
}

/** Gate-2 equivalent: charcoal "what we'll cover" bands + navy testimonials (real-or-nothing). */
function bandsSection(content: LandingPageContent): string {
  const outline = Array.isArray(content.consultationOutline) ? content.consultationOutline : [];
  // Single trust surface (no offer/coach split) → offer (this service) + portable coach proof combined.
  const testimonials = [
    ...(Array.isArray(content.testimonials) ? content.testimonials : []),
    ...(Array.isArray(content.coachTestimonials) ? content.coachTestimonials : []),
  ];
  if (outline.length === 0 && testimonials.length === 0) return "";

  const bands = outline.slice(0, 3).map((item) => `
        <div style="background:${CHARCOAL};border:1px solid ${CHARCOAL_BORDER};border-radius:10px;padding:13px 20px;display:flex;align-items:center;gap:14px;">
          ${CHECK}
          <span style="font-family:${B};font-size:15px;font-weight:500;color:${BAND_TEXT};line-height:1.4;">${highlightKeyword(String(item.description ?? ""), String(item.title ?? ""), ORANGE)}</span>
        </div>`).join("");

  const quotes = testimonials.slice(0, 2).map((t) => `
        <div style="background:${TESTIMONIAL_BG};border-radius:10px;padding:16px 22px;display:flex;gap:16px;align-items:flex-start;">
          <div aria-hidden="true" style="flex-shrink:0;width:44px;height:44px;border-radius:50%;background:#475569;display:flex;align-items:center;justify-content:center;font-family:${H};font-weight:700;font-size:16px;color:#E2E8F0;text-transform:uppercase;">${esc(initials(String(t.name ?? "")))}</div>
          <div>
            <p style="font-family:${B};font-size:15px;font-weight:400;color:#E2E8F0;line-height:1.5;margin:0 0 8px;">&ldquo;${esc(t.quote ?? "")}&rdquo;</p>
            <div style="font-family:${B};font-size:14px;font-weight:700;color:${ORANGE};">${esc(t.name ?? "")}</div>
          </div>
        </div>`).join("");

  return `
  <section style="background:${NAVY};padding:0 24px 34px;">
    <div style="max-width:1050px;margin:0 auto;">
      ${outline.length ? `<h2 style="font-family:${H};font-weight:800;font-size:clamp(20px,2vw,28px);line-height:1.2;color:${WHITE};text-align:center;margin:0 0 26px;">What we'll cover on the call</h2>` : ""}
      <div style="display:flex;flex-direction:column;gap:14px;">
        ${bands}
        ${quotes ? `<div style="height:6px;"></div>${quotes}` : ""}
      </div>
    </div>
  </section>`;
}

/** Gate-3 equivalent: cream lower section — final booking CTA card + navy footer. No tile grid. */
function creamSection(content: LandingPageContent, serviceName: string, coach: DiscoveryCoachInput): string {
  const cta = ok(content.primaryCta) ? content.primaryCta : "Book a Discovery Call";
  const brand = ok(coach.coachName) ? esc(coach.coachName) : esc(serviceName || "Your Brand");
  const year = new Date().getFullYear();
  const ctaBtn = ctaLink(
    bookingHref(coach),
    cta,
    `display:inline-block;box-sizing:border-box;padding:15px 40px;font-family:${B};font-weight:700;font-size:15px;color:${WHITE};background:${ORANGE};border-radius:8px;text-decoration:none;`,
  );

  return `
  <section style="background:${CREAM};padding:34px 24px 40px;">
    <div style="max-width:1050px;margin:0 auto;">
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,2.4vw,34px);line-height:1.2;letter-spacing:-0.01em;color:${NAVY};text-align:center;margin:0 auto 12px;max-width:780px;">Ready to see if we're a fit?</h2>
      <p style="font-family:${B};font-size:16px;color:#64748B;text-align:center;margin:0 auto 22px;max-width:620px;">Book a free 1:1 — no pressure, no pitch. Just a conversation about your next step.</p>
      <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:2px solid ${ORANGE};border-radius:14px;padding:28px 28px 26px;box-shadow:0 14px 34px rgba(20,30,45,0.10);text-align:center;">
        <h3 style="font-family:${H};font-weight:800;font-size:22px;color:${NAVY};margin:0 0 18px;">Book Your Free Discovery Call</h3>
        <div>${ctaBtn}</div>
      </div>
    </div>
  </section>
  <footer style="background:${FOOTER_BG};padding:22px 24px;text-align:center;">
    <div style="font-family:${B};font-size:12px;color:${FOOTER_TEXT};line-height:1.7;">
      &copy; ${year} ${brand}. All rights reserved.<br>
      <a href="#" style="color:${FOOTER_TEXT};text-decoration:none;">Privacy Policy</a> &middot; <a href="#" style="color:${FOOTER_TEXT};text-decoration:none;">Terms</a>
    </div>
  </footer>`;
}

/** Full discovery page: hero + "what we'll cover" bands + testimonials + cream booking CTA + footer. */
export function buildDiscoveryBurchardHtml(
  content: LandingPageContent,
  serviceName: string,
  coach: DiscoveryCoachInput = {},
): string {
  return renderDocument({
    title: content.mainHeadline || serviceName,
    fontHref: "https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700;800&family=Open+Sans:wght@400;500;600;700&display=swap",
    bodyBg: NAVY,
    body: [
      heroSection(content, coach),
      bandsSection(content),
      creamSection(content, serviceName, coach),
    ].join("\n"),
  });
}
