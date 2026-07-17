/**
 * Event — Alex Hormozi (paid in-person workshop) — template #4b. A NEW design bar, distinct from
 * Iman's dark poster and from Burchard / discovery / webinar. Bespoke replica of the frozen
 * Acquisition.com "Scaling Workshop" reference (docs/landing-page-references/
 * event_registration--alex-hormozi.png, 4480×14636): a long, mostly-white, presenter-led paid
 * workshop conversion page — a disciplined objection ladder, not a poster.
 *
 * Grey-box silhouette (spec §27): hairline event strip → navy hero (risk headline + subhead +
 * landscape video) → white explanation + purple pill → tall pale-grey "What people are saying"
 * proof field → torn black in-person divider → three numbered photographic workshop deliverables →
 * mid purple pill → looser proof collage → four navy disclosure bars (what happens in 2 days /
 * what you walk away with / is this right for your size&industry / how much are tickets) → final
 * purple pill. No footer beyond the last CTA.
 *
 * Highest-risk / Gate-1 section (spec §28/§29): the "What people are saying" proof composition.
 * DELIBERATE, DISCLOSED honesty divergence — the reference's power is raw, tilted social-media
 * screenshots with embedded highlights, which ZAP has no asset for and must never fabricate. We
 * render the coach's REAL testimonials as honest monogram quote cards instead. This section reads
 * cleaner than the raw-collage reference BY DESIGN — judge it as intended, not against the raw look.
 *
 * Honesty patterns (inherited): the hero video is the coach's REAL video_url (YouTube/Vimeo/file),
 * else the real headshot poster with NO fake play affordance, else omitted (ZAP never fabricates
 * video). The price section binds a REAL operator-captured content.price; absent → the ENTIRE
 * "How much are tickets" section is omitted (we never invent a ticket price — the reference's
 * $5k is Hormozi's, not a coach's). The qualification section binds the coach's ICP-derived
 * "who this is for"; it NEVER reproduces Hormozi's $250k / $1m–$100m thresholds, and shows no
 * fabricated revenue numbers. The event strip binds a REAL eventSchedule; absent → an
 * [INSERT_EVENT_*] token → the publish placeholder hard-gate blocks the page (review-draft). The
 * reserve flow reveals a minimal email+consent capture that posts to /api/capture-lead in EVENT
 * mode (no magnet). Bespoke builder on the shared Phase-0 primitives; NOT a config engine.
 */
import type { LandingPageContent } from "../../../drizzle/schema";
import { esc, ok, imgOrOmit, initials, renderDocument } from "./templatePrimitives";

export interface EventHormoziCoachInput {
  /** Presenter photo — headshot slot. Hero video poster fallback (no fake play) + benefit imagery. */
  headshotUrl?: string | null;
  /** Optional 16:9 hero/workshop image — hero_image slot. Preferred video poster before headshot. */
  heroImageUrl?: string | null;
  coachName?: string | null;
  coachBackground?: string | null;
  /** The coach's REAL workshop video URL. Null → headshot poster (no fake play), else omit. */
  videoUrl?: string | null;
  /**
   * ICP-derived "who this workshop is for" lines (real-or-nothing, resolver-supplied — never freshly
   * generated). Empty → the qualification section omits. NEVER contains revenue thresholds.
   */
  whoFor?: string[];
}

// ── Palette — the frozen Hormozi reference (spec §23): navy / white / pale-grey with purple CTA ──
const WHITE = "#FFFFFF";
const NAVY = "#131628"; // hero field + disclosure bars (sampled from the frozen reference)
const NAVY_DEEP = "#141531";
const NEAR_BLACK = "#171717"; // torn divider + top strip
const INK = "#20223F";
const BODY = "#3B3D57";
const PALE = "#F3F3F3"; // proof field
const CARD_LINE = "#E4E5EE";
// Action purple — sampled #6F00FD from the reference button (was a too-bright magenta gradient
// topping #9A2BFF). Kept as a very subtle top-light gradient centred on the sampled violet.
const PURPLE_A = "#8A3BFF";
const PURPLE_B = "#6F00FF";
const PURPLE_TEXT = "#6F00FF";
const H = "'Poppins', system-ui, -apple-system, sans-serif"; // heavy geometric sans
const B = "'Poppins', system-ui, -apple-system, sans-serif";
const BTN = "Arial, Helvetica, sans-serif"; // buttons + form inputs

