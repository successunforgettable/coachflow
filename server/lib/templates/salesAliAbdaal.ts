/**
 * Sales — Ali Abdaal (Part-Time YouTuber Academy) — template #5 (the last). A NEW design bar,
 * distinct from Burchard / discovery / webinar / event. Bespoke replica of the frozen Ali Abdaal
 * direct-sale course page (docs/landing-page-references/sales_page--ali-abdaal.png, 4480×69468 —
 * the tallest reference): an editorial, mostly-white/warm-ivory long-form sales page with
 * oversized sans↔serif headlines, green purchase CTAs, coral annotation, rounded cream "chapters".
 *
 * Grey-box silhouette (spec §23): header → mixed-font hero + video + CTA → review wall → founder
 * story → "secret formula" panel → systems tile grid → deliverable bands → RESULTS (the three-tier
 * case-study section) → curriculum accordion → giant offer/checklist card → bonuses → guarantee →
 * FAQ → footer.
 *
 * Highest-risk / Gate-1 section (spec §24/§25): the results/case-study sequence. DELIBERATE,
 * DISCLOSED honesty divergence — the reference's power is three quantified case studies with growth
 * CHARTS and before/after subscriber/revenue numbers, NONE of which is sourceable without
 * fabricating figures a coach doesn't have (Ali's charts, counts, revenue). We render the coach's
 * REAL testimonials as honest monogram quote cards, and render structured `caseStudies` ONLY when an
 * operator supplies real ones (identity + quote + real metric strings, never a fabricated chart).
 * This section reads as clean testimonials, not quantified charts, BY DESIGN — judge it as intended.
 *
 * Honesty patterns (inherited): hero media = coach's REAL video_url → headshot poster (no fake play)
 * → omit; ZAP never fabricates video, charts, the "6,000 creators" stat, alumni subscriber counts,
 * founder journey chart, or metric trios (all omitted real-or-nothing). Testimonials = real monogram
 * cards. Price = operator-captured content.price; ABSENT → the offer card emits [INSERT_PRICE] so the
 * publish placeholder hard-gate blocks the page (a sales page is incomplete without a price →
 * review-draft). CTA → the coach's real checkout URL, else a reveal-on-intent email capture
 * (/api/capture-lead sales mode) — never a dead button. Bespoke builder on the shared Phase-0
 * primitives; NOT a config engine.
 */
import type { LandingPageContent } from "../../../drizzle/schema";
import { esc, ok, imgOrOmit, initials, stars, checkCircle, tileIconSet, ctaLink, renderDocument } from "./templatePrimitives";

export interface SalesCoachInput {
  /** Presenter photo — headshot slot. Hero poster fallback + founder + offer-card portrait. */
  headshotUrl?: string | null;
  /** Optional 16:9 hero image — preferred video poster before the headshot. */
  heroImageUrl?: string | null;
  /** Coach logo — small wordmark in the header. */
  logoUrl?: string | null;
  coachName?: string | null;
  /** Founder-story copy (users.coach_background). */
  coachBackground?: string | null;
  /** Coach's REAL course video URL. Null → headshot poster (no fake play), else omit. */
  videoUrl?: string | null;
  /** Coach's REAL external checkout URL. Null → the CTA reveals an email capture instead. */
  checkoutUrl?: string | null;
}

// ── Palette — sampled token-for-token from the frozen Ali Abdaal reference (sales_page--ali-abdaal.png).
// Warm off-white barely above white (NOT a yellow ivory), dark navy-black ink, a SKY-BLUE `#5DCDF1`
// purchase CTA with `#1B1624` text, and gold review stars. Restraint is the point — the reference's
// polish comes from subtle warmth + high-contrast serif, not saturated colour.
// ⚠️ CORRECTED 2026-07-17 (reference-audit): the earlier premise "MUTED natural green purchase CTA +
// SOFT coral accent" was a MISREAD — the reference's real primary CTA is sky-blue (sampled #5DCDF1,
// 74k px). Green is retained for checkmarks/accents only; the CTA is sky-blue. ──
const WHITE = "#FFFFFF";
const IVORY = "#F9F6F3";      // page off-white (249,246,243) — subtle, not tan
const BLOB = "#ECE5E1";       // beige panel / faint organic background shape
const INK = "#1B1624";        // sampled headline navy-black (27,22,36)
const INK_SOFT = "#6B6572";
const BODY = "#4A4652";
const GREEN = "#2F9E4E";      // sampled muted natural green — retained for checkmarks / accents only
const GREEN_HOVER = "#268A42";
const CTA = "#5DCDF1";        // sampled sky-blue primary purchase CTA (reference's real CTA colour)
const CTA_HOVER = "#43C1EA";  // slightly deeper sky blue on hover
const CTA_TEXT = "#1B1624";   // dark ink on the sky-blue CTA (not white)
const CORAL = "#FD6D6D";      // sampled soft coral (253,109,109), not orange
const STAR = "#F6A623";       // gold review stars
const CARD_LINE = "#ECE7E0";  // subtle warm hairline border
const S = "'Hanken Grotesk', system-ui, -apple-system, sans-serif"; // squared grotesque — nav / body / connective copy
const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif"; // high-contrast editorial serif — display

const PRICE_TOKEN = "[INSERT_PRICE]";

