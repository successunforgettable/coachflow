/**
 * Event — Iman Gadzhi (free-ticket challenge) — template #4a. A NEW design bar, distinct from
 * Burchard / discovery / webinar. Bespoke replica of the frozen Iman Gadzhi "Make Money Online
 * Challenge" reference (docs/landing-page-references/event_registration--iman-gadzhi.png,
 * 4480×13966): a black cinematic event page. The HERO is one integrated poster; below it the
 * reference continues with a full set of funnel sections.
 *
 * ⚠️ CORRECTED 2026-07-17 (reference-audit): the earlier premise "the reference has NO proof /
 * benefits / agenda — one continuous poster, nothing else" was a MISREAD of the frozen PNG. It
 * shipped this template at 0.48× reference height and let it PASS its own structural gate. The
 * reference is a FULL page: poster hero (audience wall + open-arm presenter + event lockup + date
 * capsule + orange-emphasis headline + luminous orange CTA) → "What You're Going To Learn"
 * (Day 0N agenda) → "All The Details" (WHERE/WHEN/WHAT) → "The Cost of Doing Nothing vs Joining"
 * (with/without) → "What's Included" grid → final "Register Below" CTA → legal. Those are now built.
 *
 * Highest-risk / Gate-1 section (spec §20/§21): the complete integrated primary composition, from
 * the top edge of the audience wall through the bottom edge of the yellow CTA. It must read as one
 * continuous poster, never a hero/date/benefit/CTA stack with visible seams.
 *
 * Honesty patterns (inherited): the presenter figure strengthens the hero, but it is NUDGE-category
 * (ship-but-nudge) — no headshot → the figure OMITS and the page ships as a text-forward hero (the coach
 * is nudged to add a photo later); we never show a framed rectangle, and never a review-draft for a
 * missing photo. This text-only Iman hero is its weakest, so it's the prime nudge. The date capsule binds a REAL
 * eventSchedule.date; absent → [INSERT_EVENT_*] tokens → the same hard-gate → review-draft. The
 * reserve flow is button-only (matching the frozen "no visible fields") and reveals a minimal
 * email+consent capture on intent that posts to /api/capture-lead in EVENT mode (no magnet). ZAP
 * never fabricates the reference's ticket counts, prizes, countdown, or proof. Bespoke builder on
 * the shared Phase-0 primitives; NOT a config engine.
 */
import type { LandingPageContent } from "../../../drizzle/schema";
import { esc, ok, renderDocument } from "./templatePrimitives";
import { classifyLocation } from "./operatorFields";

export interface EventImanCoachInput {
  /** Open-arm, front-facing presenter photo — headshot slot. The page's authority anchor. */
  headshotUrl?: string | null;
  /** Optional audience-wall / event background image — hero_image slot. Omit → flat dark field. */
  heroImageUrl?: string | null;
  coachName?: string | null;
}

// ── Palette — the frozen Iman reference (spec §15): black canvas, electric green, yellow CTA ──
const BLACK = "#000000";
const NEAR_BLACK = "#17191B";
const WHITE = "#F4F4F2";
const GREEN = "#00D33A"; // event lockup + headline emphasis + status dot + environmental light
const GREEN_SOFT = "rgba(0,211,58,0.22)";
// PNG-sampled 2026-07-17: the reference uses a THREE-accent system — a bright GOLD ticket pill, a
// MUTED brick-orange for headings/icons/rules/the WHEN tile, and green/red on the compare panels.
// (The build had a single hot #FF6242 doing all of it, reading over-saturated vs the frozen PNG.)
const YELLOW = "#D14F35"; // muted brick-orange accent — sampled #d14f35 (icons/rules/eyebrows/WHEN tile)
const YELLOW_HI = "#E0603F";
const GOLD = "#E2DC2A";    // bright gold ticket-CTA pill — sampled #e2dc2a (CTA only, never card headers)
const GOLD_HI = "#F2ED5C";
// Compare-panel colours (light off-white panels with a coloured border + black heading — sampled).
const PANEL_LIGHT = "#EFEFED"; // "With/Without" panel body (light, NOT dark)
const PANEL_ROW = "#FFFFFF";   // item rows inside the light panel
const PANEL_INK = "#0F0F0F";   // black panel heading (NOT the accent colour)
const COMPARE_GREEN = "#22C55E"; // "with" border + check badge — sampled vivid green
const COMPARE_RED = "#EF4444";   // "without" border + cross badge — sampled red
const CAPSULE = "#20261F"; // grey rounded date capsule
const LEGAL = "#777777";
const H = "'Inter', system-ui, -apple-system, sans-serif"; // Inter Display (headings)
const B = "'Inter', system-ui, -apple-system, sans-serif";