const EVENT_LOC_TOKEN = "[INSERT_EVENT_LOCATION]";
const EVENT_DATE_TOKEN = "[INSERT_EVENT_DATE]";

/** Purple gradient pill CTA (reveal-on-intent email capture). Wording repeats across the page. */
function purpleCta(id: string, label: string): string {
  return `<button type="button" class="ev_cta" data-form="${esc(id)}" style="display:inline-block;padding:16px 38px;font-family:${BTN};font-weight:800;font-size:clamp(15px,1.6vw,18px);text-transform:uppercase;letter-spacing:0.02em;color:${WHITE};background:linear-gradient(180deg,${PURPLE_A} 0%,${PURPLE_B} 100%);border:0;border-radius:9999px;cursor:pointer;box-shadow:0 8px 20px rgba(19,22,40,0.20);">${esc(label)}</button>`;
}

/** The reveal-on-intent capture form (shared markup; one instance per CTA id). */
function captureForm(id: string): string {
  return `
        <div id="${esc(id)}" class="ev_form" style="display:none;max-width:440px;margin:18px auto 0;text-align:left;">
          <form class="ev_optin" autocomplete="on" style="display:flex;flex-direction:column;gap:10px;">
            <input type="text" name="ev_name" placeholder="First name (optional)" style="width:100%;box-sizing:border-box;padding:13px 15px;font-family:${BTN};font-size:15px;border:1px solid ${CARD_LINE};border-radius:8px;">
            <input type="email" name="ev_email" required placeholder="you@example.com" style="width:100%;box-sizing:border-box;padding:13px 15px;font-family:${BTN};font-size:15px;border:1px solid ${CARD_LINE};border-radius:8px;">
            <label style="display:flex;gap:8px;align-items:flex-start;font-family:${B};font-size:12px;line-height:1.4;color:${BODY};"><input type="checkbox" class="ev_consent" required style="margin-top:3px;"><span>I agree to receive workshop details and related emails, and accept the <a href="https://zapcampaigns.com/privacy" target="_blank" rel="noopener" style="color:${PURPLE_TEXT};">privacy policy</a>.</span></label>
            <div style="position:absolute;left:-9999px;" aria-hidden="true"><input type="text" name="ev_hp" tabindex="-1" autocomplete="off"></div>
            <button type="submit" class="ev_submit" style="width:100%;box-sizing:border-box;padding:15px 24px;font-family:${BTN};font-weight:800;font-size:16px;text-transform:uppercase;color:${WHITE};background:linear-gradient(180deg,${PURPLE_A},${PURPLE_B});border:0;border-radius:9999px;cursor:pointer;">Reserve my seat</button>
            <div class="ev_msg" style="font-family:${B};font-size:13px;color:${PURPLE_TEXT};min-height:16px;"></div>
          </form>
        </div>`;
}

/** Landscape hero video: real video → provider embed, else real photo poster (no play), else omit. */
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

/** A 16:9 landscape media frame (real video, or a genuinely-landscape hero image). */
function frame16x9(inner: string): string {
  return `<div style="position:relative;width:100%;max-width:720px;margin:0 auto;aspect-ratio:16/9;background:#0B1220;border-radius:12px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,0.4);">${inner}</div>`;
}

/**
 * Hero media, honest by source shape:
 *   1. real video URL → 16:9 iframe;
 *   2. real 16:9 hero image → 16:9 poster (genuinely landscape);
 *   3. only a portrait headshot (no video, no landscape image) → the headshot at its NATURAL 2:3
 *      aspect in a portrait frame — never a fake video-shaped 16:9 box cropping the face;
 *   4. nothing → omit.
 * The two clean paths (1, 2) are unchanged; this only fixes the deepest fallback (3).
 */
