// D4: Two HTML templates for Cloudflare Workers KV deployment
// buildTextStyleHtml  — matches LandingPageVisualRenderer (dark charcoal, Inter, purple)
// buildVisualStyleHtml — matches LandingPageVisualTemplate (alternating sections, Montserrat, orange)
import type { LandingPageContent } from "../../drizzle/schema";

// ─── Shared helpers ───────────────────────────────────────────────────────────
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ok(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0 && !v.includes("[Generation incomplete");
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as Record<string, unknown>).length > 0;
  return true;
}

// Split text on \n — first line = heading, rest = body lines (same as JSX hb()/splitHeadingBody())
function hb(v: unknown): { heading: string; body: string[] } | null {
  if (!ok(v)) return null;
  const text = String(v ?? "");
  const lines = text.split("\n").filter(l => l.trim());
  if (!lines.length) return null;
  return { heading: lines[0], body: lines.slice(1) };
}

function jp<T>(v: unknown, fb: T): T {
  if (!v) return fb;
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return fb; } }
  return v as T;
}

// ─── TEXT STYLE HTML ─────────────────────────────────────────────────────────
// Matches LandingPageVisualRenderer: #1a1a1a bg, Inter font, #8B5CF6 purple accent
export function buildTextStyleHtml(content: LandingPageContent, serviceName: string): string {
  const F = "Inter, system-ui, sans-serif";
  const A = "#8B5CF6";
  const BG = "#1a1a1a";
  const TEXT = "#ffffff";
  const BODY = "#d1d5db";
  const SURFACE = "#222222";
  const BORDER = "#374151";
  const RED = "#ff3366";
  const YEAR = new Date().getFullYear();

  const quiz = jp<any>(content.quizSection, null);
  const testimonials = jp<any[]>(content.testimonials, []);
  const outline = jp<any[]>(content.consultationOutline, []);
  const faqRaw = jp<any[]>(content.faq, []);

  function section(inner: string, extra = ""): string {
    return `<section style="padding:32px 0;${extra}">${inner}</section>`;
  }
  function ctaBtn(label: string): string {
    return `<div style="text-align:center;margin-top:20px;"><a href="#" style="display:inline-block;font-family:${F};background:${A};color:#fff;border:none;border-radius:9999px;padding:14px 36px;font-size:16px;font-weight:600;text-decoration:none;cursor:pointer;">${esc(label)}</a></div>`;
  }
  function h2(text: string, color = TEXT): string {
    return `<h2 style="font-family:${F};font-size:clamp(24px,4vw,32px);font-weight:700;font-style:normal;color:${esc(color)};margin:0 0 20px;line-height:1.2;">${esc(text)}</h2>`;
  }
  function bodyP(text: string): string {
    return `<p style="font-family:${F};font-size:18px;color:${BODY};line-height:1.7;margin:0 0 16px;font-style:normal;">${esc(text)}</p>`;
  }
  function card(inner: string): string {
    return `<div style="background:${SURFACE};border:1px solid ${BORDER};border-radius:12px;padding:24px;margin-bottom:16px;">${inner}</div>`;
  }

  const parts: string[] = [];

  // 1. Hero
  if (ok(content.eyebrowHeadline) || ok(content.mainHeadline)) {
    parts.push(section(`
      <div style="text-align:center;display:flex;flex-direction:column;gap:16px;align-items:center;">
        ${ok(content.eyebrowHeadline) ? `<p style="font-family:${F};color:${RED};font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0;">${esc(content.eyebrowHeadline)}</p>` : ""}
        ${ok(content.mainHeadline) ? `<h1 style="font-family:${F};font-size:clamp(28px,5vw,48px);font-weight:700;line-height:1.15;margin:0;font-style:normal;color:${TEXT};">${esc(content.mainHeadline)}</h1>` : ""}
        ${ok(content.subheadline) ? `<p style="font-family:${F};font-size:18px;color:${BODY};max-width:48rem;margin:0;">${esc(content.subheadline)}</p>` : ""}
        ${ok(content.primaryCta) ? `<a href="#" style="display:inline-block;font-family:${F};background:${A};color:#fff;border:none;border-radius:9999px;padding:14px 36px;font-size:18px;font-weight:600;text-decoration:none;margin-top:8px;">${esc(content.primaryCta)}</a>` : ""}
      </div>`));
  }

  // 2. As Seen In
  if (ok(content.asSeenIn) && Array.isArray(content.asSeenIn)) {
    parts.push(section(`
      <div style="border-top:1px solid ${BORDER};border-bottom:1px solid ${BORDER};padding:32px 0;">
        <p style="text-align:center;color:#6b7280;font-family:${F};font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:24px;">As Seen In</p>
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:32px;">
          ${content.asSeenIn.map(s => `<span style="font-family:${F};color:#9ca3af;font-weight:600;font-size:16px;font-style:normal;">${esc(s)}</span>`).join("")}
        </div>
      </div>`));
  }

  // 3. Quiz
  if (quiz && ok(quiz.question)) {
    parts.push(section(`
      ${card(`
        ${h2(quiz.question, TEXT)}
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
          ${(quiz.options ?? []).map((opt: string, i: number) => `
            <div style="background:#2a2a2a;border:1px solid ${BORDER};border-radius:8px;padding:14px 16px;font-family:${F};color:${BODY};">
              <span style="font-weight:600;margin-right:10px;">${String.fromCharCode(65 + i)}.</span>${esc(opt)}
            </div>`).join("")}
        </div>
        ${ok(quiz.answer) ? `<div style="background:rgba(139,92,246,0.1);border:1px solid ${A};border-radius:8px;padding:14px 16px;"><p style="font-family:${F};color:${A};font-weight:600;margin:0;font-style:normal;">Answer: ${esc(quiz.answer)}</p></div>` : ""}`)}
    `));
  }

  // 4. Problem Agitation
  const prob = hb(content.problemAgitation);
  if (prob) {
    parts.push(section(`${h2(prob.heading)}${prob.body.map(bodyP).join("")}`));
  }

  // 5. Solution Intro
  const sol = hb(content.solutionIntro);
  if (sol) {
    parts.push(section(`${h2(sol.heading)}${sol.body.map(bodyP).join("")}`, `background:linear-gradient(135deg,rgba(88,28,135,0.2),rgba(131,24,67,0.2));border-radius:16px;padding:32px;`));
  }

  // 6. Why Old Fail
  const why = hb(content.whyOldFail);
  if (why) {
    parts.push(section(`${h2(why.heading, RED)}${why.body.map(bodyP).join("")}`));
  }

  // 7. Unique Mechanism
  const uniq = hb(content.uniqueMechanism);
  if (uniq) {
    parts.push(section(`${card(`${h2(uniq.heading, A)}${uniq.body.map(bodyP).join("")}`)}`));
  }

  // 8. Testimonials
  if (testimonials.length > 0) {
    parts.push(section(`
      ${h2("What Our Clients Say")}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;">
        ${testimonials.map((t: any) => card(`
          ${t.headline ? `<h3 style="font-family:${F};color:${A};font-size:18px;font-weight:700;font-style:normal;margin-bottom:12px;">${esc(t.headline)}</h3>` : ""}
          ${t.quote ? `<p style="font-family:${F};color:${BODY};font-style:italic;margin-bottom:12px;line-height:1.6;">"${esc(t.quote)}"</p>` : ""}
          <p style="font-family:${F};font-weight:600;margin:0 0 2px;font-size:14px;font-style:normal;color:${TEXT};">${esc(t.name ?? "")}</p>
          <p style="font-family:${F};color:#9ca3af;font-size:13px;margin:0;font-style:normal;">${esc(t.location ?? "")}</p>`)).join("")}
      </div>`));
  }

  // 9. Insider Advantages
  const adv = hb(content.insiderAdvantages);
  if (adv) {
    parts.push(section(`${card(`${h2(adv.heading)}${adv.body.map(bodyP).join("")}`, `background:linear-gradient(135deg,rgba(6,78,59,0.2),rgba(30,58,138,0.2));border-radius:16px;padding:32px;border:none;`)}`));
  }

  // 10. Scarcity / Urgency
  const scar = hb(content.scarcityUrgency);
  if (scar) {
    parts.push(section(`
      <div style="border:2px solid ${RED};border-radius:16px;padding:32px;">
        ${h2(scar.heading, RED)}${scar.body.map(bodyP).join("")}
      </div>`));
  }

  // 11. Shocking Stat
  if (ok(content.shockingStat)) {
    const statText = String(content.shockingStat);
    const bigNum = statText.match(/\d+%/)?.[0] ?? "";
    parts.push(section(`
      <div style="text-align:center;padding:32px 0;">
        ${bigNum ? `<div style="font-family:${F};font-size:clamp(36px,6vw,60px);font-weight:700;color:${RED};margin-bottom:12px;font-style:normal;">${esc(bigNum)}</div>` : ""}
        <p style="font-family:${F};font-size:20px;color:${BODY};max-width:40rem;margin:0 auto;font-style:normal;">${esc(statText)}</p>
      </div>`));
  }

  // 12. Time-Saving Benefit
  const tsb = hb(content.timeSavingBenefit);
  if (tsb) {
    parts.push(section(`${card(`${h2(tsb.heading)}${tsb.body.map(bodyP).join("")}`)}`));
  }

  // 13. Consultation Outline
  if (outline.length > 0) {
    parts.push(section(`
      ${h2("What You'll Get in Your FREE Consultation")}
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${outline.map((item: any, i: number) => `
          <div style="background:${SURFACE};border:1px solid ${BORDER};border-radius:12px;padding:20px;display:flex;gap:16px;align-items:flex-start;">
            <div style="flex-shrink:0;width:32px;height:32px;background:${A};border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:${F};font-weight:700;font-size:14px;color:#fff;">${i + 1}</div>
            <div>
              <h3 style="font-family:${F};font-size:18px;font-weight:700;font-style:normal;margin-bottom:6px;color:${TEXT};">${esc(item.title ?? "")}</h3>
              <p style="font-family:${F};color:${BODY};margin:0;line-height:1.6;font-style:normal;">${esc(item.description ?? "")}</p>
            </div>
          </div>`).join("")}
      </div>`));
  }

  // 14. Final CTA
  if (ok(content.primaryCta)) {
    parts.push(section(`
      <div style="text-align:center;padding:32px 0;">
        <h2 style="font-family:${F};font-size:32px;font-weight:700;font-style:normal;margin-bottom:20px;color:${TEXT};">Ready to Get Started?</h2>
        <a href="#" style="display:inline-block;font-family:${F};background:${A};color:#fff;border:none;border-radius:9999px;padding:16px 48px;font-size:20px;font-weight:600;text-decoration:none;font-style:normal;">${esc(content.primaryCta)}</a>
      </div>`));
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(content.mainHeadline || serviceName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>*{box-sizing:border-box;margin:0;padding:0;}body{background:${BG};color:${TEXT};}a{transition:opacity 0.15s;}a:hover{opacity:0.85;}</style>
</head>
<body>
  <nav style="background:#111;border-bottom:1px solid ${BORDER};padding:14px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;">
    <span style="font-family:${F};font-weight:700;font-size:18px;color:${TEXT};">${esc(serviceName)}</span>
    ${ok(content.primaryCta) ? `<a href="#" style="font-family:${F};font-size:13px;font-weight:600;color:#fff;background:${A};padding:9px 20px;border-radius:9999px;text-decoration:none;">${esc(content.primaryCta)}</a>` : ""}
  </nav>
  <div style="max-width:56rem;margin:0 auto;padding:48px 24px;display:flex;flex-direction:column;gap:64px;">
    ${parts.join("\n")}
  </div>
  <footer style="border-top:1px solid ${BORDER};padding:24px;text-align:center;">
    <p style="font-family:${F};font-size:13px;color:#6b7280;">© ${YEAR} ${esc(serviceName)}. All rights reserved.</p>
  </footer>
</body>
</html>`;
}

// ─── VISUAL STYLE HTML ───────────────────────────────────────────────────────
// Matches LandingPageVisualTemplate.tsx: alternating dark/light/white sections,
// Montserrat + Arial, orange #FE4500 gradient CTAs, 1170px max-width, coach page layout
interface CoachAssetOptions {
  headshotUrl?: string | null;
  logoUrl?: string | null;
  socialProofUrls?: string[];
  coachName?: string | null;
  coachBackground?: string | null;
}

export function buildVisualStyleHtml(
  content: LandingPageContent,
  serviceName: string,
  coach: CoachAssetOptions = {}
): string {
  const { headshotUrl = null, logoUrl = null, socialProofUrls = [], coachName = null, coachBackground = null } = coach;
  const DARK = "#000000";
  const LIGHT = "#f6f6f6";
  const WHITE = "#ffffff";
  const TEXT_DARK = "#ffffff";
  const TEXT_LIGHT = "#000000";
  const BODY_DARK = "#cccccc";
  const BODY_LIGHT = "#333333";
  const MUTED = "#999999";
  const A = "#FE4500";
  const MAX_W = "1170px";
  const H = "Arial, Helvetica, sans-serif";
  const B = "'Montserrat', Arial, sans-serif";
  const PAD = "60px 0";
  const YEAR = new Date().getFullYear();

  const gradient = `linear-gradient(90deg, ${A} 35%, #000 100%)`;

  const quiz = jp<any>(content.quizSection, null);
  const testimonials = jp<any[]>(content.testimonials, []);
  const outline = jp<any[]>(content.consultationOutline, []);
  const faqRaw = jp<any[]>(content.faq, []);
  const faqItems = faqRaw.map((f: any) => ({ q: f.question || f.q || "", a: f.answer || f.a || "" })).filter((f: any) => f.q);
  const asSeenIn = Array.isArray(content.asSeenIn) ? content.asSeenIn : [];

  const inner = `style="max-width:${MAX_W};margin:0 auto;padding:0 24px;width:100%;"`;

  let ctaIdx = 0;
  const CTA_LABELS = ["Register Now", "I'm Ready — Let's Go", "Start Building Today", "Reserve Your Spot", "Yes — I Want This", "Begin Your Journey", "Get Started Now"];
  function ctaBtn(dark = true): string {
    const label = ok(content.primaryCta) && ctaIdx === 0 ? String(content.primaryCta) : (CTA_LABELS[ctaIdx] ?? "Get Started Now");
    ctaIdx++;
    const textColor = dark ? TEXT_DARK : TEXT_LIGHT;
    return `<div style="text-align:center;margin-top:24px;"><a href="#" style="display:inline-block;font-family:${H};font-weight:700;font-style:normal;font-size:20px;background:${gradient};color:#fff;border:none;border-radius:8px;padding:18px 48px;text-decoration:none;line-height:1.3;">${esc(label)}</a></div>`;
  }
  function bulletCheck(text: string, dark = false): string {
    const col = dark ? BODY_DARK : BODY_LIGHT;
    return `<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;"><span style="font-family:${H};color:${A};font-size:18px;font-weight:700;font-style:normal;flex-shrink:0;line-height:1.5;">✓</span><p style="font-family:${B};font-weight:400;font-style:normal;font-size:18px;line-height:1.6;color:${col};margin:0;">${esc(text)}</p></div>`;
  }
  function bulletX(text: string): string {
    return `<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;"><span style="font-family:${H};color:#dc2626;font-size:18px;font-weight:700;font-style:normal;flex-shrink:0;line-height:1.5;">✕</span><p style="font-family:${B};font-weight:400;font-style:normal;font-size:18px;line-height:1.6;color:${BODY_LIGHT};margin:0;">${esc(text)}</p></div>`;
  }

  const sections: string[] = [];

  // NAV
  sections.push(`
  <nav style="background:${DARK};padding:16px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;border-bottom:1px solid #222;">
    ${logoUrl
      ? `<img src="${esc(logoUrl)}" alt="${esc(serviceName)}" style="height:40px;object-fit:contain;vertical-align:middle;">`
      : `<span style="font-family:${H};font-weight:700;font-style:normal;font-size:20px;color:${TEXT_DARK};">${esc(serviceName)}</span>`}
    ${ok(content.primaryCta) ? `<a href="#" style="font-family:${H};font-size:13px;font-weight:700;font-style:normal;color:#fff;background:${A};padding:10px 22px;border-radius:8px;text-decoration:none;">${esc(content.primaryCta)}</a>` : ""}
  </nav>`);

  // S1: HERO (DARK) — 2-col with headshot if available, else single-col centred
  if (ok(content.eyebrowHeadline) || ok(content.mainHeadline)) {
    const heroText = `
      <div style="flex:1 1 ${headshotUrl ? "55%" : "100%"};min-width:300px;${!headshotUrl ? "text-align:center;" : ""}">
        ${ok(content.eyebrowHeadline) ? `<p style="font-family:${B};color:${A};font-size:14px;font-weight:600;font-style:normal;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">${esc(content.eyebrowHeadline)}</p>` : ""}
        ${ok(content.mainHeadline) ? `<h1 style="font-family:${H};font-size:clamp(24px,3.5vw,36px);font-weight:700;font-style:normal;line-height:1.2;color:${TEXT_DARK};margin:0 0 20px;">${esc(content.mainHeadline)}</h1>` : ""}
        ${ok(content.subheadline) ? `<p style="font-family:${B};font-size:18px;font-weight:400;font-style:normal;color:${BODY_DARK};margin:0 0 28px;line-height:1.6;">${esc(content.subheadline)}</p>` : ""}
        ${ctaBtn(true)}
      </div>`;
    const heroPhoto = headshotUrl
      ? `<div style="flex:0 1 40%;min-width:260px;display:flex;justify-content:center;align-items:center;">
           <img src="${esc(headshotUrl)}" alt="${esc(coachName || "Coach")}" style="width:100%;max-width:420px;max-height:500px;border-radius:12px;object-fit:cover;border:6px solid #c9d1d9;">
         </div>`
      : "";
    sections.push(`
  <section style="background:${DARK};padding:${PAD};">
    <div style="max-width:${MAX_W};margin:0 auto;padding:0 24px;width:100%;display:flex;gap:40px;flex-wrap:wrap;align-items:center;">
      ${heroText}${heroPhoto}
    </div>
  </section>`);
  }

  // S2: PROBLEM AGITATION (LIGHT)
  const prob = hb(content.problemAgitation);
  if (prob) {
    sections.push(`
  <section style="background:${LIGHT};padding:${PAD};">
    <div ${inner}>
      <h2 style="font-family:${H};font-weight:700;font-style:normal;font-size:clamp(28px,3.5vw,42px);color:${TEXT_LIGHT};margin:0 0 24px;">${esc(prob.heading)}</h2>
      ${prob.body.map(p => bulletCheck(p, false)).join("")}
      ${ctaBtn(false)}
    </div>
  </section>`);
  }

  // S3: AS SEEN IN (WHITE) — placed after problem in visual style
  if (asSeenIn.length > 0) {
    sections.push(`
  <section style="background:${WHITE};padding:40px 0;border-top:1px solid #e0e0e0;border-bottom:1px solid #e0e0e0;">
    <div ${inner} style="text-align:center;">
      <p style="font-family:${B};font-size:12px;font-weight:700;font-style:normal;text-transform:uppercase;letter-spacing:0.1em;color:${MUTED};margin-bottom:20px;">As Seen In</p>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:32px;">
        ${asSeenIn.map(s => `<span style="font-family:${B};color:${MUTED};font-weight:600;font-size:16px;font-style:normal;">${esc(s)}</span>`).join("")}
      </div>
    </div>
  </section>`);
  }

  // S4: SOLUTION INTRO (LIGHT)
  const sol = hb(content.solutionIntro);
  if (sol) {
    sections.push(`
  <section style="background:${LIGHT};padding:${PAD};">
    <div ${inner}>
      <h2 style="font-family:${H};font-weight:700;font-style:normal;font-size:clamp(28px,3.5vw,42px);color:${TEXT_LIGHT};margin:0 0 24px;">${esc(sol.heading)}</h2>
      ${sol.body.map(p => bulletCheck(p, false)).join("")}
    </div>
  </section>`);
  }

  // S4b: COACH AUTHORITY (DARK) — after solution intro, only if headshot or coachName present
  if (headshotUrl || coachName) {
    const bioText = coachBackground && coachBackground.length > 10 ? coachBackground : "";
    const photoCol = headshotUrl
      ? `<div style="flex:0 1 40%;min-width:260px;">
           <img src="${esc(headshotUrl)}" alt="${esc(coachName || "Coach")}" style="width:100%;max-width:400px;border-radius:12px;object-fit:cover;">
         </div>`
      : "";
    sections.push(`
  <section style="background:${DARK};padding:${PAD};">
    <div style="max-width:${MAX_W};margin:0 auto;padding:0 24px;width:100%;display:flex;gap:48px;flex-wrap:wrap;align-items:center;">
      ${photoCol}
      <div style="flex:1 1 50%;min-width:280px;">
        ${coachName ? `<h2 style="font-family:${H};font-weight:700;font-style:normal;font-size:42px;color:${TEXT_DARK};margin:0 0 16px;text-transform:uppercase;">${esc(coachName)}</h2>` : ""}
        ${bioText ? `<p style="font-family:${B};font-weight:400;font-style:normal;font-size:18px;line-height:1.6;color:${BODY_DARK};margin:0 0 24px;">${esc(bioText)}</p>` : ""}
        ${ctaBtn(true)}
      </div>
    </div>
  </section>`);
  }

  // S4c: SOCIAL PROOF GALLERY (DARK) — only if socialProofUrls has entries
  if (socialProofUrls.length > 0) {
    sections.push(`
  <section style="background:${DARK};padding:${PAD};">
    <div style="max-width:${MAX_W};margin:0 auto;padding:0 24px;">
      <h2 style="font-family:${H};font-weight:700;font-style:normal;font-size:32px;color:${TEXT_DARK};margin:0 0 32px;text-align:center;">Results Our Clients Get</h2>
      <div style="display:flex;gap:16px;overflow-x:auto;padding:24px 0;-webkit-overflow-scrolling:touch;">
        ${socialProofUrls.map(url => `<img src="${esc(url)}" alt="" style="height:300px;width:auto;border-radius:8px;flex-shrink:0;object-fit:cover;">`).join("")}
      </div>
    </div>
  </section>`);
  }

  // S5: UNIQUE MECHANISM (WHITE)
  const uniq = hb(content.uniqueMechanism);
  if (uniq) {
    sections.push(`
  <section style="background:${WHITE};padding:${PAD};">
    <div ${inner}>
      <h2 style="font-family:${H};font-weight:700;font-style:normal;font-size:clamp(28px,3.5vw,42px);color:${TEXT_LIGHT};margin:0 0 8px;">${esc(uniq.heading)}</h2>
      <div style="width:80px;height:3px;background:${A};margin:0 0 24px;"></div>
      ${uniq.body.map(p => `<p style="font-family:${B};font-weight:400;font-style:normal;font-size:18px;line-height:1.6;color:${BODY_LIGHT};margin:0 0 14px;">${esc(p)}</p>`).join("")}
      ${ctaBtn(false)}
    </div>
  </section>`);
  }

  // S6: WHY OLD FAIL + INSIDER ADVANTAGES (WHITE)
  const whyFail = hb(content.whyOldFail);
  const adv = hb(content.insiderAdvantages);
  if (whyFail || adv) {
    sections.push(`
  <section style="background:${WHITE};padding:${PAD};">
    <div ${inner}>
      ${whyFail ? `
        <h2 style="font-family:${H};font-weight:700;font-style:normal;font-size:clamp(24px,3vw,32px);color:${TEXT_LIGHT};margin:0 0 24px;">${esc(whyFail.heading)}</h2>
        ${whyFail.body.map(p => bulletX(p)).join("")}
        <div style="height:40px;"></div>` : ""}
      ${adv ? `
        <h2 style="font-family:${H};font-weight:700;font-style:normal;font-size:clamp(24px,3vw,36px);color:${TEXT_LIGHT};margin:0 0 24px;">${esc(adv.heading)}</h2>
        ${adv.body.map(p => bulletCheck(p, false)).join("")}` : ""}
    </div>
  </section>`);
  }

  // S7: TESTIMONIALS (LIGHT)
  if (testimonials.length > 0) {
    sections.push(`
  <section style="background:${LIGHT};padding:${PAD};">
    <div ${inner}>
      <h2 style="font-family:${H};font-weight:700;font-style:normal;font-size:clamp(28px,3.5vw,42px);color:${TEXT_LIGHT};margin:0 0 32px;text-align:center;">What Our Clients Say</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;">
        ${testimonials.map((tm: any) => `
          <div style="background:${WHITE};border-radius:15px;padding:30px 25px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
            ${tm.headline ? `<h3 style="font-family:${H};color:${A};font-size:20px;font-weight:700;font-style:normal;margin:0 0 12px;">${esc(tm.headline)}</h3>` : ""}
            ${tm.quote ? `<p style="font-family:${B};color:${BODY_LIGHT};font-style:italic;font-size:16px;font-weight:400;line-height:1.6;margin:0 0 16px;">"${esc(tm.quote)}"</p>` : ""}
            <p style="font-family:${H};font-weight:700;font-style:normal;font-size:15px;color:${TEXT_LIGHT};margin:0 0 2px;">${esc(tm.name ?? "")}</p>
            <p style="font-family:${B};font-size:13px;font-weight:400;font-style:normal;color:${MUTED};margin:0;">${esc(tm.location ?? "")}</p>
          </div>`).join("")}
      </div>
    </div>
  </section>`);
  }

  // S8: QUIZ (LIGHT)
  if (quiz && ok(quiz.question) && Array.isArray(quiz.options) && quiz.options.length > 0) {
    sections.push(`
  <section style="background:${LIGHT};padding:80px 0;">
    <div ${inner}>
      <h2 style="font-family:${H};font-weight:700;font-style:normal;font-size:clamp(24px,3vw,32px);color:${TEXT_LIGHT};margin:0 0 32px;text-align:center;">${esc(quiz.question)}</h2>
      <div style="display:flex;flex-direction:column;gap:12px;max-width:700px;margin:0 auto;">
        ${quiz.options.map((opt: string, i: number) => `
          <div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:12px;">
            <span style="font-family:${H};font-weight:700;font-style:normal;font-size:18px;color:${A};flex-shrink:0;">${String.fromCharCode(65 + i)}.</span>
            <span style="font-family:${B};font-weight:400;font-style:normal;font-size:16px;color:${BODY_LIGHT};">${esc(opt)}</span>
          </div>`).join("")}
      </div>
      ${quiz.answer ? `<div style="margin-top:24px;max-width:700px;margin-left:auto;margin-right:auto;background:rgba(254,69,0,0.06);border:1px solid ${A};border-radius:10px;padding:20px;">
        <p style="font-family:${B};font-weight:600;font-style:normal;font-size:15px;color:${A};margin:0 0 8px;">The Answer:</p>
        <p style="font-family:${B};font-weight:400;font-style:normal;font-size:15px;line-height:1.7;color:${TEXT_LIGHT};margin:0;">${esc(quiz.answer)}</p>
      </div>` : ""}
    </div>
  </section>`);
  }

  // S9: SHOCKING STAT (WHITE)
  if (ok(content.shockingStat)) {
    const statText = String(content.shockingStat);
    const bigNum = statText.match(/[\d,]+[%x+]?/)?.[0] ?? "";
    sections.push(`
  <section style="background:${WHITE};padding:${PAD};text-align:center;">
    <div ${inner}>
      ${bigNum ? `<div style="font-family:${H};font-size:clamp(48px,10vw,80px);font-weight:700;font-style:normal;color:${A};margin:0 0 12px;line-height:1;">${esc(bigNum)}</div>` : ""}
      <p style="font-family:${B};font-size:20px;font-weight:400;font-style:normal;color:${BODY_LIGHT};max-width:700px;margin:0 auto;line-height:1.6;">${esc(statText)}</p>
    </div>
  </section>`);
  }

  // GRADIENT CTA BAR
  sections.push(`
  <section style="background:${gradient};padding:40px 0;text-align:center;">
    <div ${inner}>${ctaBtn(true)}</div>
  </section>`);

  // S10: CONSULTATION OUTLINE (WHITE)
  if (outline.length > 0) {
    sections.push(`
  <section style="background:${WHITE};padding:${PAD};">
    <div ${inner}>
      <h2 style="font-family:${H};font-weight:700;font-style:normal;font-size:clamp(28px,3.5vw,42px);color:${TEXT_LIGHT};margin:0 0 32px;text-align:center;">What You'll Get</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;">
        ${outline.map((item: any, i: number) => `
          <div style="background:${LIGHT};border-radius:15px;padding:24px;display:flex;gap:16px;align-items:flex-start;">
            <div style="flex-shrink:0;width:40px;height:40px;background:${A};border-radius:50%;display:flex;align-items:center;justify-content:center;">
              <span style="font-family:${H};font-weight:700;font-style:normal;font-size:16px;color:#fff;">${i + 1}</span>
            </div>
            <div>
              <h3 style="font-family:${H};font-size:18px;font-weight:700;font-style:normal;color:${TEXT_LIGHT};margin:0 0 6px;">${esc(item.title ?? "")}</h3>
              <p style="font-family:${B};color:${BODY_LIGHT};margin:0;line-height:1.5;font-size:15px;font-weight:400;font-style:normal;">${esc(item.description ?? "")}</p>
            </div>
          </div>`).join("")}
      </div>
    </div>
  </section>`);
  }

  // S11: FAQ (WHITE) — CSS-only accordion via <details>/<summary>
  if (faqItems.length > 0) {
    sections.push(`
  <section style="background:${WHITE};padding:${PAD};">
    <div style="max-width:900px;margin:0 auto;padding:0 24px;">
      <h2 style="font-family:${H};font-weight:700;font-style:normal;font-size:clamp(28px,3.5vw,42px);color:${TEXT_LIGHT};margin:0 0 32px;text-align:center;">Frequently Asked Questions</h2>
      ${faqItems.map((f: any) => `
        <details style="border-bottom:1px solid #e0e0e0;">
          <summary style="display:flex;justify-content:space-between;align-items:center;padding:20px 0;cursor:pointer;list-style:none;font-family:${H};font-weight:700;font-style:normal;font-size:18px;color:${TEXT_LIGHT};">
            ${esc(f.q)}
            <span style="font-size:28px;color:${A};flex-shrink:0;margin-left:20px;line-height:1;">+</span>
          </summary>
          <div style="padding-bottom:20px;">
            <p style="font-family:${B};font-weight:400;font-style:normal;font-size:16px;line-height:1.6;color:${BODY_LIGHT};margin:0;">${esc(f.a)}</p>
          </div>
        </details>`).join("")}
    </div>
  </section>`);
  }

  // S12: SCARCITY / URGENCY (LIGHT)
  const scar = hb(content.scarcityUrgency);
  if (scar) {
    sections.push(`
  <section style="background:${LIGHT};padding:${PAD};">
    <div ${inner}>
      <div style="border:3px solid ${A};border-radius:12px;padding:40px 32px;">
        <h2 style="font-family:${H};font-weight:700;font-style:normal;font-size:clamp(24px,3vw,32px);color:${A};margin:0 0 16px;text-align:center;">${esc(scar.heading)}</h2>
        ${scar.body.map(p => `<p style="font-family:${B};font-weight:400;font-style:normal;font-size:17px;line-height:1.7;color:${BODY_LIGHT};margin:0 0 14px;">${esc(p)}</p>`).join("")}
      </div>
    </div>
  </section>`);
  }

  // S13: FINAL CTA (DARK)
  sections.push(`
  <section style="background:${DARK};padding:80px 0;">
    <div ${inner} style="text-align:center;">
      <h2 style="font-family:${H};font-weight:700;font-style:normal;font-size:clamp(24px,3.5vw,36px);color:${TEXT_DARK};margin:0 0 20px;">${esc(ok(content.mainHeadline) ? String(content.mainHeadline) : "Ready to Get Started?")}</h2>
      <p style="font-family:${B};font-weight:400;font-style:normal;font-size:17px;color:${BODY_DARK};margin:0 auto 32px;max-width:650px;line-height:1.7;text-align:left;">${esc(ok(content.subheadline) ? String(content.subheadline) : "Take the first step today.")}</p>
      ${ctaBtn(true)}
    </div>
  </section>`);

  // FOOTER
  sections.push(`
  <footer style="background:${DARK};border-top:1px solid #222;padding:24px 48px;text-align:center;">
    <p style="font-family:${B};font-weight:400;font-style:normal;font-size:13px;color:${MUTED};margin:0;">© ${YEAR} ${esc(serviceName)}. All rights reserved.</p>
  </footer>`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(content.mainHeadline || serviceName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:${WHITE};}
    details>summary::-webkit-details-marker{display:none;}
    a{transition:opacity 0.15s;}
    a:hover{opacity:0.85;}
    @media(max-width:700px){
      section>div{flex-direction:column!important;}
    }
  </style>
</head>
<body>
${sections.join("\n")}
</body>
</html>`;
}
