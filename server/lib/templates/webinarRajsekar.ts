/**
 * Webinar (Rajsekar) — template #3. A NEW design bar, NOT the Burchard design language.
 * Bespoke replica of the frozen Siddharth Rajsekar masterclass-registration reference
 * (docs/landing-page-references/webinar_registration--rajsekar.png, 4480×23788).
 * ⚠️ CORRECTED 2026-07-17 (reference-audit): the earlier premise "overwhelmingly WHITE, coral
 * action colour" was a MISREAD. The reference is a NAVY-hero page with a PURPLE action colour and
 * an ALTERNATING band rhythm (navy / white / navy / lavender / white / mint / white / lavender /
 * navy) — not monotone white/coral. Poppins headings (Univia-Pro match) / Outfit body.
 *
 * FULL page in reference order: navy hero (badge → headline → sub → countdown → purple CTA +
 * presenter) → white VIDEO/social-proof ("Watch how it works") → NAVY framework band (large
 * numerals) → lavender multi-row success grid → white host bio → MINT free bonuses → white FAQ →
 * lavender "Who is this class for?" closer → navy footer. (The reference's numeric stats bar is
 * intentionally OMITTED — a coach has no such figures and ZAP never invents "50,000+ / ₹1,500Cr+".)
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

// ── Palette — Rajsekar brand design system + PNG-sampled action colours (spec §17) ──
// Fonts: Univia Pro (headings, commercial) → matched to Poppins (closest free geometric — rounded,
// humanist, moderate x-height); body = Outfit (free, per the brand doc). Action colour is PURPLE:
// the CTA button samples #8F5BF6, with a lighter #A78BFA lilac for accent tints; navy hero #0F172A,
// near-black #22222A headings on white, emerald #34D399. (The build had drifted to white/coral.)
const WHITE = "#FFFFFF";
const INK = "#22222A"; // near-black headline / heavy copy (white sections)
const INK_SOFT = "#4A4A55";
const CORAL = "#8F5BF6"; // action colour — sampled purple CTA button
const CORAL_HOVER = "#7A44E8";
const LILAC = "#A78BFA"; // lighter accent tint (eyebrow, emphasis) per the brand doc
const HERO_NAVY = "#0F172A"; // deep-navy hero band (brand doc)
const HERO_SUB = "#C4CAD8"; // hero sub-copy on navy
const BLUE = "#438FD8"; // reservation-card perimeter (retained for form links)
const BLUE_LINK = "#4A96E0";
const GREEN = "#34D399"; // emerald rating tiles (brand doc)
const NAVY = "#0F172A"; // footer + dark framework band (sampled)
const CANVAS_SOFT = "#F6F8FB"; // alternating soft section bg
const CARD_LINE = "#E3E8EF";
// Alternating band backgrounds sampled from the reference rhythm.
const LAVENDER = "#F7F3FF"; // success grid + "who is this for" closer
const MINT = "#ECFDF5";     // free-bonuses band
const PURPLE_ON_DARK = "#B98BFF"; // large framework numerals / accents on the navy band
const H = "'Poppins', system-ui, -apple-system, sans-serif"; // Univia Pro match (headings)
const B = "'Outfit', system-ui, -apple-system, sans-serif";  // Outfit (body, per brand doc)

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

/**
 * 16:9 media mass. `posterOnly` (hero) → the presenter photo only, never the video (the video has
 * its own section below the hero, matching the reference). Otherwise (video section) → real video →
 * embed, else real photo poster (no fake play), else omitted.
 */
function mediaFrame(coach: WebinarCoachInput, posterOnly = false): string {
  const posterUrl = coach.heroImageUrl || coach.headshotUrl;
  const poster = imgOrOmit(
    posterUrl,
    coach.coachName || "Your host",
    "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top center;",
  );
  const inner = !posterOnly && ok(coach.videoUrl) ? videoEmbed(coach.videoUrl!, poster) : poster;
  if (!ok(inner)) return ""; // no real video and no real photo → omit honestly (no placeholder)
  return `<div style="position:relative;width:100%;aspect-ratio:16/9;background:#0B1220;border-radius:12px;overflow:hidden;box-shadow:0 24px 60px rgba(122,60,255,0.22);">${inner}</div>`;
}

/**
 * Hero-right PRESENTER portrait (matches the reference: the presenter beside the headline, NOT a
 * 16:9 video). Prefers the real headshot; falls back to the hero image; omits when neither exists.
 * A portrait 4:5 frame so a face-cropped photo reads as a presenter, not a letterboxed band.
 */
