/**
 * Webinar (Rajsekar) — template #3. A NEW design bar, NOT the Burchard design language.
 * Bespoke replica of the frozen Siddharth Rajsekar masterclass-registration reference
 * (docs/landing-page-references/webinar_registration--rajsekar.png, 4480×23788): an
 * overwhelmingly WHITE, video-led workshop-registration page with a coral action colour,
 * a blue-outlined white reservation card, and a deep-navy legal footer. Rounded, friendly,
 * very-heavy geometric sans (Poppins) for the headline crown; charcoal body.
 *
 * FULL 10-section page (built to the frozen full-page capture, not the older compact
 * SwipePages evidence): hero (eyebrow → headline → support → media + reservation card) →
 * "Is This You" pain cards → 3-part framework → success stories → host bio → free bonuses →
 * FAQ → footer. (The reference's numeric stats bar is intentionally OMITTED — a coach has no
 * such figures and ZAP never invents "50,000+ / ₹1,500Cr+" numbers.)
 *
 * Highest-risk / Gate-1 section (spec §22): the hero media + reservation-card composite —
 * an asymmetric video/photo mass beside a narrower blue-bordered white action card that must
 * read as ONE conversion unit.
 *
 * Honesty patterns (inherited): ZAP NEVER fabricates video — the media frame shows the coach's
 * REAL video URL, else the real headshot in the 16:9 frame with NO fake play affordance, else
 * omits. Countdown/event row bind to a REAL eventSchedule.date; absent → [INSERT_EVENT_*] tokens
 * so the publish placeholder hard-gate blocks the page (review-draft-until-a-date-is-set).
 * "Is This You" cards bind to the coach's existing long-ICP pains (real-or-nothing, resolver-
 * supplied — never freshly generated). Success stories bind to real testimonials only, with
 * monogram avatars (no fabricated faces, no padding to the reference's 12). Bonus monetary
 * values render only when operator-supplied — never invented. Bespoke builder on the shared
 * Phase-0 primitives; NOT a config engine.
 */
import type { LandingPageContent } from "../../../drizzle/schema";
import { esc, ok, imgOrOmit, initials, renderDocument } from "./templatePrimitives";

export interface WebinarCoachInput {
  /** Presenter photo — headshot slot. Hero media fallback (no fake play) + host-bio portrait. */
  headshotUrl?: string | null;
  /** Optional 16:9 hero image slot — preferred media poster before the headshot. */
  heroImageUrl?: string | null;
  /** Coach logo slot — small wordmark top-left. */
  logoUrl?: string | null;
  coachName?: string | null;
  /** Host bio copy (users.coach_background). */
  coachBackground?: string | null;
  /**
   * The coach's REAL webinar/masterclass video URL (YouTube / Vimeo / hosted file). Null →
   * headshot poster in the 16:9 frame with NO fake play affordance. ZAP never generates video.
   */
  videoUrl?: string | null;
  /**
   * "Is This You" pain cards, sourced from the coach's EXISTING long ICP (pains / frustrations
   * / objections) at publish-resolve time — never freshly generated. Real-or-nothing: empty → the
   * whole section omits.
   */
  isThisYou?: Array<{ label: string; body: string }>;
  /** Operator-fill REAL registrant count. Null → non-numeric trust line. NEVER auto-invented. */
  trustCount?: string | null;
}

// ── Palette — the frozen Rajsekar reference (spec §17), a distinct bar from Burchard ──
const WHITE = "#FFFFFF";
const INK = "#242424"; // near-black headline / heavy copy
const INK_SOFT = "#4A4A55";
const CORAL = "#FF5847"; // eyebrow + CTA + action
const CORAL_HOVER = "#F0472F";
const BLUE = "#438FD8"; // reservation-card perimeter
const BLUE_LINK = "#4A96E0";
const GREEN = "#1FA463"; // rating tiles
const NAVY = "#04113A"; // footer
const CANVAS_SOFT = "#F6F8FB"; // alternating soft section bg
const CARD_LINE = "#E3E8EF";
const H = "'Poppins', system-ui, -apple-system, sans-serif";
const B = "'Poppins', system-ui, -apple-system, sans-serif";

const EVENT_DATE_TOKEN = "[INSERT_EVENT_DATE]";
const EVENT_TIME_TOKEN = "[INSERT_EVENT_TIME]";
const EVENT_TZ_TOKEN = "[INSERT_EVENT_TIMEZONE]";

// ── Media frame — real video, else real photo (no fake play), else omit ──────────────

