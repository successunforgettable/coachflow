// D4: Build self-contained landing page HTML for Cloudflare Workers KV
import type { LandingPageContent } from "../../drizzle/schema";

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function faq(items: Array<{ question: string; answer: string }>): string {
  return items
    .map(
      (item, i) => `
      <details style="border:1px solid #E5E0D8;border-radius:12px;margin-bottom:10px;overflow:hidden;">
        <summary style="padding:16px 20px;font-family:'Instrument Sans',sans-serif;font-weight:600;font-size:15px;color:#1A1624;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;">
          ${esc(item.question)}
          <span style="font-size:20px;color:#FF5B1D;flex-shrink:0;margin-left:12px;">+</span>
        </summary>
        <div style="padding:0 20px 16px;font-family:'Instrument Sans',sans-serif;font-size:14px;color:#555;line-height:1.7;">
          ${esc(item.answer)}
        </div>
      </details>`
    )
    .join("\n");
}

function testimonials(items: Array<{ headline: string; quote: string; name: string; location: string }>): string {
  return items
    .map(
      (t) => `
      <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:16px;border:1px solid #E5E0D8;">
        <p style="font-family:'Fraunces',serif;font-style:italic;font-weight:700;font-size:17px;color:#1A1624;margin:0 0 10px;">"${esc(t.headline)}"</p>
        <p style="font-family:'Instrument Sans',sans-serif;font-size:14px;color:#555;line-height:1.7;margin:0 0 14px;">${esc(t.quote)}</p>
        <p style="font-family:'Instrument Sans',sans-serif;font-size:13px;font-weight:600;color:#1A1624;margin:0;">— ${esc(t.name)}<span style="font-weight:400;color:#999;"> · ${esc(t.location)}</span></p>
      </div>`
    )
    .join("\n");
}

function steps(items: Array<{ title: string; description: string }>): string {
  return items
    .map(
      (s, i) => `
      <div style="display:flex;gap:16px;margin-bottom:18px;">
        <div style="flex-shrink:0;width:36px;height:36px;background:#FF5B1D;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Instrument Sans',sans-serif;font-weight:700;font-size:15px;color:#fff;">${i + 1}</div>
        <div>
          <p style="font-family:'Instrument Sans',sans-serif;font-weight:700;font-size:15px;color:#1A1624;margin:0 0 4px;">${esc(s.title)}</p>
          <p style="font-family:'Instrument Sans',sans-serif;font-size:14px;color:#555;line-height:1.6;margin:0;">${esc(s.description)}</p>
        </div>
      </div>`
    )
    .join("\n");
}

