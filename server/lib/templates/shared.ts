import type { TemplateConfig, LpPageType, CoachAssetOptions, LandingPageContent } from "./types";
import { CTA_BY_PAGE_TYPE } from "./types";

// ─── HTML helpers (ported from landingPageHtml.ts) ──────────────────────────

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function ok(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0 && !v.includes("[Generation incomplete");
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as Record<string, unknown>).length > 0;
  return true;
}

export function hb(v: unknown): { heading: string; body: string[] } | null {
  if (!ok(v)) return null;
  const text = String(v ?? "");
  const lines = text.split("\n").filter(l => l.trim());
  if (!lines.length) return null;
  return { heading: lines[0], body: lines.slice(1) };
}

export function jp<T>(v: unknown, fb: T): T {
  if (!v) return fb;
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return fb; } }
  return v as T;
}

// ─── CTA routing by pageType ────────────────────────────────────────────────

export function ctaLabel(
  content: LandingPageContent,
  pageType: LpPageType,
  idx: number,
): string {
  if (idx === 0 && ok(content.primaryCta)) return String(content.primaryCta);
  const labels = CTA_BY_PAGE_TYPE[pageType] ?? CTA_BY_PAGE_TYPE.sales_page;
  return labels[idx] ?? labels[0] ?? "Get Started";
}

// ─── Reusable HTML fragments ────────────────────────────────────────────────

export function ctaButton(
  config: TemplateConfig,
  label: string,
  dark: boolean = true,
): string {
  const bg = config.ctaGradient ?? config.colors.accent;
  return `<div style="text-align:center;margin-top:24px;">` +
    `<a href="#" style="display:inline-block;font-family:${config.headingFont};font-weight:700;font-style:normal;font-size:20px;` +
    `background:${bg};color:#fff;border:none;border-radius:${config.buttonRadius};` +
    `padding:18px 48px;text-decoration:none;line-height:1.3;transition:transform 150ms;"` +
    ` onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'"` +
    `>${esc(label)}</a></div>`;
}

export function sectionWrapper(
  bg: string,
  padding: string,
  inner: string,
  maxWidth: string,
  extra: string = "",
): string {
  return `<section style="background:${bg};padding:${padding};${extra}">` +
    `<div style="max-width:${maxWidth};margin:0 auto;padding:0 24px;width:100%;">` +
    inner +
    `</div></section>`;
}

export function heading2(
  config: TemplateConfig,
  text: string,
  color: string,
  align: string = "left",
): string {
  return `<h2 style="font-family:${config.headingFont};font-weight:700;font-style:normal;` +
    `font-size:clamp(28px,3.5vw,42px);letter-spacing:${config.headingLetterSpacing};` +
    `line-height:${config.headingLineHeight};color:${color};margin:0 0 24px;text-align:${align};">${esc(text)}</h2>`;
}

export function bodyParagraph(config: TemplateConfig, text: string, color: string): string {
  return `<p style="font-family:${config.bodyFont};font-weight:400;font-style:normal;font-size:18px;` +
    `line-height:${config.bodyLineHeight};color:${color};margin:0 0 14px;">${esc(text)}</p>`;
}

export function bulletCheck(config: TemplateConfig, text: string, textColor: string): string {
  return `<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;">` +
    `<span style="font-family:${config.headingFont};color:${config.colors.accent};font-size:18px;font-weight:700;font-style:normal;flex-shrink:0;line-height:1.5;">` +
    `&#10003;</span>` +
    `<p style="font-family:${config.bodyFont};font-weight:400;font-style:normal;font-size:18px;line-height:1.6;color:${textColor};margin:0;">${esc(text)}</p></div>`;
}

export function bulletX(config: TemplateConfig, text: string, textColor: string): string {
  return `<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;">` +
    `<span style="font-family:${config.headingFont};color:${config.colors.danger};font-size:18px;font-weight:700;font-style:normal;flex-shrink:0;line-height:1.5;">` +
    `&#10005;</span>` +
    `<p style="font-family:${config.bodyFont};font-weight:400;font-style:normal;font-size:18px;line-height:1.6;color:${textColor};margin:0;">${esc(text)}</p></div>`;
}

// ─── Type-specific section renderers ────────────────────────────────────────

export function eventStripHtml(config: TemplateConfig, dark: boolean): string {
  const bg = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const textColor = dark ? config.colors.bodyOnDark : config.colors.bodyOnLight;
  const labelColor = config.colors.accent;
  const items = [
    { icon: "&#128197;", label: "DATE", value: "See registration" },
    { icon: "&#9200;", label: "TIME", value: "Live session" },
    { icon: "&#128187;", label: "FORMAT", value: "Live online" },
  ];
  return `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px;">` +
    items.map(d =>
      `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:12px 16px;text-align:center;min-width:100px;">` +
      `<div style="font-size:22px;margin-bottom:4px;">${d.icon}</div>` +
      `<p style="font-family:${config.bodyFont};font-weight:600;font-style:normal;font-size:11px;color:${labelColor};text-transform:uppercase;letter-spacing:0.08em;margin:0 0 2px;">${d.label}</p>` +
      `<p style="font-family:${config.bodyFont};font-weight:400;font-style:normal;font-size:13px;color:${textColor};margin:0;">${d.value}</p>` +
      `</div>`
    ).join("") +
    `</div>`;
}

export function downloadBadgeHtml(config: TemplateConfig, dark: boolean): string {
  const bg = dark ? "rgba(255,255,255,0.08)" : `${config.colors.accent}11`;
  const textColor = dark ? config.colors.textOnDark : config.colors.textOnLight;
  return `<div style="display:inline-flex;align-items:center;gap:10px;background:${bg};border-radius:${config.cardRadius};padding:12px 20px;margin-bottom:24px;">` +
    `<span style="font-size:20px;">&#9889;</span>` +
    `<span style="font-family:${config.bodyFont};font-weight:600;font-style:normal;font-size:14px;color:${textColor};">Instant access — download starts immediately</span>` +
    `</div>`;
}

export function bookingCueHtml(config: TemplateConfig, dark: boolean): string {
  const bg = dark ? "rgba(255,255,255,0.08)" : `${config.colors.accent}11`;
  const textColor = dark ? config.colors.textOnDark : config.colors.textOnLight;
  return `<div style="display:inline-flex;align-items:center;gap:10px;background:${bg};border-radius:${config.cardRadius};padding:12px 20px;margin-bottom:24px;">` +
    `<span style="font-size:20px;">&#128197;</span>` +
    `<span style="font-family:${config.bodyFont};font-weight:600;font-style:normal;font-size:14px;color:${textColor};">Free 1:1 call — pick a time that works for you</span>` +
    `</div>`;
}

// ─── Cloudinary image helper ────────────────────────────────────────────────

export function cfImg(url: string): string {
  if (!url) return "";
  if (url.includes("/upload/")) return url;
  return url;
}