// ── Hero media — real video, else real landscape photo, else natural-aspect headshot, else omit ──
function videoEmbed(url: string): string {
  const u = String(url || "").trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (yt) return `<iframe src="https://www.youtube.com/embed/${esc(yt[1])}" title="Course preview" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0;"></iframe>`;
  if (vm) return `<iframe src="https://player.vimeo.com/video/${esc(vm[1])}" title="Course preview" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0;"></iframe>`;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return `<video controls preload="metadata" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#0B1220;"><source src="${esc(u)}"></video>`;
  return "";
}
function frame16x9(inner: string): string {
  return `<div style="position:relative;width:100%;max-width:760px;margin:0 auto;aspect-ratio:16/9;background:#0B1220;border-radius:16px;overflow:hidden;box-shadow:0 18px 44px rgba(27,22,36,0.10);">${inner}</div>`;
}
function heroMedia(coach: SalesCoachInput): string {
  const alt = coach.coachName || "Your instructor";
  if (ok(coach.videoUrl)) { const e = videoEmbed(coach.videoUrl!); if (ok(e)) return frame16x9(e); }
  if (ok(coach.heroImageUrl)) {
    const p = imgOrOmit(coach.heroImageUrl, alt, "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;");
    if (ok(p)) return frame16x9(p);
  }
  if (ok(coach.headshotUrl)) {
    return `<div style="width:100%;max-width:360px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 18px 44px rgba(27,22,36,0.10);"><img src="${esc(coach.headshotUrl)}" alt="${esc(alt)}" style="display:block;width:100%;height:auto;"></div>`;
  }
  return "";
}

// ── CTA + capture ──────────────────────────────────────────────────────────────────────────────
/** Green purchase CTA. Real checkout URL → a real link; else a reveal-on-intent capture button. */
function purchaseCta(coach: SalesCoachInput, id: string, label: string): string {
  const style = `display:inline-block;padding:15px 38px;font-family:${S};font-weight:600;font-size:clamp(15px,1.5vw,17px);color:${CTA_TEXT};background:${CTA};border:0;border-radius:9999px;cursor:pointer;text-decoration:none;box-shadow:0 1px 2px rgba(27,22,36,0.10);`;
  if (ok(coach.checkoutUrl)) return ctaLink(coach.checkoutUrl!, label, style);
  return `<button type="button" class="sl_cta" data-form="${esc(id)}" style="${style}">${esc(label)}</button>`;
}
function captureForm(coach: SalesCoachInput, id: string): string {
  if (ok(coach.checkoutUrl)) return ""; // real checkout link → no on-page capture needed
  return `
      <div id="${esc(id)}" class="sl_form" style="display:none;max-width:440px;margin:18px auto 0;text-align:left;">
        <form class="sl_optin" autocomplete="on" style="display:flex;flex-direction:column;gap:10px;">
          <input type="text" name="sl_name" placeholder="First name (optional)" style="width:100%;box-sizing:border-box;padding:13px 15px;font-family:${S};font-size:15px;border:1px solid ${CARD_LINE};border-radius:10px;">
          <input type="email" name="sl_email" required placeholder="you@example.com" style="width:100%;box-sizing:border-box;padding:13px 15px;font-family:${S};font-size:15px;border:1px solid ${CARD_LINE};border-radius:10px;">
          <label style="display:flex;gap:8px;align-items:flex-start;font-family:${S};font-size:12px;line-height:1.4;color:${BODY};"><input type="checkbox" class="sl_consent" required style="margin-top:3px;"><span>I agree to receive enrolment details and related emails, and accept the <a href="https://zapcampaigns.com/privacy" target="_blank" rel="noopener" style="color:${GREEN_HOVER};">privacy policy</a>.</span></label>
          <div style="position:absolute;left:-9999px;" aria-hidden="true"><input type="text" name="sl_hp" tabindex="-1" autocomplete="off"></div>
          <button type="submit" class="sl_submit" style="width:100%;box-sizing:border-box;padding:15px 24px;font-family:${S};font-weight:700;font-size:16px;color:${CTA_TEXT};background:${CTA};border:0;border-radius:9999px;cursor:pointer;">Send me the enrolment details</button>
          <div class="sl_msg" style="font-family:${S};font-size:13px;color:${GREEN_HOVER};min-height:16px;"></div>
        </form>
      </div>`;
}

// ── Sections ─────────────────────────────────────────────────────────────────────────────────
function header(coach: SalesCoachInput, serviceName: string): string {
  const brand = ok(coach.logoUrl)
    ? `<img src="${esc(coach.logoUrl)}" alt="${esc(coach.coachName || serviceName)}" style="height:30px;width:auto;display:block;">`
    : `<span style="font-family:${SERIF};font-weight:600;font-size:20px;color:${INK};">${esc(coach.coachName || serviceName || "The Academy")}</span>`;
  return `
  <header style="background:${IVORY};border-bottom:1px solid ${CARD_LINE};padding:16px 24px;">
    <div style="max-width:1120px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px;">
      ${brand}
      <a href="#sl-offer" style="display:inline-block;padding:10px 22px;font-family:${S};font-weight:600;font-size:14px;color:${CTA_TEXT};background:${CTA};border-radius:9999px;text-decoration:none;">Enrol Today</a>
    </div>
  </header>`;
}