/**
 * A safe embed for the coach's REAL video: YouTube / Vimeo → provider iframe; direct file →
 * <video>. Unrecognised URL → the poster fallback (never a fabricated player). All attrs escaped.
 */
function videoEmbed(url: string, posterFallback: string): string {
  const u = String(url || "").trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  let src: string | null = null;
  if (yt) src = `https://www.youtube.com/embed/${yt[1]}`;
  else if (vm) src = `https://player.vimeo.com/video/${vm[1]}`;
  if (src) {
    return `<iframe src="${esc(src)}" title="Workshop preview" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0;"></iframe>`;
  }
  if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) {
    return `<video controls preload="metadata" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#0B1220;"><source src="${esc(u)}"></video>`;
  }
  return posterFallback;
}

/** 16:9 media mass: real video, else real headshot/hero poster (NO play button), else omitted. */
function mediaFrame(coach: WebinarCoachInput): string {
  const posterUrl = coach.heroImageUrl || coach.headshotUrl;
  const poster = imgOrOmit(
    posterUrl,
    coach.coachName || "Your host",
    "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top center;",
  );
  const inner = ok(coach.videoUrl) ? videoEmbed(coach.videoUrl!, poster) : poster;
  if (!ok(inner)) return ""; // no real video and no real photo → omit honestly (no placeholder)
  return `<div style="position:relative;width:100%;aspect-ratio:16/9;background:#0B1220;border-radius:14px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,0.28);">${inner}</div>`;
}

// ── Reservation card (Gate-1 right mass) ─────────────────────────────────────────────

function eventTargetAttr(es: NonNullable<LandingPageContent["eventSchedule"]>): string {
  return [es.date, es.time, es.timezone].filter(Boolean).join(" ").trim();
}

function reserveCard(content: LandingPageContent, coach: WebinarCoachInput): string {
  const es = content.eventSchedule ?? {};
  const hasDate = ok(es.date);
  const eventLine = hasDate
    ? `${esc(es.date)}${ok(es.time) ? `, ${esc(es.time)}` : ""}${ok(es.timezone) ? ` ${esc(es.timezone)}` : ""}`
    : `${EVENT_DATE_TOKEN}, ${EVENT_TIME_TOKEN} ${EVENT_TZ_TOKEN}`;

  // Countdown binds to a REAL date only. No date → no timer (and the tokens above trip the
  // publish hard-gate → review-draft). Never a fake ticking clock.
  const countdown = hasDate
    ? `<div id="wb_cd" data-target="${esc(eventTargetAttr(es))}" style="font-family:${B};font-weight:700;font-size:15px;color:${CORAL};letter-spacing:0.02em;margin:2px 0 14px;">&nbsp;</div>`
    : "";

  const bonuses = Array.isArray(content.bonuses) ? content.bonuses : [];
  const bonusLine = bonuses.length && ok(bonuses[0].title)
    ? `<div style="font-family:${H};font-weight:700;font-size:16px;line-height:1.35;color:${INK};margin:0 0 12px;">&#127873; <span style="color:${CORAL};">BONUS:</span> ${esc(bonuses[0].title)} — free when you attend live</div>`
    : "";

  const cta = ok(content.primaryCta) ? content.primaryCta : "Reserve My Free Seat";
  // Real-or-nothing trust: a real operator number, else a non-numeric line (never the
  // reference's fabricated "Reviews 9,076 / 5.0").
  const trustLine = ok(coach.trustCount)
    ? `${esc(coach.trustCount)} already registered`
    : "Free to attend &middot; Live online";

  return `
      <div style="background:${WHITE};border:2px dashed ${BLUE};border-radius:16px;padding:26px 26px 22px;box-shadow:0 18px 44px rgba(15,23,42,0.10);">
        ${bonusLine}
        <div style="display:flex;align-items:center;gap:8px;font-family:${B};font-weight:600;font-size:15px;color:${INK};margin:0 0 4px;">
          <span aria-hidden="true">&#128197;</span><span>${eventLine}</span>
        </div>
        ${countdown}
        <!-- Default state matches the frozen card: a single coral CTA, no visible fields. The
             minimal email capture reveals on intent, then posts to /api/capture-lead (webinar). -->
        <button type="button" id="wb_cta" style="display:block;width:100%;box-sizing:border-box;padding:16px 24px;font-family:${H};font-weight:700;font-size:17px;color:${WHITE};background:${CORAL};border:0;border-radius:9999px;cursor:pointer;letter-spacing:0.01em;">${esc(cta)}</button>
        <div id="wb_form" style="display:none;margin-top:14px;">
          <form id="wb_optin" autocomplete="on" style="display:flex;flex-direction:column;gap:10px;">
            <input type="text" id="wb_name" name="wb_name" placeholder="First name (optional)" style="width:100%;box-sizing:border-box;padding:12px 14px;font-family:${B};font-size:15px;border:1px solid ${CARD_LINE};border-radius:10px;">
            <input type="email" id="wb_email" name="wb_email" required placeholder="you@example.com" style="width:100%;box-sizing:border-box;padding:12px 14px;font-family:${B};font-size:15px;border:1px solid ${CARD_LINE};border-radius:10px;">
            <label style="display:flex;gap:8px;align-items:flex-start;font-family:${B};font-size:12px;line-height:1.4;color:${INK_SOFT};"><input type="checkbox" id="wb_consent" required style="margin-top:3px;"><span>I agree to receive the joining link and related emails, and accept the <a href="https://zapcampaigns.com/privacy" target="_blank" rel="noopener" style="color:${BLUE_LINK};">privacy policy</a>.</span></label>
            <div style="position:absolute;left:-9999px;" aria-hidden="true"><input type="text" id="wb_hp" name="wb_hp" tabindex="-1" autocomplete="off"></div>
            <button type="submit" id="wb_submit" style="width:100%;box-sizing:border-box;padding:14px 24px;font-family:${H};font-weight:700;font-size:16px;color:${WHITE};background:${CORAL};border:0;border-radius:9999px;cursor:pointer;">Confirm my seat</button>
            <div id="wb_msg" style="font-family:${B};font-size:13px;color:${CORAL_HOVER};min-height:16px;"></div>
          </form>
        </div>
        <div style="display:flex;align-items:center;gap:8px;justify-content:center;margin-top:14px;">
          <span aria-hidden="true" style="display:inline-flex;gap:3px;">${greenStar()}${greenStar()}${greenStar()}${greenStar()}${greenStar()}</span>
          <span style="font-family:${B};font-size:13px;font-weight:500;color:${INK_SOFT};">${trustLine}</span>
        </div>
      </div>`;
}

