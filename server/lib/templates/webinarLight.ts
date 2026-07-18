/**
 * Webinar PROOF-LIGHT template — the low-proof sibling of webinarRajsekar.ts.
 *
 * WHY THIS EXISTS (root cause, 2026-07-18): the reference Rajsekar page's success grid is 12+
 * testimonials each with a revenue figure, plus a 50,000+/₹1,500Cr stats bar. But the cascade
 * hard-caps testimonials at 3 (services.testimonial1/2/3; the unlimited `testimonials` library table
 * is NOT wired into LP generation, and proofMetrics/caseStudies are never populated). So the success
 * grid is starved for every real coach. This LIGHT variant is a PROPERLY-COMPOSED page for a coach
 * with little/no proof — teacher- and value-forward — NOT the rich page with an empty success grid.
 * It leans on what is ALWAYS generated: the promise, the framework (what you'll learn), the method,
 * the host's own story, the bonuses, the cost of inaction. No success grid, no stats bar. Selected
 * automatically by `resolveWebinarStyle` at publish when proof is below the (placeholder) rich
 * threshold; it is the DEFAULT for webinar_registration.
 *
 * Honesty is identical to the rich variant: the presenter is a background-removed CUTOUT or the figure
 * OMITS (nudge-category: ships text-forward, no review-draft for a missing photo); the countdown binds a
 * REAL event date only; and NOTHING is fabricated. Shares the Rajsekar navy/purple palette + fonts so the variants read as one
 * brand. Self-contained per the Iman/Hormozi precedent — the rich builder is untouched.
 */
import type { LandingPageContent } from "../../../drizzle/schema";
import { esc, ok, imgOrOmit, renderDocument } from "./templatePrimitives";

/** Coach inputs — mirrors WebinarCoachInput; resolved in webinarPublish.ts. */
export interface WebinarLightCoachInput {
  headshotUrl?: string | null;
  presenterCutoutUrl?: string | null;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
  coachName?: string | null;
  coachBackground?: string | null;
  videoUrl?: string | null;
  trustCount?: string | null;
}

// ── Palette — token-for-token with webinarRajsekar (the two variants are one brand) ──
const WHITE = "#FFFFFF";
const INK = "#22222A";
const INK_SOFT = "#4A4A55";
const CORAL = "#8F5BF6";        // purple action colour
const LILAC = "#A78BFA";
const HERO_NAVY = "#0F172A";
const HERO_SUB = "#C4CAD8";
const GREEN = "#34D399";
const NAVY = "#0F172A";
const CANVAS_SOFT = "#F6F8FB";
const CARD_LINE = "#E3E8EF";
const MINT = "#ECFDF5";
const PURPLE_ON_DARK = "#B98BFF";
const BLUE_LINK = "#4A96E0";
const H = "'Poppins', system-ui, -apple-system, sans-serif";
const B = "'Outfit', system-ui, -apple-system, sans-serif";

const EVENT_DATE_TOKEN = "[INSERT_EVENT_DATE]";
const EVENT_TIME_TOKEN = "[INSERT_EVENT_TIME]";
const EVENT_TZ_TOKEN = "[INSERT_EVENT_TIMEZONE]";
// Presenter photo is NUDGE-category (ship-but-nudge), not a hard-hold — no [INSERT_PRESENTER_PHOTO].

function greenStar(): string {
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;background:${GREEN};border-radius:3px;color:#fff;font-size:11px;line-height:1;">&#9733;</span>`;
}

/** Hero presenter CUTOUT (transparent figure, no framed rectangle). No cutout → review-draft token. */
function heroPresenter(coach: WebinarLightCoachInput): string {
  const url = coach.presenterCutoutUrl;
  if (!ok(url)) return ""; // NUDGE-category (ship-but-nudge): no cutout → omit the figure, ship text-only
  return `<div style="position:relative;width:100%;max-width:440px;margin:0 auto;">`
    + `<img src="${esc(url!)}" alt="${esc(coach.coachName || "Your host")}" style="display:block;width:100%;height:auto;object-fit:contain;filter:drop-shadow(0 34px 60px rgba(0,0,0,0.45));">`
    + `</div>`;
}

