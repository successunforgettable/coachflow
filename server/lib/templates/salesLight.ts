/**
 * Sales PROOF-LIGHT template — the low-proof sibling of salesAliAbdaal.ts.
 *
 * WHY THIS EXISTS (root cause, 2026-07-18): the reference Ali-Abdaal sales page runs 30+ testimonials
 * threaded continuously — its mechanism IS overwhelming evidence. But the cascade hard-caps
 * testimonials at 3 (services.testimonial1/2/3; the unlimited `testimonials` library table is NOT
 * wired into LP generation, and proofMetrics/caseStudies are never populated). So the reference-
 * faithful RICH template is structurally starved for every real coach today. This LIGHT variant is a
 * PROPERLY-COMPOSED page for a coach with little/no proof — offer- and method-forward — NOT the rich
 * page with empty slots or thinned padding. It leans on what is ALWAYS generated: the offer, the
 * unique mechanism, the curriculum, the systems, the guarantee, the coach's own story. No testimonial
 * wall, no stats bar, no results grid. Selected automatically by `resolveSalesStyle` at publish when
 * proof is below the (placeholder) rich threshold; it is the DEFAULT for sales_page (and thus the
 * Auto-Mode / blank-slate page, since course_launch/product_launch/challenge all route to sales_page).
 *
 * Honesty is identical to the rich variant: real price only (absent → [INSERT_PRICE] → review-draft),
 * real checkout URL (else on-page capture), and NEVER a fabricated testimonial, number, or credential.
 * Shares the frozen Ali palette + fonts so the two variants read as one brand. Self-contained per the
 * Iman/Hormozi precedent — the rich builder is untouched.
 */
import type { LandingPageContent } from "../../../drizzle/schema";
import { esc, ok, imgOrOmit, checkCircle, ctaLink, tileIconSet, renderDocument } from "./templatePrimitives";

/** Coach inputs — mirrors SalesCoachInput; resolved in salesPublish.ts. */
export interface SalesLightCoachInput {
  headshotUrl?: string | null;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
  coachName?: string | null;
  coachBackground?: string | null;
  videoUrl?: string | null;
  checkoutUrl?: string | null;
}

// ── Palette — token-for-token with salesAliAbdaal (the two variants are one brand) ──
const WHITE = "#FFFFFF";
const IVORY = "#F9F6F3";
const BLOB = "#ECE5E1";
const INK = "#1B1624";
const INK_SOFT = "#6B6572";
const BODY = "#4A4652";
const GREEN = "#2F9E4E";
const GREEN_HOVER = "#268A42";
const CTA = "#5DCDF1";
const CTA_TEXT = "#1B1624";
const CORAL = "#FD6D6D";
const CARD_LINE = "#ECE7E0";
const S = "'Hanken Grotesk', system-ui, -apple-system, sans-serif";
const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";

const PRICE_TOKEN = "[INSERT_PRICE]";