function heroMedia(coach: EventHormoziCoachInput): string {
  const alt = coach.coachName || "Your host";
  // 1. Recognised video → landscape iframe. (posterFallback "" so an UNrecognised URL falls through
  //    to the image logic below rather than stretching a portrait into the video frame.)
  if (ok(coach.videoUrl)) {
    const embed = videoEmbed(coach.videoUrl!, "");
    if (ok(embed)) return frame16x9(embed);
  }
  // 2. Real 16:9 hero image → landscape poster.
  if (ok(coach.heroImageUrl)) {
    const poster = imgOrOmit(coach.heroImageUrl, alt,
      "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;");
    if (ok(poster)) return frame16x9(poster);
  }
  // 3. Deepest fallback: a portrait headshot only. Present it at its natural aspect, not 16:9.
  if (ok(coach.headshotUrl)) {
    return `<div style="width:100%;max-width:340px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,0.4);"><img src="${esc(coach.headshotUrl)}" alt="${esc(alt)}" style="display:block;width:100%;height:auto;"></div>`;
  }
  // 4. No real media → omit honestly.
  return "";
}

// ── Sections ─────────────────────────────────────────────────────────────────────────

/** Hairline event/location strip — real eventSchedule.venue, else [INSERT_EVENT_LOCATION] token. */
function eventStrip(content: LandingPageContent): string {
  const es = content.eventSchedule ?? {};
  const loc = ok(es.venue) ? esc(es.venue) : EVENT_LOC_TOKEN;
  const date = ok(es.date) ? esc(es.date) : EVENT_DATE_TOKEN;
  return `
  <div style="background:${NEAR_BLACK};padding:9px 20px;text-align:center;">
    <span style="display:inline-block;background:rgba(255,255,255,0.08);border-radius:9999px;padding:5px 16px;font-family:${B};font-weight:600;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#E7E7F0;">Live in-person workshop &middot; ${loc} &middot; ${date}</span>
  </div>`;
}

/** Gate 2: navy hero — risk headline → subheadline → landscape video crossing into white → CTA. */
function heroSection(content: LandingPageContent, coach: EventHormoziCoachInput): string {
  const headline = ok(content.mainHeadline) ? esc(content.mainHeadline) : "Are you the biggest risk to your own business?";
  const sub = ok(content.subheadline) ? esc(content.subheadline) : "";
  const explain = ok(content.solutionIntro) ? esc(content.solutionIntro)
    : ok(content.problemAgitation) ? esc(content.problemAgitation) : "";
  const media = heroMedia(coach);
  return `
  <section style="background:${NAVY};padding:56px 24px 0;">
    <div style="max-width:960px;margin:0 auto;text-align:center;">
      <h1 style="font-family:${H};font-weight:800;font-size:clamp(28px,4.4vw,50px);line-height:1.1;letter-spacing:-0.01em;text-transform:uppercase;color:${WHITE};margin:0 auto 18px;max-width:20ch;">${headline}</h1>
      ${sub ? `<p style="font-family:${B};font-weight:400;font-size:clamp(16px,1.6vw,20px);line-height:1.5;color:#C7C8E0;margin:0 auto 40px;max-width:46ch;">${sub}</p>` : `<div style="height:20px;"></div>`}
      ${media ? `<div style="margin:0 auto;transform:translateY(56px);">${media}</div>` : ""}
    </div>
  </section>
  <section style="background:${WHITE};padding:${media ? "96px" : "56px"} 24px 64px;">
    <div style="max-width:680px;margin:0 auto;text-align:center;">
      ${explain ? `<p style="font-family:${B};font-weight:400;font-size:clamp(16px,1.5vw,18px);line-height:1.6;color:${BODY};margin:0 auto 30px;">${explain}</p>` : ""}
      ${purpleCta("f_hero", ok(content.primaryCta) ? content.primaryCta : "I'm ready to scale")}
      ${captureForm("f_hero")}
    </div>
  </section>`;
}

/**
 * Gate 1: "What people are saying" proof field. Honest monogram quote cards from REAL testimonials
 * (disclosed divergence from the reference's raw social screenshots — never fabricated). Pale-grey
 * textured field preserved; the density comes from real quotes, not invented figures.
 */
