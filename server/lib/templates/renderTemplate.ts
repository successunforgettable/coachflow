// renderTemplate.ts — shared config-driven landing page renderer
// Composes TemplateConfig colours/fonts x PageTypeLayout section order into full HTML.

import type {
  TemplateConfig,
  LpPageType,
  CoachAssetOptions,
  LandingPageContent,
  SectionKey,
} from "./types";
import {
  esc,
  ok,
  hb,
  jp,
  ctaLabel,
  ctaButton,
  sectionWrapper,
  heading2,
  bodyParagraph,
  bulletCheck,
  bulletX,
  eventStripHtml,
  downloadBadgeHtml,
  bookingCueHtml,
  cfImg,
} from "./shared";

// ─── Main entry ──────────────────────────────────────────────────────────────

export function renderTemplate(
  content: LandingPageContent,
  config: TemplateConfig,
  coach: CoachAssetOptions,
  pageType: LpPageType,
): string {
  const layout = config.sectionMap[pageType];
  const YEAR = new Date().getFullYear();
  const c = config.colors;

  // Mutable CTA index — incremented each time a CTA is rendered
  let ctaIdx = 0;
  function nextCta(dark: boolean = true): string {
    const label = ctaLabel(content, pageType, ctaIdx);
    ctaIdx++;
    return ctaButton(config, label, dark);
  }

  // ─── Content parsing (done once) ────────────────────────────────────────
  const quiz = jp<any>(content.quizSection, null);
  const testimonials = jp<any[]>(content.testimonials, []);
  const outline = jp<any[]>(content.consultationOutline, []);
  const faqRaw = jp<any[]>(content.faq, []);
  const faqItems = faqRaw
    .map((f: any) => ({ q: f.question || f.q || "", a: f.answer || f.a || "" }))
    .filter((f: any) => f.q);
  const asSeenIn = Array.isArray(content.asSeenIn) ? content.asSeenIn : [];
  const guarantee = (content as any).guarantee;

  const {
    headshotUrl = null,
    logoUrl = null,
    socialProofUrls = [],
    coachName = null,
    coachBackground = null,
  } = coach;

  // ─── Section renderers ──────────────────────────────────────────────────

  const renderers: Record<SectionKey, () => string> = {
    hero() {
      if (!ok(content.eyebrowHeadline) && !ok(content.mainHeadline)) return "";
      const ts = layout.typeSpecificSections ?? {};
      const isDark = true;
      const textColor = c.textOnDark;
      const bodyColor = c.bodyOnDark;
      const useSplit = layout.heroLayout === "split" && headshotUrl;

      const typeSpecific =
        (ts.eventStrip ? eventStripHtml(config, isDark) : "") +
        (ts.downloadBadge ? downloadBadgeHtml(config, isDark) : "") +
        (ts.bookingCue ? bookingCueHtml(config, isDark) : "");

      const heroText = `
        <div style="flex:1 1 ${useSplit ? "55%" : "100%"};min-width:300px;${!useSplit ? "text-align:center;" : ""}">
          ${ok(content.eyebrowHeadline) ? `<p style="font-family:${config.bodyFont};color:${c.accent};font-size:14px;font-weight:600;font-style:normal;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">${esc(content.eyebrowHeadline)}</p>` : ""}
          ${ok(content.mainHeadline) ? `<h1 style="font-family:${config.headingFont};font-size:clamp(24px,3.5vw,42px);font-weight:700;font-style:normal;line-height:${config.headingLineHeight};letter-spacing:${config.headingLetterSpacing};color:${textColor};margin:0 0 20px;">${esc(content.mainHeadline)}</h1>` : ""}
          ${ok(content.subheadline) ? `<p style="font-family:${config.bodyFont};font-size:18px;font-weight:400;font-style:normal;color:${bodyColor};margin:0 0 28px;line-height:${config.bodyLineHeight};">${esc(content.subheadline)}</p>` : ""}
          ${typeSpecific}
          ${nextCta(isDark)}
        </div>`;

      const heroPhoto = useSplit
        ? `<div style="flex:0 1 40%;min-width:260px;display:flex;justify-content:center;align-items:center;">
             <img src="${esc(cfImg(headshotUrl!))}" alt="${esc(coachName || "Coach")}" style="width:100%;max-width:420px;max-height:500px;border-radius:${config.cardRadius};object-fit:cover;border:6px solid ${c.accent};">
           </div>`
        : "";

      return `<section style="background:${c.dark};padding:${config.sectionPadding};">` +
        `<div style="max-width:${config.maxWidth};margin:0 auto;padding:0 24px;width:100%;display:flex;gap:40px;flex-wrap:wrap;align-items:center;">` +
        heroText + heroPhoto +
        `</div></section>`;
    },

    asSeenIn() {
      if (asSeenIn.length === 0) return "";
      return `<section style="background:${c.white};padding:40px 0;border-top:1px solid ${c.border};border-bottom:1px solid ${c.border};">` +
        `<div style="max-width:${config.maxWidth};margin:0 auto;padding:0 24px;text-align:center;">` +
        `<p style="font-family:${config.bodyFont};font-size:12px;font-weight:700;font-style:normal;text-transform:uppercase;letter-spacing:0.1em;color:${c.muted};margin-bottom:20px;">As Seen In</p>` +
        `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:32px;">` +
        asSeenIn.map(s => `<span style="font-family:${config.bodyFont};color:${c.muted};font-weight:600;font-size:16px;font-style:normal;">${esc(s)}</span>`).join("") +
        `</div></div></section>`;
    },

    quiz() {
      if (!quiz || !ok(quiz.question) || !Array.isArray(quiz.options) || quiz.options.length === 0) return "";
      return sectionWrapper(c.light, config.sectionPadding,
        heading2(config, quiz.question, c.textOnLight, "center") +
        `<div style="display:flex;flex-direction:column;gap:12px;max-width:700px;margin:0 auto;">` +
        quiz.options.map((opt: string, i: number) =>
          `<div style="background:${c.white};border:1px solid ${c.border};border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:12px;">` +
          `<span style="font-family:${config.headingFont};font-weight:700;font-style:normal;font-size:18px;color:${c.accent};flex-shrink:0;">${String.fromCharCode(65 + i)}.</span>` +
          `<span style="font-family:${config.bodyFont};font-weight:400;font-style:normal;font-size:16px;color:${c.bodyOnLight};">${esc(opt)}</span>` +
          `</div>`
        ).join("") +
        `</div>` +
        (ok(quiz.answer) ? `<div style="margin-top:24px;max-width:700px;margin-left:auto;margin-right:auto;background:${c.accent}11;border:1px solid ${c.accent};border-radius:10px;padding:20px;">` +
          `<p style="font-family:${config.bodyFont};font-weight:600;font-style:normal;font-size:15px;color:${c.accent};margin:0 0 8px;">The Answer:</p>` +
          `<p style="font-family:${config.bodyFont};font-weight:400;font-style:normal;font-size:15px;line-height:1.7;color:${c.textOnLight};margin:0;">${esc(quiz.answer)}</p></div>` : ""),
        config.maxWidth);
    },

    problemAgitation() {
      const prob = hb(content.problemAgitation);
      if (!prob) return "";
      return sectionWrapper(c.light, config.sectionPadding,
        heading2(config, prob.heading, c.textOnLight) +
        prob.body.map(p => bulletCheck(config, p, c.bodyOnLight)).join(""),
        config.maxWidth);
    },

    solutionIntro() {
      const sol = hb(content.solutionIntro);
      if (!sol) return "";
      return sectionWrapper(c.light, config.sectionPadding,
        heading2(config, sol.heading, c.textOnLight) +
        sol.body.map(p => bulletCheck(config, p, c.bodyOnLight)).join(""),
        config.maxWidth);
    },

    whyOldFail() {
      const why = hb(content.whyOldFail);
      if (!why) return "";
      return sectionWrapper(c.white, config.sectionPadding,
        heading2(config, why.heading, c.textOnLight) +
        why.body.map(p => bulletX(config, p, c.bodyOnLight)).join(""),
        config.maxWidth);
    },

    uniqueMechanism() {
      const uniq = hb(content.uniqueMechanism);
      if (!uniq) return "";
      return sectionWrapper(c.white, config.sectionPadding,
        heading2(config, uniq.heading, c.textOnLight) +
        `<div style="width:80px;height:3px;background:${c.accent};margin:0 0 24px;"></div>` +
        uniq.body.map(p => bodyParagraph(config, p, c.bodyOnLight)).join("") +
        nextCta(false),
        config.maxWidth);
    },

    testimonials() {
      if (testimonials.length === 0) return "";
      const cardStyle = config.decorative.testimonialCardStyle;
      const cardBorder = cardStyle === "bordered" ? `border:1px solid ${c.border};` : "";
      const cardShadow = cardStyle === "shadow" ? "box-shadow:0 2px 8px rgba(0,0,0,0.06);" : "";
      const cardGlass = cardStyle === "glass" ? `background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.3);` : "";
      const cardExtra = cardBorder || cardShadow || cardGlass;
      const cardBg = cardStyle === "glass" ? "" : `background:${c.white};`;

      return sectionWrapper(c.light, config.sectionPadding,
        heading2(config, "What Our Clients Say", c.textOnLight, "center") +
        `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;">` +
        testimonials.map((tm: any) =>
          `<div style="${cardBg}border-radius:${config.cardRadius};padding:30px 25px;${cardExtra}">` +
          (tm.headline ? `<h3 style="font-family:${config.headingFont};color:${c.accent};font-size:20px;font-weight:700;font-style:normal;margin:0 0 12px;">${esc(tm.headline)}</h3>` : "") +
          (tm.quote ? `<p style="font-family:${config.bodyFont};color:${c.bodyOnLight};font-style:italic;font-size:16px;font-weight:400;line-height:1.6;margin:0 0 16px;">"${esc(tm.quote)}"</p>` : "") +
          `<p style="font-family:${config.headingFont};font-weight:700;font-style:normal;font-size:15px;color:${c.textOnLight};margin:0 0 2px;">${esc(tm.name ?? "")}</p>` +
          `<p style="font-family:${config.bodyFont};font-size:13px;font-weight:400;font-style:normal;color:${c.muted};margin:0;">${esc(tm.location ?? "")}</p>` +
          `</div>`
        ).join("") +
        `</div>`,
        config.maxWidth);
    },

    insiderAdvantages() {
      const adv = hb(content.insiderAdvantages);
      if (!adv) return "";
      return sectionWrapper(c.white, config.sectionPadding,
        heading2(config, adv.heading, c.textOnLight) +
        adv.body.map(p => bulletCheck(config, p, c.bodyOnLight)).join(""),
        config.maxWidth);
    },

    scarcityUrgency() {
      const scar = hb(content.scarcityUrgency);
      if (!scar) return "";
      return sectionWrapper(c.light, config.sectionPadding,
        `<div style="border:3px solid ${c.accent};border-radius:${config.cardRadius};padding:40px 32px;">` +
        heading2(config, scar.heading, c.accent, "center") +
        scar.body.map(p => bodyParagraph(config, p, c.bodyOnLight)).join("") +
        `</div>`,
        config.maxWidth);
    },

    shockingStat() {
      if (!ok(content.shockingStat)) return "";
      const statText = String(content.shockingStat);
      const bigNum = statText.match(/[\d,]+[%x+]?/)?.[0] ?? "";
      return sectionWrapper(c.white, config.sectionPadding,
        `<div style="text-align:center;">` +
        (bigNum ? `<div style="font-family:${config.headingFont};font-size:clamp(48px,10vw,80px);font-weight:700;font-style:normal;color:${c.accent};margin:0 0 12px;line-height:1;">${esc(bigNum)}</div>` : "") +
        `<p style="font-family:${config.bodyFont};font-size:20px;font-weight:400;font-style:normal;color:${c.bodyOnLight};max-width:700px;margin:0 auto;line-height:1.6;">${esc(statText)}</p>` +
        `</div>`,
        config.maxWidth);
    },

    timeSavingBenefit() {
      const tsb = hb(content.timeSavingBenefit);
      if (!tsb) return "";
      return sectionWrapper(c.white, config.sectionPadding,
        heading2(config, tsb.heading, c.textOnLight) +
        tsb.body.map(p => bodyParagraph(config, p, c.bodyOnLight)).join(""),
        config.maxWidth);
    },

    consultationOutline() {
      if (outline.length === 0) return "";
      return sectionWrapper(c.white, config.sectionPadding,
        heading2(config, "What You'll Get", c.textOnLight, "center") +
        `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;">` +
        outline.map((item: any, i: number) =>
          `<div style="background:${c.light};border-radius:${config.cardRadius};padding:24px;display:flex;gap:16px;align-items:flex-start;">` +
          `<div style="flex-shrink:0;width:40px;height:40px;background:${c.accent};border-radius:50%;display:flex;align-items:center;justify-content:center;">` +
          `<span style="font-family:${config.headingFont};font-weight:700;font-style:normal;font-size:16px;color:#fff;">${i + 1}</span>` +
          `</div><div>` +
          `<h3 style="font-family:${config.headingFont};font-size:18px;font-weight:700;font-style:normal;color:${c.textOnLight};margin:0 0 6px;">${esc(item.title ?? "")}</h3>` +
          `<p style="font-family:${config.bodyFont};color:${c.bodyOnLight};margin:0;line-height:1.5;font-size:15px;font-weight:400;font-style:normal;">${esc(item.description ?? "")}</p>` +
          `</div></div>`
        ).join("") +
        `</div>`,
        config.maxWidth);
    },

    guarantee() {
      if (!ok(guarantee)) return "";
      const g = hb(guarantee);
      if (!g) return "";
      return sectionWrapper(c.dark, config.sectionPadding,
        heading2(config, g.heading, c.textOnDark, "center") +
        g.body.map(p => bodyParagraph(config, p, c.bodyOnDark)).join(""),
        config.maxWidth);
    },

    faq() {
      if (faqItems.length === 0) return "";
      return `<section style="background:${c.white};padding:${config.sectionPadding};">` +
        `<div style="max-width:900px;margin:0 auto;padding:0 24px;">` +
        heading2(config, "Frequently Asked Questions", c.textOnLight, "center") +
        faqItems.map((f: any) =>
          `<details style="border-bottom:1px solid ${c.border};">` +
          `<summary style="display:flex;justify-content:space-between;align-items:center;padding:20px 0;cursor:pointer;list-style:none;font-family:${config.headingFont};font-weight:700;font-style:normal;font-size:18px;color:${c.textOnLight};">` +
          esc(f.q) +
          `<span style="font-size:28px;color:${c.accent};flex-shrink:0;margin-left:20px;line-height:1;">+</span>` +
          `</summary>` +
          `<div style="padding-bottom:20px;">` +
          `<p style="font-family:${config.bodyFont};font-weight:400;font-style:normal;font-size:16px;line-height:1.6;color:${c.bodyOnLight};margin:0;">${esc(f.a)}</p>` +
          `</div></details>`
        ).join("") +
        `</div></section>`;
    },

    coachAuthority() {
      if (!headshotUrl && !coachName) return "";
      const rawBio = coachBackground && coachBackground.trim().length > 10 ? coachBackground.trim() : "";
      const bioText = rawBio || "";
      const photoCol = headshotUrl
        ? `<div style="flex:0 1 40%;min-width:260px;">` +
          `<img src="${esc(cfImg(headshotUrl))}" alt="${esc(coachName || "Coach")}" height="400" loading="lazy" style="width:100%;max-width:400px;border-radius:${config.cardRadius};object-fit:cover;border:4px solid ${c.accent};">` +
          `</div>`
        : "";
      return `<section style="background:${c.dark};padding:${config.sectionPadding};">` +
        `<div style="max-width:${config.maxWidth};margin:0 auto;padding:0 24px;width:100%;display:flex;gap:48px;flex-wrap:wrap;align-items:center;">` +
        photoCol +
        `<div style="flex:1 1 50%;min-width:280px;">` +
        (coachName ? `<h2 style="font-family:${config.headingFont};font-weight:700;font-style:normal;font-size:42px;letter-spacing:${config.headingLetterSpacing};line-height:${config.headingLineHeight};color:${c.textOnDark};margin:0 0 16px;text-transform:uppercase;">${esc(coachName)}</h2>` : "") +
        (bioText ? bodyParagraph(config, bioText, c.bodyOnDark) : "") +
        nextCta(true) +
        `</div></div></section>`;
    },

    socialProofGallery() {
      if (socialProofUrls.length === 0) return "";
      return `<section style="background:${c.dark};padding:${config.sectionPadding};">` +
        `<div style="max-width:${config.maxWidth};margin:0 auto;padding:0 24px;">` +
        heading2(config, "Results Our Clients Get", c.textOnDark, "center") +
        `<div style="display:flex;flex-wrap:nowrap;gap:16px;overflow-x:auto;padding-bottom:16px;-webkit-overflow-scrolling:touch;">` +
        socialProofUrls.map(url =>
          `<img src="${esc(cfImg(url))}" alt="" height="300" loading="lazy" style="height:300px;width:auto;min-width:200px;flex-shrink:0;object-fit:cover;border-radius:8px;">`
        ).join("") +
        `</div></div></section>`;
    },

    gradientCta() {
      const bg = config.ctaGradient ?? `linear-gradient(90deg, ${c.accent} 35%, ${c.dark} 100%)`;
      return `<section style="background:${bg};padding:40px 0;text-align:center;">` +
        `<div style="max-width:${config.maxWidth};margin:0 auto;padding:0 24px;">` +
        nextCta(true) +
        `</div></section>`;
    },

    finalCta() {
      const headline = ok(content.mainHeadline) ? String(content.mainHeadline) : "Ready to Get Started?";
      const sub = ok(content.subheadline) ? String(content.subheadline) : "Take the first step today.";
      return sectionWrapper(c.dark, "80px 0",
        `<div style="text-align:center;">` +
        `<h2 style="font-family:${config.headingFont};font-weight:700;font-style:normal;font-size:clamp(24px,3.5vw,36px);letter-spacing:${config.headingLetterSpacing};line-height:${config.headingLineHeight};color:${c.textOnDark};margin:0 0 20px;">${esc(headline)}</h2>` +
        `<p style="font-family:${config.bodyFont};font-weight:400;font-style:normal;font-size:17px;color:${c.bodyOnDark};margin:0 auto 32px;max-width:650px;line-height:${config.bodyLineHeight};">${esc(sub)}</p>` +
        nextCta(true) +
        `</div>`,
        config.maxWidth);
    },
  };

  // ─── Assemble sections ──────────────────────────────────────────────────

  const sectionHtmlParts: string[] = [];
  for (const key of layout.order) {
    try {
      const renderer = renderers[key];
      if (!renderer) continue;
      const html = renderer();
      if (html) sectionHtmlParts.push(html);
    } catch {
      // skip broken section silently
    }
  }

  // ─── Nav ────────────────────────────────────────────────────────────────

  const navBgMap: Record<string, string> = {
    dark: `background:${c.dark};border-bottom:1px solid ${c.border};`,
    light: `background:${c.white};border-bottom:1px solid ${c.border};`,
    transparent: `background:transparent;`,
  };
  const navBg = navBgMap[config.navStyle] ?? navBgMap.dark;
  const navTextColor = config.navStyle === "light" ? c.textOnLight : c.textOnDark;

  const navHtml = `<nav style="${navBg}padding:16px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;">` +
    (logoUrl
      ? `<img src="${esc(cfImg(logoUrl))}" alt="" style="height:40px;object-fit:contain;vertical-align:middle;">`
      : `<span></span>`) +
    (ok(content.primaryCta)
      ? `<a href="#" style="font-family:${config.headingFont};font-size:13px;font-weight:700;font-style:normal;color:#fff;background:${c.accent};padding:10px 22px;border-radius:${config.buttonRadius};text-decoration:none;">${esc(content.primaryCta)}</a>`
      : "") +
    `</nav>`;

  // ─── Footer ─────────────────────────────────────────────────────────────

  const footerHtml = `<footer style="background:${c.dark};border-top:1px solid ${c.border};padding:24px 48px;text-align:center;">` +
    `<p style="font-family:${config.bodyFont};font-weight:400;font-style:normal;font-size:13px;color:${c.muted};margin:0;">&copy; ${YEAR}. All rights reserved.</p>` +
    `</footer>`;

  // ─── Full document ──────────────────────────────────────────────────────

  const fontLinks = [config.headingFontUrl, config.bodyFontUrl]
    .filter(Boolean)
    .map(url => `<link href="${url}" rel="stylesheet">`)
    .join("\n  ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(content.mainHeadline || "")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${fontLinks}
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:${c.pageBg};}
    details>summary::-webkit-details-marker{display:none;}
    a{transition:opacity 0.15s;}
    a:hover{opacity:0.85;}
    @media(max-width:700px){
      section>div{flex-direction:column!important;}
    }
  </style>
</head>
<body>
${navHtml}
${sectionHtmlParts.join("\n")}
${footerHtml}
</body>
</html>`;
}