/** Left hero action block — reveal-on-intent capture (webinar mode) + countdown on a REAL date only. */
function reserveCard(content: LandingPageContent, coach: WebinarLightCoachInput): string {
  const es = content.eventSchedule ?? {};
  const hasDate = ok(es.date);
  const eventTarget = [es.date, es.time, es.timezone].filter(Boolean).join(" ").trim();
  const countdown = hasDate
    ? `<div id="wb_cd" data-target="${esc(eventTarget)}" style="font-family:${B};font-weight:700;font-size:15px;color:${WHITE};letter-spacing:0.08em;margin:0 0 20px;">&nbsp;</div>`
    : "";
  const cta = ok(content.primaryCta) ? content.primaryCta : "Reserve My Free Seat";
  const trustLine = ok(coach.trustCount) ? `${esc(coach.trustCount)} already registered` : "Free to attend &middot; Live online";
  return `
      <div style="text-align:left;">
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

/** Reference-faithful two-column hero — LEFT badge→headline→sub→CTA, RIGHT presenter cutout. */
function heroSection(content: LandingPageContent, coach: WebinarLightCoachInput): string {
  const eyebrow = ok(content.eyebrowHeadline) ? esc(content.eyebrowHeadline) : "FREE LIVE CLASS";
  const headline = ok(content.mainHeadline) ? esc(content.mainHeadline) : "Join my free live workshop";
  const sub = ok(content.subheadline) ? esc(content.subheadline) : "";
  const logo = ok(coach.logoUrl)
    ? `<img src="${esc(coach.logoUrl)}" alt="${esc(coach.coachName || "Logo")}" style="height:30px;width:auto;display:block;margin:0 0 22px;">`
    : "";
  const es = content.eventSchedule ?? {};
  const dateBadge = ok(es.date)
    ? `<span style="color:${HERO_SUB};font-weight:500;">&nbsp;&middot;&nbsp;${esc(es.date)}${ok(es.time) ? `, ${esc(es.time)}` : ""}${ok(es.timezone) ? ` ${esc(es.timezone)}` : ""}</span>`
    : `<span style="color:${HERO_SUB};font-weight:500;">&nbsp;&middot;&nbsp;${EVENT_DATE_TOKEN}, ${EVENT_TIME_TOKEN} ${EVENT_TZ_TOKEN}</span>`;
  const badge = `<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(167,139,250,0.14);border:1px solid rgba(167,139,250,0.34);border-radius:9999px;padding:7px 16px;font-family:${B};font-weight:700;font-size:12px;letter-spacing:0.06em;color:${LILAC};text-transform:uppercase;margin:0 0 20px;"><span aria-hidden="true" style="width:7px;height:7px;border-radius:50%;background:${GREEN};display:inline-block;"></span>${eyebrow}${dateBadge}</div>`;

  const media = heroPresenter(coach);
  const hasCutout = ok(coach.presenterCutoutUrl);
  // No cutout → OMIT the right column; the hero centres as a single-column text hero (nudge, not hold).
  const right = hasCutout
    ? `<div style="flex:1 1 440px;min-width:300px;position:relative;">
        ${media}
        <div aria-hidden="true" style="position:absolute;top:-14px;left:-14px;background:${WHITE};border-radius:12px;padding:8px 14px;font-family:${B};font-weight:600;font-size:13px;color:${INK};box-shadow:0 10px 24px rgba(122,60,255,0.20);">&#9889; Live &amp; interactive</div>
        <div aria-hidden="true" style="position:absolute;bottom:-14px;right:-14px;background:${CORAL};border-radius:12px;padding:8px 14px;font-family:${B};font-weight:600;font-size:13px;color:${WHITE};box-shadow:0 10px 24px rgba(122,60,255,0.32);">&#127775; Free to attend</div>
      </div>`
    : "";

  return `
  <section style="background:${HERO_NAVY};padding:76px 24px 92px;">
    <div style="max-width:1120px;margin:0 auto;display:flex;flex-wrap:wrap;gap:48px;align-items:center;justify-content:center;">
      <div id="wb_reserve" style="flex:1 1 460px;min-width:300px;text-align:left;">
        ${logo}${badge}
        <h1 style="font-family:${H};font-weight:800;font-size:clamp(30px,4vw,50px);line-height:1.08;letter-spacing:-0.02em;color:${WHITE};margin:0 0 18px;max-width:15ch;">${headline}</h1>
        ${sub ? `<p style="font-family:${B};font-weight:400;font-size:clamp(16px,1.4vw,19px);line-height:1.55;color:${HERO_SUB};margin:0 0 28px;max-width:46ch;">${sub}</p>` : ""}
        ${reserveCard(content, coach)}
      </div>
      ${right}
    </div>
  </section>`;
}