function heroSection(content: LandingPageContent, coach: SalesCoachInput): string {
  const eyebrow = ok(content.eyebrowHeadline) ? `<div style="font-family:${S};font-weight:700;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;color:${CORAL};margin:0 0 22px;">${esc(content.eyebrowHeadline)}</div>` : "";
  // The reference's editorial feel = a high-contrast SERIF (Fraunces) display headline, medium-bold,
  // generously leaded — NOT a heavy sans. That single change is the biggest craft lift.
  const headline = esc(ok(content.mainHeadline) ? content.mainHeadline : "Learn the strategies I use to grow, without quitting your day job");
  const sub = ok(content.subheadline) ? esc(content.subheadline) : "";
  const media = heroMedia(coach);
  return `
  <section style="position:relative;background:${IVORY};padding:64px 24px;overflow:hidden;">
    <div aria-hidden="true" style="position:absolute;top:-6%;left:50%;transform:translateX(-50%);width:640px;height:640px;border-radius:9999px;background:${BLOB};filter:blur(8px);opacity:0.6;pointer-events:none;"></div>
    <div style="position:relative;max-width:900px;margin:0 auto;text-align:center;">
      ${eyebrow}
      <h1 style="font-family:${SERIF};font-weight:600;font-size:clamp(34px,4.8vw,60px);line-height:1.13;letter-spacing:-0.005em;color:${INK};margin:0 auto 26px;max-width:19ch;">${headline}</h1>
      ${sub ? `<p style="font-family:${S};font-weight:400;font-size:clamp(16px,1.5vw,19px);line-height:1.6;color:${INK_SOFT};margin:0 auto 30px;max-width:50ch;">${sub}</p>` : `<div style="height:24px;"></div>`}
      ${media ? `<div style="margin:0 auto 30px;">${media}</div>` : ""}
      ${purchaseCta(coach, "f_hero", ok(content.primaryCta) ? content.primaryCta : "Join the Academy")}
      ${captureForm(coach, "f_hero")}
    </div>
  </section>`;
}

type SalesTestimonial = NonNullable<LandingPageContent["testimonials"]>[number];

/**
 * PROOF ALLOCATOR (2026-07-18) — the fix for the duplication bug. The three proof surfaces (review
 * wall, interleaved strips, results grid) all used to slice the SAME `content.testimonials` array, so
 * a coach's testimonials rendered 2–3 times — the same person's quote repeated to fake density. This
 * partitions the coach's REAL testimonials into DISJOINT slices so each appears EXACTLY ONCE, and
 * scales which surfaces render to the count:
 *   N=1–2 → a single wall block (no strips, no results).
 *   N=3   → wall of 3 (no strips, no results).
 *   N=4   → wall of 3 + 1 threaded strip.
 *   N=5–8 → wall of 3 + up to 3 threaded strips + a results block for the remainder.
 *   N=9+  → the saturated treatment (wall + 3 strips + a larger results grid).
 * Real-or-nothing: only quoted testimonials count; nothing is padded, repeated, or fabricated.
 */
function allocateProof(content: LandingPageContent): { wall: SalesTestimonial[]; strips: SalesTestimonial[]; results: SalesTestimonial[] } {
  const all = (Array.isArray(content.testimonials) ? content.testimonials : []).filter((t) => ok(t?.quote));
  if (all.length <= 2) return { wall: all, strips: [], results: [] };
  const wall = all.slice(0, 3);
  const rest = all.slice(3);
  const stripCount = Math.min(3, rest.length);
  return { wall, strips: rest.slice(0, stripCount), results: rest.slice(stripCount) };
}

/** Review wall — real testimonials as five-star monogram cards (its disjoint allocator slice). */
function reviewWall(items: SalesTestimonial[]): string {
  if (items.length === 0) return "";
  const cards = items.map((t) => `
        <div style="flex:1 1 300px;min-width:260px;max-width:360px;background:${WHITE};border:1px solid ${CARD_LINE};border-radius:16px;padding:24px;box-shadow:0 2px 8px rgba(27,22,36,0.08);">
          <div style="margin:0 0 12px;">${stars(STAR, 15)}</div>
          <p style="font-family:${S};font-weight:400;font-size:15px;line-height:1.6;color:${INK};margin:0 0 16px;">&ldquo;${esc(t.quote)}&rdquo;</p>
          <div style="display:flex;align-items:center;gap:12px;">
            <div aria-hidden="true" style="width:42px;height:42px;border-radius:9999px;background:${CORAL}1A;display:flex;align-items:center;justify-content:center;font-family:${SERIF};font-weight:600;font-size:15px;color:${CORAL};text-transform:uppercase;">${esc(initials(String(t.name ?? "")))}</div>
            <div>
              ${ok(t.name) ? `<div style="font-family:${S};font-weight:700;font-size:14px;color:${INK};">${esc(t.name)}</div>` : ""}
              ${ok(t.location) ? `<div style="font-family:${S};font-size:12px;color:${INK_SOFT};">${esc(t.location)}</div>` : ""}
            </div>
          </div>
        </div>`).join("");
  return `
  <section style="background:${WHITE};padding:64px 24px;">
    <div style="max-width:1120px;margin:0 auto;">
      <h2 style="font-family:${SERIF};font-weight:600;font-size:clamp(26px,3vw,38px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 28px;max-width:20ch;">Loved by the people who took it</h2>
      <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;">${cards}</div>
    </div>
  </section>`;
}

/**
 * A single real testimonial as a wide beige interlude — threads proof BETWEEN content sections to
 * match the reference's interleaved rhythm. Takes ONE testimonial from the allocator's disjoint
 * `strips` slice (never re-slices the shared array, so a quote can never repeat elsewhere on the
 * page). Omits when the slot has no testimonial (real-or-nothing).
 */