function heroPresenter(coach: WebinarCoachInput): string {
  const url = coach.headshotUrl || coach.heroImageUrl;
  const img = imgOrOmit(url, coach.coachName || "Your host",
    "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top center;");
  if (!ok(img)) return "";
  return `<div style="position:relative;width:100%;aspect-ratio:4/5;max-width:420px;margin:0 auto;background:#0B1220;border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(122,60,255,0.22);">${img}</div>`;
}

/**
 * "Watch how it works" — the reference's white video/social-proof band directly under the hero.
 * Renders the coach's REAL video (video_url) in a 16:9 frame; ZAP never fabricates video, so with no
 * real video the whole section omits. Heading is generic-but-true (never Rajsekar's specific claim).
 */
function videoSection(content: LandingPageContent, coach: WebinarCoachInput): string {
  if (!ok(coach.videoUrl)) return ""; // no real video → omit the section entirely
  const heading = "Watch how it works";
  const sub = ok(content.solutionIntro) ? esc(content.solutionIntro) : "";
  const frame = `<div style="position:relative;width:100%;aspect-ratio:16/9;background:#0B1220;border-radius:16px;overflow:hidden;box-shadow:0 30px 70px rgba(122,60,255,0.18);">${videoEmbed(coach.videoUrl!, "")}</div>`;
  return `
  <section style="background:${WHITE};padding:72px 24px;">
    <div style="max-width:900px;margin:0 auto;text-align:center;">
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,2.8vw,36px);line-height:1.15;color:${INK};margin:0 auto 14px;max-width:22ch;">${heading}</h2>
      ${sub ? `<p style="font-family:${B};font-weight:400;font-size:clamp(15px,1.4vw,18px);line-height:1.55;color:${INK_SOFT};margin:0 auto 34px;max-width:52ch;">${sub}</p>` : `<div style="height:20px;"></div>`}
      ${frame}
    </div>
  </section>`;
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
  // publish hard-gate → review-draft). Never a fake ticking clock. White on the navy hero.
  const countdown = hasDate
    ? `<div id="wb_cd" data-target="${esc(eventTargetAttr(es))}" style="font-family:${B};font-weight:700;font-size:15px;color:${WHITE};letter-spacing:0.08em;margin:0 0 20px;">&nbsp;</div>`
    : "";

  const bonuses = Array.isArray(content.bonuses) ? content.bonuses : [];
  const bonusLine = bonuses.length && ok(bonuses[0].title)
    ? `<div style="font-family:${B};font-weight:600;font-size:15px;line-height:1.4;color:${HERO_SUB};margin:0 0 16px;">&#127873; <span style="color:${LILAC};font-weight:700;">BONUS:</span> ${esc(bonuses[0].title)} — free when you attend live</div>`
    : "";

  const cta = ok(content.primaryCta) ? content.primaryCta : "Reserve My Free Seat";
  // Real-or-nothing trust: a real operator number, else a non-numeric line (never the
  // reference's fabricated "Reviews 9,076 / 5.0").
  const trustLine = ok(coach.trustCount)
    ? `${esc(coach.trustCount)} already registered`
    : "Free to attend &middot; Live online";

  // Left-aligned hero action block on the navy field (no bordered card — the reference keeps the
  // CTA inline under the headline). The reveal-on-intent email capture keeps its wb_* ids so the
  // runtime script still wires it to /api/capture-lead (webinar mode).
  return `
      <div style="text-align:left;">
        ${bonusLine}
        ${countdown}
        <button type="button" id="wb_cta" style="display:inline-block;padding:17px 40px;font-family:${H};font-weight:700;font-size:17px;color:${WHITE};background:${CORAL};border:0;border-radius:16px;cursor:pointer;letter-spacing:0.01em;box-shadow:0 14px 30px rgba(122,60,255,0.35);">${esc(cta)}</button>
        <div id="wb_form" style="display:none;margin-top:16px;max-width:400px;">
          <form id="wb_optin" autocomplete="on" style="display:flex;flex-direction:column;gap:10px;">
            <input type="text" id="wb_name" name="wb_name" placeholder="First name (optional)" style="width:100%;box-sizing:border-box;padding:13px 15px;font-family:${B};font-size:15px;border:1px solid ${CARD_LINE};border-radius:8px;">
            <input type="email" id="wb_email" name="wb_email" required placeholder="you@example.com" style="width:100%;box-sizing:border-box;padding:13px 15px;font-family:${B};font-size:15px;border:1px solid ${CARD_LINE};border-radius:8px;">
            <label style="display:flex;gap:8px;align-items:flex-start;font-family:${B};font-size:12px;line-height:1.4;color:${HERO_SUB};"><input type="checkbox" id="wb_consent" required style="margin-top:3px;"><span>I agree to receive the joining link and related emails, and accept the <a href="https://zapcampaigns.com/privacy" target="_blank" rel="noopener" style="color:${LILAC};">privacy policy</a>.</span></label>
            <div style="position:absolute;left:-9999px;" aria-hidden="true"><input type="text" id="wb_hp" name="wb_hp" tabindex="-1" autocomplete="off"></div>
            <button type="submit" id="wb_submit" style="width:100%;box-sizing:border-box;padding:15px 24px;font-family:${H};font-weight:700;font-size:16px;color:${WHITE};background:${CORAL};border:0;border-radius:16px;cursor:pointer;">Confirm my seat</button>
            <div id="wb_msg" style="font-family:${B};font-size:13px;color:${LILAC};min-height:16px;"></div>
          </form>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:18px;">
          <span aria-hidden="true" style="display:inline-flex;gap:3px;">${greenStar()}${greenStar()}${greenStar()}${greenStar()}${greenStar()}</span>
          <span style="font-family:${B};font-size:13px;font-weight:500;color:${HERO_SUB};">${trustLine}</span>
        </div>
      </div>`;
}

