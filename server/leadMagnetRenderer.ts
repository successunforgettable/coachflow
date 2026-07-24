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
import type { LeadMagnetBody, GuideBody, ChecklistBody, ToolkitBody, QuizBody, NextStep, LeadMagnetFormat, ToolType } from "./leadMagnetContentGenerator";

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
    .map(p => `<p class="p">${inlineMd(esc(p).replace(/\n/g, "<br>"))}</p>`).join("");
}

// ── in-house markdown → HTML (no dependency) ────────────────────────────────
// The generator emits well-structured markdown (## headings, **bold**, | tables |, --- rules, - lists) plus
// [BRACKET] fill-in prompts. Rendering it as HTML (not a raw <pre> dump) is the fix for the "very confusing"
// bonus documents. Inline formatting runs on ALREADY-ESCAPED text, so it can never inject markup.
function inlineMd(escaped: string): string {
  return escaped
    // **bold** first (before single-asterisk italic)
    .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\b_([^_\n]+?)_\b/g, "<em>$1</em>")
    // [FILL-IN PROMPT] → a distinct fill-in chip the reader can see they complete. Kept AFTER emphasis so a
    // bracket's inner text isn't mangled. &#39;/&quot; etc are already escaped; brackets are literal here.
    .replace(/\[([^\]\n]{1,80})\]/g, '<span class="fillin">[$1]</span>');
}

function mdInlinePlusBreaks(raw: string): string {
  return inlineMd(esc(raw)).replace(/\n/g, "<br>");
}

// Line-based markdown → HTML. Deliberately small and deterministic — the subset the generator produces (headings,
// bold/italic, ordered & unordered lists, tables, rules, blockquotes, [BRACKET] fill-ins). Line-based (not
// blank-line-block) so a heading that is immediately followed by content on the next line still renders as a
// heading rather than leaking its literal "##".
const RE_HEADING = /^\s*(#{1,6})\s+(.+?)\s*$/;
const RE_HR = /^\s*([-*_])\1{2,}\s*$/;
const RE_ULI = /^\s*([-*+]|[☐☑✅])\s+/;
const RE_OLI = /^\s*\d+[.)]\s+/;
const RE_TABLE_SEP = /^\s*\|?[\s:|-]+\|?\s*$/;

function mdToHtml(src: string): string {
  const text = String(src ?? "").replace(/\r\n?/g, "\n").replace(/\n+$/g, "");
  if (!text.trim()) return "";
  const lines = text.split("\n");
  const out: string[] = [];

  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  const flushPara = () => { if (para.length) { out.push(`<p class="md-p">${mdInlinePlusBreaks(para.join("\n"))}</p>`); para = []; } };
  const flushList = () => { if (list) { const t = list.type; out.push(`<${t} class="md-${t}">${list.items.map(i => `<li>${inlineMd(esc(i))}</li>`).join("")}</${t}>`); list = null; } };
  const flushAll = () => { flushPara(); flushList(); };
  const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) { flushAll(); continue; }

    // table: a "| … |" row immediately followed by a |---| separator row
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && RE_TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      flushAll();
      const head = cells(line);
      const bodyRows: string[] = [];
      let j = i + 2;
      for (; j < lines.length && lines[j].includes("|") && lines[j].trim(); j++) bodyRows.push(lines[j]);
      const th = head.map(c => `<th>${inlineMd(esc(c))}</th>`).join("");
      const tb = bodyRows.map(r => `<tr>${cells(r).map(c => `<td>${inlineMd(esc(c))}</td>`).join("")}</tr>`).join("");
      out.push(`<table class="md-table"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`);
      i = j - 1;
      continue;
    }

    if (RE_HR.test(line)) { flushAll(); out.push('<hr class="md-hr">'); continue; }

    const h = line.match(RE_HEADING);
    if (h) { flushAll(); const cls = h[1].length <= 2 ? "md-h3" : "md-h4"; out.push(`<p class="${cls}">${inlineMd(esc(h[2]))}</p>`); continue; }

    if (RE_ULI.test(line)) { flushPara(); if (!list || list.type !== "ul") { flushList(); list = { type: "ul", items: [] }; } list.items.push(line.replace(RE_ULI, "")); continue; }
    if (RE_OLI.test(line)) { flushPara(); if (!list || list.type !== "ol") { flushList(); list = { type: "ol", items: [] }; } list.items.push(line.replace(RE_OLI, "")); continue; }

    if (/^\s*>\s?/.test(line)) { flushPara(); flushList(); out.push(`<blockquote class="md-q">${inlineMd(esc(line.replace(/^\s*>\s?/, "")))}</blockquote>`); continue; }

    // plain text — accumulate into the current paragraph (ends a list)
    flushList();
    para.push(line);
  }
  flushAll();
  return `<div class="md">${out.join("")}</div>`;
}