function greenStar(): string {
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;background:${GREEN};border-radius:3px;color:#fff;font-size:11px;line-height:1;">&#9733;</span>`;
}

// ── Sections ─────────────────────────────────────────────────────────────────────────

/** Gate 1: centered eyebrow → headline → support, then the media + reservation-card composite. */
function heroSection(content: LandingPageContent, coach: WebinarCoachInput): string {
  const eyebrow = ok(content.eyebrowHeadline) ? esc(content.eyebrowHeadline) : "FREE ONLINE WORKSHOP";
  const headline = ok(content.mainHeadline) ? esc(content.mainHeadline) : "Join my free live workshop";
  const sub = ok(content.subheadline) ? esc(content.subheadline) : "";
  const logo = ok(coach.logoUrl)
    ? `<img src="${esc(coach.logoUrl)}" alt="${esc(coach.coachName || "Logo")}" style="height:30px;width:auto;display:block;margin:0 auto;">`
    : "";

  const media = mediaFrame(coach);
  const card = reserveCard(content, coach);
  // Asymmetric composite (spec §7): media the wider left mass, card the narrower right mass.
  // When there is no media at all, the card centres so the hero still reads finished.
  const composite = media
    ? `<div style="display:flex;flex-wrap:wrap;gap:34px;align-items:flex-start;justify-content:center;">
        <div style="flex:1 1 560px;min-width:300px;max-width:680px;">${media}</div>
        <div style="flex:1 1 380px;min-width:290px;max-width:440px;">${card}</div>
      </div>`
    : `<div style="max-width:460px;margin:0 auto;">${card}</div>`;

  return `
  <section style="background:${WHITE};padding:34px 24px 56px;">
    <div style="max-width:1080px;margin:0 auto;text-align:center;">
      ${logo ? `<div style="margin:0 0 26px;">${logo}</div>` : ""}
      <div style="font-family:${B};font-weight:700;font-size:14px;letter-spacing:0.08em;color:${CORAL};text-transform:uppercase;margin:0 0 14px;">${eyebrow}</div>
      <h1 style="font-family:${H};font-weight:800;font-size:clamp(30px,4.4vw,52px);line-height:1.06;letter-spacing:-0.02em;color:${INK};margin:0 auto 18px;max-width:16ch;">${headline}</h1>
      ${sub ? `<p style="font-family:${B};font-weight:500;font-size:clamp(16px,1.5vw,19px);line-height:1.5;color:${INK_SOFT};margin:0 auto 40px;max-width:52ch;">${sub}</p>` : `<div style="height:20px;"></div>`}
      <div style="text-align:left;">${composite}</div>
    </div>
  </section>`;
}