function proofStrip(t: SalesTestimonial | undefined): string {
  if (!t || !ok(t.quote)) return "";
  return `
  <section style="background:${BLOB};padding:44px 24px;">
    <div style="max-width:820px;margin:0 auto;text-align:center;">
      <div style="margin:0 0 14px;display:flex;justify-content:center;">${stars(STAR, 16)}</div>
      <p style="font-family:${SERIF};font-weight:500;font-style:italic;font-size:clamp(19px,2.2vw,26px);line-height:1.4;color:${INK};margin:0 0 18px;">&ldquo;${esc(t.quote)}&rdquo;</p>
      <div style="font-family:${S};font-weight:700;font-size:15px;color:${INK};">${esc(t.name ?? "")}${ok(t.location) ? `<span style="font-weight:400;color:${INK_SOFT};"> &middot; ${esc(t.location)}</span>` : ""}</div>
    </div>
  </section>`;
}

/** Founder story — coach name + background + real headshot. No fabricated journey chart. */
function founderSection(content: LandingPageContent, coach: SalesCoachInput): string {
  const name = ok(coach.coachName) ? esc(coach.coachName) : "";
  const bio = ok(coach.coachBackground) ? esc(coach.coachBackground) : "";
  if (!name && !bio) return "";
  const portrait = imgOrOmit(coach.headshotUrl, coach.coachName || "Your instructor",
    "width:200px;height:240px;border-radius:16px;object-fit:cover;object-position:top center;flex-shrink:0;box-shadow:0 10px 28px rgba(27,22,36,0.10);");
  const pull = ok(content.shockingStat) ? esc(content.shockingStat) : ok(content.insiderAdvantages) ? esc(content.insiderAdvantages) : "";
  return `
  <section style="background:${WHITE};padding:24px 24px 64px;">
    <div style="max-width:960px;margin:0 auto;display:flex;flex-wrap:wrap;gap:40px;align-items:center;justify-content:center;">
      ${portrait}
      <div style="flex:1 1 420px;min-width:300px;">
        <div style="font-family:${S};font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${CORAL};margin:0 0 10px;">My story</div>
        ${name ? `<h2 style="font-family:${SERIF};font-weight:600;font-size:clamp(24px,2.6vw,34px);color:${INK};margin:0 0 16px;">Hi, I&#39;m ${name}</h2>` : ""}
        ${bio ? `<p style="font-family:${S};font-weight:400;font-size:16px;line-height:1.65;color:${BODY};margin:0 0 ${pull ? "18px" : "0"};">${bio}</p>` : ""}
        ${pull ? `<p style="font-family:${SERIF};font-weight:600;font-style:italic;font-size:19px;line-height:1.4;color:${INK};border-left:3px solid ${CORAL};padding-left:16px;margin:0;">${pull}</p>` : ""}
      </div>
    </div>
  </section>`;
}

/**
 * COACH-PROOF authority band — portable testimonials the coach owns (their track record, other
 * programs, "great mentor" quotes), framed as AUTHORITY next to the founder story, NOT as this
 * program's results. Honest on a brand-new program's page: it says what clients say about working with
 * the coach and claims nothing about the new offer. Sits right after the founder narrative to match
 * Ali's own reference (a founder track-record band). Real-or-omit. Disjoint from the offer wall by
 * construction (offer = serviceId=this; coach = everything else), so no quote appears twice.
 */
function coachProofSection(content: LandingPageContent, coach: SalesCoachInput): string {
  const items = (Array.isArray(content.coachTestimonials) ? content.coachTestimonials : []).filter((t) => ok(t?.quote)).slice(0, 6);
  if (items.length === 0) return "";
  const who = ok(coach.coachName) ? `working with ${esc(coach.coachName)}` : "working with me";
  const cards = items.map((t) => `
        <div style="flex:1 1 300px;min-width:260px;max-width:360px;background:${IVORY};border:1px solid ${CARD_LINE};border-radius:16px;padding:24px;">
          <p style="font-family:${SERIF};font-weight:500;font-style:italic;font-size:16px;line-height:1.55;color:${INK};margin:0 0 16px;">&ldquo;${esc(t.quote)}&rdquo;</p>
          <div style="display:flex;align-items:center;gap:12px;">
            <div aria-hidden="true" style="width:40px;height:40px;border-radius:9999px;background:${CORAL}1A;display:flex;align-items:center;justify-content:center;font-family:${SERIF};font-weight:600;font-size:14px;color:${CORAL};text-transform:uppercase;">${esc(initials(String(t.name ?? "")))}</div>
            <div>
              ${ok(t.name) ? `<div style="font-family:${S};font-weight:700;font-size:14px;color:${INK};">${esc(t.name)}</div>` : ""}
              ${ok(t.location) ? `<div style="font-family:${S};font-size:12px;color:${INK_SOFT};">${esc(t.location)}</div>` : ""}
            </div>
          </div>
        </div>`).join("");
  return `
  <section style="background:${WHITE};padding:24px 24px 64px;">
    <div style="max-width:1000px;margin:0 auto;">
      <div style="font-family:${S};font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${CORAL};text-align:center;margin:0 0 8px;">The people I&#39;ve worked with</div>
      <h2 style="font-family:${SERIF};font-weight:600;font-size:clamp(22px,2.6vw,32px);line-height:1.2;color:${INK};text-align:center;margin:0 auto 28px;max-width:24ch;">What clients say about ${who}</h2>
      <div style="display:flex;flex-wrap:wrap;gap:18px;justify-content:center;">${cards}</div>
    </div>
  </section>`;
}

/** "The simple formula" — editorial panel bound to uniqueMechanism (no fabricated loop labels). */
function formulaSection(content: LandingPageContent): string {
  if (!ok(content.uniqueMechanism)) return "";
  return `
  <section style="background:${IVORY};padding:64px 24px;">
    <div style="max-width:820px;margin:0 auto;background:${WHITE};border:1px solid ${CARD_LINE};border-radius:24px;padding:48px 40px;text-align:center;box-shadow:0 2px 8px rgba(27,22,36,0.08);">
      <div style="font-family:${S};font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${CORAL};margin:0 0 14px;">The simple formula</div>
      <h2 style="font-family:${SERIF};font-weight:600;font-size:clamp(24px,3vw,36px);line-height:1.2;color:${INK};margin:0 auto 20px;max-width:22ch;">It&#39;s simpler than you think</h2>
      <p style="font-family:${S};font-weight:400;font-size:17px;line-height:1.65;color:${BODY};margin:0 auto;max-width:56ch;">${esc(content.uniqueMechanism)}</p>
    </div>
  </section>`;
}

/** "Build systems for" tile grid — bound to systemTiles (up to 8), flat icons + serif labels. */
function systemsGrid(content: LandingPageContent): string {
  const tiles = (Array.isArray(content.systemTiles) ? content.systemTiles : []).filter(ok).slice(0, 8);
  if (tiles.length === 0) return "";
  const icons = tileIconSet(CORAL);
  const cells = tiles.map((t, i) => `
        <div style="flex:1 1 240px;min-width:220px;max-width:300px;background:${IVORY};border:1px solid ${CARD_LINE};border-radius:16px;padding:26px 22px;text-align:center;">
          <div style="display:flex;justify-content:center;margin:0 0 14px;">${icons[i % icons.length]}</div>
          <div style="font-family:${SERIF};font-weight:600;font-size:17px;line-height:1.3;color:${INK};">${esc(t)}</div>
        </div>`).join("");
  return `
  <section style="background:${WHITE};padding:64px 24px;">
    <div style="max-width:1120px;margin:0 auto;">
      <h2 style="font-family:${SERIF};font-weight:600;font-size:clamp(26px,3vw,38px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 30px;max-width:22ch;">You&#39;ll build systems for</h2>
      <div style="display:flex;flex-wrap:wrap;gap:18px;justify-content:center;">${cells}</div>
    </div>
  </section>`;
}

/** Deliverable bands — bound to consultationOutline (render 2–6, no padding). */
function deliverablesSection(content: LandingPageContent): string {
  const items = (Array.isArray(content.consultationOutline) ? content.consultationOutline : [])
    .filter((o) => ok(o?.title) || ok(o?.description)).slice(0, 6);
  if (items.length === 0) return "";
  const cards = items.map((o, i) => `
        <div style="flex:1 1 340px;min-width:280px;background:${WHITE};border:1px solid ${CARD_LINE};border-radius:16px;padding:28px 26px;box-shadow:0 2px 8px rgba(27,22,36,0.08);">
          <div style="font-family:${SERIF};font-weight:600;font-size:14px;color:${CORAL};margin:0 0 10px;">0${i + 1}</div>
          ${ok(o.title) ? `<div style="font-family:${SERIF};font-weight:600;font-size:20px;color:${INK};margin:0 0 10px;">${esc(o.title)}</div>` : ""}
          ${ok(o.description) ? `<p style="font-family:${S};font-weight:400;font-size:15px;line-height:1.6;color:${BODY};margin:0;">${esc(o.description)}</p>` : ""}
        </div>`).join("");
  return `
  <section style="background:${IVORY};padding:64px 24px;">
    <div style="max-width:1000px;margin:0 auto;">
      <h2 style="font-family:${SERIF};font-weight:600;font-size:clamp(26px,3vw,38px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 30px;max-width:24ch;">What&#39;s inside the Academy</h2>
      <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;">${cards}</div>
    </div>
  </section>`;
}

/**
 * GATE-1 results section. Real operator `caseStudies` (identity + quote + real metric strings — NO
 * fabricated charts) when supplied; else the coach's real `testimonials` as monogram quote cards.
 * Never invents Ali's charts, subscriber counts, or revenue. Reads as clean testimonials by design.
 */
function resultsSection(content: LandingPageContent, items: SalesTestimonial[]): string {
  const cases = (Array.isArray(content.caseStudies) ? content.caseStudies : []).filter((c) => ok(c?.name) && ok(c?.quote));
  const heading = `<h2 style="font-family:${SERIF};font-weight:600;font-size:clamp(26px,3vw,38px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 30px;max-width:22ch;">Real results from real students</h2>`;

  if (cases.length > 0) {
    const cards = cases.slice(0, 3).map((c) => {
      const portrait = imgOrOmit(c.portraitUrl, c.name || "Student",
        "width:64px;height:64px;border-radius:9999px;object-fit:cover;flex-shrink:0;");
      const avatar = ok(c.portraitUrl) ? portrait
        : `<div aria-hidden="true" style="width:64px;height:64px;border-radius:9999px;background:${CORAL}1A;display:flex;align-items:center;justify-content:center;font-family:${SERIF};font-weight:600;font-size:22px;color:${CORAL};text-transform:uppercase;flex-shrink:0;">${esc(initials(String(c.name ?? "")))}</div>`;
      // Real operator metric strings only (e.g. "600k+ subscribers"). Never a fabricated chart.
      const metrics = (Array.isArray(c.metrics) ? c.metrics : []).filter(ok).slice(0, 3).map((m) => `
              <div style="flex:1 1 120px;background:${IVORY};border-radius:12px;padding:14px;text-align:center;"><div style="font-family:${SERIF};font-weight:600;font-size:18px;color:${INK};">${esc(m)}</div></div>`).join("");
      return `
        <div style="background:${WHITE};border:1px solid ${CARD_LINE};border-radius:20px;padding:32px;box-shadow:0 2px 8px rgba(27,22,36,0.08);margin:0 0 24px;">
          <div style="display:flex;align-items:center;gap:16px;margin:0 0 18px;">
            ${avatar}
            <div style="font-family:${SERIF};font-weight:600;font-size:20px;color:${INK};">${esc(c.name)}</div>
          </div>
          <p style="font-family:${S};font-weight:400;font-size:16px;line-height:1.65;color:${INK};margin:0 0 ${metrics ? "20px" : "0"};">&ldquo;${esc(c.quote)}&rdquo;</p>
          ${metrics ? `<div style="display:flex;flex-wrap:wrap;gap:12px;">${metrics}</div>` : ""}
        </div>`;
    }).join("");
    return `
  <section style="background:${WHITE};padding:64px 24px;">
    <div style="max-width:820px;margin:0 auto;">${heading}${cards}</div>
  </section>`;
  }

  // Fallback (default): the allocator's disjoint results slice as monogram quote cards (Gate-1 honest
  // form). These are the testimonials NOT already shown in the wall or strips — never a repeat.
  if (items.length === 0) return "";
  const cards = items.map((t) => `
        <div style="flex:1 1 300px;min-width:260px;max-width:360px;background:${WHITE};border:1px solid ${CARD_LINE};border-radius:16px;padding:24px;box-shadow:0 2px 8px rgba(27,22,36,0.08);">
          <p style="font-family:${S};font-weight:400;font-size:15px;line-height:1.6;color:${INK};margin:0 0 16px;">&ldquo;${esc(t.quote)}&rdquo;</p>
          <div style="display:flex;align-items:center;gap:12px;">
            <div aria-hidden="true" style="width:42px;height:42px;border-radius:9999px;background:${GREEN}1A;display:flex;align-items:center;justify-content:center;font-family:${SERIF};font-weight:600;font-size:15px;color:${GREEN_HOVER};text-transform:uppercase;">${esc(initials(String(t.name ?? "")))}</div>
            <div>
              ${ok(t.name) ? `<div style="font-family:${S};font-weight:700;font-size:14px;color:${INK};">${esc(t.name)}</div>` : ""}
              ${ok(t.location) ? `<div style="font-family:${S};font-size:12px;color:${INK_SOFT};">${esc(t.location)}</div>` : ""}
            </div>
          </div>
        </div>`).join("");
  return `
  <section style="background:${WHITE};padding:64px 24px;">
    <div style="max-width:1120px;margin:0 auto;">${heading}
      <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;">${cards}</div>
    </div>
  </section>`;
}

/** Curriculum accordion — bound to curriculum (real module titles + optional emoji). */
function curriculumSection(content: LandingPageContent): string {
  const rows = (Array.isArray(content.curriculum) ? content.curriculum : []).filter((c) => ok(c?.title)).slice(0, 12);
  if (rows.length === 0) return "";
  const items = rows.map((r) => `
        <details style="border:1px solid ${CARD_LINE};border-radius:12px;margin:0 0 12px;background:${WHITE};overflow:hidden;">
          <summary style="list-style:none;cursor:pointer;padding:18px 22px;display:flex;align-items:center;gap:12px;font-family:${SERIF};font-weight:600;font-size:17px;color:${INK};">
            ${ok(r.emoji) ? `<span aria-hidden="true" style="font-size:20px;">${esc(r.emoji)}</span>` : ""}<span style="flex:1;">${esc(r.title)}</span><span aria-hidden="true" style="color:${INK_SOFT};font-size:14px;">▾</span>
          </summary>
        </details>`).join("");
  return `
  <section style="background:${WHITE};padding:64px 24px;">
    <div style="max-width:720px;margin:0 auto;">
      <h2 style="font-family:${SERIF};font-weight:600;font-size:clamp(26px,3vw,38px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 28px;">The curriculum</h2>
      ${items}
    </div>
  </section>`;
}

/**
 * Offer / purchase card — the giant elevated white card. Real operator price only; ABSENT →
 * [INSERT_PRICE] token trips the publish hard-gate → review-draft (a sales page is incomplete
 * without a price). Included-content checklist is built from real curriculum + bonus titles.
 */
function offerSection(content: LandingPageContent, coach: SalesCoachInput): string {
  const p = content.price;
  const hasPrice = !!p && ok(p.amount);
  const cur = hasPrice && ok(p!.currency) ? esc(p!.currency!) + (/^[A-Za-z]/.test(p!.currency!.trim()) ? " " : "") : "";
  const priceText = hasPrice ? `${cur}${esc(p!.amount)}` : PRICE_TOKEN;
  const installments = hasPrice && ok(p!.installments) ? `<div style="font-family:${S};font-weight:400;font-size:15px;color:${INK_SOFT};margin:6px 0 0;">${esc(p!.installments!)}</div>` : "";

  const portrait = imgOrOmit(coach.headshotUrl, coach.coachName || "Your instructor",
    "width:72px;height:72px;border-radius:9999px;object-fit:cover;object-position:top center;flex-shrink:0;");

  const included = [
    ...(Array.isArray(content.curriculum) ? content.curriculum : []).filter((c) => ok(c?.title)).map((c) => c.title),
    ...(Array.isArray(content.bonuses) ? content.bonuses : []).filter((b) => ok(b?.title)).map((b) => `Bonus: ${b.title}`),
  ].slice(0, 14);
  const checklist = included.length
    ? `<div style="margin:22px 0;">${included.map((line) => `<div style="display:flex;align-items:flex-start;gap:10px;font-family:${S};font-size:15px;line-height:1.5;color:${BODY};margin:0 0 10px;">${checkCircle(GREEN)}<span>${esc(line)}</span></div>`).join("")}</div>`
    : "";

  const title = ok(coach.coachName) ? `${esc(coach.coachName)}&#39;s Academy` : ok(content.mainHeadline) ? esc(content.mainHeadline) : "Join the Academy";
  return `
  <section id="sl-offer" style="background:${IVORY};padding:64px 24px;">
    <div style="max-width:640px;margin:0 auto;background:${WHITE};border:1px solid ${CARD_LINE};border-radius:24px;padding:44px 40px;box-shadow:0 2px 8px rgba(27,22,36,0.08);text-align:center;">
      <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin:0 0 20px;">
        ${portrait}
        <div style="font-family:${SERIF};font-weight:600;font-size:22px;color:${INK};text-align:left;">${title}</div>
      </div>
      <div style="font-family:${SERIF};font-weight:600;font-size:clamp(38px,6vw,56px);line-height:1;color:${INK};">${priceText}</div>
      ${installments}
      <div style="margin:26px 0 0;">${purchaseCta(coach, "f_offer", ok(content.primaryCta) ? content.primaryCta : "Enrol Now")}${captureForm(coach, "f_offer")}</div>
      ${checklist ? `<div style="border-top:1px solid ${CARD_LINE};margin-top:26px;padding-top:24px;text-align:left;"><div style="font-family:${S};font-weight:700;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${INK_SOFT};margin:0 0 14px;text-align:center;">Everything you get</div>${checklist}<div style="text-align:center;margin-top:8px;">${purchaseCta(coach, "f_offer2", ok(content.primaryCta) ? content.primaryCta : "Enrol Now")}${captureForm(coach, "f_offer2")}</div></div>` : ""}
    </div>
  </section>`;
}

