/**
 * leadMagnetRenderer — turns a generated lead-magnet body (hvcoTitles.assetBody)
 * into branded, browser-rendered HTML. One HTML source of truth per magnet:
 *   - the DELIVERABLE page (guide / checklist / toolkit) is published to
 *     Cloudflare KV and is what the PDF is rendered from (identical bytes).
 *   - the OPT-IN page carries the capture form (consent + honeypot) and, on a
 *     successful submit, swaps in-place to a bridge that CONFIRMS, delivers the
 *     magnet (Read online + Download PDF), carries a tailored next-step CTA, and
 *     shows a social-proof slot where data exists.
 *
 * Design: minimalist, quieter register than the ad-image editorial style —
 * upright Fraunces headings, muted neutral palette, heavy white space, single
 * column, 17px body, cover / dividers / PDF page-numbers / consistent wordmark.
 *
 * Format-dispatch: renderDeliverableHtml switches on format so a QUIZ renderer
 * plugs in next sprint with no re-architecture. Quiz returns null today (out of
 * scope) so the publisher skips hosting/PDF for it.
 *
 * These are BROWSER-rendered pages (Chromium via CF), so they use a <style>
 * block + classes; fonts load via the public Google Fonts <link> already used in
 * production so CF Browser Rendering embeds the real faces.
 */
import type { LeadMagnetBody, GuideBody, ChecklistBody, ToolkitBody, NextStep, LeadMagnetFormat, ToolType } from "./leadMagnetContentGenerator";

// ── design tokens (minimalist: warm paper, ink, soft stone accent) ──
const INK = "#1c1a17";
const SEC = "#6d675e";
const HAIR = "#e7e2d8";
const PAPER = "#fbfaf7";
const ACC = "#8a8175";
const HEAD = "'Fraunces', Georgia, 'Times New Roman', serif";
const BODY = "'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">';