function proofSection(content: LandingPageContent, heading: string, slice: [number, number]): string {
  // Single trust surface (no offer/coach split) → offer (this service) + portable coach proof combined.
  const testimonials = [
    ...(Array.isArray(content.testimonials) ? content.testimonials : []),
    ...(Array.isArray(content.coachTestimonials) ? content.coachTestimonials : []),
  ].filter((t) => ok(t?.quote)).slice(slice[0], slice[1]);
  if (testimonials.length === 0) return "";
  const cards = testimonials.map((t) => `
        <div style="flex:1 1 300px;min-width:260px;max-width:360px;background:${WHITE};border:1px solid ${CARD_LINE};border-radius:10px;padding:24px;box-shadow:0 8px 20px rgba(19,22,40,0.06);">
          <p style="font-family:${B};font-weight:400;font-size:15px;line-height:1.6;color:${INK};margin:0 0 16px;">&ldquo;${esc(t.quote)}&rdquo;</p>
          <div style="display:flex;align-items:center;gap:12px;">
            <div aria-hidden="true" style="width:42px;height:42px;border-radius:9999px;background:${PURPLE_TEXT}1A;display:flex;align-items:center;justify-content:center;font-family:${H};font-weight:700;font-size:15px;color:${PURPLE_TEXT};text-transform:uppercase;">${esc(initials(String(t.name ?? "")))}</div>
            <div>
              ${ok(t.name) ? `<div style="font-family:${H};font-weight:700;font-size:14px;color:${INK};">${esc(t.name)}</div>` : ""}
              ${ok(t.location) ? `<div style="font-family:${B};font-size:12px;color:${BODY};">${esc(t.location)}</div>` : ""}
            </div>
          </div>
        </div>`).join("");
  return `
  <section style="background:${PALE};padding:72px 24px;background-image:radial-gradient(rgba(20,21,49,0.04) 1px,transparent 1px);background-size:16px 16px;">
    <div style="max-width:1080px;margin:0 auto;">
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,2.6vw,34px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 40px;max-width:22ch;">${esc(heading)}</h2>
      <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;">${cards}</div>
    </div>
  </section>`;
}

/**
 * Full-width TORN black in-person divider (spec §7/§30 — "in-person" underlined). Real torn-paper
 * edges: a ragged strip along the top (filled with the PALE proof colour above) and bottom (filled
 * WHITE like the deliverables below) so the black band reads as torn out of the page, not a flat bar.
 */
function tornDivider(): string {
  const D = "M0,20 L60,6 L120,17 L180,4 L240,15 L300,3 L360,16 L420,6 L480,18 L540,5 L600,15 L660,7 L720,17 L780,4 L840,16 L900,6 L960,18 L1020,5 L1080,15 L1140,8 L1200,17 L1200,20 Z";
  const tearTop = `<svg aria-hidden="true" viewBox="0 0 1200 20" preserveAspectRatio="none" style="position:absolute;top:-1px;left:0;width:100%;height:20px;display:block;"><path d="${D}" fill="${PALE}"/></svg>`;
  const tearBottom = `<svg aria-hidden="true" viewBox="0 0 1200 20" preserveAspectRatio="none" style="position:absolute;bottom:-1px;left:0;width:100%;height:20px;display:block;transform:rotate(180deg);"><path d="${D}" fill="${WHITE}"/></svg>`;
  return `
  <section style="background:${NEAR_BLACK};padding:72px 24px;position:relative;overflow:hidden;">
    ${tearTop}${tearBottom}
    <div style="max-width:900px;margin:0 auto;text-align:center;position:relative;z-index:1;">
      <h2 style="font-family:${H};font-weight:800;font-size:clamp(24px,3vw,40px);line-height:1.15;text-transform:uppercase;color:${WHITE};margin:0;">What you get at the <span style="text-decoration:underline;text-decoration-color:${PURPLE_A};text-underline-offset:5px;">in-person</span> workshop</h2>
    </div>
  </section>`;
}

/**
 * Three numbered workshop deliverables from consultationOutline. TEXT-FIRST BY DESIGN (decision G5),
 * and honestly so: the reference shows a photo per deliverable, but ZAP has NO honest per-deliverable
 * image source — a coach supplies one headshot + one hero image, never three distinct workshop
 * photos, and fabricating stock imagery is forbidden. So each deliverable is an enriched numbered
 * card (purple index + top accent) rather than a fake photo. A CTA follows the full set.
 */
