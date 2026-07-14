/**
 * Event — Iman Gadzhi (free-ticket challenge) — template #4a. A NEW design bar, distinct from
 * Burchard / discovery / webinar. Bespoke replica of the frozen Iman Gadzhi "Make Money Online
 * Challenge" reference (docs/landing-page-references/event_registration--iman-gadzhi.png,
 * 4480×13966): ONE integrated cinematic event-registration poster, not a chain of funnel sections.
 *
 * Grey-box silhouette (spec §19): full-width blurred audience wall + green light → centred
 * open-arm presenter → event lockup on the lower torso → live/date capsule → large green-emphasis
 * headline → small support line → single luminous yellow pill CTA → sparse black descent with a
 * faint perspective grid → tiny legal endpoint. Nothing else — the reference has NO proof,
 * benefits, agenda, price, FAQ, or visible form (spec §12/§22): those must NEVER be invented.
 *
 * Highest-risk / Gate-1 section (spec §20/§21): the complete integrated primary composition, from
 * the top edge of the audience wall through the bottom edge of the yellow CTA. It must read as one
 * continuous poster, never a hero/date/benefit/CTA stack with visible seams.
 *
 * Honesty patterns (inherited): the page IS the presenter — no headshot (and no hero image) → the
 * hero emits an [INSERT_PRESENTER_PHOTO] token so the publish placeholder hard-gate blocks the page
 * (review-draft; we never ship a faceless dark poster). The date capsule binds a REAL
 * eventSchedule.date; absent → [INSERT_EVENT_*] tokens → the same hard-gate → review-draft. The
 * reserve flow is button-only (matching the frozen "no visible fields") and reveals a minimal
 * email+consent capture on intent that posts to /api/capture-lead in EVENT mode (no magnet). ZAP
 * never fabricates the reference's ticket counts, prizes, countdown, or proof. Bespoke builder on
 * the shared Phase-0 primitives; NOT a config engine.
 */
import type { LandingPageContent } from "../../../drizzle/schema";
import { esc, ok, renderDocument } from "./templatePrimitives";

export interface EventImanCoachInput {
  /** Open-arm, front-facing presenter photo — headshot slot. The page's authority anchor. */
  headshotUrl?: string | null;
  /** Optional audience-wall / event background image — hero_image slot. Omit → flat dark field. */
  heroImageUrl?: string | null;
  coachName?: string | null;
}

// ── Palette — the frozen Iman reference (spec §15): black canvas, electric green, yellow CTA ──
const BLACK = "#020302";
const NEAR_BLACK = "#0A0F0B";
const WHITE = "#F4F4F2";
const GREEN = "#00D33A"; // event lockup + headline emphasis + status dot + environmental light
const GREEN_SOFT = "rgba(0,211,58,0.22)";
const YELLOW = "#FFF62E"; // the single luminous conversion accent (deliberately NOT green)
const YELLOW_HI = "#FFFB8F";
const CAPSULE = "#20261F"; // grey rounded date capsule
const LEGAL = "#777777";
const H = "'Montserrat', system-ui, -apple-system, sans-serif"; // heavy geometric block sans
const B = "'Montserrat', system-ui, -apple-system, sans-serif";

const EVENT_DATE_TOKEN = "[INSERT_EVENT_DATE]";
const PRESENTER_TOKEN = "[INSERT_PRESENTER_PHOTO]";

/**
 * Green the trailing emphasis of the headline (spec §7/§14 — contiguous green phrase, white lead).
 * A STYLING transform on the real headline — no words are added, removed, or changed. Prefers the
 * clause after the last comma; else the trailing ~40% of words; the whole line stays white if it
 * is too short to split.
 */
function greenTailHeadline(headline: string): string {
  const safe = esc(headline);
  const words = safe.split(/\s+/).filter(Boolean);
  if (words.length < 4) return safe;
  const comma = safe.lastIndexOf(",");
  const green = (t: string) => `<span style="color:${GREEN};">${t}</span>`;
  if (comma > 0 && comma < safe.length - 2) {
    return safe.slice(0, comma + 1) + " " + green(safe.slice(comma + 1).trim());
  }
  const cut = Math.max(1, Math.round(words.length * 0.6));
  return words.slice(0, cut).join(" ") + " " + green(words.slice(cut).join(" "));
}