/** "Is This You" — 3 pain cards bound to the coach's existing long ICP (real-or-nothing). */
function isThisYouSection(coach: WebinarCoachInput): string {
  const items = (Array.isArray(coach.isThisYou) ? coach.isThisYou : []).filter((c) => ok(c?.body)).slice(0, 3);
  if (items.length === 0) return "";
  const cards = items.map((c) => `
        <div style="flex:1 1 280px;min-width:250px;background:${WHITE};border:1px solid ${CARD_LINE};border-radius:16px;padding:26px 24px;box-shadow:0 8px 24px rgba(15,23,42,0.05);">
          <div style="width:40px;height:40px;border-radius:10px;background:${CORAL}1A;display:flex;align-items:center;justify-content:center;margin:0 0 16px;"><span style="color:${CORAL};font-family:${H};font-weight:800;font-size:20px;">?</span></div>
          ${ok(c.label) ? `<div style="font-family:${H};font-weight:700;font-size:17px;color:${INK};margin:0 0 8px;">${esc(c.label)}</div>` : ""}
          <p style="font-family:${B};font-weight:400;font-size:15px;line-height:1.55;color:${INK_SOFT};margin:0;">${esc(c.body)}</p>
        </div>`).join("");
  return `
  <section style="background:${CANVAS_SOFT};padding:64px 24px;">
    <div style="max-width:1080px;margin:0 auto;">
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,2.6vw,34px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 36px;max-width:20ch;">Does this sound like you?</h2>
      <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;">${cards}</div>
    </div>
  </section>`;
}

/** 3-part framework — binds consultationOutline ("What you'll learn LIVE"). */
function frameworkSection(content: LandingPageContent): string {
  const outline = (Array.isArray(content.consultationOutline) ? content.consultationOutline : [])
    .filter((o) => ok(o?.title) || ok(o?.description)).slice(0, 3);
  if (outline.length === 0) return "";
  const steps = outline.map((o, i) => `
        <div style="flex:1 1 280px;min-width:250px;text-align:center;">
          <div style="width:56px;height:56px;border-radius:9999px;background:${CORAL};color:${WHITE};display:flex;align-items:center;justify-content:center;font-family:${H};font-weight:800;font-size:24px;margin:0 auto 18px;">${i + 1}</div>
          ${ok(o.title) ? `<div style="font-family:${H};font-weight:700;font-size:19px;color:${INK};margin:0 0 8px;">${esc(o.title)}</div>` : ""}
          ${ok(o.description) ? `<p style="font-family:${B};font-weight:400;font-size:15px;line-height:1.55;color:${INK_SOFT};margin:0 auto;max-width:34ch;">${esc(o.description)}</p>` : ""}
        </div>`).join("");
  return `
  <section style="background:${WHITE};padding:72px 24px;">
    <div style="max-width:1080px;margin:0 auto;">
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,2.6vw,34px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 44px;max-width:22ch;">What you&#39;ll learn live</h2>
      <div style="display:flex;flex-wrap:wrap;gap:32px;justify-content:center;">${steps}</div>
    </div>
  </section>`;
}

/** Success stories — real testimonials only, monogram avatars, no padding, no invented figures. */
function successSection(content: LandingPageContent): string {
  const testimonials = (Array.isArray(content.testimonials) ? content.testimonials : [])
    .filter((t) => ok(t?.quote)).slice(0, 6);
  if (testimonials.length === 0) return "";
  const cards = testimonials.map((t) => `
        <div style="flex:1 1 300px;min-width:260px;max-width:360px;background:${WHITE};border:1px solid ${CARD_LINE};border-radius:16px;padding:24px;box-shadow:0 8px 24px rgba(15,23,42,0.05);">
          <div style="display:flex;align-items:center;gap:12px;margin:0 0 14px;">
            <div aria-hidden="true" style="width:44px;height:44px;border-radius:9999px;background:${CORAL}1A;display:flex;align-items:center;justify-content:center;font-family:${H};font-weight:700;font-size:16px;color:${CORAL};text-transform:uppercase;">${esc(initials(String(t.name ?? "")))}</div>
            <div>
              ${ok(t.name) ? `<div style="font-family:${H};font-weight:700;font-size:15px;color:${INK};">${esc(t.name)}</div>` : ""}
              ${ok(t.location) ? `<div style="font-family:${B};font-size:13px;color:${INK_SOFT};">${esc(t.location)}</div>` : ""}
            </div>
          </div>
          <p style="font-family:${B};font-weight:400;font-size:15px;line-height:1.55;color:${INK};margin:0;">&ldquo;${esc(t.quote)}&rdquo;</p>
        </div>`).join("");
  return `
  <section style="background:${CANVAS_SOFT};padding:72px 24px;">
    <div style="max-width:1080px;margin:0 auto;">
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,2.6vw,34px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 40px;max-width:22ch;">From people who attended</h2>
      <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;">${cards}</div>
    </div>
  </section>`;
}