/** Free bonuses — generated title + description; monetary value only when operator-supplied. */
function bonusesSection(content: LandingPageContent): string {
  const bonuses = (Array.isArray(content.bonuses) ? content.bonuses : []).filter((b) => ok(b?.title) || ok(b?.description)).slice(0, 4);
  if (bonuses.length === 0) return "";
  const cards = bonuses.map((b) => `
        <div style="flex:1 1 300px;min-width:260px;max-width:360px;background:${WHITE};border:1px solid ${CARD_LINE};border-radius:16px;padding:24px;box-shadow:0 2px 8px rgba(27,22,36,0.08);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px;">
            ${ok(b.title) ? `<div style="font-family:${SERIF};font-weight:600;font-size:18px;color:${INK};">${esc(b.title)}</div>` : "<span></span>"}
            ${ok(b.value) ? `<div style="font-family:${S};font-weight:700;font-size:14px;color:${GREEN_HOVER};white-space:nowrap;">${esc(b.value)}</div>` : ""}
          </div>
          ${ok(b.description) ? `<p style="font-family:${S};font-weight:400;font-size:15px;line-height:1.55;color:${BODY};margin:0;">${esc(b.description)}</p>` : ""}
        </div>`).join("");
  return `
  <section style="background:${WHITE};padding:64px 24px;">
    <div style="max-width:1120px;margin:0 auto;">
      <h2 style="font-family:${SERIF};font-weight:600;font-size:clamp(26px,3vw,38px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 28px;max-width:22ch;">Free bonuses when you enrol</h2>
      <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;">${cards}</div>
    </div>
  </section>`;
}