function benefitsSection(content: LandingPageContent): string {
  const items = (Array.isArray(content.consultationOutline) ? content.consultationOutline : [])
    .filter((o) => ok(o?.title) || ok(o?.description)).slice(0, 3);
  if (items.length === 0) return "";
  const cols = items.map((o, i) => `
        <div style="flex:1 1 280px;min-width:250px;background:#FBFBFE;border:1px solid ${CARD_LINE};border-radius:12px;padding:26px 24px;position:relative;overflow:hidden;">
          <div aria-hidden="true" style="position:absolute;top:0;left:0;width:100%;height:4px;background:linear-gradient(90deg,${PURPLE_A},${PURPLE_B});"></div>
          <div style="font-family:${H};font-weight:800;font-size:48px;line-height:1;color:${PURPLE_TEXT};margin:6px 0 14px;">${String(i + 1).padStart(2, "0")}</div>
          ${ok(o.title) ? `<div style="font-family:${H};font-weight:700;font-size:19px;color:${INK};margin:0 0 10px;">${esc(o.title)}</div>` : ""}
          ${ok(o.description) ? `<p style="font-family:${B};font-weight:400;font-size:15px;line-height:1.6;color:${BODY};margin:0;">${esc(o.description)}</p>` : ""}
        </div>`).join("");
  return `
  <section style="background:${WHITE};padding:72px 24px 64px;">
    <div style="max-width:1000px;margin:0 auto;">
      <div style="display:flex;flex-wrap:wrap;gap:24px;">${cols}</div>
      <div style="text-align:center;margin-top:52px;">
        ${purpleCta("f_mid", ok(content.primaryCta) ? content.primaryCta : "I'm ready to scale")}
        ${captureForm("f_mid")}
      </div>
    </div>
  </section>`;
}

/** One navy disclosure bar + its answer copy (the objection-ladder unit). Omits when body is empty. */
function disclosure(title: string, body: string): string {
  if (!ok(body)) return "";
  return `
    <div style="border-bottom:1px solid ${CARD_LINE};">
      <div style="background:${NAVY};padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <span style="font-family:${H};font-weight:700;font-size:clamp(17px,1.9vw,21px);color:${WHITE};">${esc(title)}</span>
        <span aria-hidden="true" style="font-family:${H};font-weight:700;font-size:22px;color:#8E90C8;flex-shrink:0;">+</span>
      </div>
      <div style="background:${WHITE};padding:22px 24px 30px;">
        <p style="font-family:${B};font-weight:400;font-size:15px;line-height:1.65;color:${BODY};margin:0;max-width:70ch;">${body}</p>
      </div>
    </div>`;
}

/** Qualification answer — ICP-derived "who this is for" (real-or-nothing; NEVER revenue thresholds). */
function whoForBody(coach: EventHormoziCoachInput): string {
  const lines = (Array.isArray(coach.whoFor) ? coach.whoFor : []).filter((s) => ok(s)).slice(0, 4);
  if (lines.length === 0) return "";
  const items = lines.map((s) => `<li style="margin:0 0 8px;">${esc(s)}</li>`).join("");
  return `This workshop is built for a specific kind of business owner. It&#39;s the right room for you if:<ul style="margin:12px 0 0;padding-left:20px;">${items}</ul>`;
}

/** Price answer — REAL operator-captured price only. Absent → the whole section is omitted upstream. */
function priceBody(content: LandingPageContent): string {
  const p = content.price;
  if (!p || !ok(p.amount)) return "";
  // Symbol currencies ("$", "£") sit flush against the amount; word currencies ("USD") take a space.
  const cur = ok(p.currency) ? esc(p.currency!) + (/^[A-Za-z]/.test(p.currency!.trim()) ? " " : "") : "";
  const inst = ok(p.installments) ? ` (${esc(p.installments!)})` : "";
  return `Tickets are <strong>${cur}${esc(p.amount)}${inst}</strong> per seat. Your seat covers the full in-person workshop, the working sessions, and direct access to the room — every attendee is a real operator, not a spectator.`;
}