function greenStar(): string {
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;background:${GREEN};border-radius:3px;color:#fff;font-size:11px;line-height:1;">&#9733;</span>`;
}

// ── Sections ─────────────────────────────────────────────────────────────────────────

/** Gate 1: reference-faithful two-column hero — LEFT badge→headline→sub→countdown→CTA, RIGHT presenter. */
function heroSection(content: LandingPageContent, coach: WebinarCoachInput): string {
  const eyebrow = ok(content.eyebrowHeadline) ? esc(content.eyebrowHeadline) : "FREE LIVE CLASS";
  const headline = ok(content.mainHeadline) ? esc(content.mainHeadline) : "Join my free live workshop";
  const sub = ok(content.subheadline) ? esc(content.subheadline) : "";
  const logo = ok(coach.logoUrl)
    ? `<img src="${esc(coach.logoUrl)}" alt="${esc(coach.coachName || "Logo")}" style="height:30px;width:auto;display:block;margin:0 0 22px;">`
    : "";

  // Eyebrow pill: "FREE LIVE CLASS · <real date>" (date only when a real eventSchedule.date exists).
  const es = content.eventSchedule ?? {};
  // Real date → shown in the badge; no date → emit the [INSERT_EVENT_*] tokens so the publish
  // placeholder hard-gate blocks the page (review-draft-until-a-date-is-set). Never a fake date.
  const dateBadge = ok(es.date)
    ? `<span style="color:${HERO_SUB};font-weight:500;">&nbsp;&middot;&nbsp;${esc(es.date)}${ok(es.time) ? `, ${esc(es.time)}` : ""}${ok(es.timezone) ? ` ${esc(es.timezone)}` : ""}</span>`
    : `<span style="color:${HERO_SUB};font-weight:500;">&nbsp;&middot;&nbsp;${EVENT_DATE_TOKEN}, ${EVENT_TIME_TOKEN} ${EVENT_TZ_TOKEN}</span>`;
  const badge = `<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(167,139,250,0.14);border:1px solid rgba(167,139,250,0.34);border-radius:9999px;padding:7px 16px;font-family:${B};font-weight:700;font-size:12px;letter-spacing:0.06em;color:${LILAC};text-transform:uppercase;margin:0 0 20px;"><span aria-hidden="true" style="width:7px;height:7px;border-radius:50%;background:${GREEN};display:inline-block;"></span>${eyebrow}${dateBadge}</div>`;

  const media = heroPresenter(coach); // hero shows the presenter PORTRAIT; the video has its own section
  const action = reserveCard(content, coach);

  // RIGHT: presenter media with two honest decorative chips (no fabricated numbers — both are
  // true of any free live class). Omitted entirely when there is no real video/photo.
  const right = media
    ? `<div style="flex:1 1 440px;min-width:300px;position:relative;">
        ${media}
        <div aria-hidden="true" style="position:absolute;top:-14px;left:-14px;background:${WHITE};border-radius:12px;padding:8px 14px;font-family:${B};font-weight:600;font-size:13px;color:${INK};box-shadow:0 10px 24px rgba(122,60,255,0.20);">&#9889; Live &amp; interactive</div>
        <div aria-hidden="true" style="position:absolute;bottom:-14px;right:-14px;background:${CORAL};border-radius:12px;padding:8px 14px;font-family:${B};font-weight:600;font-size:13px;color:${WHITE};box-shadow:0 10px 24px rgba(122,60,255,0.32);">&#127775; Free to attend</div>
      </div>`
    : "";

  return `
  <section style="background:${HERO_NAVY};padding:56px 24px 64px;">
    <div style="max-width:1120px;margin:0 auto;display:flex;flex-wrap:wrap;gap:48px;align-items:center;justify-content:center;">
      <div id="wb_reserve" style="flex:1 1 460px;min-width:300px;text-align:left;">
        ${logo}${badge}
        <h1 style="font-family:${H};font-weight:800;font-size:clamp(30px,4vw,50px);line-height:1.08;letter-spacing:-0.02em;color:${WHITE};margin:0 0 18px;max-width:15ch;">${headline}</h1>
        ${sub ? `<p style="font-family:${B};font-weight:400;font-size:clamp(16px,1.4vw,19px);line-height:1.55;color:${HERO_SUB};margin:0 0 28px;max-width:46ch;">${sub}</p>` : ""}
        ${action}
      </div>
      ${right}
    </div>
  </section>`;
}