export function buildLandingPageHtml({
  content,
  serviceName,
  primaryCtaUrl = "#",
}: {
  content: LandingPageContent;
  serviceName: string;
  primaryCtaUrl?: string;
}): string {
  const asSeenIn = Array.isArray(content.asSeenIn) ? content.asSeenIn : [];
  const testimonialsArr = Array.isArray(content.testimonials) ? content.testimonials : [];
  const consultationArr = Array.isArray(content.consultationOutline) ? content.consultationOutline : [];
  const faqArr = Array.isArray(content.faq) ? content.faq : [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(content.mainHeadline || serviceName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,900&family=Instrument+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#F5F1EA;color:#1A1624;}
    details>summary::-webkit-details-marker{display:none;}
    @media(max-width:600px){
      .hero-headline{font-size:32px!important;}
      .section{padding:40px 20px!important;}
    }
  </style>
</head>
<body>

<!-- NAV -->
<nav style="background:#1A1624;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;">
  <span style="font-family:'Fraunces',serif;font-style:italic;font-weight:900;font-size:20px;color:#fff;">${esc(serviceName)}</span>
  <a href="${esc(primaryCtaUrl)}" style="font-family:'Instrument Sans',sans-serif;font-size:13px;font-weight:700;color:#fff;background:#FF5B1D;padding:10px 22px;border-radius:9999px;text-decoration:none;">
    ${esc(content.primaryCta || "Get Started")}
  </a>
</nav>

<!-- HERO -->
<section class="section" style="max-width:800px;margin:0 auto;padding:72px 32px 56px;text-align:center;">
  ${content.eyebrowHeadline ? `<p style="font-family:'Instrument Sans',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#FF5B1D;margin-bottom:18px;">${esc(content.eyebrowHeadline)}</p>` : ""}
  <h1 class="hero-headline" style="font-family:'Fraunces',serif;font-style:italic;font-weight:900;font-size:48px;color:#1A1624;line-height:1.12;margin-bottom:20px;">${esc(content.mainHeadline)}</h1>
  ${content.subheadline ? `<p style="font-family:'Instrument Sans',sans-serif;font-size:17px;color:#555;line-height:1.7;max-width:560px;margin:0 auto 32px;">${esc(content.subheadline)}</p>` : ""}
  <a href="${esc(primaryCtaUrl)}" style="display:inline-block;font-family:'Instrument Sans',sans-serif;font-size:16px;font-weight:700;color:#fff;background:#FF5B1D;padding:16px 40px;border-radius:9999px;text-decoration:none;letter-spacing:0.02em;">
    ${esc(content.primaryCta || "Get Started")}
  </a>
</section>

${asSeenIn.length > 0 ? `
<!-- AS SEEN IN -->
<section style="background:#fff;padding:28px 32px;border-top:1px solid #E5E0D8;border-bottom:1px solid #E5E0D8;">
  <div style="max-width:800px;margin:0 auto;text-align:center;">
    <p style="font-family:'Instrument Sans',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#999;margin-bottom:16px;">As Seen In</p>
    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:20px;">
      ${asSeenIn.map(s => `<span style="font-family:'Instrument Sans',sans-serif;font-size:14px;font-weight:700;color:#999;">${esc(s)}</span>`).join("")}
    </div>
  </div>
</section>` : ""}

${content.shockingStat ? `
<!-- SHOCKING STAT -->
<section class="section" style="background:#1A1624;padding:56px 32px;text-align:center;">
  <div style="max-width:720px;margin:0 auto;">
    <p style="font-family:'Fraunces',serif;font-style:italic;font-weight:900;font-size:36px;color:#FF5B1D;line-height:1.2;margin-bottom:16px;">${esc(content.shockingStat)}</p>
    ${content.timeSavingBenefit ? `<p style="font-family:'Instrument Sans',sans-serif;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;">${esc(content.timeSavingBenefit)}</p>` : ""}
  </div>
</section>` : ""}

<!-- PROBLEM / SOLUTION -->
<section class="section" style="max-width:800px;margin:0 auto;padding:64px 32px;">
  ${content.problemAgitation ? `
  <div style="margin-bottom:40px;">
    <p style="font-family:'Instrument Sans',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#FF5B1D;margin-bottom:12px;">The Problem</p>
    <p style="font-family:'Instrument Sans',sans-serif;font-size:16px;color:#333;line-height:1.8;">${esc(content.problemAgitation)}</p>
  </div>` : ""}

  ${content.whyOldFail ? `
  <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:40px;border-left:4px solid #FF5B1D;">
    <p style="font-family:'Instrument Sans',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#FF5B1D;margin-bottom:10px;">Why Old Solutions Fail</p>
    <p style="font-family:'Instrument Sans',sans-serif;font-size:15px;color:#333;line-height:1.8;">${esc(content.whyOldFail)}</p>
  </div>` : ""}

  ${content.solutionIntro ? `
  <div>
    <p style="font-family:'Instrument Sans',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#FF5B1D;margin-bottom:12px;">The Solution</p>
    <p style="font-family:'Instrument Sans',sans-serif;font-size:16px;color:#333;line-height:1.8;">${esc(content.solutionIntro)}</p>
  </div>` : ""}
</section>

${content.uniqueMechanism ? `
<!-- UNIQUE MECHANISM -->
<section style="background:#fff;padding:64px 32px;border-top:1px solid #E5E0D8;border-bottom:1px solid #E5E0D8;">
  <div style="max-width:800px;margin:0 auto;text-align:center;">
    <p style="font-family:'Instrument Sans',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#FF5B1D;margin-bottom:16px;">The Method</p>
    <p style="font-family:'Fraunces',serif;font-style:italic;font-weight:900;font-size:28px;color:#1A1624;line-height:1.3;max-width:600px;margin:0 auto;">${esc(content.uniqueMechanism)}</p>
  </div>
</section>` : ""}

${testimonialsArr.length > 0 ? `
<!-- TESTIMONIALS -->
<section class="section" style="max-width:800px;margin:0 auto;padding:64px 32px;">
  <p style="font-family:'Instrument Sans',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#FF5B1D;margin-bottom:24px;text-align:center;">What Clients Say</p>
  ${testimonials(testimonialsArr)}
</section>` : ""}

${content.insiderAdvantages ? `
<!-- INSIDER ADVANTAGES -->
<section style="background:#1A1624;padding:64px 32px;">
  <div style="max-width:800px;margin:0 auto;text-align:center;">
    <p style="font-family:'Instrument Sans',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#FF5B1D;margin-bottom:16px;">Why This Works</p>
    <p style="font-family:'Instrument Sans',sans-serif;font-size:16px;color:rgba(255,255,255,0.85);line-height:1.8;max-width:620px;margin:0 auto;">${esc(content.insiderAdvantages)}</p>
  </div>
</section>` : ""}

${consultationArr.length > 0 ? `
<!-- CONSULTATION OUTLINE -->
<section class="section" style="max-width:800px;margin:0 auto;padding:64px 32px;">
  <p style="font-family:'Instrument Sans',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#FF5B1D;margin-bottom:24px;text-align:center;">What to Expect</p>
  ${steps(consultationArr)}
</section>` : ""}

${content.scarcityUrgency ? `
<!-- SCARCITY / CTA -->
<section style="background:#FF5B1D;padding:64px 32px;text-align:center;">
  <div style="max-width:720px;margin:0 auto;">
    <p style="font-family:'Fraunces',serif;font-style:italic;font-weight:900;font-size:32px;color:#fff;line-height:1.25;margin-bottom:20px;">${esc(content.scarcityUrgency)}</p>
    <a href="${esc(primaryCtaUrl)}" style="display:inline-block;font-family:'Instrument Sans',sans-serif;font-size:16px;font-weight:700;color:#FF5B1D;background:#fff;padding:16px 48px;border-radius:9999px;text-decoration:none;letter-spacing:0.02em;">
      ${esc(content.primaryCta || "Get Started")}
    </a>
  </div>
</section>` : ""}

${faqArr.length > 0 ? `
<!-- FAQ -->
<section class="section" style="max-width:800px;margin:0 auto;padding:64px 32px;">
  <p style="font-family:'Instrument Sans',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#FF5B1D;margin-bottom:24px;text-align:center;">Frequently Asked Questions</p>
  ${faq(faqArr)}
</section>` : ""}

<!-- FOOTER CTA -->
<section style="background:#1A1624;padding:56px 32px;text-align:center;">
  <p style="font-family:'Fraunces',serif;font-style:italic;font-weight:900;font-size:28px;color:#fff;margin-bottom:24px;">${esc(content.primaryCta || "Get Started Today")}</p>
  <a href="${esc(primaryCtaUrl)}" style="display:inline-block;font-family:'Instrument Sans',sans-serif;font-size:16px;font-weight:700;color:#fff;background:#FF5B1D;padding:16px 48px;border-radius:9999px;text-decoration:none;letter-spacing:0.02em;">
    ${esc(content.primaryCta || "Get Started")}
  </a>
  <p style="font-family:'Instrument Sans',sans-serif;font-size:12px;color:rgba(255,255,255,0.4);margin-top:32px;">© ${new Date().getFullYear()} ${esc(serviceName)}. All rights reserved.</p>
</section>

</body>
</html>`;
}