const EVENT_DATE_TOKEN = "[INSERT_EVENT_DATE]";
const EVENT_LOC_TOKEN = "[INSERT_EVENT_VENUE]"; // canonical location token (matches the registry + intake), so a venue answer substitutes it everywhere
// Presenter photo is NUDGE-category (ship-but-nudge), not a hard-hold — no [INSERT_PRESENTER_PHOTO].

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
  const green = (t: string) => `<span style="color:${YELLOW};">${t}</span>`; // muted brick-orange headline emphasis (PNG-sampled)
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
  // Presenter photo is NUDGE-category (2026-07-18), NOT hard-hold: no usable cutout → the figure simply
  // OMITS and the page ships as a text-forward hero (audience wall + green light band + headline). We
  // never show a framed rectangle, and never a review-draft token — the coach gets a soft nudge later
  // ([[NUDGE_FIELDS]] in operatorFields). This text-only hero is Iman's weakest, so it's the prime nudge.
  const presenter = ok(coach.headshotUrl)
    ? `<img src="${esc(coach.headshotUrl)}" alt="${esc(coach.coachName || "Your host")}" style="position:relative;z-index:2;display:block;margin:0 auto;max-width:440px;width:62%;height:auto;object-fit:contain;filter:drop-shadow(0 30px 60px rgba(0,0,0,0.6));">`
    : "";
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
  // Capsule "type" label: a real venue names it; __ONLINE__ or an unanswered location both read as the
  // generic "LIVE VIRTUAL EVENT" here (never the raw sentinel). The authoritative location hold lives in
  // the All-The-Details WHERE cell, which emits [INSERT_EVENT_VENUE] on genuine silence.
  const typeState = classifyLocation(es.venue);
  const type = typeState.status === "value" ? esc(typeState.value) : "LIVE VIRTUAL EVENT";
  const dateText = hasDate
    ? `${esc(es.date)}${ok(es.endDate) ? ` – ${esc(es.endDate)}` : ""}`
    : EVENT_DATE_TOKEN;
  return `
      <div style="display:inline-flex;align-items:center;gap:10px;background:${CAPSULE};border-radius:9999px;padding:9px 20px;margin:0 auto 26px;">
        <span aria-hidden="true" style="width:10px;height:10px;border-radius:9999px;background:${GREEN};box-shadow:0 0 0 3px rgba(255,60,60,0.35);flex-shrink:0;"></span>
        <span style="font-family:${B};font-weight:700;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${WHITE};">${type}: <span style="font-weight:500;">${dateText}</span></span>
      </div>`;
}

/**
 * The single luminous pill CTA with ticket icon + scarcity note (reveal-on-intent capture).
 * `suffix` makes ids unique so the page can carry more than one instance (hero + final CTA);
 * class hooks (`ev_cta_btn` / `ev_form_box` / `ev_optin` / `ev_*_in`) let one runtime wire them all.
 * The hero instance keeps the original bare ids (ev_cta / ev_form / …) for back-compat.
 */