/** Host bio — coach name + background + real portrait (monogram-free: a real photo or omit). */
function bioSection(coach: WebinarCoachInput): string {
  const name = ok(coach.coachName) ? esc(coach.coachName) : "";
  const bio = ok(coach.coachBackground) ? esc(coach.coachBackground) : "";
  if (!name && !bio) return "";
  const portrait = imgOrOmit(
    coach.headshotUrl,
    coach.coachName || "Your host",
    "width:150px;height:150px;border-radius:9999px;object-fit:cover;object-position:top center;flex-shrink:0;box-shadow:0 12px 30px rgba(15,23,42,0.16);",
  );
  return `
  <section style="background:${WHITE};padding:72px 24px;">
    <div style="max-width:860px;margin:0 auto;display:flex;flex-wrap:wrap;gap:34px;align-items:center;justify-content:center;">
      ${portrait}
      <div style="flex:1 1 380px;min-width:280px;">
        <div style="font-family:${B};font-weight:700;font-size:13px;letter-spacing:0.08em;color:${CORAL};text-transform:uppercase;margin:0 0 8px;">Meet your host</div>
        ${name ? `<h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,2.4vw,32px);color:${INK};margin:0 0 14px;">${name}</h2>` : ""}
        ${bio ? `<p style="font-family:${B};font-weight:400;font-size:16px;line-height:1.6;color:${INK_SOFT};margin:0;">${bio}</p>` : ""}
      </div>
    </div>
  </section>`;
}

/** Free bonuses — generated title + description; monetary value renders only when operator-supplied. */
function bonusesSection(content: LandingPageContent): string {
  const bonuses = (Array.isArray(content.bonuses) ? content.bonuses : [])
    .filter((b) => ok(b?.title) || ok(b?.description)).slice(0, 4);
  if (bonuses.length === 0) return "";
  const cards = bonuses.map((b) => `
        <div style="flex:1 1 300px;min-width:260px;max-width:360px;background:${WHITE};border:1px solid ${CARD_LINE};border-radius:16px;padding:24px;box-shadow:0 8px 24px rgba(15,23,42,0.05);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px;">
            ${ok(b.title) ? `<div style="font-family:${H};font-weight:700;font-size:17px;color:${INK};">${esc(b.title)}</div>` : "<span></span>"}
            ${ok(b.value) ? `<div style="font-family:${H};font-weight:700;font-size:14px;color:${GREEN};white-space:nowrap;">${esc(b.value)}</div>` : ""}
          </div>
          ${ok(b.description) ? `<p style="font-family:${B};font-weight:400;font-size:15px;line-height:1.55;color:${INK_SOFT};margin:0;">${esc(b.description)}</p>` : ""}
        </div>`).join("");
  return `
  <section style="background:${CANVAS_SOFT};padding:72px 24px;">
    <div style="max-width:1080px;margin:0 auto;">
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,2.6vw,34px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 12px;max-width:22ch;">Free bonuses when you attend live</h2>
      <p style="font-family:${B};font-size:15px;color:${INK_SOFT};text-align:center;margin:0 auto 40px;max-width:46ch;">Show up live and these are yours &mdash; on the house.</p>
      <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;">${cards}</div>
    </div>
  </section>`;
}

/** FAQ — binds content.faq. */
function faqSection(content: LandingPageContent): string {
  const faq = (Array.isArray(content.faq) ? content.faq : []).filter((f) => ok(f?.question)).slice(0, 6);
  if (faq.length === 0) return "";
  const items = faq.map((f) => `
        <div style="border-bottom:1px solid ${CARD_LINE};padding:20px 0;">
          <div style="font-family:${H};font-weight:700;font-size:17px;color:${INK};margin:0 0 8px;">${esc(f.question)}</div>
          ${ok(f.answer) ? `<p style="font-family:${B};font-weight:400;font-size:15px;line-height:1.55;color:${INK_SOFT};margin:0;">${esc(f.answer)}</p>` : ""}
        </div>`).join("");
  return `
  <section style="background:${WHITE};padding:72px 24px;">
    <div style="max-width:760px;margin:0 auto;">
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,2.6vw,34px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 28px;">Questions?</h2>
      ${items}
    </div>
  </section>`;
}

function footer(serviceName: string, coach: WebinarCoachInput): string {
  const brand = ok(coach.coachName) ? esc(coach.coachName) : esc(serviceName || "Your Brand");
  const year = new Date().getFullYear();
  return `
  <footer style="background:${NAVY};padding:34px 24px;text-align:center;">
    <div style="font-family:${B};font-size:12px;color:#9FB2CC;line-height:1.8;">
      &copy; ${year} ${brand}. All rights reserved.<br>
      <a href="#" style="color:${BLUE_LINK};text-decoration:none;">Privacy Policy</a> &middot; <a href="#" style="color:${BLUE_LINK};text-decoration:none;">Terms &amp; Conditions</a>
    </div>
  </footer>`;
}

/**
 * Inline runtime: (1) countdown to a REAL event date (hides itself if the target is unparseable —
 * never a fake clock); (2) reveal-on-intent email capture that posts to /api/capture-lead in
 * webinar mode (email + consent only; no magnet delivery). Slug is read from the page URL, so
 * nothing needs injecting at build time.
 */
function runtimeScript(): string {
  return `<script>