// ── Hero media (shared behaviour with the rich variant) ─────────────────────────────────────────
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
function heroMedia(coach: SalesLightCoachInput): string {
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

// ── CTA + capture (shared behaviour) ────────────────────────────────────────────────────────────
function purchaseCta(coach: SalesLightCoachInput, id: string, label: string): string {
  const style = `display:inline-block;padding:15px 38px;font-family:${S};font-weight:600;font-size:clamp(15px,1.5vw,17px);color:${CTA_TEXT};background:${CTA};border:0;border-radius:9999px;cursor:pointer;text-decoration:none;box-shadow:0 1px 2px rgba(27,22,36,0.10);`;
  if (ok(coach.checkoutUrl)) return ctaLink(coach.checkoutUrl!, label, style);
  return `<button type="button" class="sl_cta" data-form="${esc(id)}" style="${style}">${esc(label)}</button>`;
}
function captureForm(coach: SalesLightCoachInput, id: string): string {
  if (ok(coach.checkoutUrl)) return "";
  return `
      <div id="${esc(id)}" class="sl_form" style="display:none;max-width:440px;margin:18px auto 0;text-align:left;">
        <form class="sl_optin" autocomplete="on" style="display:flex;flex-direction:column;gap:10px;">
          <input type="text" name="sl_name" placeholder="First name (optional)" style="width:100%;box-sizing:border-box;padding:13px 15px;font-family:${S};font-size:15px;border:1px solid ${CARD_LINE};border-radius:10px;">
          <input type="email" name="sl_email" required placeholder="you@example.com" style="width:100%;box-sizing:border-box;padding:13px 15px;font-family:${S};font-size:15px;border:1px solid ${CARD_LINE};border-radius:10px;">
          <label style="display:flex;gap:8px;align-items:flex-start;font-family:${S};font-size:12px;line-height:1.4;color:${INK_SOFT};"><input type="checkbox" class="sl_consent" required style="margin-top:3px;"><span>I agree to receive the enrolment details and related emails, and accept the <a href="https://zapcampaigns.com/privacy" target="_blank" rel="noopener" style="color:${GREEN_HOVER};">privacy policy</a>.</span></label>
          <div style="position:absolute;left:-9999px;" aria-hidden="true"><input type="text" name="sl_hp" tabindex="-1" autocomplete="off"></div>
          <button type="submit" class="sl_submit" style="width:100%;box-sizing:border-box;padding:15px 24px;font-family:${S};font-weight:700;font-size:16px;color:${CTA_TEXT};background:${CTA};border:0;border-radius:9999px;cursor:pointer;">Send me the enrolment details</button>
          <div class="sl_msg" style="font-family:${S};font-size:13px;color:${CORAL};min-height:16px;"></div>
        </form>
      </div>`;
}

// ── Sections ─────────────────────────────────────────────────────────────────────────────────────
function header(coach: SalesLightCoachInput, serviceName: string): string {
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

function heroSection(content: LandingPageContent, coach: SalesLightCoachInput): string {
  const eyebrow = ok(content.eyebrowHeadline) ? `<div style="font-family:${S};font-weight:700;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;color:${CORAL};margin:0 0 22px;">${esc(content.eyebrowHeadline)}</div>` : "";
  const headline = esc(ok(content.mainHeadline) ? content.mainHeadline : "Learn the exact system, step by step");
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

/**
 * The outcome/transformation band — leads with the PROMISE (what changes) since proof can't carry the
 * page. Binds real generated copy: solutionIntro (the transformation) + up to four outcome lines from
 * systemTiles / featureHighlights (qualitative, non-numeric). Real-or-omit.
 */
function transformationSection(content: LandingPageContent): string {
  const promise = ok(content.solutionIntro) ? esc(content.solutionIntro) : "";
  const outcomes = [
    ...(Array.isArray(content.systemTiles) ? content.systemTiles : []),
    ...(Array.isArray(content.featureHighlights) ? content.featureHighlights : []),
  ].filter(ok).slice(0, 4).map((x) => esc(String(x)));
  if (!promise && outcomes.length < 2) return "";
  const lead = promise || "Here's exactly what you'll be able to do.";
  const bullets = outcomes.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;max-width:820px;margin:30px auto 0;">${outcomes.map((o) => `
        <div style="flex:1 1 320px;min-width:280px;max-width:380px;display:flex;align-items:flex-start;gap:10px;background:${WHITE};border:1px solid ${CARD_LINE};border-radius:12px;padding:16px 18px;text-align:left;font-family:${S};font-size:15px;line-height:1.5;color:${BODY};">${checkCircle(GREEN)}<span>${o}</span></div>`).join("")}</div>`
    : "";
  return `
  <section style="background:${WHITE};padding:64px 24px;">
    <div style="max-width:820px;margin:0 auto;text-align:center;">
      <div style="font-family:${S};font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${CORAL};margin:0 0 14px;">By the end</div>
      <h2 style="font-family:${SERIF};font-weight:600;font-size:clamp(24px,3vw,36px);line-height:1.25;color:${INK};margin:0 auto;max-width:24ch;">${lead}</h2>
      ${bullets}
    </div>
  </section>`;
}

/** "The simple formula" — unique mechanism panel (always generated). */
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

/** Curriculum accordion (always generated for sales). */
function curriculumSection(content: LandingPageContent): string {
  const rows = (Array.isArray(content.curriculum) ? content.curriculum : []).filter((c) => ok(c?.title)).slice(0, 12);
  if (rows.length === 0) return "";
  const items = rows.map((r) => `
        <details style="border:1px solid ${CARD_LINE};border-radius:12px;margin:0 0 12px;background:${WHITE};overflow:hidden;">
          <summary style="list-style:none;cursor:pointer;padding:18px 22px;display:flex;align-items:center;gap:12px;font-family:${SERIF};font-weight:600;font-size:17px;color:${INK};">
            ${ok(r.emoji) ? `<span aria-hidden="true" style="font-size:20px;">${esc(r.emoji)}</span>` : ""}<span style="flex:1;">${esc(r.title)}</span><span aria-hidden="true" style="color:${INK_SOFT};font-size:14px;">&#9662;</span>
          </summary>
        </details>`).join("");
  return `
  <section style="background:${WHITE};padding:64px 24px;">
    <div style="max-width:720px;margin:0 auto;">
      <h2 style="font-family:${SERIF};font-weight:600;font-size:clamp(26px,3vw,38px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 28px;">What&#39;s inside</h2>
      ${items}
    </div>
  </section>`;
}

/** "You'll build systems for" tile grid (systemTiles). */
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
  <section style="background:${IVORY};padding:64px 24px;">
    <div style="max-width:1120px;margin:0 auto;">
      <h2 style="font-family:${SERIF};font-weight:600;font-size:clamp(26px,3vw,38px);line-height:1.15;color:${INK};text-align:center;margin:0 auto 28px;max-width:22ch;">You&#39;ll build systems for</h2>
      <div style="display:flex;flex-wrap:wrap;gap:18px;justify-content:center;">${cells}</div>
    </div>
  </section>`;
}

/** The coach's own story — the credential that carries a low-proof page. Omits when absent (never faked). */
function founderSection(content: LandingPageContent, coach: SalesLightCoachInput): string {
  const name = ok(coach.coachName) ? esc(coach.coachName) : "";
  const bio = ok(coach.coachBackground) ? esc(coach.coachBackground) : "";
  if (!name && !bio) return "";
  const portrait = imgOrOmit(coach.headshotUrl, coach.coachName || "Your instructor",
    "width:200px;height:240px;border-radius:16px;object-fit:cover;object-position:top center;flex-shrink:0;box-shadow:0 10px 28px rgba(27,22,36,0.10);");
  const pull = ok(content.shockingStat) ? esc(content.shockingStat) : ok(content.insiderAdvantages) ? esc(content.insiderAdvantages) : "";
  return `
  <section style="background:${WHITE};padding:64px 24px;">
    <div style="max-width:960px;margin:0 auto;display:flex;flex-wrap:wrap;gap:40px;align-items:center;justify-content:center;">
      ${portrait}
      <div style="flex:1 1 420px;min-width:300px;">
        <div style="font-family:${S};font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${CORAL};margin:0 0 10px;">Who&#39;s teaching this</div>
        ${name ? `<h2 style="font-family:${SERIF};font-weight:600;font-size:clamp(24px,2.6vw,34px);color:${INK};margin:0 0 16px;">Hi, I&#39;m ${name}</h2>` : ""}
        ${bio ? `<p style="font-family:${S};font-weight:400;font-size:16px;line-height:1.65;color:${BODY};margin:0 0 ${pull ? "18px" : "0"};">${bio}</p>` : ""}
        ${pull ? `<p style="font-family:${SERIF};font-weight:600;font-style:italic;font-size:19px;line-height:1.4;color:${INK};border-left:3px solid ${CORAL};padding-left:16px;margin:0;">${pull}</p>` : ""}
      </div>
    </div>
  </section>`;
}

/** Guarantee (always generated). */
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

/** Offer / purchase card — real price only; absent → [INSERT_PRICE] → review-draft (identical to rich). */
function offerSection(content: LandingPageContent, coach: SalesLightCoachInput): string {
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

/** Bonuses — generated title + description; monetary value only when operator-supplied. */
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

/** FAQ (always generated). */
function faqSection(content: LandingPageContent): string {
  const faq = (Array.isArray(content.faq) ? content.faq : []).filter((f) => ok(f?.question)).slice(0, 8);
  if (faq.length === 0) return "";
  const items = faq.map((f) => `
        <details style="border-bottom:1px solid ${CARD_LINE};padding:6px 0;">
          <summary style="list-style:none;cursor:pointer;padding:16px 0;display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:${SERIF};font-weight:600;font-size:17px;color:${INK};"><span>${esc(f.question)}</span><span aria-hidden="true" style="color:${INK_SOFT};font-size:14px;flex-shrink:0;">&#9662;</span></summary>
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

/** Dedicated final CTA — closes on the offer (no proof needed). */
function finalCtaSection(content: LandingPageContent, coach: SalesLightCoachInput): string {
  const cta = ok(content.primaryCta) ? content.primaryCta : "Enrol Now";
  const head = ok(content.mainHeadline) ? esc(content.mainHeadline) : "Ready to start?";
  return `
  <section style="background:${INK};padding:72px 24px;">
    <div style="max-width:680px;margin:0 auto;text-align:center;">
      <h2 style="font-family:${SERIF};font-weight:600;font-size:clamp(26px,3.4vw,42px);line-height:1.15;color:${WHITE};margin:0 auto 22px;max-width:20ch;">${head}</h2>
      <a href="#sl-offer" style="display:inline-block;padding:16px 42px;font-family:${S};font-weight:600;font-size:17px;color:${CTA_TEXT};background:${CTA};border-radius:9999px;text-decoration:none;box-shadow:0 10px 28px rgba(93,205,241,0.3);">${esc(cta)}</a>
    </div>
  </section>`;
}

function footer(serviceName: string, coach: SalesLightCoachInput, year: number): string {
  const brand = ok(coach.coachName) ? esc(coach.coachName) : esc(serviceName || "The Academy");
  return `
  <footer style="background:${IVORY};border-top:1px solid ${CARD_LINE};padding:40px 24px;text-align:center;">
    <div style="font-family:${S};font-size:13px;color:${INK_SOFT};line-height:1.9;">
      &copy; ${year} ${brand}. All rights reserved.<br>
      <a href="#" style="color:${INK_SOFT};text-decoration:none;">Privacy Policy</a> &middot; <a href="#" style="color:${INK_SOFT};text-decoration:none;">Terms &amp; Conditions</a>
    </div>
  </footer>`;
}

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
 * Proof-LIGHT sales page: header → hero → transformation → formula → curriculum → systems →
 * coach story → guarantee → offer(+price) → bonuses → FAQ → final CTA → footer. No testimonial wall,
 * no stats bar, no results grid — a composed, offer-and-method-forward page that stands on its own at
 * zero proof (the Auto-Mode / blank-slate default).
 */
export function buildSalesLightHtml(
  content: LandingPageContent,
  serviceName: string,
  coach: SalesLightCoachInput = {},
  nowYear = 2026,
): string {
  return renderDocument({
    title: content.mainHeadline || serviceName,
    fontHref: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap",
    bodyBg: WHITE,
    body: [
      header(coach, serviceName),
      heroSection(content, coach),
      transformationSection(content),
      formulaSection(content),
      curriculumSection(content),
      systemsGrid(content),
      founderSection(content, coach),
      guaranteeSection(content),
      offerSection(content, coach),
      bonusesSection(content),
      faqSection(content),
      finalCtaSection(content, coach),
      footer(serviceName, coach, nowYear),
      runtimeScript(),
    ].join("\n"),
  });
}