function ctaBlock(content: LandingPageContent, suffix = ""): string {
  const label = ok(content.primaryCta) ? esc(content.primaryCta) : "GET MY FREE TICKET";
  const scarcity = ok(content.scarcityUrgency)
    ? esc(content.scarcityUrgency)
    : "Tickets Are First Come, First Served";
  const ticket = `<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${BLACK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M12 6v12" stroke-dasharray="1 3"/></svg>`;
  const f = (n: string) => `ev_${n}${suffix}`;
  return `
      <div style="max-width:520px;margin:0 auto;">
        <button type="button" id="${f("cta")}" class="ev_cta_btn" data-form="${f("form")}" style="display:flex;flex-direction:column;align-items:center;gap:4px;width:100%;box-sizing:border-box;padding:18px 28px;border:0;border-radius:9999px;cursor:pointer;background:linear-gradient(180deg,${GOLD_HI} 0%,${GOLD} 100%);box-shadow:0 0 0 4px rgba(226,220,42,0.16), 0 18px 44px rgba(226,220,42,0.22);">
          <span style="display:inline-flex;align-items:center;gap:10px;font-family:${H};font-weight:800;font-size:clamp(17px,2.2vw,21px);text-transform:uppercase;letter-spacing:0.02em;color:${BLACK};">${ticket}${label}</span>
          <span style="font-family:${B};font-weight:600;font-size:12px;color:rgba(2,3,2,0.68);">*${scarcity}</span>
        </button>
        <div id="${f("form")}" class="ev_form_box" style="display:none;margin-top:16px;text-align:left;">
          <form class="ev_optin" autocomplete="on" style="display:flex;flex-direction:column;gap:10px;">
            <input type="text" class="ev_name_in" name="ev_name" placeholder="First name (optional)" style="width:100%;box-sizing:border-box;padding:13px 15px;font-family:${B};font-size:15px;border:1px solid #2A2F28;border-radius:10px;background:${NEAR_BLACK};color:${WHITE};">
            <input type="email" class="ev_email_in" name="ev_email" required placeholder="you@example.com" style="width:100%;box-sizing:border-box;padding:13px 15px;font-family:${B};font-size:15px;border:1px solid #2A2F28;border-radius:10px;background:${NEAR_BLACK};color:${WHITE};">
            <label style="display:flex;gap:8px;align-items:flex-start;font-family:${B};font-size:12px;line-height:1.4;color:#9AA39A;"><input type="checkbox" class="ev_consent_in" required style="margin-top:3px;"><span>I agree to receive my ticket and event emails, and accept the <a href="https://zapcampaigns.com/privacy" target="_blank" rel="noopener" style="color:${GREEN};">privacy policy</a>.</span></label>
            <div style="position:absolute;left:-9999px;" aria-hidden="true"><input type="text" class="ev_hp_in" name="ev_hp" tabindex="-1" autocomplete="off"></div>
            <button type="submit" class="ev_submit_btn" style="width:100%;box-sizing:border-box;padding:15px 24px;font-family:${H};font-weight:800;font-size:16px;text-transform:uppercase;color:${BLACK};background:${GOLD};border:0;border-radius:9999px;cursor:pointer;">Claim my free ticket</button>
            <div class="ev_msg_box" style="font-family:${B};font-size:13px;color:${YELLOW_HI};min-height:16px;"></div>
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
  document.querySelectorAll('.ev_cta_btn').forEach(function(btn){
    btn.addEventListener('click',function(){var box=document.getElementById(btn.getAttribute('data-form'));if(box){box.style.display='block';var e=box.querySelector('.ev_email_in');if(e){e.focus();}}});
  });
  document.querySelectorAll('.ev_optin').forEach(function(form){
    form.addEventListener('submit',function(ev){ev.preventDefault();
      var msg=form.querySelector('.ev_msg_box');
      var email=((form.querySelector('.ev_email_in')||{}).value||'').trim();
      var consent=(form.querySelector('.ev_consent_in')||{}).checked;
      if(!email||!consent){if(msg){msg.textContent='Enter your email and tick the box to claim your ticket.';}return;}
      var sub=form.querySelector('.ev_submit_btn');if(sub){sub.disabled=true;sub.textContent='Reserving…';}
      var slug=(location.pathname.split('/').filter(Boolean).pop())||'';
      fetch('/api/capture-lead',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({mode:'event',slug:slug,email:email,name:((form.querySelector('.ev_name_in')||{}).value||''),consent:consent,website:((form.querySelector('.ev_hp_in')||{}).value||'')})})
      .then(function(r){return r.json().catch(function(){return {};});})
      .then(function(){var box=form.closest('.ev_form_box')||form.parentNode;box.innerHTML='<div style="font-family:'+"'Inter',sans-serif"+';font-weight:700;font-size:15px;color:#F4F4F2;text-align:center;padding:8px 0;">Your ticket is reserved! Check your inbox for the joining details.</div>';})
      .catch(function(){if(msg){msg.textContent='Something went wrong — please try again.';}if(sub){sub.disabled=false;sub.textContent='Claim my free ticket';}});
    });
  });
})();
</script>`;
}

// ── Reference lower sections (2026-07-17 rebuild) — the frozen PNG is a FULL page, not a poster ──
const RED = "#FF4D4D";       // "without" column negatives
const CARD_W = "#FFFFFF";    // white agenda cards
const CARD_INK = "#151515";  // dark text on white cards
const SUBTLE = "#B9C0B8";    // section sub-copy on black
const CREAM = "#FAF8F3";     // Day-card body — near-white cream (PNG-sampled, NOT an orange fill)
const DAY_HEADER = "#0D0D0D"; // Day-card header — glossy black bar with white "DAY 0N" + orange icon
const CHARCOAL = "#282828";  // ATD "WHAT" tile — sampled charcoal (the varied third tile)