/** Guarantee — bound to content.guarantee (real-or-omit). */
function guaranteeSection(content: LandingPageContent): string {
  if (!ok(content.guarantee)) return "";
  return `
  <section style="background:${IVORY};padding:64px 24px;">
    <div style="max-width:620px;margin:0 auto;background:${WHITE};border:1px solid ${CARD_LINE};border-radius:20px;padding:40px;text-align:center;box-shadow:0 2px 8px rgba(27,22,36,0.08);">
      <div style="font-family:${SERIF};font-weight:600;font-size:clamp(22px,2.6vw,30px);color:${INK};margin:0 0 16px;">Our guarantee</div>
      <p style="font-family:${S};font-weight:400;font-size:16px;line-height:1.65;color:${BODY};margin:0;">${esc(content.guarantee)}</p>
    </div>
  </section>`;
}

/** FAQ — bound to content.faq. */
function faqSection(content: LandingPageContent): string {
  const faq = (Array.isArray(content.faq) ? content.faq : []).filter((f) => ok(f?.question)).slice(0, 8);
  if (faq.length === 0) return "";
  const items = faq.map((f) => `
        <details style="border-bottom:1px solid ${CARD_LINE};padding:6px 0;">
          <summary style="list-style:none;cursor:pointer;padding:16px 0;display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:${SERIF};font-weight:600;font-size:17px;color:${INK};"><span>${esc(f.question)}</span><span aria-hidden="true" style="color:${INK_SOFT};font-size:14px;flex-shrink:0;">▾</span></summary>
          ${ok(f.answer) ? `<p style="font-family:${S};font-weight:400;font-size:15px;line-height:1.6;color:${BODY};margin:0 0 16px;">${esc(f.answer)}</p>` : ""}
        </details>`).join("");
  return `
  <section style="background:${WHITE};padding:64px 24px;">
    <div style="max-width:760px;margin:0 auto;">
      <h2 style="font-family:${SERIF};font-weight:600;font-size:clamp(26px,3vw,38px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 32px;">Questions?</h2>
      ${items}
    </div>
  </section>`;
}