/** The audience wall + open-arm presenter mass — a single blended scene, never a bordered card. */
function presenterScene(coach: EventImanCoachInput): string {
  const audience = ok(coach.heroImageUrl)
    ? `background-image:url('${esc(coach.heroImageUrl)}');background-size:cover;background-position:center top;`
    : "";
  // No presenter photo → emit the token that trips the publish hard-gate (review-draft). The page
  // has no honest hero without the open-arm presenter, so we do NOT ship a faceless dark poster.
  const presenter = ok(coach.headshotUrl)
    ? `<img src="${esc(coach.headshotUrl)}" alt="${esc(coach.coachName || "Your host")}" style="position:relative;z-index:2;display:block;margin:0 auto;max-width:560px;width:78%;height:auto;object-fit:contain;filter:drop-shadow(0 30px 60px rgba(0,0,0,0.6));">`
    : `<div style="position:relative;z-index:2;font-family:${B};font-size:13px;color:${LEGAL};padding:80px 20px;">${PRESENTER_TOKEN}</div>`;
  return `
      <div style="position:relative;width:100%;max-width:920px;margin:0 auto;min-height:340px;padding-top:clamp(48px,8vw,104px);${audience}">
        <!-- blurred/darkened audience field + green horizontal light band behind the presenter -->
        <div aria-hidden="true" style="position:absolute;inset:0;z-index:1;background:
            radial-gradient(120% 60% at 50% 42%, ${GREEN_SOFT} 0%, rgba(0,0,0,0) 60%),
            linear-gradient(180deg, rgba(2,3,2,0.35) 0%, rgba(2,3,2,0.72) 62%, ${BLACK} 100%);
            ${coach.heroImageUrl ? "backdrop-filter:blur(3px);" : ""}"></div>
        ${presenter}
      </div>`;
}

/** Compact event lockup (block uppercase + green accent) — bridges presenter and date capsule. */
function eventLockup(serviceName: string): string {
  const name = ok(serviceName) ? esc(serviceName) : "Live Event";
  return `
      <div style="font-family:${H};font-weight:800;font-size:clamp(22px,3vw,34px);line-height:1;letter-spacing:0.02em;text-transform:uppercase;color:${WHITE};margin:-28px auto 18px;position:relative;z-index:3;max-width:20ch;">
        ${name}
      </div>`;
}

/** Live/date rounded capsule — real eventSchedule, else [INSERT_EVENT_*] tokens (review-draft). */
function dateCapsule(content: LandingPageContent): string {
  const es = content.eventSchedule ?? {};
  const hasDate = ok(es.date);
  const type = ok(es.venue) ? esc(es.venue) : "LIVE VIRTUAL EVENT";
  const dateText = hasDate
    ? `${esc(es.date)}${ok(es.endDate) ? ` – ${esc(es.endDate)}` : ""}`
    : EVENT_DATE_TOKEN;
  return `
      <div style="display:inline-flex;align-items:center;gap:10px;background:${CAPSULE};border-radius:9999px;padding:9px 20px;margin:0 auto 26px;">
        <span aria-hidden="true" style="width:10px;height:10px;border-radius:9999px;background:${GREEN};box-shadow:0 0 0 3px rgba(255,60,60,0.35);flex-shrink:0;"></span>
        <span style="font-family:${B};font-weight:700;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${WHITE};">${type}: <span style="font-weight:500;">${dateText}</span></span>
      </div>`;
}