/** The lower objection ladder — process → takeaways → qualification → price. Each unit omits if empty. */
function ladderSection(content: LandingPageContent, coach: EventHormoziCoachInput): string {
  const process = ok(content.whyOldFail) ? esc(content.whyOldFail)
    : ok(content.solutionIntro) ? esc(content.solutionIntro) : "";
  const takeaways = ok(content.timeSavingBenefit) ? esc(content.timeSavingBenefit)
    : ok(content.insiderAdvantages) ? esc(content.insiderAdvantages) : "";
  const bars = [
    disclosure("What actually happens during the workshop?", process),
    disclosure("What do I walk away with?", takeaways),
    disclosure("Is this right for my business?", whoForBody(coach)),
    disclosure("How much are tickets?", priceBody(content)),
  ].join("");
  if (!ok(bars)) return "";
  return `
  <section style="background:${WHITE};padding:32px 24px 8px;">
    <div style="max-width:820px;margin:0 auto;border:1px solid ${CARD_LINE};border-bottom:0;border-radius:10px 10px 0 0;overflow:hidden;">${bars}</div>
  </section>`;
}

/** Final CTA + endpoint. No footer/legal nav beyond the last pill (spec §21 endpoint discipline). */
function finalCta(content: LandingPageContent): string {
  return `
  <section style="background:${WHITE};padding:56px 24px 88px;text-align:center;">
    ${purpleCta("f_final", ok(content.primaryCta) ? content.primaryCta : "I'm ready to scale")}
    ${captureForm("f_final")}
  </section>`;
}

/** Inline runtime: reveal-on-intent capture (multiple CTAs) → /api/capture-lead EVENT mode. */
function runtimeScript(): string {
  return `<script>
(function(){
  var btns=document.querySelectorAll('.ev_cta');
  for(var i=0;i<btns.length;i++){(function(btn){btn.addEventListener('click',function(){
    var f=document.getElementById(btn.getAttribute('data-form'));
    if(f){f.style.display='block';var e=f.querySelector('input[type=email]');if(e){e.focus();}}
  });})(btns[i]);}
  var forms=document.querySelectorAll('.ev_optin');
  for(var j=0;j<forms.length;j++){(function(form){form.addEventListener('submit',function(ev){ev.preventDefault();
    var msg=form.querySelector('.ev_msg');
    var email=((form.querySelector('input[type=email]')||{}).value||'').trim();
    var consent=(form.querySelector('.ev_consent')||{}).checked;
    if(!email||!consent){if(msg){msg.textContent='Enter your email and tick the box to reserve your seat.';}return;}
    var sub=form.querySelector('.ev_submit');if(sub){sub.disabled=true;sub.textContent='Reserving…';}
    var slug=(location.pathname.split('/').filter(Boolean).pop())||'';
    fetch('/api/capture-lead',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({mode:'event',slug:slug,email:email,name:((form.querySelector('input[name=ev_name]')||{}).value||''),consent:consent,website:((form.querySelector('input[name=ev_hp]')||{}).value||'')})})
    .then(function(r){return r.json().catch(function(){return {};});})
    .then(function(){form.parentNode.innerHTML='<div style="font-family:'+"'Poppins',sans-serif"+';font-weight:700;font-size:15px;color:#20223F;text-align:center;padding:8px 0;">You&#39;re on the list! Check your inbox for the workshop details.</div>';})
    .catch(function(){if(msg){msg.textContent='Something went wrong — please try again.';}if(sub){sub.disabled=false;sub.textContent='Reserve my seat';}});
  });})(forms[j]);}
})();
</script>`;
}

/**
 * Full Hormozi paid-workshop page: event strip → navy hero+video → CTA → proof (Gate 1, monogram
 * cards) → torn divider → 3 benefits → mid CTA → more proof → objection ladder (process/takeaways/
 * qualification/price) → final CTA. No footer beyond the last pill.
 */
export function buildEventHormoziHtml(
  content: LandingPageContent,
  serviceName: string,
  coach: EventHormoziCoachInput = {},
): string {
  return renderDocument({
    title: content.mainHeadline || serviceName,
    fontHref: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap",
    bodyBg: WHITE,
    body: [
      eventStrip(content),
      heroSection(content, coach),
      proofSection(content, "What people are saying", [0, 3]),
      tornDivider(),
      benefitsSection(content),
      proofSection(content, "More from people in the room", [3, 6]),
      ladderSection(content, coach),
      finalCta(content),
      runtimeScript(),
    ].join("\n"),
  });
}