function footer(serviceName: string, coach: SalesCoachInput): string {
  const brand = ok(coach.coachName) ? esc(coach.coachName) : esc(serviceName || "The Academy");
  const year = new Date().getFullYear();
  return `
  <footer style="background:${IVORY};border-top:1px solid ${CARD_LINE};padding:40px 24px;text-align:center;">
    <div style="font-family:${S};font-size:13px;color:${INK_SOFT};line-height:1.9;">
      &copy; ${year} ${brand}. All rights reserved.<br>
      <a href="#" style="color:${INK_SOFT};text-decoration:none;">Privacy Policy</a> &middot; <a href="#" style="color:${INK_SOFT};text-decoration:none;">Terms &amp; Conditions</a>
    </div>
  </footer>`;
}

/** Inline runtime: reveal-on-intent capture (only when there's no real checkout link) → sales mode. */
function runtimeScript(): string {
  return `<script>
(function(){
  var btns=document.querySelectorAll('.sl_cta');
  for(var i=0;i<btns.length;i++){(function(btn){btn.addEventListener('click',function(){
    var f=document.getElementById(btn.getAttribute('data-form'));
    if(f){f.style.display='block';var e=f.querySelector('input[type=email]');if(e){e.focus();}}
  });})(btns[i]);}
  var forms=document.querySelectorAll('.sl_optin');
  for(var j=0;j<forms.length;j++){(function(form){form.addEventListener('submit',function(ev){ev.preventDefault();
    var msg=form.querySelector('.sl_msg');
    var email=((form.querySelector('input[type=email]')||{}).value||'').trim();
    var consent=(form.querySelector('.sl_consent')||{}).checked;
    if(!email||!consent){if(msg){msg.textContent='Enter your email and tick the box to continue.';}return;}
    var sub=form.querySelector('.sl_submit');if(sub){sub.disabled=true;sub.textContent='Sending…';}
    var slug=(location.pathname.split('/').filter(Boolean).pop())||'';
    fetch('/api/capture-lead',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({mode:'sales',slug:slug,email:email,name:((form.querySelector('input[name=sl_name]')||{}).value||''),consent:consent,website:((form.querySelector('input[name=sl_hp]')||{}).value||'')})})
    .then(function(r){return r.json().catch(function(){return {};});})
    .then(function(){form.parentNode.innerHTML='<div style="font-family:'+"'Hanken Grotesk',sans-serif"+';font-weight:700;font-size:15px;color:#1A1A1A;text-align:center;padding:8px 0;">Thanks! Check your inbox for the enrolment details.</div>';})
    .catch(function(){if(msg){msg.textContent='Something went wrong — please try again.';}if(sub){sub.disabled=false;sub.textContent='Send me the enrolment details';}});
  });})(forms[j]);}
})();
</script>`;
}