const FORMAT_NOUN: Record<LeadMagnetFormat, string> = { guide: "guide", checklist: "checklist", toolkit: "toolkit", quiz: "quiz" };
const TYPE_LABEL: Record<ToolType, string> = { swipe: "Swipe file", template: "Template", sop: "SOP", worksheet: "Worksheet", script: "Script", checklist: "Checklist" };

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function paras(text: string): string {
  return String(text ?? "")
    .split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p class="p">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

// Shared minimalist stylesheet. No @page margin — PDF page margins come from the
// Browser Rendering call (keeps content clear of the page-number footer).
function baseCss(extra = ""): string {
  return `
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{background:${PAPER};color:${INK};font-family:${BODY};font-size:17px;line-height:1.75;-webkit-font-smoothing:antialiased}
  .wrap{max-width:640px;margin:0 auto;padding:80px 40px 88px}
  .kick{font-weight:600;letter-spacing:.22em;text-transform:uppercase;font-size:12px;color:${ACC};margin:0 0 22px}
  .cover{min-height:74vh;display:flex;flex-direction:column;justify-content:center;page-break-after:always}
  h1{font-family:${HEAD};font-weight:600;font-size:40px;line-height:1.12;letter-spacing:-.01em;margin:0 0 24px}
  .promise{font-size:19px;line-height:1.65;color:${SEC};margin:0 0 30px;max-width:34em}
  .coverline{width:56px;height:2px;background:${INK};margin:6px 0 0}
  .mark{font-weight:600;letter-spacing:.04em;font-size:13px;color:${ACC};margin-top:auto;padding-top:40px}
  h2{font-family:${HEAD};font-weight:600;font-size:25px;line-height:1.2;margin:0 0 12px}
  .p{margin:0 0 16px;color:${INK}}
  .div{border:0;height:1px;background:${HAIR};margin:52px 0}
  .tag{font-weight:600;letter-spacing:.16em;text-transform:uppercase;font-size:11px;color:${ACC};margin:0 0 10px}
  .inst{color:${SEC};font-size:15px;margin:0 0 18px}
  .toolbody pre{white-space:pre-wrap;font-family:${BODY};font-size:16px;line-height:1.7;margin:0;color:${INK};page-break-inside:auto}
  .check{display:flex;gap:14px;align-items:flex-start;padding:16px 0;border-bottom:1px solid ${HAIR}}
  .check:last-child{border-bottom:0}
  .box{flex:0 0 20px;width:20px;height:20px;border:2px solid ${ACC};border-radius:6px;margin-top:3px}
  .check .label{font-weight:600;margin:0 0 3px}
  .check .detail{color:${SEC};font-size:15px;margin:0}
  .next{margin:64px 0 0;padding:34px 0 0;border-top:2px solid ${INK};page-break-inside:avoid}
  .next .kick{color:${ACC}}
  .next h2{margin:0 0 10px}
  .next p{color:${SEC};margin:0 0 20px}
  .cta{display:inline-block;border:1.5px solid ${INK};border-radius:9999px;padding:13px 28px;font-weight:600;font-size:16px;color:${INK};text-decoration:none}
  .foot{color:${ACC};font-size:12px;text-align:center;margin:72px 0 0;letter-spacing:.03em}
  ${extra}`;
}

function shell(title: string, inner: string, extraCss = ""): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>${FONT_LINK}
<style>${baseCss(extraCss)}</style></head><body>${inner}</body></html>`;
}

function cover(kicker: string, title: string, promise: string): string {
  return `<div class="cover"><p class="kick">${esc(kicker)}</p><h1>${esc(title)}</h1>` +
    `<p class="promise">${esc(promise)}</p><div class="coverline"></div><div class="mark">ZAP CAMPAIGNS</div></div>`;
}
function nextStepBlock(n: NextStep): string {
  if (!n) return "";
  return `<section class="next"><p class="kick">Your next step</p><h2>${esc(n.heading)}</h2>` +
    `<p>${esc(n.body)}</p><a class="cta" href="#">${esc(n.ctaLabel)}</a></section>`;
}
const FOOT = `<p class="foot">Created with ZAP Campaigns</p>`;

function renderGuide(b: GuideBody): string {
  const sections = (b.sections || []).map((s, i) =>
    `<section><h2>${esc(s.heading)}</h2>${paras(s.body)}</section>${i < b.sections.length - 1 ? '<hr class="div">' : ""}`).join("");
  return `<div class="wrap">${cover("Guide", b.title, b.promise)}${sections}${nextStepBlock(b.nextStep)}${FOOT}</div>`;
}
function renderChecklist(b: ChecklistBody): string {
  const items = (b.items || []).map(i =>
    `<div class="check"><div class="box"></div><div><p class="label">${esc(i.label)}</p><p class="detail">${esc(i.detail)}</p></div></div>`).join("");
  return `<div class="wrap">${cover("Checklist", b.title, b.promise)}<div>${items}</div>${nextStepBlock(b.nextStep)}${FOOT}</div>`;
}
function renderToolkit(b: ToolkitBody): string {
  const tools = (b.tools || []).map((t, i) =>
    `<section class="tool"><div class="tag">${esc(TYPE_LABEL[t.type] || t.type)}</div><h2>${esc(t.name)}</h2>` +
    `<p class="inst">${esc(t.instructions)}</p><div class="toolbody"><pre>${esc(t.content)}</pre></div></section>` +
    `${i < b.tools.length - 1 ? '<hr class="div">' : ""}`).join("");
  return `<div class="wrap">${cover("Toolkit", b.title, b.promise)}${tools}${nextStepBlock(b.nextStep)}${FOOT}</div>`;
}

/**
 * Render the branded deliverable page for a magnet body. Format-dispatch so the
 * quiz renderer plugs in next sprint. Returns null for quiz (out of scope now).
 */
export function renderDeliverableHtml(body: LeadMagnetBody): string | null {
  switch (body.format) {
    case "guide": return shell(body.title, renderGuide(body));
    case "checklist": return shell(body.title, renderChecklist(body));
    case "toolkit": return shell(body.title, renderToolkit(body));
    case "quiz": return null; // next sprint (interactive scored surface)
    default: return null;
  }
}

// ── opt-in page (capture form + consent + honeypot) with upgraded bridge ──
export interface OptInTestimonial { quote: string; name: string; title: string; }
export interface OptInPageOpts {
  title: string;
  format: LeadMagnetFormat;   // drives the tight, type-aware CTA label
  promise: string;
  slug: string;               // deliverable slug echoed to /api/capture-lead
  hvcoId: number;
  deliverableUrl: string;
  pdfUrl: string;
  privacyPolicyUrl: string;
  apiBase: string;            // same-origin fetch base
  nextStep: NextStep;         // tailored next step on the bridge
  testimonial?: OptInTestimonial | null; // social-proof slot (hidden if absent)
}

export function renderOptInHtml(o: OptInPageOpts): string {
  const noun = FORMAT_NOUN[o.format] || "resource";
  const submitLabel = `Send me the ${noun}`;
  const cfg = JSON.stringify({
    slug: o.slug, hvcoId: o.hvcoId, endpoint: `${o.apiBase}/api/capture-lead`,
    deliverableUrl: o.deliverableUrl, pdfUrl: o.pdfUrl,
  });
  const proof = o.testimonial && o.testimonial.quote
    ? `<figure class="proof"><blockquote>&ldquo;${esc(o.testimonial.quote)}&rdquo;</blockquote>` +
      `<figcaption>${esc(o.testimonial.name)}${o.testimonial.title ? ` &middot; ${esc(o.testimonial.title)}` : ""}</figcaption></figure>`
    : "";

  const css = `
  .wrap{max-width:560px}
  .form{background:#fff;border:1px solid ${HAIR};border-radius:16px;padding:26px 26px 24px;margin:26px 0 0}
  .form label{display:block;font-weight:600;font-size:14px;margin:0 0 6px}
  .form input[type=email],.form input[type=text]{width:100%;padding:13px 14px;font-family:${BODY};font-size:16px;border:1px solid ${HAIR};border-radius:10px;margin:0 0 16px;background:${PAPER};color:${INK}}
  .consent{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:${SEC};margin:2px 0 18px}
  .consent input{margin-top:3px}.consent a{color:${INK}}
  .btn{width:100%;border:0;cursor:pointer;background:${INK};color:${PAPER};font-family:${BODY};font-weight:600;font-size:17px;padding:15px 20px;border-radius:9999px}
  .btn:disabled{opacity:.6;cursor:default}
  .err{color:#b02a2a;font-size:14px;margin:12px 0 0;min-height:1px}
  .hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
  .proof{margin:30px 0 0;padding:22px 24px;background:#fff;border:1px solid ${HAIR};border-radius:16px}
  .proof blockquote{font-family:${HEAD};font-weight:400;font-size:19px;line-height:1.5;margin:0 0 10px;color:${INK}}
  .proof figcaption{font-size:13px;color:${ACC};font-weight:600;letter-spacing:.02em}
  .bridge{display:none;margin:26px 0 0}
  .bridge .card{background:#fff;border:1px solid ${HAIR};border-radius:16px;padding:32px 28px;text-align:center}
  .bridge h2{margin:0 0 8px}
  .bridge .sub{color:${SEC};margin:0 0 22px}
  .dl{display:inline-block;margin:6px 6px 0;padding:14px 26px;border-radius:9999px;font-weight:600;font-size:16px;text-decoration:none}
  .dl.primary{background:${INK};color:${PAPER}}
  .dl.secondary{background:${PAPER};color:${INK};border:1px solid ${HAIR}}
  .nextcard{margin:18px 0 0;padding:26px 24px;background:${PAPER};border:1px solid ${HAIR};border-radius:16px;text-align:left}
  .nextcard .kick{color:${ACC};margin:0 0 10px}
  .nextcard h3{font-family:${HEAD};font-weight:600;font-size:21px;margin:0 0 8px}
  .nextcard p{color:${SEC};margin:0 0 18px}`;

  const nextData = JSON.stringify({ heading: o.nextStep?.heading || "", body: o.nextStep?.body || "", ctaLabel: o.nextStep?.ctaLabel || "" });

  const inner = `<div class="wrap">
  <p class="kick">Free ${esc(noun)}</p>
  <h1>${esc(o.title)}</h1>
  <p class="promise">${esc(o.promise)}</p>
  <form class="form" id="optin" autocomplete="on">
    <label for="lm_name">First name <span style="color:${SEC};font-weight:400">(optional)</span></label>
    <input type="text" id="lm_name" name="lm_name" placeholder="Your first name">
    <label for="lm_email">Email</label>
    <input type="email" id="lm_email" name="lm_email" required placeholder="you@example.com">
    <div class="hp" aria-hidden="true"><label>Leave this empty<input type="text" id="lm_website" name="lm_website" tabindex="-1" autocomplete="off"></label></div>
    <label class="consent"><input type="checkbox" id="lm_consent" required>
      <span>I agree to receive this ${esc(noun)} and related emails, and accept the <a href="${esc(o.privacyPolicyUrl)}" target="_blank" rel="noopener">privacy policy</a>.</span></label>
    <button class="btn" type="submit" id="lm_submit">${esc(submitLabel)}</button>
    <p class="err" id="lm_err"></p>
  </form>
  ${proof}
  <div class="bridge" id="bridge">
    <div class="card">
      <p class="kick">You're in</p>
      <h2>Your ${esc(noun)} is ready</h2>
      <p class="sub">Open it now or download the PDF — we've also emailed you the link.</p>
      <a class="dl primary" id="lm_view" href="#" target="_blank" rel="noopener">Read online</a>
      <a class="dl secondary" id="lm_pdf" href="#" target="_blank" rel="noopener">Download PDF</a>
    </div>
    <div class="nextcard" id="nextcard" style="display:none">
      <p class="kick">Your next step</p>
      <h3 id="next_heading"></h3>
      <p id="next_body"></p>
      <a class="dl primary" id="next_cta" href="#" target="_blank" rel="noopener"></a>
    </div>
  </div>
  <p class="foot">Created with ZAP Campaigns</p></div>
<script>
(function(){
  var CFG = ${cfg}; var NEXT = ${nextData};
  var f = document.getElementById('optin'), err = document.getElementById('lm_err'), btn = document.getElementById('lm_submit');
  f.addEventListener('submit', function(e){
    e.preventDefault(); err.textContent = '';
    var email = document.getElementById('lm_email').value.trim();
    var consent = document.getElementById('lm_consent').checked;
    if (!email) { err.textContent = 'Please enter your email.'; return; }
    if (!consent) { err.textContent = 'Please accept the privacy policy to continue.'; return; }
    btn.disabled = true; btn.textContent = 'Sending…';
    fetch(CFG.endpoint, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ slug:CFG.slug, hvcoId:CFG.hvcoId, email:email,
        name: document.getElementById('lm_name').value.trim(), consent:consent,
        website: document.getElementById('lm_website').value }) })
      .then(function(r){ return r.json().catch(function(){ return {}; }); })
      .then(function(d){
        var view = (d && d.magnetHtmlUrl) || CFG.deliverableUrl;
        var pdf = (d && d.magnetPdfUrl) || CFG.pdfUrl;
        document.getElementById('lm_view').href = view;
        var pdfEl = document.getElementById('lm_pdf');
        if (pdf) { pdfEl.href = pdf; } else { pdfEl.style.display = 'none'; }
        if (NEXT.heading) {
          document.getElementById('next_heading').textContent = NEXT.heading;
          document.getElementById('next_body').textContent = NEXT.body;
          var c = document.getElementById('next_cta'); c.textContent = NEXT.ctaLabel || 'Learn more'; c.href = view;
          document.getElementById('nextcard').style.display = 'block';
        }
        f.style.display = 'none';
        var p = document.querySelector('.proof'); if (p) p.style.display = 'none';
        document.getElementById('bridge').style.display = 'block';
      })
      .catch(function(){ err.textContent = 'Something went wrong. Please try again.'; btn.disabled = false; btn.textContent = ${JSON.stringify(submitLabel)}; });
  });
})();
</script>`;
  return shell(o.title, inner, css);
}
