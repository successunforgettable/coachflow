# Landing Page Template System — Sprint 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the template registry architecture, content changes (FAQ/guarantee/suppress-proof), Energetic template at Kong caliber, campaign-type-aware rendering, and publisher rewire — proving the quality bar on one template across two campaign types before committing to four more.

**Architecture:** Shared `renderTemplate(content, config, coachAssets, pageType)` function reads a `TemplateConfig` (palette + fonts + sectionMap per pageType). Each visual style is a config file; campaign type controls section order and type-specific elements. The two axes compose orthogonally. Old `"text"`/`"visual"` builders remain as legacy fallback for already-published pages.

**Tech Stack:** TypeScript, inline HTML generation (server-side), React (client preview), Drizzle ORM (MySQL/TiDB), Google Fonts.

**Pre-migration preview strategy:** Since the migration is held for Arfeen's go-ahead, the new template system renders via a **parallel code path**. The publisher's `styleMode` enum currently accepts `"text" | "visual"`. We add the 5 new template IDs to the TypeScript types and Zod schemas NOW (accepting them in code), but the DB column still only stores `"text"` or `"visual"` until the migration runs. For Sprint 1 REVIEW purposes, we verify rendering by calling `renderTemplate()` directly in tests with sample content and by previewing in the React `TemplateRenderer` component (which doesn't touch the DB enum). The publish-to-Cloudflare path stays on legacy builders until the migration is applied. This means Arfeen can see and approve the visual quality in the React preview before any prod write.

**Gates:** TS baseline 36, vitest 330/330 (must not regress). Migration DDL prepared, NOT executed.

---

## File Map

### New files (server — template system)
- `server/lib/templates/types.ts` — TemplateConfig type, SectionKey, LpPageType re-export, CoachAssetOptions
- `server/lib/templates/shared.ts` — HTML helpers (esc, ok, hb, jp), section wrappers, type-specific renderers (eventStrip, downloadBadge, bookingCue), CTA routing by pageType
- `server/lib/templates/renderTemplate.ts` — renderTemplate(content, config, coachAssets, pageType) → HTML string
- `server/lib/templates/energetic.ts` — Energetic template config (Kong-caliber)
- `server/lib/templates/registry.ts` — TEMPLATES map, getTemplate() lookup

### New files (client — template preview)
- `client/src/v2/components/templates/templateConfigs.ts` — client-side Energetic config mirror (colors, fonts, layout flags)
- `client/src/v2/components/templates/TemplateRenderer.tsx` — React preview renderer reading TemplateConfig

### Modified files
- `drizzle/schema.ts` — LandingPageContent type: add `guarantee: string`, change `faq?` → `faq`
- `drizzle/0081_landing_page_templates.sql` — Migration DDL (prepared, NOT run)
- `server/landingPageGenerator.ts` — Add guarantee to JSON schema + prompt, FAQ generation instructions, suppress-fabricated-proof logic
- `server/landingPagePublisher.ts` — Read `lp.pageType`, route new style IDs to `renderTemplate()`, keep legacy fallback
- `server/routers/landingPages.ts` — Expand `styleMode` Zod enum to include 5 new template IDs
- `server/routers/complianceRewrites.ts` — Route new style IDs to renderTemplate for re-publish
- `server/_core/orchestration.ts` — Change Auto Mode default from `"visual"` to `"energetic"`
- `server/pipeline-fixes.test.ts` — Add template system structural tests
- `client/src/v2/V2LandingPageResultPanel.tsx` — Wire TemplateRenderer for preview (Sprint 1: Energetic-only, picker UI deferred to Sprint 3)

---

## Task 1: Template Type Definitions

**Files:**
- Create: `server/lib/templates/types.ts`

- [ ] **Step 1: Create types.ts with all type definitions**

```typescript
// server/lib/templates/types.ts
import type { LandingPageContent } from "../../../drizzle/schema";

export type { LandingPageContent };

// Re-export from generator for single source of truth
export type LpPageType =
  | "sales_page"
  | "webinar_registration"
  | "discovery_call_booking"
  | "lead_magnet_download"
  | "event_registration";

export type TemplateStyleId = "executive" | "energetic" | "clinical" | "warm" | "bold";

// All possible style values (new templates + legacy)
export type StyleMode = TemplateStyleId | "text" | "visual";

export type SectionKey =
  | "hero"
  | "asSeenIn"
  | "quiz"
  | "problemAgitation"
  | "solutionIntro"
  | "whyOldFail"
  | "uniqueMechanism"
  | "testimonials"
  | "insiderAdvantages"
  | "scarcityUrgency"
  | "shockingStat"
  | "timeSavingBenefit"
  | "consultationOutline"
  | "guarantee"
  | "faq"
  | "coachAuthority"
  | "socialProofGallery"
  | "gradientCta"
  | "finalCta";

export interface CoachAssetOptions {
  headshotUrl?: string | null;
  logoUrl?: string | null;
  socialProofUrls?: string[];
  coachName?: string | null;
  coachBackground?: string | null;
}

export interface PageTypeLayout {
  order: SectionKey[];
  heroLayout: "split" | "centered" | "offset";
  typeSpecificSections?: {
    eventStrip?: boolean;
    downloadBadge?: boolean;
    bookingCue?: boolean;
  };
}

export interface TemplateConfig {
  id: TemplateStyleId;
  label: string;

  // Typography
  headingFont: string;
  headingFontUrl: string; // Google Fonts URL
  bodyFont: string;
  bodyFontUrl: string;
  headingLetterSpacing: string;
  headingLineHeight: string;
  bodyLineHeight: string;

  // Color palette
  colors: {
    pageBg: string;
    dark: string;
    light: string;
    white: string;
    accent: string;
    accentHover: string;
    textOnDark: string;
    textOnLight: string;
    bodyOnDark: string;
    bodyOnLight: string;
    muted: string;
    border: string;
    danger: string;
  };

  // Layout
  maxWidth: string;
  sectionPadding: string;
  navStyle: "dark" | "light" | "transparent";
  buttonRadius: string;
  cardRadius: string;
  ctaGradient: string | null; // null = solid accent color

  // Decorative
  decorative: {
    shadowLevel: 0 | 1 | 2 | 3 | 4 | 5;
    glassBorder: boolean;
    highlightedHeadingWords: boolean;
    sectionDivider: "none" | "line" | "gradient-fade";
    testimonialCardStyle: "bordered" | "shadow" | "glass";
  };

  // Campaign-type section maps
  sectionMap: Record<LpPageType, PageTypeLayout>;
}

// CTA text arrays keyed by page type
export const CTA_BY_PAGE_TYPE: Record<LpPageType, string[]> = {
  sales_page: [
    "Get Started Now", "Yes — I Want This", "Claim Your Spot",
    "Start Building Today", "Reserve Your Spot", "I'm Ready", "Get Started",
  ],
  webinar_registration: [
    "Register Now", "Save My Seat", "I'm Ready to Join",
    "Reserve Your Spot", "Yes — Count Me In", "Secure My Place", "Register Free",
  ],
  discovery_call_booking: [
    "Book Your Free Call", "Schedule Now", "Let's Talk",
    "Book My Session", "Yes — I'm Ready", "Claim Your Spot", "Book Now",
  ],
  lead_magnet_download: [
    "Download Free", "Get My Copy", "Send It To Me",
    "Yes — I Want This", "Download Now", "Get Instant Access", "Claim Your Free Copy",
  ],
  event_registration: [
    "Reserve Your Seat", "Register Now", "Save Your Spot",
    "I'll Be There", "Secure My Place", "Register for the Event", "Count Me In",
  ],
};
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit 2>&1 | grep "templates/types" | head -5`
Expected: No errors from this file (or zero lines of output).

- [ ] **Step 3: Commit**

```bash
git add server/lib/templates/types.ts
git commit -m "feat(lp): template type definitions — TemplateConfig, SectionKey, PageTypeLayout, CTA routing maps

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Shared HTML Helpers + Type-Specific Section Renderers

**Files:**
- Create: `server/lib/templates/shared.ts`

- [ ] **Step 1: Create shared.ts with HTML helpers and type-specific renderers**

```typescript
// server/lib/templates/shared.ts
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
  // First CTA always uses the LLM-generated primaryCta if present
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

/** Event details strip — date/time/venue badges for webinar + event pages */
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

/** Download badge — instant-access callout for lead magnet pages */
export function downloadBadgeHtml(config: TemplateConfig, dark: boolean): string {
  const bg = dark ? "rgba(255,255,255,0.08)" : `${config.colors.accent}11`;
  const textColor = dark ? config.colors.textOnDark : config.colors.textOnLight;
  return `<div style="display:inline-flex;align-items:center;gap:10px;background:${bg};border-radius:${config.cardRadius};padding:12px 20px;margin-bottom:24px;">` +
    `<span style="font-size:20px;">&#9889;</span>` +
    `<span style="font-family:${config.bodyFont};font-weight:600;font-style:normal;font-size:14px;color:${textColor};">Instant access — download starts immediately</span>` +
    `</div>`;
}

/** Booking cue — duration/calendar hint for discovery call pages */
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
  // If already a Cloudinary URL with transformations, return as-is
  if (url.includes("/upload/")) return url;
  return url;
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep "templates/shared" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add server/lib/templates/shared.ts
git commit -m "feat(lp): shared HTML helpers + type-specific section renderers (eventStrip, downloadBadge, bookingCue)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: renderTemplate — The Shared Renderer

**Files:**
- Create: `server/lib/templates/renderTemplate.ts`

This is the core function. It reads the TemplateConfig's sectionMap for the given pageType, iterates sections in order, skips empty content, and produces a complete HTML page.

- [ ] **Step 1: Create renderTemplate.ts**

```typescript
// server/lib/templates/renderTemplate.ts
import type { TemplateConfig, LpPageType, CoachAssetOptions, LandingPageContent, SectionKey } from "./types";
import {
  esc, ok, hb, jp, ctaLabel, ctaButton, sectionWrapper, heading2,
  bodyParagraph, bulletCheck, bulletX, eventStripHtml, downloadBadgeHtml,
  bookingCueHtml, cfImg,
} from "./shared";

export function renderTemplate(
  content: LandingPageContent,
  config: TemplateConfig,
  coach: CoachAssetOptions,
  pageType: LpPageType,
): string {
  const { headshotUrl = null, logoUrl = null, socialProofUrls = [], coachName = null, coachBackground = null } = coach;
  const c = config.colors;
  const layout = config.sectionMap[pageType];
  if (!layout) throw new Error(`Template "${config.id}" has no sectionMap for pageType "${pageType}"`);

  const YEAR = new Date().getFullYear();
  let ctaIdx = 0;
  function nextCta(dark: boolean): string {
    const label = ctaLabel(content, pageType, ctaIdx);
    ctaIdx++;
    return ctaButton(config, label, dark);
  }

  // Parse arrays from content (handles string-encoded JSON)
  const testimonials = jp<Array<{ headline?: string; quote?: string; name?: string; location?: string }>>(content.testimonials, []);
  const outline = jp<Array<{ title?: string; description?: string }>>(content.consultationOutline, []);
  const faqRaw = jp<Array<{ question?: string; answer?: string; q?: string; a?: string }>>(content.faq, []);
  const faqItems = faqRaw.map(f => ({ q: f.question || f.q || "", a: f.answer || f.a || "" })).filter(f => f.q);
  const asSeenIn = Array.isArray(content.asSeenIn) ? content.asSeenIn : [];
  const quiz = jp<{ question?: string; options?: string[]; answer?: string }>(content.quizSection, {});

  // Section renderers — each returns HTML string or "" if content missing
  const sectionRenderers: Record<SectionKey, () => string> = {
    hero: () => {
      if (!ok(content.eyebrowHeadline) && !ok(content.mainHeadline)) return "";
      const isDark = c.dark === c.pageBg || config.navStyle === "dark";
      const textCol = isDark ? c.textOnDark : c.textOnLight;
      const bodyCol = isDark ? c.bodyOnDark : c.bodyOnLight;
      const heroBg = c.dark;

      // Type-specific elements in hero
      const typeSpecific = layout.typeSpecificSections;
      const eventStripMarkup = typeSpecific?.eventStrip ? eventStripHtml(config, true) : "";
      const downloadBadgeMarkup = typeSpecific?.downloadBadge ? downloadBadgeHtml(config, true) : "";
      const bookingCueMarkup = typeSpecific?.bookingCue ? bookingCueHtml(config, true) : "";

      if (layout.heroLayout === "split" && headshotUrl) {
        // 2-column: text left, photo right
        return `<section style="background:${heroBg};padding:${config.sectionPadding};">` +
          `<div style="max-width:${config.maxWidth};margin:0 auto;padding:0 24px;width:100%;display:flex;gap:40px;flex-wrap:wrap;align-items:center;">` +
          `<div style="flex:1 1 55%;min-width:300px;">` +
          (ok(content.eyebrowHeadline) ? `<p style="font-family:${config.bodyFont};color:${c.accent};font-size:14px;font-weight:600;font-style:normal;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">${esc(content.eyebrowHeadline)}</p>` : "") +
          (ok(content.mainHeadline) ? `<h1 style="font-family:${config.headingFont};font-size:clamp(28px,4vw,52px);font-weight:700;font-style:normal;line-height:${config.headingLineHeight};letter-spacing:${config.headingLetterSpacing};color:${textCol};margin:0 0 20px;">${esc(content.mainHeadline)}</h1>` : "") +
          (ok(content.subheadline) ? `<p style="font-family:${config.bodyFont};font-size:18px;font-weight:400;font-style:normal;color:${bodyCol};margin:0 0 28px;line-height:${config.bodyLineHeight};">${esc(content.subheadline)}</p>` : "") +
          eventStripMarkup + downloadBadgeMarkup + bookingCueMarkup +
          nextCta(true) +
          `</div>` +
          `<div style="flex:0 1 40%;min-width:260px;display:flex;justify-content:center;align-items:center;">` +
          `<img src="${esc(cfImg(headshotUrl))}" alt="${esc(coachName || "Coach")}" style="width:100%;max-width:420px;max-height:500px;border-radius:${config.cardRadius};object-fit:cover;border:4px solid ${c.accent};">` +
          `</div>` +
          `</div></section>`;
      }

      // Centered hero (no photo or centered layout)
      return `<section style="background:${heroBg};padding:${config.sectionPadding};">` +
        `<div style="max-width:${config.maxWidth};margin:0 auto;padding:0 24px;width:100%;text-align:center;">` +
        (ok(content.eyebrowHeadline) ? `<p style="font-family:${config.bodyFont};color:${c.accent};font-size:14px;font-weight:600;font-style:normal;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">${esc(content.eyebrowHeadline)}</p>` : "") +
        (ok(content.mainHeadline) ? `<h1 style="font-family:${config.headingFont};font-size:clamp(32px,5vw,60px);font-weight:700;font-style:normal;line-height:${config.headingLineHeight};letter-spacing:${config.headingLetterSpacing};color:${textCol};margin:0 0 20px;">${esc(content.mainHeadline)}</h1>` : "") +
        (ok(content.subheadline) ? `<p style="font-family:${config.bodyFont};font-size:20px;font-weight:400;font-style:normal;color:${bodyCol};margin:0 auto 28px;max-width:700px;line-height:${config.bodyLineHeight};">${esc(content.subheadline)}</p>` : "") +
        eventStripMarkup + downloadBadgeMarkup + bookingCueMarkup +
        nextCta(true) +
        `</div></section>`;
    },

    asSeenIn: () => {
      if (!ok(asSeenIn) || asSeenIn.length === 0) return "";
      return sectionWrapper(c.white, "40px 0", `
        <p style="text-align:center;font-family:${config.bodyFont};font-size:12px;font-weight:700;font-style:normal;text-transform:uppercase;letter-spacing:0.1em;color:${c.muted};margin-bottom:20px;">As Seen In</p>
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:32px;">
          ${asSeenIn.map(s => `<span style="font-family:${config.bodyFont};color:${c.muted};font-weight:600;font-size:16px;font-style:normal;">${esc(s)}</span>`).join("")}
        </div>`, config.maxWidth, `border-top:1px solid ${c.border};border-bottom:1px solid ${c.border};`);
    },

    quiz: () => {
      if (!quiz || !ok(quiz.question) || !Array.isArray(quiz.options) || quiz.options.length === 0) return "";
      return sectionWrapper(c.light, config.sectionPadding, `
        ${heading2(config, quiz.question, c.textOnLight, "center")}
        <div style="display:flex;flex-direction:column;gap:12px;max-width:700px;margin:0 auto;">
          ${quiz.options.map((opt: string, i: number) => `
            <div style="background:${c.white};border:1px solid ${c.border};border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:12px;">
              <span style="font-family:${config.headingFont};font-weight:700;font-style:normal;font-size:18px;color:${c.accent};flex-shrink:0;">${String.fromCharCode(65 + i)}.</span>
              <span style="font-family:${config.bodyFont};font-weight:400;font-style:normal;font-size:16px;color:${c.bodyOnLight};">${esc(opt)}</span>
            </div>`).join("")}
        </div>
        ${quiz.answer ? `<div style="margin-top:24px;max-width:700px;margin-left:auto;margin-right:auto;background:${c.accent}11;border:1px solid ${c.accent};border-radius:10px;padding:20px;">
          <p style="font-family:${config.bodyFont};font-weight:600;font-style:normal;font-size:15px;color:${c.accent};margin:0 0 8px;">The Answer:</p>
          <p style="font-family:${config.bodyFont};font-weight:400;font-style:normal;font-size:15px;line-height:1.7;color:${c.textOnLight};margin:0;">${esc(quiz.answer)}</p>
        </div>` : ""}`, config.maxWidth);
    },

    problemAgitation: () => {
      const d = hb(content.problemAgitation);
      if (!d) return "";
      return sectionWrapper(c.light, config.sectionPadding,
        heading2(config, d.heading, c.textOnLight) +
        d.body.map(p => bulletCheck(config, p, c.bodyOnLight)).join("") +
        nextCta(false), config.maxWidth);
    },

    solutionIntro: () => {
      const d = hb(content.solutionIntro);
      if (!d) return "";
      return sectionWrapper(c.light, config.sectionPadding,
        heading2(config, d.heading, c.textOnLight) +
        d.body.map(p => bulletCheck(config, p, c.bodyOnLight)).join(""), config.maxWidth);
    },

    whyOldFail: () => {
      const d = hb(content.whyOldFail);
      if (!d) return "";
      return sectionWrapper(c.white, config.sectionPadding,
        heading2(config, d.heading, c.danger) +
        d.body.map(p => bulletX(config, p, c.bodyOnLight)).join(""), config.maxWidth);
    },

    uniqueMechanism: () => {
      const d = hb(content.uniqueMechanism);
      if (!d) return "";
      return sectionWrapper(c.white, config.sectionPadding,
        heading2(config, d.heading, c.textOnLight) +
        `<div style="width:80px;height:3px;background:${c.accent};margin:0 0 24px;"></div>` +
        d.body.map(p => bodyParagraph(config, p, c.bodyOnLight)).join("") +
        nextCta(false), config.maxWidth);
    },

    testimonials: () => {
      if (testimonials.length === 0) return "";
      const cardStyle = config.decorative.testimonialCardStyle;
      const cardBorder = cardStyle === "bordered" ? `border:1px solid ${c.border};` :
        cardStyle === "glass" ? `border:1px solid rgba(255,255,255,0.12);backdrop-filter:blur(8px);` : "";
      const cardShadow = cardStyle === "shadow" ? `box-shadow:0 4px 16px rgba(0,0,0,0.08);` :
        cardStyle === "glass" ? `box-shadow:0 4px 24px rgba(0,0,0,0.06);` : "";
      return sectionWrapper(c.light, config.sectionPadding, `
        ${heading2(config, "What Our Clients Say", c.textOnLight, "center")}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;">
          ${testimonials.map(tm => `
            <div style="background:${c.white};border-radius:${config.cardRadius};padding:30px 25px;${cardBorder}${cardShadow}">
              ${tm.headline ? `<h3 style="font-family:${config.headingFont};color:${c.accent};font-size:20px;font-weight:700;font-style:normal;margin:0 0 12px;">${esc(tm.headline)}</h3>` : ""}
              ${tm.quote ? `<p style="font-family:${config.bodyFont};color:${c.bodyOnLight};font-style:italic;font-size:16px;font-weight:400;line-height:1.6;margin:0 0 16px;">"${esc(tm.quote)}"</p>` : ""}
              <p style="font-family:${config.headingFont};font-weight:700;font-style:normal;font-size:15px;color:${c.textOnLight};margin:0 0 2px;">${esc(tm.name ?? "")}</p>
              <p style="font-family:${config.bodyFont};font-size:13px;font-weight:400;font-style:normal;color:${c.muted};margin:0;">${esc(tm.location ?? "")}</p>
            </div>`).join("")}
        </div>`, config.maxWidth);
    },

    insiderAdvantages: () => {
      const d = hb(content.insiderAdvantages);
      if (!d) return "";
      return sectionWrapper(c.white, config.sectionPadding,
        heading2(config, d.heading, c.textOnLight) +
        d.body.map(p => bulletCheck(config, p, c.bodyOnLight)).join(""), config.maxWidth);
    },

    scarcityUrgency: () => {
      const d = hb(content.scarcityUrgency);
      if (!d) return "";
      return sectionWrapper(c.light, config.sectionPadding, `
        <div style="border:3px solid ${c.accent};border-radius:${config.cardRadius};padding:40px 32px;">
          ${heading2(config, d.heading, c.accent, "center")}
          ${d.body.map(p => bodyParagraph(config, p, c.bodyOnLight)).join("")}
        </div>`, config.maxWidth);
    },

    shockingStat: () => {
      if (!ok(content.shockingStat)) return "";
      const statText = String(content.shockingStat);
      const bigNum = statText.match(/[\d,]+[%x+]?/)?.[0] ?? "";
      return sectionWrapper(c.white, config.sectionPadding, `
        <div style="text-align:center;">
          ${bigNum ? `<div style="font-family:${config.headingFont};font-size:clamp(48px,10vw,80px);font-weight:700;font-style:normal;color:${c.accent};margin:0 0 12px;line-height:1;letter-spacing:${config.headingLetterSpacing};">${esc(bigNum)}</div>` : ""}
          <p style="font-family:${config.bodyFont};font-size:20px;font-weight:400;font-style:normal;color:${c.bodyOnLight};max-width:700px;margin:0 auto;line-height:1.6;">${esc(statText)}</p>
        </div>`, config.maxWidth);
    },

    timeSavingBenefit: () => {
      const d = hb(content.timeSavingBenefit);
      if (!d) return "";
      return sectionWrapper(c.white, config.sectionPadding,
        heading2(config, d.heading, c.textOnLight) +
        d.body.map(p => bodyParagraph(config, p, c.bodyOnLight)).join(""), config.maxWidth);
    },

    consultationOutline: () => {
      if (outline.length === 0) return "";
      return sectionWrapper(c.white, config.sectionPadding, `
        ${heading2(config, "What You'll Get", c.textOnLight, "center")}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;">
          ${outline.map((item, i) => `
            <div style="background:${c.light};border-radius:${config.cardRadius};padding:24px;display:flex;gap:16px;align-items:flex-start;">
              <div style="flex-shrink:0;width:40px;height:40px;background:${c.accent};border-radius:50%;display:flex;align-items:center;justify-content:center;">
                <span style="font-family:${config.headingFont};font-weight:700;font-style:normal;font-size:16px;color:#fff;">${i + 1}</span>
              </div>
              <div>
                <h3 style="font-family:${config.headingFont};font-size:18px;font-weight:700;font-style:normal;color:${c.textOnLight};margin:0 0 6px;">${esc(item.title ?? "")}</h3>
                <p style="font-family:${config.bodyFont};color:${c.bodyOnLight};margin:0;line-height:1.5;font-size:15px;font-weight:400;font-style:normal;">${esc(item.description ?? "")}</p>
              </div>
            </div>`).join("")}
        </div>`, config.maxWidth);
    },

    guarantee: () => {
      const g = (content as any).guarantee;
      if (!ok(g)) return "";
      const d = hb(g);
      if (!d) return "";
      return sectionWrapper(c.dark, config.sectionPadding, `
        <div style="text-align:center;max-width:800px;margin:0 auto;">
          <div style="font-size:36px;margin-bottom:16px;">&#128170;</div>
          ${heading2(config, d.heading, c.textOnDark, "center")}
          ${d.body.map(p => bodyParagraph(config, p, c.bodyOnDark)).join("")}
        </div>`, config.maxWidth);
    },

    faq: () => {
      if (faqItems.length === 0) return "";
      return `<section style="background:${c.white};padding:${config.sectionPadding};">` +
        `<div style="max-width:900px;margin:0 auto;padding:0 24px;">` +
        heading2(config, "Frequently Asked Questions", c.textOnLight, "center") +
        faqItems.map(f => `
          <details style="border-bottom:1px solid ${c.border};">
            <summary style="display:flex;justify-content:space-between;align-items:center;padding:20px 0;cursor:pointer;list-style:none;font-family:${config.headingFont};font-weight:700;font-style:normal;font-size:18px;color:${c.textOnLight};">
              ${esc(f.q)}
              <span style="font-size:28px;color:${c.accent};flex-shrink:0;margin-left:20px;line-height:1;">+</span>
            </summary>
            <div style="padding-bottom:20px;">
              <p style="font-family:${config.bodyFont};font-weight:400;font-style:normal;font-size:16px;line-height:1.6;color:${c.bodyOnLight};margin:0;">${esc(f.a)}</p>
            </div>
          </details>`).join("") +
        `</div></section>`;
    },

    coachAuthority: () => {
      if (!headshotUrl && !coachName) return "";
      const rawBio = coachBackground && coachBackground.trim().length > 10 ? coachBackground.trim() : "";
      const bioText = rawBio && rawBio.length < 80
        ? `${rawBio}. Helping people achieve their goals.`
        : rawBio;
      return sectionWrapper(c.dark, config.sectionPadding, `
        <div style="display:flex;gap:48px;flex-wrap:wrap;align-items:center;">
          ${headshotUrl ? `<div style="flex:0 1 40%;min-width:260px;"><img src="${esc(cfImg(headshotUrl))}" alt="${esc(coachName || "Coach")}" loading="lazy" style="width:100%;max-width:400px;border-radius:${config.cardRadius};object-fit:cover;border:4px solid ${c.accent};"></div>` : ""}
          <div style="flex:1 1 50%;min-width:280px;">
            ${coachName ? `<h2 style="font-family:${config.headingFont};font-weight:700;font-style:normal;font-size:42px;letter-spacing:${config.headingLetterSpacing};color:${c.textOnDark};margin:0 0 16px;">${esc(coachName)}</h2>` : ""}
            ${bioText ? bodyParagraph(config, bioText, c.bodyOnDark) : ""}
            ${nextCta(true)}
          </div>
        </div>`, config.maxWidth);
    },

    socialProofGallery: () => {
      if (socialProofUrls.length === 0) return "";
      return sectionWrapper(c.dark, config.sectionPadding, `
        ${heading2(config, "Results Our Clients Get", c.textOnDark, "center")}
        <div style="display:flex;flex-wrap:nowrap;gap:16px;overflow-x:auto;padding-bottom:16px;-webkit-overflow-scrolling:touch;">
          ${socialProofUrls.map(url => `<img src="${esc(cfImg(url))}" alt="" loading="lazy" style="height:300px;width:auto;min-width:200px;flex-shrink:0;object-fit:cover;border-radius:8px;">`).join("")}
        </div>`, config.maxWidth);
    },

    gradientCta: () => {
      const bg = config.ctaGradient ?? `linear-gradient(90deg, ${c.accent} 35%, ${c.dark} 100%)`;
      return `<section style="background:${bg};padding:40px 0;text-align:center;">` +
        `<div style="max-width:${config.maxWidth};margin:0 auto;padding:0 24px;">` +
        nextCta(true) +
        `</div></section>`;
    },

    finalCta: () => {
      return sectionWrapper(c.dark, "80px 0", `
        <div style="text-align:center;">
          <h2 style="font-family:${config.headingFont};font-weight:700;font-style:normal;font-size:clamp(24px,3.5vw,36px);letter-spacing:${config.headingLetterSpacing};color:${c.textOnDark};margin:0 0 20px;">${esc(ok(content.mainHeadline) ? String(content.mainHeadline) : "Ready to Get Started?")}</h2>
          <p style="font-family:${config.bodyFont};font-weight:400;font-style:normal;font-size:17px;color:${c.bodyOnDark};margin:0 auto 32px;max-width:650px;line-height:${config.bodyLineHeight};">${esc(ok(content.subheadline) ? String(content.subheadline) : "Take the first step today.")}</p>
          ${nextCta(true)}
        </div>`, config.maxWidth);
    },
  };

  // ─── Assemble page ──────────────────────────────────────────────────────────

  // Nav
  const navBg = config.navStyle === "dark" ? c.dark : config.navStyle === "light" ? c.white : "transparent";
  const navText = config.navStyle === "dark" ? c.textOnDark : c.textOnLight;
  const navBorder = config.navStyle === "transparent" ? "" : `border-bottom:1px solid ${c.border};`;
  const nav = `<nav style="background:${navBg};padding:16px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${navBorder}">` +
    (logoUrl
      ? `<img src="${esc(cfImg(logoUrl))}" alt="${esc("")}" style="height:40px;object-fit:contain;vertical-align:middle;">`
      : `<span style="font-family:${config.headingFont};font-weight:700;font-style:normal;font-size:20px;color:${navText};">${esc("")}</span>`) +
    (ok(content.primaryCta) ? `<a href="#" style="font-family:${config.headingFont};font-size:13px;font-weight:700;font-style:normal;color:#fff;background:${c.accent};padding:10px 22px;border-radius:${config.buttonRadius};text-decoration:none;">${esc(content.primaryCta)}</a>` : "") +
    `</nav>`;

  // Sections
  const sectionHtml = layout.order
    .map(key => {
      const renderer = sectionRenderers[key];
      if (!renderer) return "";
      try { return renderer(); } catch { return ""; }
    })
    .filter(Boolean)
    .join("\n");

  // Footer
  const footer = `<footer style="background:${c.dark};border-top:1px solid ${c.border};padding:24px 48px;text-align:center;">` +
    `<p style="font-family:${config.bodyFont};font-weight:400;font-style:normal;font-size:13px;color:${c.muted};margin:0;">&copy; ${YEAR}. All rights reserved.</p>` +
    `</footer>`;

  // Google Fonts
  const fontUrls = [config.headingFontUrl, config.bodyFontUrl].filter(Boolean);
  const fontLinks = fontUrls.map(url => `<link href="${url}" rel="stylesheet">`).join("\n  ");

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
${nav}
${sectionHtml}
${footer}
</body>
</html>`;
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep "templates/renderTemplate" | head -5`
Expected: No errors (or only pre-existing baseline errors unrelated to this file).

- [ ] **Step 3: Commit**

```bash
git add server/lib/templates/renderTemplate.ts
git commit -m "feat(lp): renderTemplate — shared renderer composing style config x pageType section maps

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Energetic Template Config (Kong Caliber)

**Files:**
- Create: `server/lib/templates/energetic.ts`

The Energetic template is modeled after Kong (getkong.ai): tight heading tracking, black/orange, high energy, gradient CTAs, alternating dark/light sections. This IS the quality bar.

- [ ] **Step 1: Create energetic.ts**

```typescript
// server/lib/templates/energetic.ts
// Kong-caliber direct-response template: tight tracking, black + electric orange,
// gradient CTAs, alternating dark/light, shadow-heavy testimonial cards.
import type { TemplateConfig } from "./types";

export const ENERGETIC: TemplateConfig = {
  id: "energetic",
  label: "Energetic",

  // Typography — Sora (geometric, modern heading) + Space Grotesk (clean body)
  headingFont: "'Sora', sans-serif",
  headingFontUrl: "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap",
  bodyFont: "'Space Grotesk', sans-serif",
  bodyFontUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap",
  headingLetterSpacing: "-0.03em",
  headingLineHeight: "1.1",
  bodyLineHeight: "1.7",

  colors: {
    pageBg: "#000000",
    dark: "#000000",
    light: "#111111",
    white: "#FAFAFA",
    accent: "#FF5C00",
    accentHover: "#FF7A33",
    textOnDark: "#FFFFFF",
    textOnLight: "#000000",
    bodyOnDark: "#B0B0B0",
    bodyOnLight: "#444444",
    muted: "#888888",
    border: "#222222",
    danger: "#FF3333",
  },

  maxWidth: "1140px",
  sectionPadding: "96px 0",
  navStyle: "dark",
  buttonRadius: "8px",
  cardRadius: "16px",
  ctaGradient: "linear-gradient(90deg, #FF5C00 35%, #000 100%)",

  decorative: {
    shadowLevel: 4,
    glassBorder: false,
    highlightedHeadingWords: false,
    sectionDivider: "none",
    testimonialCardStyle: "shadow",
  },

  sectionMap: {
    sales_page: {
      order: [
        "hero", "asSeenIn", "problemAgitation", "solutionIntro",
        "coachAuthority", "socialProofGallery", "uniqueMechanism",
        "whyOldFail", "insiderAdvantages", "testimonials", "quiz",
        "shockingStat", "gradientCta", "consultationOutline",
        "guarantee", "scarcityUrgency", "faq", "finalCta",
      ],
      heroLayout: "split",
    },

    webinar_registration: {
      order: [
        "hero", "consultationOutline", "timeSavingBenefit",
        "coachAuthority", "testimonials", "scarcityUrgency", "faq", "finalCta",
      ],
      heroLayout: "centered",
      typeSpecificSections: { eventStrip: true },
    },

    discovery_call_booking: {
      order: [
        "hero", "insiderAdvantages", "coachAuthority",
        "testimonials", "faq", "finalCta",
      ],
      heroLayout: "split",
      typeSpecificSections: { bookingCue: true },
    },

    lead_magnet_download: {
      order: [
        "hero", "problemAgitation", "coachAuthority",
        "testimonials", "faq", "finalCta",
      ],
      heroLayout: "centered",
      typeSpecificSections: { downloadBadge: true },
    },

    event_registration: {
      order: [
        "hero", "consultationOutline", "insiderAdvantages",
        "coachAuthority", "scarcityUrgency", "faq", "finalCta",
      ],
      heroLayout: "centered",
      typeSpecificSections: { eventStrip: true },
    },
  },
};
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep "templates/energetic" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add server/lib/templates/energetic.ts
git commit -m "feat(lp): Energetic template config — Kong-caliber Sora+Space Grotesk, black/orange, 5 pageType section maps

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Template Registry

**Files:**
- Create: `server/lib/templates/registry.ts`

- [ ] **Step 1: Create registry.ts**

```typescript
// server/lib/templates/registry.ts
import type { TemplateConfig, TemplateStyleId } from "./types";
import { ENERGETIC } from "./energetic";

const TEMPLATES: Record<TemplateStyleId, TemplateConfig> = {
  energetic: ENERGETIC,
  // Sprint 2 additions:
  executive: ENERGETIC,  // placeholder — will be replaced with real config
  clinical: ENERGETIC,   // placeholder
  warm: ENERGETIC,       // placeholder
  bold: ENERGETIC,       // placeholder
};

export function getTemplate(id: TemplateStyleId): TemplateConfig {
  return TEMPLATES[id];
}

export function isTemplateStyleId(s: string): s is TemplateStyleId {
  return s in TEMPLATES;
}

export { TEMPLATES };
```

- [ ] **Step 2: Commit**

```bash
git add server/lib/templates/registry.ts
git commit -m "feat(lp): template registry with getTemplate() lookup — Energetic live, 4 placeholders for Sprint 2

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Schema Type Changes + Migration DDL (Prepared, NOT Run)

**Files:**
- Modify: `drizzle/schema.ts:432-465` (LandingPageContent type)
- Modify: `drizzle/schema.ts:502` (publishedStyle enum)
- Create: `drizzle/0081_landing_page_templates.sql`

- [ ] **Step 1: Update LandingPageContent type — add guarantee, make faq required**

In `drizzle/schema.ts`, modify the `LandingPageContent` type (lines 432-465):

Change line 461 from:
```typescript
  faq?: Array<{
```
to:
```typescript
  faq: Array<{
```

Add after line 464 (after the faq closing `};`):
```typescript
  guarantee: string;
```

The full updated type should end with:
```typescript
  faq: Array<{
    question: string;
    answer: string;
  }>;
  guarantee: string;
};
```

- [ ] **Step 2: Update publishedStyle enum**

In `drizzle/schema.ts`, modify line 502 from:
```typescript
  publishedStyle: mysqlEnum("publishedStyle", ["text", "visual"]).default("text"),
```
to:
```typescript
  publishedStyle: mysqlEnum("publishedStyle", ["text", "visual", "executive", "energetic", "clinical", "warm", "bold"]).default("text"),
```

- [ ] **Step 3: Create migration DDL file (NOT run)**

Create `drizzle/0081_landing_page_templates.sql`:

```sql
-- Landing Page Template System — Sprint 1
-- HOLD: Do NOT apply until Arfeen gives explicit go-ahead.
-- This is a prod write on the landingPages table.

-- 1. Expand publishedStyle enum to include 5 template style IDs.
--    Existing "text" and "visual" values are preserved for backward
--    compatibility on already-published pages.
ALTER TABLE `landingPages`
  MODIFY COLUMN `publishedStyle`
  ENUM('text','visual','executive','energetic','clinical','warm','bold')
  DEFAULT 'text';

-- Note: guarantee and faq changes are to the JSON blob stored in the
-- angle columns (originalAngle, godfatherAngle, etc.), NOT to table
-- columns. No DDL needed for those — they are TypeScript type changes
-- that affect the generator output shape and renderer expectations.
-- The JSON columns accept any valid JSON regardless of the TS type.
```

- [ ] **Step 4: Verify TS baseline**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36 (or verify it hasn't increased — the faq/guarantee type changes will cause new errors in the generator's json_schema object that must be fixed in Task 8).

Note: Making faq required and adding guarantee will cause TS errors in `landingPageGenerator.ts` where the JSON schema's `required` array and `properties` object don't include these fields. Those errors are fixed in Task 8 (generator changes). The TS count may temporarily increase here and come back down in Task 8.

- [ ] **Step 5: Commit**

```bash
git add drizzle/schema.ts drizzle/0081_landing_page_templates.sql
git commit -m "feat(lp): schema type changes (guarantee field, faq required, publishedStyle enum expansion) + migration DDL prepared (NOT run)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Content Changes — Suppress Fabricated Proof

**Files:**
- Modify: `server/landingPageGenerator.ts:359-372` (socialProofGuidance)

- [ ] **Step 1: Update socialProofGuidance to suppress fabricated proof**

In `server/landingPageGenerator.ts`, replace the else branch of the socialProofGuidance conditional (lines 368-372). The current code:

```typescript
    : `NO SOCIAL PROOF DATA PROVIDED:
- For testimonials section: Use outcome-based quotes WITHOUT specific names ("A marketing agency owner" instead of "John Smith")
- For "As Seen In" section: OMIT entirely or use "Trusted by [audience] in 30+ countries"
- DO NOT fabricate customer counts, ratings, or press mentions
- Focus on benefit claims and transformation stories instead`;
```

Replace with:

```typescript
    : `NO SOCIAL PROOF DATA PROVIDED — SUPPRESS ALL FABRICATED PROOF:
- Set "testimonials" to an EMPTY ARRAY []. Do not generate fictional testimonials, fictional names, or fictional quotes of any kind.
- Set "asSeenIn" to an EMPTY ARRAY []. Do not fabricate publication names.
- The renderer will gracefully omit these sections when empty.
- Focus the remaining sections on benefit claims and transformation stories.`;
```

- [ ] **Step 2: Verify the change doesn't break tests**

Run: `npx vitest run server/pipeline-fixes.test.ts 2>&1 | tail -5`
Expected: 330 passed.

- [ ] **Step 3: Commit**

```bash
git add server/landingPageGenerator.ts
git commit -m "fix(lp): suppress fabricated proof — empty arrays for testimonials + asSeenIn when no real social proof data

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Content Changes — Guarantee Field + FAQ Required in Generator

**Files:**
- Modify: `server/landingPageGenerator.ts` (JSON schema, prompt text, required array)

- [ ] **Step 1: Add guarantee and faq to the JSON schema properties**

In `server/landingPageGenerator.ts`, find the `properties` object inside `json_schema.schema` (around line 492-548). After the `consultationOutline` property block (ends around line 548), add:

```typescript
            faq: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" }
                },
                required: ["question", "answer"],
                additionalProperties: false
              }
            },
            guarantee: { type: "string" },
```

- [ ] **Step 2: Add guarantee and faq to the required array**

Find the `required` array (around line 550-555). Add `"faq"` and `"guarantee"` to it:

```typescript
          required: [
            "eyebrowHeadline", "mainHeadline", "subheadline", "primaryCta",
            "asSeenIn", "quizSection", "problemAgitation", "solutionIntro",
            "whyOldFail", "uniqueMechanism", "testimonials", "insiderAdvantages",
            "scarcityUrgency", "shockingStat", "timeSavingBenefit", "consultationOutline",
            "faq", "guarantee"
          ],
```

- [ ] **Step 3: Add FAQ and guarantee generation instructions to the prompt**

In the prompt text (around line 450, after the consultationOutline section #16), add:

```
17. **FAQ** (5-7 frequently asked questions with answers)
    Generate 5-7 FAQ items that address: common objections to buying, logistics questions (how it works, what's included, how long it takes), guarantee details, and one question about who this is NOT for. Each item has a "question" and "answer". Answers should be 2-3 sentences, conversational, and reassuring.

18. **Guarantee** (dedicated guarantee statement, 100-200 words)
    Write a dedicated risk-reversal guarantee section. Format as: first line is the guarantee headline (e.g., "Our 90-Day Money-Back Guarantee"), remaining lines are the guarantee body explaining terms and building confidence. If the operator provided a specific guarantee type or duration in the cascade context above, use it exactly. If not, write a results-oriented satisfaction guarantee appropriate to the offer type. Frame positively — what the customer gets, not what they lose.
```

- [ ] **Step 4: Update PAGETYPE_PROMPTS to include faq and guarantee in sections lists**

For `sales_page` (line 117-119), the sections list already includes `faq` — verify it also includes `guarantee` by adding it. Change line 119 to:
```
solutionIntro, whyOldFail, uniqueMechanism, testimonials, insiderAdvantages,
scarcityUrgency, shockingStat, timeSavingBenefit, consultationOutline, faq, guarantee.
```

For the non-sales-page types (`webinar_registration`, `discovery_call_booking`, `lead_magnet_download`, `event_registration`), each has `faq: []` in their "SECTIONS TO LEAVE EMPTY" list. Change these to include `guarantee: ""` in their empty sections AND remove `faq: []` from the empty list and add `faq` to the populated sections list with a note:
- For webinar: Add `faq` to populated sections with instruction "2-3 FAQ items about the webinar (when, how to access, replay availability)"
- For discovery: Add `faq` to populated sections with "2-3 FAQ items about the call (duration, what to prepare, is it a sales call)"
- For lead_magnet: Add `faq` to populated sections with "2-3 FAQ items about the download (format, how to access, what's included)"
- For event: Add `faq` to populated sections with "2-3 FAQ items about the event (parking, what to bring, dress code)"

All non-sales-page types: add `guarantee: ""` to their SECTIONS TO LEAVE EMPTY list (guarantee is sales-page only for now — short-form pages don't need a dedicated guarantee section).

- [ ] **Step 5: Verify TS baseline**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36 (the baseline — the faq/guarantee additions should resolve any TS errors introduced in Task 6).

- [ ] **Step 6: Verify tests**

Run: `npx vitest run server/pipeline-fixes.test.ts 2>&1 | tail -5`
Expected: 330 passed.

- [ ] **Step 7: Commit**

```bash
git add server/landingPageGenerator.ts
git commit -m "feat(lp): generator adds guarantee field + FAQ required + FAQ generation instructions for all page types

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Publisher Rewire — Route New Style IDs to renderTemplate

**Files:**
- Modify: `server/landingPagePublisher.ts`
- Modify: `server/routers/landingPages.ts:817`

- [ ] **Step 1: Update RunLandingPagePublishInput type**

In `server/landingPagePublisher.ts`, change the `styleMode` type (line 41):

From:
```typescript
  styleMode: "text" | "visual";
```
To:
```typescript
  styleMode: "text" | "visual" | "executive" | "energetic" | "clinical" | "warm" | "bold";
```

- [ ] **Step 2: Add renderTemplate routing in the publisher**

In `server/landingPagePublisher.ts`, replace lines 120-132 (the HTML build section):

From:
```typescript
  // 6. Build HTML for the picked angle + style mode.
  const { buildTextStyleHtml, buildVisualStyleHtml } = await import("./lib/landingPageHtml");
  const { ensureKvNamespace, writeKvPage, deployWorker } = await import("./lib/cloudflare");

  const html = input.styleMode === "visual"
    ? buildVisualStyleHtml(content, serviceName, {
        headshotUrl,
        logoUrl,
        socialProofUrls,
        coachName,
        coachBackground,
      })
    : buildTextStyleHtml(content, serviceName);
```

To:
```typescript
  // 6. Build HTML for the picked angle + style mode.
  const { ensureKvNamespace, writeKvPage, deployWorker } = await import("./lib/cloudflare");

  let html: string;
  const templateStyleIds = ["executive", "energetic", "clinical", "warm", "bold"] as const;
  if (templateStyleIds.includes(input.styleMode as any)) {
    const { renderTemplate } = await import("./lib/templates/renderTemplate");
    const { getTemplate } = await import("./lib/templates/registry");
    const template = getTemplate(input.styleMode as typeof templateStyleIds[number]);
    const lpPageType = (lp as any).pageType || "sales_page";
    html = renderTemplate(content, template, {
      headshotUrl,
      logoUrl,
      socialProofUrls,
      coachName,
      coachBackground,
    }, lpPageType);
  } else {
    // Legacy path for "text" / "visual" — existing published pages
    const { buildTextStyleHtml, buildVisualStyleHtml } = await import("./lib/landingPageHtml");
    html = input.styleMode === "visual"
      ? buildVisualStyleHtml(content, serviceName, {
          headshotUrl,
          logoUrl,
          socialProofUrls,
          coachName,
          coachBackground,
        })
      : buildTextStyleHtml(content, serviceName);
  }
```

- [ ] **Step 3: Update the Zod enum in the tRPC endpoint**

In `server/routers/landingPages.ts`, change line 817:

From:
```typescript
    .input(z.object({ landingPageId: z.number(), styleMode: z.enum(["text", "visual"]).default("text") }))
```
To:
```typescript
    .input(z.object({ landingPageId: z.number(), styleMode: z.enum(["text", "visual", "executive", "energetic", "clinical", "warm", "bold"]).default("text") }))
```

- [ ] **Step 4: Update complianceRewrites.ts to handle new style IDs**

In `server/routers/complianceRewrites.ts`, replace lines 302-325:

From:
```typescript
  const styleMode: "text" | "visual" = lp.publishedStyle === "visual" ? "visual" : "text";
  // ... (lines 304-322)
  const html = styleMode === "visual"
    ? buildVisualStyleHtml(content, serviceName, { headshotUrl, logoUrl, socialProofUrls, coachName, coachBackground })
    : buildTextStyleHtml(content, serviceName);
```

To:
```typescript
  const styleMode = lp.publishedStyle || "text";
  // ... (keep lines 304-322 as-is for coach asset loading)
  let html: string;
  const templateStyleIds = ["executive", "energetic", "clinical", "warm", "bold"] as const;
  if (templateStyleIds.includes(styleMode as any)) {
    const { renderTemplate } = await import("../lib/templates/renderTemplate");
    const { getTemplate } = await import("../lib/templates/registry");
    const template = getTemplate(styleMode as typeof templateStyleIds[number]);
    const lpPageType = (lp as any).pageType || "sales_page";
    html = renderTemplate(content, template, {
      headshotUrl, logoUrl, socialProofUrls, coachName, coachBackground,
    }, lpPageType);
  } else {
    const { buildTextStyleHtml, buildVisualStyleHtml } = await import("../lib/landingPageHtml");
    html = styleMode === "visual"
      ? buildVisualStyleHtml(content, serviceName, { headshotUrl, logoUrl, socialProofUrls, coachName, coachBackground })
      : buildTextStyleHtml(content, serviceName);
  }
```

IMPORTANT: Note the complianceRewrites `renderTemplate` call has a different argument order — it passes `serviceName` separately. Looking at the actual renderTemplate signature, it takes `(content, config, coach, pageType)`. The compliance path needs adjustment. Let me correct:

```typescript
  if (templateStyleIds.includes(styleMode as any)) {
    const { renderTemplate } = await import("../lib/templates/renderTemplate");
    const { getTemplate } = await import("../lib/templates/registry");
    const template = getTemplate(styleMode as typeof templateStyleIds[number]);
    const lpPageType = (lp as any).pageType || "sales_page";
    html = renderTemplate(content, template, {
      headshotUrl, logoUrl, socialProofUrls, coachName, coachBackground,
    }, lpPageType);
  } else {
    const { buildTextStyleHtml, buildVisualStyleHtml } = await import("../lib/landingPageHtml");
    html = styleMode === "visual"
      ? buildVisualStyleHtml(content, serviceName, { headshotUrl, logoUrl, socialProofUrls, coachName, coachBackground })
      : buildTextStyleHtml(content, serviceName);
  }
```

- [ ] **Step 5: Update Auto Mode default**

In `server/_core/orchestration.ts`, change line 365:

From:
```typescript
          styleMode: "visual",
```
To:
```typescript
          styleMode: "energetic",
```

- [ ] **Step 6: Verify TS baseline**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36.

- [ ] **Step 7: Verify tests**

Run: `npx vitest run server/pipeline-fixes.test.ts 2>&1 | tail -5`
Expected: 330 passed.

- [ ] **Step 8: Commit**

```bash
git add server/landingPagePublisher.ts server/routers/landingPages.ts server/routers/complianceRewrites.ts server/_core/orchestration.ts
git commit -m "feat(lp): publisher routes new style IDs to renderTemplate, legacy fallback preserved, Auto Mode default → energetic

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Structural Tests

**Files:**
- Modify: `server/pipeline-fixes.test.ts` (append new test block)

- [ ] **Step 1: Add template system structural tests**

Append to `server/pipeline-fixes.test.ts`:

```typescript
// ─── Landing Page Template System — structural assertions ──────────────────
import { renderTemplate } from "./lib/templates/renderTemplate";
import { getTemplate, isTemplateStyleId, TEMPLATES } from "./lib/templates/registry";
import { ENERGETIC } from "./lib/templates/energetic";
import type { LandingPageContent } from "../drizzle/schema";
import type { LpPageType, TemplateStyleId } from "./lib/templates/types";
import { CTA_BY_PAGE_TYPE } from "./lib/templates/types";
import { ctaLabel, ok, esc, hb } from "./lib/templates/shared";

// Minimal valid content for rendering tests
const SAMPLE_CONTENT: LandingPageContent = {
  eyebrowHeadline: "FOR COACHES WHO WANT MORE CLIENTS",
  mainHeadline: "Stop Guessing — Start Getting Clients With A Proven System",
  subheadline: "The exact method 200+ coaches use to fill their calendar in 90 days.",
  primaryCta: "Book Your Free Strategy Call",
  asSeenIn: [],
  quizSection: { question: "", options: [], answer: "" },
  problemAgitation: "Still Struggling to Get Clients?\nYou post on social media daily but hear crickets.\nYou've tried ads but burned money with nothing to show.",
  solutionIntro: "",
  whyOldFail: "",
  uniqueMechanism: "",
  testimonials: [],
  insiderAdvantages: "What Makes This Different\nWe focus on warm outreach, not cold ads.\nOur system works in 30 days, not 6 months.",
  scarcityUrgency: "Limited Spots Available\nWe only take 10 new clients per month to maintain quality.",
  shockingStat: "",
  timeSavingBenefit: "Save 6 Months of Trial and Error\nOur blueprint gives you the shortcut.",
  consultationOutline: [
    { title: "Revenue Gap Analysis", description: "Find the exact gap between current and target income." },
    { title: "Client Acquisition Audit", description: "Identify which channels are working and which are wasting time." },
  ],
  faq: [
    { question: "How long does it take to see results?", answer: "Most clients see their first new booking within 30 days." },
    { question: "Is this a sales call?", answer: "No — it's a genuine strategy session. We'll map out your plan whether you work with us or not." },
  ],
  guarantee: "Our 90-Day Results Guarantee\nIf you don't see measurable improvement in your client pipeline within 90 days, we'll work with you for free until you do. No questions asked.",
};

describe("Landing Page Template System", () => {
  describe("Registry", () => {
    it("getTemplate returns ENERGETIC config for 'energetic'", () => {
      const config = getTemplate("energetic");
      expect(config.id).toBe("energetic");
      expect(config.headingFont).toContain("Sora");
      expect(config.colors.accent).toBe("#FF5C00");
    });

    it("isTemplateStyleId correctly identifies valid IDs", () => {
      expect(isTemplateStyleId("energetic")).toBe(true);
      expect(isTemplateStyleId("executive")).toBe(true);
      expect(isTemplateStyleId("text")).toBe(false);
      expect(isTemplateStyleId("visual")).toBe(false);
      expect(isTemplateStyleId("unknown")).toBe(false);
    });

    it("all 5 template IDs are registered", () => {
      const ids: TemplateStyleId[] = ["executive", "energetic", "clinical", "warm", "bold"];
      for (const id of ids) {
        expect(getTemplate(id)).toBeDefined();
        expect(getTemplate(id).id).toBeDefined();
      }
    });
  });

  describe("Energetic config", () => {
    it("has sectionMap for all 5 page types", () => {
      const pageTypes: LpPageType[] = [
        "sales_page", "webinar_registration", "discovery_call_booking",
        "lead_magnet_download", "event_registration",
      ];
      for (const pt of pageTypes) {
        expect(ENERGETIC.sectionMap[pt]).toBeDefined();
        expect(ENERGETIC.sectionMap[pt].order.length).toBeGreaterThan(0);
        expect(ENERGETIC.sectionMap[pt].heroLayout).toBeDefined();
      }
    });

    it("sales_page has the most sections (full page)", () => {
      const salesCount = ENERGETIC.sectionMap.sales_page.order.length;
      const webinarCount = ENERGETIC.sectionMap.webinar_registration.order.length;
      const discoveryCount = ENERGETIC.sectionMap.discovery_call_booking.order.length;
      expect(salesCount).toBeGreaterThan(webinarCount);
      expect(salesCount).toBeGreaterThan(discoveryCount);
    });

    it("webinar and event pages have eventStrip type-specific section", () => {
      expect(ENERGETIC.sectionMap.webinar_registration.typeSpecificSections?.eventStrip).toBe(true);
      expect(ENERGETIC.sectionMap.event_registration.typeSpecificSections?.eventStrip).toBe(true);
    });

    it("discovery page has bookingCue, lead_magnet has downloadBadge", () => {
      expect(ENERGETIC.sectionMap.discovery_call_booking.typeSpecificSections?.bookingCue).toBe(true);
      expect(ENERGETIC.sectionMap.lead_magnet_download.typeSpecificSections?.downloadBadge).toBe(true);
    });
  });

  describe("CTA routing", () => {
    it("first CTA uses primaryCta from content", () => {
      const label = ctaLabel(SAMPLE_CONTENT, "sales_page", 0);
      expect(label).toBe("Book Your Free Strategy Call");
    });

    it("subsequent CTAs use page-type-specific labels", () => {
      const webinarLabel = ctaLabel(SAMPLE_CONTENT, "webinar_registration", 1);
      expect(CTA_BY_PAGE_TYPE.webinar_registration).toContain(webinarLabel);

      const discoveryLabel = ctaLabel(SAMPLE_CONTENT, "discovery_call_booking", 1);
      expect(CTA_BY_PAGE_TYPE.discovery_call_booking).toContain(discoveryLabel);
    });
  });

  describe("Shared helpers", () => {
    it("esc escapes HTML entities", () => {
      expect(esc('<script>"alert"</script>')).toBe("&lt;script&gt;&quot;alert&quot;&lt;/script&gt;");
    });

    it("ok returns false for empty/null/undefined", () => {
      expect(ok(null)).toBe(false);
      expect(ok("")).toBe(false);
      expect(ok([])).toBe(false);
      expect(ok("[Generation incomplete")).toBe(false);
    });

    it("ok returns true for populated values", () => {
      expect(ok("hello")).toBe(true);
      expect(ok(["a"])).toBe(true);
    });

    it("hb splits heading and body", () => {
      const result = hb("Title\nLine 1\nLine 2");
      expect(result).toEqual({ heading: "Title", body: ["Line 1", "Line 2"] });
    });
  });

  describe("renderTemplate", () => {
    it("renders sales_page with Energetic config without throwing", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "sales_page");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Sora");
      expect(html).toContain("#FF5C00");
      expect(html).toContain(SAMPLE_CONTENT.mainHeadline);
    });

    it("renders webinar_registration — shorter page, has event strip", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "webinar_registration");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("DATE");
      expect(html).toContain("Live session");
      // Webinar should NOT include problemAgitation or whyOldFail sections
      // (content is populated but section not in webinar's sectionMap order)
      // The section order controls what renders, not content presence
    });

    it("renders discovery_call_booking with booking cue", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "discovery_call_booking");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Free 1:1 call");
    });

    it("renders lead_magnet_download with download badge", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "lead_magnet_download");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Instant access");
    });

    it("includes guarantee section for sales_page", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "sales_page");
      expect(html).toContain("90-Day Results Guarantee");
    });

    it("includes FAQ section when faq array is populated", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "sales_page");
      expect(html).toContain("Frequently Asked Questions");
      expect(html).toContain("How long does it take");
    });

    it("suppressed proof: empty testimonials array produces no testimonials section", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "sales_page");
      expect(html).not.toContain("What Our Clients Say");
    });

    it("suppressed proof: empty asSeenIn array produces no As Seen In section", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "sales_page");
      expect(html).not.toContain("As Seen In");
    });

    it("includes coach authority when headshot provided", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {
        headshotUrl: "https://example.com/photo.jpg",
        coachName: "Test Coach",
      }, "sales_page");
      expect(html).toContain("Test Coach");
    });

    it("webinar page does NOT include problemAgitation even when content has it", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "webinar_registration");
      // problemAgitation content exists but is not in webinar's section order
      expect(html).not.toContain("Still Struggling to Get Clients");
    });
  });
});
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run server/pipeline-fixes.test.ts 2>&1 | tail -10`
Expected: All existing 330 tests pass PLUS the new template tests pass. Total should be 330 + ~20 new = ~350.

- [ ] **Step 3: Verify TS baseline**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36.

- [ ] **Step 4: Commit**

```bash
git add server/pipeline-fixes.test.ts
git commit -m "test(lp): template system structural tests — registry, Energetic config, CTA routing, renderTemplate for all 5 page types

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Client-Side Template Preview (Energetic Only)

**Files:**
- Create: `client/src/v2/components/templates/templateConfigs.ts`
- Create: `client/src/v2/components/templates/TemplateRenderer.tsx`

This task creates the React preview equivalent of renderTemplate. For Sprint 1, only the Energetic config is wired. The picker UI is Sprint 3.

- [ ] **Step 1: Create client-side Energetic config**

```typescript
// client/src/v2/components/templates/templateConfigs.ts

export type TemplateStyleId = "executive" | "energetic" | "clinical" | "warm" | "bold";

export type LpPageType =
  | "sales_page"
  | "webinar_registration"
  | "discovery_call_booking"
  | "lead_magnet_download"
  | "event_registration";

export type SectionKey =
  | "hero" | "asSeenIn" | "quiz" | "problemAgitation" | "solutionIntro"
  | "whyOldFail" | "uniqueMechanism" | "testimonials" | "insiderAdvantages"
  | "scarcityUrgency" | "shockingStat" | "timeSavingBenefit" | "consultationOutline"
  | "guarantee" | "faq" | "coachAuthority" | "socialProofGallery" | "gradientCta" | "finalCta";

export interface PageTypeLayout {
  order: SectionKey[];
  heroLayout: "split" | "centered" | "offset";
  typeSpecificSections?: {
    eventStrip?: boolean;
    downloadBadge?: boolean;
    bookingCue?: boolean;
  };
}

export interface ClientTemplateConfig {
  id: TemplateStyleId;
  label: string;
  headingFont: string;
  headingFontUrl: string;
  bodyFont: string;
  bodyFontUrl: string;
  headingLetterSpacing: string;
  headingLineHeight: string;
  bodyLineHeight: string;
  colors: {
    pageBg: string; dark: string; light: string; white: string;
    accent: string; accentHover: string;
    textOnDark: string; textOnLight: string;
    bodyOnDark: string; bodyOnLight: string;
    muted: string; border: string; danger: string;
  };
  maxWidth: string;
  sectionPadding: string;
  buttonRadius: string;
  cardRadius: string;
  ctaGradient: string | null;
  decorative: {
    testimonialCardStyle: "bordered" | "shadow" | "glass";
  };
  sectionMap: Record<LpPageType, PageTypeLayout>;
}

export const CTA_BY_PAGE_TYPE: Record<LpPageType, string[]> = {
  sales_page: ["Get Started Now", "Yes — I Want This", "Claim Your Spot", "Start Building Today", "Reserve Your Spot", "I'm Ready", "Get Started"],
  webinar_registration: ["Register Now", "Save My Seat", "I'm Ready to Join", "Reserve Your Spot", "Yes — Count Me In", "Secure My Place", "Register Free"],
  discovery_call_booking: ["Book Your Free Call", "Schedule Now", "Let's Talk", "Book My Session", "Yes — I'm Ready", "Claim Your Spot", "Book Now"],
  lead_magnet_download: ["Download Free", "Get My Copy", "Send It To Me", "Yes — I Want This", "Download Now", "Get Instant Access", "Claim Your Free Copy"],
  event_registration: ["Reserve Your Seat", "Register Now", "Save Your Spot", "I'll Be There", "Secure My Place", "Register for the Event", "Count Me In"],
};

export const ENERGETIC_CLIENT: ClientTemplateConfig = {
  id: "energetic",
  label: "Energetic",
  headingFont: "'Sora', sans-serif",
  headingFontUrl: "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap",
  bodyFont: "'Space Grotesk', sans-serif",
  bodyFontUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap",
  headingLetterSpacing: "-0.03em",
  headingLineHeight: "1.1",
  bodyLineHeight: "1.7",
  colors: {
    pageBg: "#000000", dark: "#000000", light: "#111111", white: "#FAFAFA",
    accent: "#FF5C00", accentHover: "#FF7A33",
    textOnDark: "#FFFFFF", textOnLight: "#000000",
    bodyOnDark: "#B0B0B0", bodyOnLight: "#444444",
    muted: "#888888", border: "#222222", danger: "#FF3333",
  },
  maxWidth: "1140px",
  sectionPadding: "96px 0",
  buttonRadius: "8px",
  cardRadius: "16px",
  ctaGradient: "linear-gradient(90deg, #FF5C00 35%, #000 100%)",
  decorative: { testimonialCardStyle: "shadow" },
  sectionMap: {
    sales_page: {
      order: ["hero", "asSeenIn", "problemAgitation", "solutionIntro", "coachAuthority", "socialProofGallery", "uniqueMechanism", "whyOldFail", "insiderAdvantages", "testimonials", "quiz", "shockingStat", "gradientCta", "consultationOutline", "guarantee", "scarcityUrgency", "faq", "finalCta"],
      heroLayout: "split",
    },
    webinar_registration: {
      order: ["hero", "consultationOutline", "timeSavingBenefit", "coachAuthority", "testimonials", "scarcityUrgency", "faq", "finalCta"],
      heroLayout: "centered",
      typeSpecificSections: { eventStrip: true },
    },
    discovery_call_booking: {
      order: ["hero", "insiderAdvantages", "coachAuthority", "testimonials", "faq", "finalCta"],
      heroLayout: "split",
      typeSpecificSections: { bookingCue: true },
    },
    lead_magnet_download: {
      order: ["hero", "problemAgitation", "coachAuthority", "testimonials", "faq", "finalCta"],
      heroLayout: "centered",
      typeSpecificSections: { downloadBadge: true },
    },
    event_registration: {
      order: ["hero", "consultationOutline", "insiderAdvantages", "coachAuthority", "scarcityUrgency", "faq", "finalCta"],
      heroLayout: "centered",
      typeSpecificSections: { eventStrip: true },
    },
  },
};

export function getClientTemplate(id: TemplateStyleId): ClientTemplateConfig {
  // Sprint 1: only Energetic is real; others fall back to Energetic
  return ENERGETIC_CLIENT;
}
```

- [ ] **Step 2: Create TemplateRenderer.tsx**

This is a large file — it mirrors renderTemplate's logic in React/JSX. Create `client/src/v2/components/templates/TemplateRenderer.tsx`. The component accepts `config`, `angleData`, `pageType`, coach assets, and real testimonials. It renders sections in the order specified by `config.sectionMap[pageType].order`, using the config's colors/fonts for styling. Every text element carries full inline font stack (CLAUDE.md invariant).

The TemplateRenderer component structure follows the same pattern as the existing `LandingPageVisualTemplate.tsx` but parameterized by config and pageType. It should:
- Load Google Fonts via `useEffect` on mount (inject `<link>` into document head)
- Iterate `config.sectionMap[pageType].order` and render each section
- Use `ok()` to skip empty sections
- Route CTA text via `CTA_BY_PAGE_TYPE[pageType]`
- Render type-specific elements (event strip, download badge, booking cue) based on `typeSpecificSections`
- Accept `realTestimonials` prop (same as existing component) to bypass LLM-generated quotes

The full implementation follows the same section-by-section pattern as renderTemplate.ts but using JSX and React state (e.g., FAQ accordion with `useState`). This is too large to include inline in the plan — the implementer should port each section renderer from `renderTemplate.ts` into JSX, maintaining the same visual output. Key structural rules:
- Every text element: `style={{ fontFamily: config.headingFont, ... }}`
- Colors from `config.colors.*`
- Section padding from `config.sectionPadding`
- Card radius from `config.cardRadius`
- CTA gradient from `config.ctaGradient`

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36.

- [ ] **Step 4: Commit**

```bash
git add client/src/v2/components/templates/templateConfigs.ts client/src/v2/components/templates/TemplateRenderer.tsx
git commit -m "feat(lp): client-side Energetic config + TemplateRenderer React preview component

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Wire TemplateRenderer Into V2LandingPageResultPanel (Preview Only)

**Files:**
- Modify: `client/src/v2/V2LandingPageResultPanel.tsx`

For Sprint 1, the style toggle pills remain but clicking "Visual Style" now renders via TemplateRenderer with Energetic config instead of the old LandingPageVisualTemplate. The picker UI (5 thumbnails) is Sprint 3.

- [ ] **Step 1: Add import for TemplateRenderer and config**

At the top of `V2LandingPageResultPanel.tsx`, add:

```typescript
import TemplateRenderer from "./components/templates/TemplateRenderer";
import { ENERGETIC_CLIENT } from "./components/templates/templateConfigs";
```

- [ ] **Step 2: Replace LandingPageVisualTemplate usage with TemplateRenderer**

Find where `LandingPageVisualTemplate` is rendered in the visual preview mode and replace it with:

```tsx
<TemplateRenderer
  config={ENERGETIC_CLIENT}
  angleData={activeAngle}
  pageType={(landingPage as any)?.pageType || "sales_page"}
  headshot={coachAssets.headshot}
  logo={coachAssets.logo}
  socialProof={coachAssets.socialProof || []}
  coachName={coachProfile?.coachName}
  coachBackground={coachProfile?.coachBackground}
  realTestimonials={realTestimonials}
/>
```

Note: `pageType` comes from the LP row's `pageType` column (returned by the `get` tRPC query), NOT from string-matching hvcoType/campaignType.

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36.

- [ ] **Step 4: Commit**

```bash
git add client/src/v2/V2LandingPageResultPanel.tsx
git commit -m "feat(lp): wire TemplateRenderer (Energetic) into LP result panel preview — pageType from authoritative column

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Final Gates + Squash to Single Sprint Commit

**Files:** None new — verification only.

- [ ] **Step 1: Full TS baseline check**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36. If higher, investigate and fix before proceeding.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run server/pipeline-fixes.test.ts 2>&1 | tail -10`
Expected: All tests pass (330 original + ~20 new template tests).

- [ ] **Step 3: Run secondary test suites**

Run: `npx vitest run server/lib/complianceFilter.test.ts 2>&1 | tail -3`
Expected: 14/14 pass.

Run: `npx vitest run server/_core/tokenCrypto.test.ts 2>&1 | tail -3`
Expected: 10/10 pass.

- [ ] **Step 4: Interactive squash into single atomic commit**

Per CLAUDE.md sprint discipline, squash all Task 1-12 commits into one atomic commit:

```bash
git log --oneline | head -15
```

Count the commits since the last non-sprint commit (0952f62). Then:

```bash
git reset --soft 0952f62
git add -A
git commit -m "feat: landing page template system Sprint 1 — Energetic template at Kong caliber, campaign-type-aware renderTemplate, guarantee+FAQ+suppress-proof content changes, migration prepared (not run)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Hold for review — do NOT push**

The commit is ready but held. Arfeen needs to:
1. Review the Energetic template quality (React preview) on a real campaign kit
2. Verify both sales_page and webinar_registration render correctly
3. Approve the migration DDL before it's applied to prod

---

## Verification Checklist (Post-Build)

After all tasks complete, verify Energetic on both campaign types:

1. **Sales page (long):** Preview a real sales_page LP in the React panel → should show full page with all sections, Sora+Space Grotesk fonts, #FF5C00 orange accent, tight heading tracking, 96px section padding, guarantee section, FAQ accordion, no fabricated testimonials/asSeenIn if no real proof
2. **Webinar (short):** Preview a webinar_registration LP → should show only hero (with event strip badges) + consultationOutline + timeSavingBenefit + coachAuthority + testimonials + scarcityUrgency + FAQ + finalCta. Event strip shows date/time/format badges. CTA reads "Register Now" (not generic "Get Started").
3. Screenshots of both for Arfeen's review.

---

## Pre-Migration Preview Strategy (recap)

The migration DDL (`drizzle/0081_landing_page_templates.sql`) is prepared but NOT applied. This means:
- The DB column `publishedStyle` still only accepts `"text"` and `"visual"`
- Publishing to Cloudflare with a new template ID would fail at the DB write step (enum mismatch)
- BUT: React preview works fine (it doesn't write to DB, just renders in the browser)
- AND: `renderTemplate()` works fine in tests (pure function, no DB involvement)
- AND: the publisher's routing logic is in place — once the migration runs, publishing with `"energetic"` will work immediately

So the review flow is: Arfeen sees the template quality in the React preview → approves → we apply the migration → publishing goes live with the new templates.