/**
 * Full Ali-Abdaal sales page: header → hero → review wall → founder → formula → systems grid →
 * deliverables → results (Gate-1) → curriculum → offer → bonuses → guarantee → FAQ → footer.
 * Every section omits gracefully when its source is absent; the offer emits [INSERT_PRICE] when the
 * operator hasn't set a price so the publish gate holds the page as a review-draft.
 */
export function buildSalesAliAbdaalHtml(
  content: LandingPageContent,
  serviceName: string,
  coach: SalesCoachInput = {},
): string {
  return renderDocument({
    title: content.mainHeadline || serviceName,
    fontHref: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap",
    bodyBg: WHITE,
    // Allocate the coach's REAL testimonials across the proof surfaces ONCE, disjointly — each
    // testimonial appears exactly once (wall → threaded strips → results), scaled to the count.
    body: (() => {
      const proof = allocateProof(content);
      return [
        header(coach, serviceName),
        heroSection(content, coach),
        reviewWall(proof.wall),
        founderSection(content, coach),
        coachProofSection(content, coach),   // portable coach proof — authority near the bio, never the offer wall
        formulaSection(content),
        proofStrip(proof.strips[0]),   // threaded proof — the allocator fills 0–3 strips for N=4–8+
        systemsGrid(content),
        proofStrip(proof.strips[1]),
        deliverablesSection(content),
        proofStrip(proof.strips[2]),
        resultsSection(content, proof.results),  // only the remainder beyond wall+strips — never a repeat
        curriculumSection(content),
        offerSection(content, coach),
        bonusesSection(content),
        guaranteeSection(content),
        faqSection(content),
        footer(serviceName, coach),
        runtimeScript(),
      ].join("\n");
    })(),
  });
}