/** Centred white section head + red-orange underline + optional sub, on the black canvas. */
function sectionHead(title: string, sub?: string): string {
  return `
      <div style="text-align:center;margin:0 auto 40px;max-width:760px;">
        <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,3.4vw,40px);line-height:1.12;letter-spacing:-0.01em;color:${WHITE};margin:0;">${title}</h2>
        <div aria-hidden="true" style="width:64px;height:4px;border-radius:9999px;background:${YELLOW};margin:16px auto 0;"></div>
        ${sub ? `<p style="font-family:${B};font-weight:400;font-size:clamp(14px,1.4vw,17px);line-height:1.55;color:${SUBTLE};margin:16px auto 0;max-width:56ch;">${sub}</p>` : ""}
      </div>`;
}

/** "What You're Going To Learn" — Day 0N agenda cards bound to consultationOutline (real-or-omit). */
function learnSection(content: LandingPageContent): string {
  const days = (Array.isArray(content.consultationOutline) ? content.consultationOutline : []).filter((d) => ok(d?.title)).slice(0, 6);
  if (!days.length) return "";
  // PNG-sampled treatment: glossy BLACK header (white "DAY 0N" + muted-orange bar-chart icon) over a
  // near-white CREAM body with an orange rule under the title. NOT the old orange-gradient header.
  const barIcon = `<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="${YELLOW}" style="flex-shrink:0;"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>`;
  const cards = days.map((d, i) => `
        <div style="flex:1 1 300px;min-width:260px;max-width:340px;background:${CREAM};border:1px solid rgba(209,79,53,0.30);border-radius:16px;overflow:hidden;box-shadow:0 20px 44px rgba(0,0,0,0.5);">
          <div style="background:${DAY_HEADER};padding:12px 18px;display:flex;align-items:center;gap:10px;font-family:${H};font-weight:800;font-size:18px;letter-spacing:0.04em;text-transform:uppercase;color:${WHITE};">${barIcon}DAY ${String(i + 1).padStart(2, "0")}</div>
          <div style="padding:18px 20px 22px;">
            <div style="font-family:${H};font-weight:800;font-size:18px;line-height:1.22;color:${CARD_INK};margin:0 0 12px;">${esc(d.title)}</div>
            <div aria-hidden="true" style="height:2px;background:${YELLOW};opacity:0.5;margin:0 0 ${ok(d.description) ? "14px" : "0"};"></div>
            ${ok(d.description) ? `<p style="font-family:${B};font-weight:400;font-size:14px;line-height:1.55;color:#4A4A4A;margin:0;">${esc(d.description)}</p>` : ""}
          </div>
        </div>`).join("");
  return `
  <section style="background:${BLACK};padding:16px 24px 64px;">
    <div style="max-width:1040px;margin:0 auto;">
      ${sectionHead("What You&rsquo;re Going To Learn", "A look at what you&rsquo;ll experience across the live challenge.")}
      <div style="display:flex;flex-wrap:wrap;gap:22px;justify-content:center;">${cards}</div>
    </div>
  </section>`;
}