// "How to use this" orientation block — rendered right after the cover so the reader immediately knows what the
// document is, how to use it, and what it achieves. Omitted when the body carries no howToUse.
function howToUseBlock(howToUse?: string | null): string {
  if (!howToUse || !String(howToUse).trim()) return "";
  return `<section class="howto"><p class="tag">How to use this</p>${mdToHtml(String(howToUse))}</section>`;
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
  /* Cover flows naturally and sits a deliberate distance above the first section
     (no forced viewport-height centering — that stranded content top+bottom and
     opened a dead void before the first section). page-break-after keeps the PDF
     cover on its own page; the margin is the designed gap for the online read. */
  .cover{padding:6px 0 0;margin:0 0 60px;page-break-after:always}
  h1{font-family:${HEAD};font-weight:600;font-size:40px;line-height:1.12;letter-spacing:-.01em;margin:0 0 24px}
  .promise{font-size:19px;line-height:1.65;color:${SEC};margin:0 0 30px;max-width:34em}
  .coverline{width:56px;height:2px;background:${INK};margin:6px 0 0}
  /* Brand slot (cover): coach logo when present, otherwise nothing — no ZAP stamp
     on the coach's asset. brand-capture drops a real logo URL into this slot. */
  .brandmark{margin:34px 0 0}
  .brandmark img{display:block;max-height:46px;width:auto}
  h2{font-family:${HEAD};font-weight:600;font-size:25px;line-height:1.2;margin:0 0 12px}
  .p{margin:0 0 16px;color:${INK}}
  .div{border:0;height:1px;background:${HAIR};margin:52px 0}
  .tag{font-weight:600;letter-spacing:.16em;text-transform:uppercase;font-size:11px;color:${ACC};margin:0 0 10px}
  .inst{color:${SEC};font-size:15px;margin:0 0 18px}
  .toolbody pre{white-space:pre-wrap;font-family:${BODY};font-size:16px;line-height:1.7;margin:0;color:${INK};page-break-inside:auto}
  /* Rendered markdown (tool content + howToUse): real headings, lists, tables — never a raw markdown dump. */
  .md{font-size:16px;line-height:1.7;color:${INK}}
  .md-h3{font-family:${HEAD};font-weight:600;font-size:18px;line-height:1.3;margin:22px 0 8px;color:${INK}}
  .md-h4{font-weight:600;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${ACC};margin:20px 0 8px}
  .md-p{margin:0 0 14px}
  .md-ul,.md-ol{margin:0 0 14px;padding-left:22px}
  .md-ul li,.md-ol li{margin:0 0 7px;padding-left:2px}
  .md-hr{border:0;height:1px;background:${HAIR};margin:20px 0}
  .md-q{margin:0 0 14px;padding:2px 0 2px 16px;border-left:3px solid ${HAIR};color:${SEC};font-style:italic}
  .md-table{width:100%;border-collapse:collapse;margin:6px 0 18px;font-size:14px;page-break-inside:auto}
  .md-table th{text-align:left;font-weight:600;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${ACC};border-bottom:2px solid ${HAIR};padding:8px 10px 8px 0;vertical-align:top}
  .md-table td{border-bottom:1px solid ${HAIR};padding:9px 10px 9px 0;vertical-align:top;color:${INK}}
  /* Fill-in prompt chip — makes [BRACKETED] fields read as something the reader completes, not body prose. */
  .fillin{background:#f2ede2;border:1px solid ${HAIR};border-radius:5px;padding:0 5px;font-weight:600;font-size:.92em;color:${ACC};white-space:normal}
  /* "How to use this" orientation block, right under the cover. */
  .howto{background:#fff;border:1px solid ${HAIR};border-radius:14px;padding:22px 24px;margin:0 0 44px}
  .howto .tag{margin:0 0 10px}
  .howto .md{font-size:16px}
  .howto .md-p:last-child{margin-bottom:0}
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
  /* Footer brand: coach logo when present, otherwise the footer is omitted
     entirely — the coach's deliverable is never signed with ZAP's name. */
  .foot{text-align:center;margin:72px 0 0}
  .foot img{display:inline-block;max-height:30px;width:auto;opacity:.8}
  ${extra}`;
}

function shell(title: string, inner: string, extraCss = ""): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>${FONT_LINK}
<style>${baseCss(extraCss)}</style></head><body>${inner}</body></html>`;
}

// Brand slot: a coach logo when one is supplied, otherwise nothing. The magnet is
// the coach's asset, so it is never stamped with ZAP's name. brand-capture (its own
// sprint) will populate coachLogoUrl from coachAssets(assetType='logo'); the slot,
// sizing and layout are ready so a real logo drops in with no re-work.
function brandMark(coachLogoUrl?: string | null): string {
  if (!coachLogoUrl) return "";
  return `<div class="brandmark"><img src="${esc(coachLogoUrl)}" alt=""></div>`;
}
function foot(coachLogoUrl?: string | null): string {
  if (!coachLogoUrl) return "";
  return `<div class="foot"><img src="${esc(coachLogoUrl)}" alt=""></div>`;
}
function cover(kicker: string, title: string, promise: string, coachLogoUrl?: string | null): string {
  return `<div class="cover"><p class="kick">${esc(kicker)}</p><h1>${esc(title)}</h1>` +
    `<p class="promise">${esc(promise)}</p><div class="coverline"></div>${brandMark(coachLogoUrl)}</div>`;
}
function nextStepBlock(n: NextStep): string {
  if (!n) return "";
  return `<section class="next"><p class="kick">Your next step</p><h2>${esc(n.heading)}</h2>` +
    `<p>${esc(n.body)}</p><a class="cta" href="#">${esc(n.ctaLabel)}</a></section>`;
}

function renderGuide(b: GuideBody, logo?: string | null): string {
  const sections = (b.sections || []).map((s, i) =>
    `<section><h2>${esc(s.heading)}</h2>${paras(s.body)}</section>${i < b.sections.length - 1 ? '<hr class="div">' : ""}`).join("");
  return `<div class="wrap">${cover("Guide", b.title, b.promise, logo)}${howToUseBlock(b.howToUse)}${sections}${nextStepBlock(b.nextStep)}${foot(logo)}</div>`;
}
function renderChecklist(b: ChecklistBody, logo?: string | null): string {
  const items = (b.items || []).map(i =>
    `<div class="check"><div class="box"></div><div><p class="label">${inlineMd(esc(i.label))}</p><p class="detail">${inlineMd(esc(i.detail))}</p></div></div>`).join("");
  return `<div class="wrap">${cover("Checklist", b.title, b.promise, logo)}${howToUseBlock(b.howToUse)}<div>${items}</div>${nextStepBlock(b.nextStep)}${foot(logo)}</div>`;
}
function renderToolkit(b: ToolkitBody, logo?: string | null): string {
  const tools = (b.tools || []).map((t, i) =>
    `<section class="tool"><div class="tag">${esc(TYPE_LABEL[t.type] || t.type)}</div><h2>${esc(t.name)}</h2>` +
    `<p class="inst">${esc(t.instructions)}</p><div class="toolbody">${mdToHtml(t.content)}</div></section>` +
    `${i < b.tools.length - 1 ? '<hr class="div">' : ""}`).join("");
  return `<div class="wrap">${cover("Toolkit", b.title, b.promise, logo)}${howToUseBlock(b.howToUse)}${tools}${nextStepBlock(b.nextStep)}${foot(logo)}</div>`;
}

export interface RenderDeliverableOpts {
  /** Coach logo URL for the brand slot. Absent today (brand-capture not shipped),
   *  so the wordmark is simply omitted rather than showing ZAP's name. */
  coachLogoUrl?: string | null;
}

/**
 * Render the branded deliverable page for a magnet body. Format-dispatch so the
 * quiz renderer plugs in next sprint. Returns null for quiz (out of scope now).
 */
export function renderDeliverableHtml(body: LeadMagnetBody, opts: RenderDeliverableOpts = {}): string | null {
  const logo = opts.coachLogoUrl ?? null;
  switch (body.format) {
    case "guide": return shell(body.title, renderGuide(body, logo));
    case "checklist": return shell(body.title, renderChecklist(body, logo));
    case "toolkit": return shell(body.title, renderToolkit(body, logo));
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
  coachLogoUrl?: string | null; // brand slot; omitted (no ZAP stamp) until brand-capture
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
  ${foot(o.coachLogoUrl)}</div>
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

// ── quiz page (interactive readiness scorecard, gate-at-result, one KV page) ──
// Unlike the static formats (separate opt-in + deliverable pages), a quiz is ONE
// self-contained page: take the scorecard → client-side scoring → teaser → email
// gate → personalised result. Same premium minimalist bar (shell/baseCss); mobile
// spec baked in (one question per screen, auto-advance, >=44px targets, 16px
// inputs, single column, progress bar, back-nav, sessionStorage save-progress).
export interface QuizPageOpts {
  body: QuizBody;
  slug: string;
  hvcoId: number;
  privacyPolicyUrl: string;
  apiBase: string;                       // same-origin fetch base
  pageUrl: string;                       // this page's own URL (interim CTA target until booking-URL capture)
  testimonial?: OptInTestimonial | null; // social-proof slot on the result (hidden if absent)
  coachLogoUrl?: string | null;          // brand slot; omitted (no ZAP stamp) until brand-capture
}

// Embed data in a <script> safely: JSON with < escaped so a "</script>" inside any
// generated string can never break out of the script element.
function jsData(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c");
}

export function renderQuizPage(o: QuizPageOpts): string {
  const b = o.body;
  const maxScore = (b.questions || []).reduce(
    (s, q) => s + Math.max(0, ...(q.options || []).map(op => op.weight || 0)), 0);
  const quizData = jsData({
    questions: (b.questions || []).map(q => ({
      question: q.question,
      options: (q.options || []).map(op => ({ label: op.label, weight: op.weight })),
    })),
    bands: (b.scoring?.bands || []).map(bd => ({
      name: bd.name, minPercent: bd.minPercent, maxPercent: bd.maxPercent,
      teaser: bd.teaser, meaning: bd.meaning, cta: bd.cta,
    })),
    max: maxScore,
  });
  const cfg = jsData({
    slug: o.slug, hvcoId: o.hvcoId, endpoint: `${o.apiBase}/api/capture-lead`, pageUrl: o.pageUrl,
  });
  const proof = o.testimonial && o.testimonial.quote
    ? `<figure class="proof"><blockquote>&ldquo;${esc(o.testimonial.quote)}&rdquo;</blockquote>` +
      `<figcaption>${esc(o.testimonial.name)}${o.testimonial.title ? ` &middot; ${esc(o.testimonial.title)}` : ""}</figcaption></figure>`
    : "";

  const css = `
  .wrap{max-width:560px}
  .qz-screen{animation:qzfade .25s ease}
  @keyframes qzfade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .qz-prog{height:6px;background:${HAIR};border-radius:9999px;margin:0 0 30px;overflow:hidden;display:none}
  .qz-bar{height:100%;background:${INK};width:0;transition:width .25s ease}
  .qz-count{font-weight:600;letter-spacing:.14em;text-transform:uppercase;font-size:12px;color:${ACC};margin:0 0 14px}
  .qz-q{font-family:${HEAD};font-weight:600;font-size:26px;line-height:1.28;margin:0 0 24px}
  .qz-opts{display:flex;flex-direction:column;gap:12px}
  .qz-opt{display:block;width:100%;text-align:left;min-height:56px;padding:16px 18px;font-family:${BODY};font-size:16px;line-height:1.5;color:${INK};background:#fff;border:1.5px solid ${HAIR};border-radius:14px;cursor:pointer;transition:border-color .12s,background .12s}
  .qz-opt:hover{border-color:${ACC}}
  .qz-opt.sel{border-color:${INK};background:${PAPER}}
  .qz-back{margin:22px 0 0;background:none;border:0;color:${ACC};font-family:${BODY};font-weight:600;font-size:15px;cursor:pointer;padding:10px 0;min-height:44px}
  .btn{width:100%;border:0;cursor:pointer;background:${INK};color:${PAPER};font-family:${BODY};font-weight:600;font-size:17px;padding:16px 20px;border-radius:9999px;min-height:52px;margin:8px 0 0}
  .btn:disabled{opacity:.6;cursor:default}
  .form{background:#fff;border:1px solid ${HAIR};border-radius:16px;padding:24px 24px 22px;margin:24px 0 0}
  .form label.q{display:block;font-weight:600;font-size:15px;margin:0 0 10px}
  .form input[type=email]{width:100%;padding:14px;font-family:${BODY};font-size:16px;border:1px solid ${HAIR};border-radius:10px;margin:0 0 14px;background:${PAPER};color:${INK}}
  .consent{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:${SEC};margin:2px 0 16px}
  .consent input{margin-top:3px;width:18px;height:18px}.consent a{color:${INK}}
  .err{color:#b02a2a;font-size:14px;margin:12px 0 0;min-height:1px}
  .hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
  .qz-teaserband{font-family:${HEAD};font-weight:600;font-size:30px;line-height:1.15;margin:0 0 10px}
  .qz-resband{font-family:${HEAD};font-weight:600;font-size:40px;line-height:1.12;letter-spacing:-.01em;margin:0 0 20px}
  .qz-mean{font-size:18px;line-height:1.7;color:${INK};margin:0 0 8px}
  .proof{margin:30px 0 0;padding:22px 24px;background:#fff;border:1px solid ${HAIR};border-radius:16px}
  .proof blockquote{font-family:${HEAD};font-weight:400;font-size:19px;line-height:1.5;margin:0 0 10px;color:${INK}}
  .proof figcaption{font-size:13px;color:${ACC};font-weight:600;letter-spacing:.02em}
  .nextcard{margin:26px 0 0;padding:26px 24px;background:${PAPER};border:1px solid ${HAIR};border-radius:16px;text-align:left}
  .nextcard .kick{color:${ACC};margin:0 0 10px}
  .nextcard h3{font-family:${HEAD};font-weight:600;font-size:21px;margin:0 0 8px}
  .nextcard p{color:${SEC};margin:0 0 18px}
  .dl{display:inline-block;padding:14px 26px;border-radius:9999px;font-weight:600;font-size:16px;text-decoration:none;background:${INK};color:${PAPER}}`;

  const inner = `<div class="wrap">
  <div class="qz-prog" id="qz_prog"><div class="qz-bar" id="qz_bar"></div></div>

  <section class="qz-screen" id="qz_intro">
    ${brandMark(o.coachLogoUrl)}
    <p class="kick">Scorecard</p>
    <h1>${esc(b.title)}</h1>
    <p class="promise">${esc(b.promise)}</p>
    <button class="btn" id="qz_start" type="button">Start the scorecard</button>
  </section>

  <section class="qz-screen" id="qz_qs" style="display:none">
    <p class="qz-count" id="qz_count"></p>
    <h2 class="qz-q" id="qz_qtext"></h2>
    <div class="qz-opts" id="qz_opts"></div>
    <button class="qz-back" id="qz_back" type="button" style="display:none">&larr; Back</button>
  </section>

  <section class="qz-screen" id="qz_gate" style="display:none">
    <p class="kick">Your result</p>
    <h2 class="qz-teaserband" id="qz_tband"></h2>
    <p class="promise" id="qz_tteaser"></p>
    <form class="form" id="qz_form" autocomplete="on">
      <label class="q" for="qz_email">Enter your email to unlock your full result</label>
      <input type="email" id="qz_email" name="qz_email" inputmode="email" required placeholder="you@example.com">
      <div class="hp" aria-hidden="true"><label>Leave empty<input type="text" id="qz_website" tabindex="-1" autocomplete="off"></label></div>
      <label class="consent"><input type="checkbox" id="qz_consent" required>
        <span>I agree to receive my result and related emails, and accept the <a href="${esc(o.privacyPolicyUrl)}" target="_blank" rel="noopener">privacy policy</a>.</span></label>
      <button class="btn" type="submit" id="qz_submit">Show me my full result</button>
      <p class="err" id="qz_err"></p>
    </form>
  </section>

  <section class="qz-screen" id="qz_result" style="display:none">
    <p class="kick">Your result</p>
    <h1 class="qz-resband" id="qz_rband"></h1>
    <p class="qz-mean" id="qz_rmean"></p>
    <div class="nextcard" id="qz_ncard">
      <p class="kick">Your next step</p>
      <h3 id="qz_cta_h"></h3>
      <p id="qz_cta_b"></p>
      <a class="dl" id="qz_cta_a" href="#" target="_blank" rel="noopener"></a>
    </div>
    ${proof}
    ${foot(o.coachLogoUrl)}
  </section>
</div>
<script>
(function(){
  var QUIZ = ${quizData}; var CFG = ${cfg};
  var KEY = 'zapQuiz:' + CFG.slug;
  var answers = []; var idx = 0; var RESULT = null;
  try { var sv = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (sv && sv.answers) { answers = sv.answers; idx = sv.idx || 0; } } catch (e) {}

  var $ = function(id){ return document.getElementById(id); };
  var screens = ['qz_intro','qz_qs','qz_gate','qz_result'];
  function show(id){ screens.forEach(function(s){ $(s).style.display = s === id ? 'block' : 'none'; }); }
  function save(){ try { sessionStorage.setItem(KEY, JSON.stringify({ answers: answers, idx: idx })); } catch (e) {} }
  var prog = $('qz_prog'), bar = $('qz_bar');

  function renderQ(){
    var q = QUIZ.questions[idx];
    prog.style.display = 'block';
    bar.style.width = Math.round(((idx + 1) / QUIZ.questions.length) * 100) + '%';
    $('qz_count').textContent = 'Question ' + (idx + 1) + ' of ' + QUIZ.questions.length;
    $('qz_qtext').textContent = q.question;
    var box = $('qz_opts'); box.innerHTML = '';
    q.options.forEach(function(op, oi){
      var el = document.createElement('button');
      el.type = 'button'; el.className = 'qz-opt' + (answers[idx] && answers[idx].oi === oi ? ' sel' : '');
      el.textContent = op.label;
      el.addEventListener('click', function(){ choose(oi); });
      box.appendChild(el);
    });
    $('qz_back').style.display = idx > 0 ? 'inline-block' : 'none';
    show('qz_qs');
    window.scrollTo(0, 0);
  }
  function choose(oi){
    var q = QUIZ.questions[idx];
    answers[idx] = { oi: oi, question: q.question, answer: q.options[oi].label, weight: q.options[oi].weight };
    save();
    var btns = $('qz_opts').querySelectorAll('.qz-opt');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('sel', i === oi);
    setTimeout(function(){
      if (idx < QUIZ.questions.length - 1) { idx++; save(); renderQ(); }
      else { finish(); }
    }, 220);
  }
  function finish(){
    var sum = 0; for (var i = 0; i < QUIZ.questions.length; i++) { if (answers[i]) sum += answers[i].weight; }
    var pct = QUIZ.max > 0 ? Math.round((sum / QUIZ.max) * 100) : 0;
    var band = null;
    for (var j = 0; j < QUIZ.bands.length; j++) { var bd = QUIZ.bands[j]; if (pct >= bd.minPercent && pct <= bd.maxPercent) { band = bd; break; } }
    if (!band) band = QUIZ.bands[QUIZ.bands.length - 1];
    RESULT = { pct: pct, band: band };
    prog.style.display = 'none';
    $('qz_tband').textContent = band.name;
    $('qz_tteaser').textContent = band.teaser;
    show('qz_gate');
    window.scrollTo(0, 0);
  }
  function reveal(){
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    var band = RESULT.band;
    $('qz_rband').textContent = band.name;
    $('qz_rmean').textContent = band.meaning;
    $('qz_cta_h').textContent = band.cta.heading;
    $('qz_cta_b').textContent = band.cta.body;
    var a = $('qz_cta_a'); a.textContent = band.cta.ctaLabel || 'Learn more'; a.href = CFG.pageUrl || '#';
    show('qz_result');
    window.scrollTo(0, 0);
  }

  $('qz_start').addEventListener('click', function(){ idx = 0; answers = []; save(); renderQ(); });
  $('qz_back').addEventListener('click', function(){ if (idx > 0) { idx--; save(); renderQ(); } });

  $('qz_form').addEventListener('submit', function(e){
    e.preventDefault();
    var err = $('qz_err'); err.textContent = '';
    var email = $('qz_email').value.trim(); var consent = $('qz_consent').checked;
    if (!email) { err.textContent = 'Please enter your email.'; return; }
    if (!consent) { err.textContent = 'Please accept the privacy policy to continue.'; return; }
    var btn = $('qz_submit'); btn.disabled = true; btn.textContent = 'Unlocking…';
    var submission = answers.filter(Boolean).map(function(a){ return { question: a.question, answer: a.answer, weight: a.weight }; });
    fetch(CFG.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: CFG.slug, hvcoId: CFG.hvcoId, email: email, consent: consent,
        website: $('qz_website').value, submissionData: submission, resultBand: RESULT.band.name }) })
      .then(function(r){ return r.json().catch(function(){ return {}; }); })
      .then(function(){ reveal(); })
      .catch(function(){ err.textContent = 'Something went wrong. Please try again.'; btn.disabled = false; btn.textContent = 'Show me my full result'; });
  });

  // Resume mid-quiz on refresh; otherwise the intro shows by default.
  if (answers.filter(Boolean).length > 0) { renderQ(); }
})();
</script>`;
  return shell(b.title, inner, css);
}