(function(){
  var cd=document.getElementById('wb_cd');
  if(cd){var t=Date.parse(cd.getAttribute('data-target')||'');
    if(isNaN(t)){cd.style.display='none';}
    else{var tick=function(){var d=t-Date.now();if(d<0){cd.textContent='Starting soon';return;}
      var day=Math.floor(d/864e5),h=Math.floor(d/36e5%24),m=Math.floor(d/6e4%60),s=Math.floor(d/1e3%60);
      cd.textContent='Starts in '+day+'d '+h+'h '+m+'m '+s+'s';};tick();setInterval(tick,1000);}}
  var btn=document.getElementById('wb_cta'),box=document.getElementById('wb_form');
  if(btn&&box){btn.addEventListener('click',function(){box.style.display='block';var e=document.getElementById('wb_email');if(e){e.focus();}});}
  var form=document.getElementById('wb_optin');
  if(form){form.addEventListener('submit',function(ev){ev.preventDefault();
    var msg=document.getElementById('wb_msg');
    var email=((document.getElementById('wb_email')||{}).value||'').trim();
    var consent=(document.getElementById('wb_consent')||{}).checked;
    if(!email||!consent){if(msg){msg.textContent='Enter your email and tick the box to reserve your seat.';}return;}
    var sub=document.getElementById('wb_submit');if(sub){sub.disabled=true;sub.textContent='Reserving…';}
    var slug=(location.pathname.split('/').filter(Boolean).pop())||'';
    fetch('/api/capture-lead',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({mode:'webinar',slug:slug,email:email,name:((document.getElementById('wb_name')||{}).value||''),consent:consent,website:((document.getElementById('wb_hp')||{}).value||'')})})
    .then(function(r){return r.json().catch(function(){return {};});})
    .then(function(){box.innerHTML='<div style="font-family:'+"'Poppins',sans-serif"+';font-weight:600;font-size:15px;color:#242424;text-align:center;padding:8px 0;">You&#39;re registered! Check your inbox for the joining link.</div>';})
    .catch(function(){if(msg){msg.textContent='Something went wrong — please try again.';}if(sub){sub.disabled=false;sub.textContent='Confirm my seat';}});
  });}
})();
</script>`;
}

/** Full webinar page: hero composite → is-this-you → framework → success → bio → bonuses → FAQ → footer. */
export function buildWebinarRajsekarHtml(
  content: LandingPageContent,
  serviceName: string,
  coach: WebinarCoachInput = {},
): string {
  return renderDocument({
    title: content.mainHeadline || serviceName,
    fontHref: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap",
    bodyBg: WHITE,
    body: [
      heroSection(content, coach),
      isThisYouSection(coach),
      frameworkSection(content),
      successSection(content),
      bioSection(coach),
      bonusesSection(content),
      faqSection(content),
      footer(serviceName, coach),
      runtimeScript(),
    ].join("\n"),
  });
}