/** "All The Details" — WHERE / WHEN / WHAT, bound to eventSchedule (only when a real date exists). */
function detailsSection(content: LandingPageContent): string {
  const es = content.eventSchedule ?? {};
  if (!ok(es.date)) return ""; // no real date → the page is a review-draft anyway; omit details
  const when = [es.date, ok(es.time) ? `at ${es.time}` : "", ok(es.timezone) ? esc(es.timezone) : ""].filter(Boolean).map((x) => esc(String(x))).join(" ");
  const whatBits = [ok(es.language) ? esc(es.language) : "", es.durationMins ? `${es.durationMins}-min sessions` : ""].filter(Boolean).join(" · ");
  // Three-state location (2026-07-18): a real venue → the venue; __ONLINE__ → an explicit "Live online"
  // (a complete answer); genuine silence → [INSERT_EVENT_VENUE] → held. "Online" is now a first-class
  // answer, no longer inferred from a null venue (which used to silently label every dateless-fixed event
  // "Live online" whether or not the coach ever said so).
  const locState = classifyLocation(es.venue);
  const whereText = locState.status === "value" ? esc(locState.value)
    : locState.status === "na" ? "Live online — join from anywhere in the world."
    : EVENT_LOC_TOKEN;
  const cols: Array<[string, string]> = [
    ["WHERE", whereText],
    ["WHEN", when],
    ["WHAT", whatBits || "A free live event designed to move you forward."],
  ];
  // PNG-sampled: the three tiles are VARIED, not a uniform orange header — cream WHERE, orange-fill
  // WHEN (the single highlight), charcoal WHAT; the label sits inside each tile, not on a header bar.
  const tileStyles = [
    { bg: CREAM,    head: YELLOW,     body: "#2A2A2A" },              // WHERE — cream
    { bg: YELLOW,   head: "#FFFFFF",  body: "rgba(255,255,255,0.92)" }, // WHEN  — orange fill
    { bg: CHARCOAL, head: YELLOW,     body: "#D8D8D6" },              // WHAT  — charcoal
  ];
  const cards = cols.map(([k, v], i) => {
    const s = tileStyles[i] ?? tileStyles[0];
    return `
        <div style="flex:1 1 240px;min-width:220px;max-width:320px;background:${s.bg};border-radius:16px;overflow:hidden;padding:20px 20px 22px;">
          <div style="font-family:${H};font-weight:800;font-size:22px;letter-spacing:0.06em;text-transform:uppercase;color:${s.head};margin:0 0 10px;">${k}</div>
          <div style="font-family:${B};font-weight:400;font-size:14px;line-height:1.55;color:${s.body};">${v}</div>
        </div>`;
  }).join("");
  return `
  <section style="background:${BLACK};padding:8px 24px 64px;">
    <div style="max-width:960px;margin:0 auto;">
      ${sectionHead("All The Details")}
      <div style="display:flex;flex-wrap:wrap;gap:22px;justify-content:center;">${cards}</div>
    </div>
  </section>`;
}

/** "The Cost of Doing Nothing vs Joining" — With (real deliverables) / Without (real pains). */
function costSection(content: LandingPageContent): string {
  const withItems = (Array.isArray(content.consultationOutline) ? content.consultationOutline : []).filter((d) => ok(d?.title)).slice(0, 3).map((d) => esc(d.title!));
  const withoutItems = [content.problemAgitation, content.whyOldFail, content.scarcityUrgency].filter(ok).slice(0, 3).map((x) => esc(x!));
  if (withItems.length < 2 || withoutItems.length < 1) return ""; // no honest source for the contrast → omit
  // PNG-sampled: LIGHT off-white panels (not dark) with a green/red border, a BLACK heading + rule,
  // and items on white rows with a solid colour-filled check/cross badge.
  const row = (text: string, colour: string, mark: string) => `
          <div style="display:flex;gap:12px;align-items:flex-start;background:${PANEL_ROW};border-radius:10px;padding:12px 14px;margin:0 0 10px;font-family:${B};font-weight:500;font-size:14px;line-height:1.5;color:#1A1A1A;">
            <span aria-hidden="true" style="flex-shrink:0;width:20px;height:20px;border-radius:9999px;background:${colour};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;">${mark}</span><span>${text}</span>
          </div>`;
  const col = (title: string, colour: string, mark: string, items: string[]) => `
        <div style="flex:1 1 300px;min-width:280px;max-width:420px;background:${PANEL_LIGHT};border:2px solid ${colour};border-radius:16px;padding:24px 22px;">
          <div style="font-family:${H};font-weight:800;font-size:20px;color:${PANEL_INK};margin:0 0 8px;">${title}</div>
          <div aria-hidden="true" style="height:2px;background:#1A1A1A;opacity:0.85;margin:0 0 16px;"></div>
          ${items.map((t) => row(t, colour, mark)).join("")}
        </div>`;
  return `
  <section style="background:${BLACK};padding:8px 24px 60px;">
    <div style="max-width:960px;margin:0 auto;">
      ${sectionHead("The Cost of Doing Nothing<br>vs Joining the Challenge")}
      <div style="display:flex;flex-wrap:wrap;gap:22px;justify-content:center;align-items:stretch;">
        ${col("With This Event", COMPARE_GREEN, "&#10003;", withItems)}
        ${col("Without This Event", COMPARE_RED, "&times;", withoutItems)}
      </div>
      <div style="margin:34px auto 0;">${ctaBlock(content, "3")}</div>
    </div>
  </section>`;
}