/** "What you'll learn live" — the framework (consultationOutline). Always generated. */
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

/**
 * "Why this works" — the method band that carries a low-proof page: why the old way fails + the
 * unique mechanism (both always generated). Real-or-omit. This is where proof would sit on the rich
 * page; here the argument is the mechanism, not the crowd.
 */
function methodSection(content: LandingPageContent): string {
  const whyOld = ok(content.whyOldFail) ? esc(content.whyOldFail) : "";
  const mech = ok(content.uniqueMechanism) ? esc(content.uniqueMechanism) : "";
  if (!whyOld && !mech) return "";
  const card = (label: string, body: string, tint: string) => `
        <div style="flex:1 1 360px;min-width:280px;max-width:460px;background:${WHITE};border:1px solid ${CARD_LINE};border-radius:16px;padding:30px 28px;box-shadow:0 10px 30px rgba(15,23,42,0.06);">
          <div style="font-family:${B};font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${tint};margin:0 0 12px;">${label}</div>
          <p style="font-family:${B};font-weight:400;font-size:16px;line-height:1.6;color:${INK_SOFT};margin:0;">${body}</p>
        </div>`;
  const cards = [
    whyOld ? card("Why the old way stalls", whyOld, INK_SOFT) : "",
    mech ? card("Why this works", mech, CORAL) : "",
  ].filter(Boolean).join("");
  return `
  <section style="background:${CANVAS_SOFT};padding:80px 24px;">
    <div style="max-width:1000px;margin:0 auto;">
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,2.6vw,34px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 40px;max-width:24ch;">There&#39;s a better way to do this</h2>
      <div style="display:flex;flex-wrap:wrap;gap:24px;justify-content:center;align-items:stretch;">${cards}</div>
    </div>
  </section>`;
}