/** The single luminous yellow pill CTA with ticket icon + internal scarcity note (reveal capture). */
function ctaBlock(content: LandingPageContent): string {
  const label = ok(content.primaryCta) ? esc(content.primaryCta) : "GET MY FREE TICKET";
  const scarcity = ok(content.scarcityUrgency)
    ? esc(content.scarcityUrgency)
    : "Tickets Are First Come, First Served";
  const ticket = `<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${BLACK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M12 6v12" stroke-dasharray="1 3"/></svg>`;
  return `
      <div style="max-width:520px;margin:0 auto;">
        <button type="button" id="ev_cta" style="display:flex;flex-direction:column;align-items:center;gap:4px;width:100%;box-sizing:border-box;padding:18px 28px;border:0;border-radius:9999px;cursor:pointer;background:linear-gradient(180deg,${YELLOW_HI} 0%,${YELLOW} 100%);box-shadow:0 0 0 4px rgba(255,246,46,0.18), 0 18px 44px rgba(255,246,46,0.22);">
          <span style="display:inline-flex;align-items:center;gap:10px;font-family:${H};font-weight:800;font-size:clamp(17px,2.2vw,21px);text-transform:uppercase;letter-spacing:0.02em;color:${BLACK};">${ticket}${label}</span>
          <span style="font-family:${B};font-weight:600;font-size:12px;color:rgba(2,3,2,0.68);">*${scarcity}</span>
        </button>
        <div id="ev_form" style="display:none;margin-top:16px;text-align:left;">
          <form id="ev_optin" autocomplete="on" style="display:flex;flex-direction:column;gap:10px;">
            <input type="text" id="ev_name" name="ev_name" placeholder="First name (optional)" style="width:100%;box-sizing:border-box;padding:13px 15px;font-family:${B};font-size:15px;border:1px solid #2A2F28;border-radius:10px;background:${NEAR_BLACK};color:${WHITE};">
            <input type="email" id="ev_email" name="ev_email" required placeholder="you@example.com" style="width:100%;box-sizing:border-box;padding:13px 15px;font-family:${B};font-size:15px;border:1px solid #2A2F28;border-radius:10px;background:${NEAR_BLACK};color:${WHITE};">
            <label style="display:flex;gap:8px;align-items:flex-start;font-family:${B};font-size:12px;line-height:1.4;color:#9AA39A;"><input type="checkbox" id="ev_consent" required style="margin-top:3px;"><span>I agree to receive my ticket and event emails, and accept the <a href="https://zapcampaigns.com/privacy" target="_blank" rel="noopener" style="color:${GREEN};">privacy policy</a>.</span></label>
            <div style="position:absolute;left:-9999px;" aria-hidden="true"><input type="text" id="ev_hp" name="ev_hp" tabindex="-1" autocomplete="off"></div>
            <button type="submit" id="ev_submit" style="width:100%;box-sizing:border-box;padding:15px 24px;font-family:${H};font-weight:800;font-size:16px;text-transform:uppercase;color:${BLACK};background:${YELLOW};border:0;border-radius:9999px;cursor:pointer;">Claim my free ticket</button>
            <div id="ev_msg" style="font-family:${B};font-size:13px;color:${YELLOW_HI};min-height:16px;"></div>
          </form>
        </div>
      </div>`;
}

/** Sparse black descent with a faint centred perspective-grid floor (atmosphere, not a section). */
function atmosphericFloor(): string {
  return `
  <section aria-hidden="true" style="background:${BLACK};height:220px;position:relative;overflow:hidden;">
    <div style="position:absolute;left:50%;bottom:-40px;width:160%;height:200px;transform:translateX(-50%) perspective(320px) rotateX(62deg);
        background-image:linear-gradient(${GREEN_SOFT} 1px,transparent 1px),linear-gradient(90deg,${GREEN_SOFT} 1px,transparent 1px);
        background-size:44px 44px;opacity:0.5;"></div>
  </section>`;
}

/** Legal endpoint — privacy/terms, non-affiliation disclaimer, copyright. The page's only footer. */
function legalEndpoint(serviceName: string, coach: EventImanCoachInput): string {
  const brand = ok(coach.coachName) ? esc(coach.coachName) : esc(serviceName || "This Event");
  const year = new Date().getFullYear();
  return `
  <footer style="background:${BLACK};padding:30px 24px 44px;text-align:center;">
    <div style="font-family:${B};font-size:12px;color:${LEGAL};line-height:1.9;max-width:640px;margin:0 auto;">
      <a href="#" style="color:${LEGAL};text-decoration:none;">Privacy Policy</a> &nbsp;|&nbsp; <a href="#" style="color:${LEGAL};text-decoration:none;">Terms &amp; Conditions</a><br>
      This site is not part of, or endorsed by, Facebook, Google, or any social-media platform in any way.<br>
      &copy; ${year} ${brand}. All Rights Reserved.
    </div>
  </footer>`;
}