/** "What's Included" — bonuses/featureHighlights grid. NEVER the reference's $250K/McLaren/Rolex prizes. */
function includedSection(content: LandingPageContent): string {
  const bonuses = (Array.isArray(content.bonuses) ? content.bonuses : []).filter((b) => ok(b?.title));
  const feats = (Array.isArray(content.featureHighlights) ? content.featureHighlights : []).filter(ok);
  const items = bonuses.length
    ? bonuses.map((b) => ({ t: esc(b.title), d: ok(b.description) ? esc(b.description!) : "", v: ok(b.value) ? esc(b.value!) : "" }))
    : feats.map((f) => ({ t: esc(f), d: "", v: "" }));
  if (!items.length) return "";
  const cards = items.map((it) => `
        <div style="flex:1 1 300px;min-width:260px;max-width:420px;position:relative;border-radius:16px;overflow:hidden;background:radial-gradient(120% 120% at 50% 50%, rgba(209,79,53,0.16) 0%, rgba(0,0,0,0) 60%), ${NEAR_BLACK};border:1px solid #26221F;padding:24px 22px;">
          ${it.v ? `<div style="position:absolute;top:14px;right:14px;font-family:${B};font-weight:700;font-size:12px;color:${YELLOW};">${it.v} value</div>` : ""}
          <div style="font-family:${H};font-weight:800;font-size:18px;line-height:1.2;color:${WHITE};margin:0 0 ${it.d ? "10px" : "0"};">${it.t}</div>
          ${it.d ? `<p style="font-family:${B};font-weight:400;font-size:14px;line-height:1.55;color:${SUBTLE};margin:0;">${it.d}</p>` : ""}
        </div>`).join("");
  return `
  <section style="background:${BLACK};padding:8px 24px 60px;">
    <div style="max-width:960px;margin:0 auto;">
      ${sectionHead("What&rsquo;s Included When You Register")}
      <div style="display:flex;flex-wrap:wrap;gap:22px;justify-content:center;">${cards}</div>
    </div>
  </section>`;
}

/** Final "Register Below to Save Your Free Seat" CTA card (its own reveal-capture instance). */
function finalCtaSection(content: LandingPageContent): string {
  const note = ok(content.guarantee)
    ? esc(content.guarantee)
    : "Register below to save your free seat — you&rsquo;ll get the confirmation and joining details by email.";
  return `
  <section style="background:${BLACK};padding:8px 24px 72px;">
    <div style="max-width:760px;margin:0 auto;border-radius:20px;overflow:hidden;background:radial-gradient(130% 110% at 50% 45%, rgba(190,55,40,0.20) 0%, rgba(0,0,0,0) 62%), ${NEAR_BLACK};padding:44px 28px;text-align:center;">
      <div style="font-family:${B};font-weight:700;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${YELLOW};margin:0 0 12px;">Important</div>
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,3.4vw,38px);line-height:1.1;color:${WHITE};margin:0 auto 14px;max-width:20ch;">Register Below to Save Your Free Seat.</h2>
      <p style="font-family:${B};font-weight:400;font-size:15px;line-height:1.55;color:${SUBTLE};margin:0 auto 26px;max-width:52ch;">${note}</p>
      ${ctaBlock(content, "2")}
      <div style="font-family:${B};font-size:12px;color:${LEGAL};margin-top:14px;">You&rsquo;ll get the confirmation at your email address.</div>
    </div>
  </section>`;
}

/**
 * The full Iman event page (2026-07-17 rebuild). CORRECTED from the earlier "poster only" premise:
 * the frozen reference is a FULL page — poster hero → agenda (Day 0N) → All The Details → Cost of
 * Doing Nothing vs Joining → What's Included → final Register CTA → legal. Every lower section binds
 * to REAL cascade content and graceful-omits when it has no honest source; ZAP never fabricates the
 * reference's ticket counts, $250K prize pool, McLaren/Rolex prizes, or figures.
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
      <h1 style="font-family:${H};font-weight:800;font-size:clamp(28px,4.6vw,52px);line-height:1.08;letter-spacing:-0.02em;color:${WHITE};margin:0 auto 16px;max-width:20ch;">${headline}</h1>
      ${support ? `<p style="font-family:${B};font-weight:500;font-size:clamp(15px,1.6vw,18px);line-height:1.5;color:#B9C0B8;margin:0 auto 30px;max-width:44ch;">${support}</p>` : `<div style="height:22px;"></div>`}
      ${ctaBlock(content)}
    </div>
  </section>`;

  return renderDocument({
    title: content.mainHeadline || serviceName,
    fontHref: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
    bodyBg: BLACK,
    body: [
      primary,
      learnSection(content),
      detailsSection(content),
      costSection(content),
      includedSection(content),
      finalCtaSection(content),
      legalEndpoint(serviceName, coach),
      runtimeScript(),
    ].join("\n"),
  });
}