/** Host bio — the credential that carries a low-proof page (coachBackground). Omits when absent. */
function bioSection(coach: WebinarLightCoachInput): string {
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

/** Free bonuses — generated title + description; monetary value only when operator-supplied. */
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

/** "What changes if you don't do this?" — cost-of-inaction, bound to real generated copy. Real-or-omit. */
function costOfInactionSection(content: LandingPageContent): string {
  const sources: Array<[string, string]> = ([
    ["Nothing changes", content.problemAgitation],
    ["The old way keeps failing", content.whyOldFail],
    ["The window is now", content.scarcityUrgency],
  ] as Array<[string, unknown]>).filter(([, v]) => ok(v as string)).map(([l, v]) => [l, String(v)]);
  if (sources.length < 2) return "";
  const cta = ok(content.primaryCta) ? esc(content.primaryCta) : "Reserve My Free Seat";
  const cards = sources.map(([label, body]) => `
        <div style="flex:1 1 300px;min-width:260px;max-width:360px;background:${WHITE};border:1px solid #E7DEF9;border-radius:16px;padding:26px 24px;box-shadow:0 10px 30px rgba(122,60,255,0.08);">
          <div style="width:40px;height:40px;border-radius:10px;background:${CORAL}1A;display:flex;align-items:center;justify-content:center;margin:0 0 16px;"><span style="color:${CORAL};font-family:${H};font-weight:800;font-size:20px;">!</span></div>
          <div style="font-family:${H};font-weight:700;font-size:17px;color:${INK};margin:0 0 8px;">${esc(label)}</div>
          <p style="font-family:${B};font-weight:400;font-size:15px;line-height:1.55;color:${INK_SOFT};margin:0;">${esc(body)}</p>
        </div>`).join("");
  return `
  <section style="background:#F7F3FF;padding:80px 24px;">
    <div style="max-width:1080px;margin:0 auto;">
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,2.6vw,34px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 36px;max-width:24ch;">What changes if you don&rsquo;t do this?</h2>
      <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;">${cards}</div>
      <div style="text-align:center;margin:38px 0 0;">
        <a href="#wb_reserve" style="display:inline-block;padding:17px 40px;font-family:${H};font-weight:700;font-size:17px;text-decoration:none;color:${WHITE};background:${CORAL};border-radius:16px;box-shadow:0 14px 30px rgba(122,60,255,0.3);">${esc(cta)}</a>
      </div>
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

/** Dedicated navy final CTA — scroll-to-hero (the hero owns the single capture form). */
function finalCtaSection(content: LandingPageContent): string {
  const cta = ok(content.primaryCta) ? esc(content.primaryCta) : "Reserve My Free Seat";
  const sub = ok(content.solutionIntro) ? esc(content.solutionIntro) : "";
  return `
  <section style="background:${NAVY};padding:88px 24px;">
    <div style="max-width:720px;margin:0 auto;text-align:center;">
      <div style="font-family:${B};font-weight:700;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${LILAC};margin:0 0 14px;">Your next class starts here</div>
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(28px,3.6vw,44px);line-height:1.12;color:${WHITE};margin:0 auto 18px;max-width:18ch;">Your knowledge, your business, your freedom.</h2>
      ${sub ? `<p style="font-family:${B};font-weight:400;font-size:clamp(15px,1.5vw,18px);line-height:1.55;color:${HERO_SUB};margin:0 auto 30px;max-width:48ch;">${sub}</p>` : `<div style="height:14px;"></div>`}
      <a href="#wb_reserve" style="display:inline-block;padding:18px 44px;font-family:${H};font-weight:700;font-size:18px;text-decoration:none;color:${WHITE};background:${CORAL};border-radius:16px;box-shadow:0 16px 34px rgba(122,60,255,0.4);">${esc(cta)}</a>
      <div style="font-family:${B};font-size:13px;color:${HERO_SUB};margin-top:16px;">Free to attend &middot; Live online</div>
    </div>
  </section>`;
}

function footer(serviceName: string, coach: WebinarLightCoachInput, year: number): string {
  const brand = ok(coach.coachName) ? esc(coach.coachName) : esc(serviceName || "Your Brand");
  return `
  <footer style="background:${NAVY};padding:34px 24px;text-align:center;">
    <div style="font-family:${B};font-size:12px;color:#9FB2CC;line-height:1.8;">
      &copy; ${year} ${brand}. All rights reserved.<br>
      <a href="#" style="color:${BLUE_LINK};text-decoration:none;">Privacy Policy</a> &middot; <a href="#" style="color:${BLUE_LINK};text-decoration:none;">Terms &amp; Conditions</a>
    </div>
  </footer>`;
}

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

/**
 * Proof-LIGHT webinar page: navy hero (+ presenter cutout) → what you'll learn (framework) →
 * why this works (method) → meet your host → bonuses → cost-of-inaction → FAQ → final CTA → footer.
 * No success grid, no stats bar — a composed, teacher-and-value-forward page that stands on its own at
 * zero proof (the default for webinar_registration).
 */
export function buildWebinarLightHtml(
  content: LandingPageContent,
  serviceName: string,
  coach: WebinarLightCoachInput = {},
  nowYear = 2026,
): string {
  return renderDocument({
    title: content.mainHeadline || serviceName,
    fontHref: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700&display=swap",
    bodyBg: WHITE,
    body: [
      heroSection(content, coach),
      frameworkSection(content),
      methodSection(content),
      bioSection(coach),
      bonusesSection(content),
      costOfInactionSection(content),
      faqSection(content),
      finalCtaSection(content),
      footer(serviceName, coach, nowYear),
      runtimeScript(),
    ].join("\n"),
  });
}