/**
 * "Who is this class for?" — the reference's lavender qualification closer. Binds the coach's
 * existing long ICP (coach.isThisYou, real-or-nothing → omit when empty) and ends on a purple CTA
 * that scrolls to the hero reserve block (no second capture form — the hero owns the one form).
 */
function whoForSection(content: LandingPageContent, coach: WebinarCoachInput): string {
  const items = (Array.isArray(coach.isThisYou) ? coach.isThisYou : []).filter((c) => ok(c?.body)).slice(0, 3);
  if (items.length === 0) return "";
  const cta = ok(content.primaryCta) ? esc(content.primaryCta) : "Reserve My Free Seat";
  const cards = items.map((c) => `
        <div style="flex:1 1 280px;min-width:250px;background:${WHITE};border:1px solid #E7DEF9;border-radius:16px;padding:26px 24px;box-shadow:0 10px 30px rgba(122,60,255,0.08);">
          <div style="width:40px;height:40px;border-radius:10px;background:${CORAL}1A;display:flex;align-items:center;justify-content:center;margin:0 0 16px;"><span style="color:${CORAL};font-family:${H};font-weight:800;font-size:20px;">&#10003;</span></div>
          ${ok(c.label) ? `<div style="font-family:${H};font-weight:700;font-size:17px;color:${INK};margin:0 0 8px;">${esc(c.label)}</div>` : ""}
          <p style="font-family:${B};font-weight:400;font-size:15px;line-height:1.55;color:${INK_SOFT};margin:0;">${esc(c.body)}</p>
        </div>`).join("");
  return `
  <section style="background:${LAVENDER};padding:80px 24px;">
    <div style="max-width:1080px;margin:0 auto;">
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,2.6vw,34px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 36px;max-width:20ch;">Who is this class for?</h2>
      <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;">${cards}</div>
      <div style="text-align:center;margin:38px 0 0;">
        <a href="#wb_reserve" style="display:inline-block;padding:17px 40px;font-family:${H};font-weight:700;font-size:17px;text-decoration:none;color:${WHITE};background:${CORAL};border-radius:16px;box-shadow:0 14px 30px rgba(122,60,255,0.3);">${cta}</a>
      </div>
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
          <div style="font-family:${H};font-weight:800;font-size:clamp(52px,6vw,76px);line-height:1;color:${PURPLE_ON_DARK};margin:0 0 12px;opacity:0.95;">${String(i + 1).padStart(2, "0")}</div>
          ${ok(o.title) ? `<div style="font-family:${H};font-weight:700;font-size:19px;color:${WHITE};margin:0 0 8px;">${esc(o.title)}</div>` : ""}
          ${ok(o.description) ? `<p style="font-family:${B};font-weight:400;font-size:15px;line-height:1.55;color:#C4CAD8;margin:0 auto;max-width:34ch;">${esc(o.description)}</p>` : ""}
        </div>`).join("");
  return `
  <section style="background:${NAVY};padding:80px 24px;">
    <div style="max-width:1080px;margin:0 auto;">
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,2.6vw,34px);line-height:1.15;color:${WHITE};text-align:center;margin:0 auto 48px;max-width:22ch;">What you&#39;ll learn live</h2>
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
  <section style="background:${LAVENDER};padding:80px 24px;">
    <div style="max-width:1120px;margin:0 auto;">
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
  <section style="background:${MINT};padding:80px 24px;">
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

/** Full webinar page (reference band rhythm): navy hero → white video → NAVY framework → lavender
 * success → white bio → MINT bonuses → white FAQ → lavender who-for → navy footer. */
export function buildWebinarRajsekarHtml(
  content: LandingPageContent,
  serviceName: string,
  coach: WebinarCoachInput = {},
): string {
  return renderDocument({
    title: content.mainHeadline || serviceName,
    fontHref: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700&display=swap",
    bodyBg: WHITE,
    body: [
      heroSection(content, coach),
      videoSection(content, coach),
      frameworkSection(content),
      successSection(content),
      bioSection(coach),
      bonusesSection(content),
      faqSection(content),
      whoForSection(content, coach),
      footer(serviceName, coach),
      runtimeScript(),
    ].join("\n"),
  });
}