/**
 * Inline runtime: reveal-on-intent email capture that posts to /api/capture-lead in EVENT mode
 * (email + consent only; no magnet). Slug is read from the page URL, so nothing is injected at
 * build time. There is NO countdown — the frozen reference shows none, and ZAP never fakes one.
 */
function runtimeScript(): string {
  return `<script>
(function(){
  var btn=document.getElementById('ev_cta'),box=document.getElementById('ev_form');
  if(btn&&box){btn.addEventListener('click',function(){box.style.display='block';var e=document.getElementById('ev_email');if(e){e.focus();}});}
  var form=document.getElementById('ev_optin');
  if(form){form.addEventListener('submit',function(ev){ev.preventDefault();
    var msg=document.getElementById('ev_msg');
    var email=((document.getElementById('ev_email')||{}).value||'').trim();
    var consent=(document.getElementById('ev_consent')||{}).checked;
    if(!email||!consent){if(msg){msg.textContent='Enter your email and tick the box to claim your ticket.';}return;}
    var sub=document.getElementById('ev_submit');if(sub){sub.disabled=true;sub.textContent='Reserving…';}
    var slug=(location.pathname.split('/').filter(Boolean).pop())||'';
    fetch('/api/capture-lead',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({mode:'event',slug:slug,email:email,name:((document.getElementById('ev_name')||{}).value||''),consent:consent,website:((document.getElementById('ev_hp')||{}).value||'')})})
    .then(function(r){return r.json().catch(function(){return {};});})
    .then(function(){box.innerHTML='<div style="font-family:'+"'Montserrat',sans-serif"+';font-weight:700;font-size:15px;color:#F4F4F2;text-align:center;padding:8px 0;">Your ticket is reserved! Check your inbox for the joining details.</div>';})
    .catch(function(){if(msg){msg.textContent='Something went wrong — please try again.';}if(sub){sub.disabled=false;sub.textContent='Claim my free ticket';}});
  });}
})();
</script>`;
}

/**
 * The complete integrated primary composition (Gate 1) followed by the atmospheric descent and the
 * legal endpoint. One continuous cinematic poster — deliberately NO benefits / proof / agenda /
 * price / FAQ sections (the frozen reference has none; inventing them is the #1 replica failure).
 */
export function buildEventImanGadzhiHtml(
  content: LandingPageContent,
  serviceName: string,
  coach: EventImanCoachInput = {},
): string {
  const headline = greenTailHeadline(ok(content.mainHeadline) ? content.mainHeadline : "3 Days to Launch Your First Profitable Product");
  const support = ok(content.subheadline) ? esc(content.subheadline) : "";

  const primary = `
  <section style="background:${BLACK};padding:0 20px 56px;overflow:hidden;">
    <div style="max-width:1000px;margin:0 auto;text-align:center;">
      ${presenterScene(coach)}
      ${eventLockup(serviceName)}
      ${dateCapsule(content)}
      <h1 style="font-family:${H};font-weight:800;font-size:clamp(28px,4.6vw,52px);line-height:1.08;letter-spacing:-0.01em;color:${WHITE};margin:0 auto 16px;max-width:20ch;">${headline}</h1>
      ${support ? `<p style="font-family:${B};font-weight:500;font-size:clamp(15px,1.6vw,18px);line-height:1.5;color:#B9C0B8;margin:0 auto 30px;max-width:44ch;">${support}</p>` : `<div style="height:22px;"></div>`}
      ${ctaBlock(content)}
    </div>
  </section>`;

  return renderDocument({
    title: content.mainHeadline || serviceName,
    fontHref: "https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&display=swap",
    bodyBg: BLACK,
    body: [
      primary,
      atmosphericFloor(),
      legalEndpoint(serviceName, coach),
      runtimeScript(),
    ].join("\n"),
  });
}
