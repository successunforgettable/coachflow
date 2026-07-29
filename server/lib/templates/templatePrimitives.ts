/**
 * templatePrimitives — shared, dependency-free building blocks for the
 * per-reference landing-page templates (Burchard #1 and templates 2–9).
 *
 * DELIBERATELY MINIMAL. This is NOT a config/theme engine — the old
 * `TemplateConfig`/`sectionMap` "one style × five layouts" machinery
 * (`renderTemplate.ts`) is exactly what the LP rebuild replaced. Each
 * per-reference template stays a bespoke, hand-built replica of its frozen
 * capture and keeps its own small local palette. These helpers only remove
 * the truly generic, byte-identical repetition (escaping, guards, the
 * document shell, a few themeable primitives) so a new template is less
 * from-scratch without becoming generic.
 *
 * `esc`/`ok` are the CANONICAL versions for the new template system:
 *   - `esc` escapes apostrophes (`'` → `&#39;`) — the correct, attribute-safe
 *     behavior. (`shared.ts` — the legacy energetic renderer's helpers — does
 *     NOT escape apostrophes; that path is being retired per the rebuild and is
 *     left untouched here to avoid changing already-published legacy output.)
 */

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Non-empty-content guard. Rejects blanks and the generator's incompleteness marker. */
export function ok(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0 && !v.includes("[Generation incomplete");
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as Record<string, unknown>).length > 0;
  return true;
}

// ── Empty-state discipline (no fabricated stand-ins — render real or omit) ────

/** Render an <img> for a real url, or omit entirely (never a fabricated placeholder). */
export function imgOrOmit(url: string | null | undefined, alt: string, style: string): string {
  return ok(url) ? `<img src="${esc(url)}" alt="${esc(alt)}" style="${style}">` : "";
}

/** Render a section only when it has real content to show. */
export function sectionOrEmpty(show: boolean, html: string): string {
  return show ? html : "";
}

// ── Themeable primitives (color passed in so each template stays on-palette) ──

/** Five-star rating fragment. */
export function stars(color: string, size = 16, spacing = 2): string {
  return `<span aria-hidden="true" style="color:${color};font-size:${size}px;letter-spacing:${spacing}px;line-height:1;">★★★★★</span>`;
}

/** Circled check glyph (benefit bands). */
export function checkCircle(color: string): string {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" style="flex-shrink:0;"><circle cx="12" cy="12" r="10.5" fill="none" stroke="${color}" stroke-width="1.6"/><path d="M7.5 12.3 l3 3 l6.2 -6.6" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Initials monogram from a real name — the honest testimonial avatar (no fabricated photo). */
export function initials(name: string): string {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

/**
 * Wrap the first case-insensitive occurrence of `keyword` in an emphasis span.
 * If the keyword isn't embedded in the sentence, lead with it. Used for the
 * benefit-band keyword treatment.
 */
export function highlightKeyword(sentence: string, keyword: string, color: string): string {
  const safe = esc(sentence);
  if (!ok(keyword)) return safe;
  const k = esc(keyword);
  const idx = safe.toLowerCase().indexOf(k.toLowerCase());
  const span = (t: string) => `<span style="color:${color};font-weight:700;text-transform:uppercase;">${t}</span>`;
  if (idx < 0) return `${span(k)} — ${safe}`;
  return safe.slice(0, idx) + span(safe.slice(idx, idx + k.length)) + safe.slice(idx + k.length);
}

/**
 * Wrap the first case-insensitive occurrence of `term` (e.g. the lead-magnet
 * name) in a color emphasis span. No forced insertion — unchanged if absent.
 */
export function highlightTerm(text: string, term: string | null | undefined, color: string): string {
  const safe = esc(text);
  if (!ok(term)) return safe;
  const escTerm = esc(term);
  const idx = safe.toLowerCase().indexOf(escTerm.toLowerCase());
  if (idx < 0) return safe;
  const before = safe.slice(0, idx);
  const match = safe.slice(idx, idx + escTerm.length);
  const after = safe.slice(idx + escTerm.length);
  return `${before}<span style="color:${color};">${match}</span>${after}`;
}

/** Six small line-icons cycled per feature tile (the stroke color is themed). */
export function tileIconSet(color: string): string[] {
  return [
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>`,
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9"/></svg>`,
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>`,
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="${color}"/></svg>`,
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>`,
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 3 14.5 9 21 9.5 16 13.5 17.5 20 12 16.5 6.5 20 8 13.5 3 9.5 9.5 9"/></svg>`,
  ];
}

/**
 * A CTA anchor that actually navigates (booking pages link to a real calendar, unlike the
 * lead-magnet hero's decorative form). `href` is escaped as-is: pass the coach's real URL,
 * or a literal `[INSERT_BOOKING_URL]` token when absent so the publish placeholder hard-gate
 * blocks the page (defense-in-depth for the review-draft-when-absent rule).
 */
export function ctaLink(href: string, label: string, style: string): string {
  return `<a href="${esc(href)}" style="${style}">${esc(label)}</a>`;
}

// ── Document shell ────────────────────────────────────────────────────────────

/**
 * Full HTML document shell (inline-style mandate — the only <style> is a box-sizing
 * reset + body margin/bg). `title` is escaped here; `body` is trusted HTML.
 */
export function renderDocument(opts: {
  title: string;
  fontHref: string;
  bodyBg: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${opts.fontHref}" rel="stylesheet">
<style>*{box-sizing:border-box;}body{margin:0;background:${opts.bodyBg};}</style>
</head>
<body>
${opts.body}
</body>
</html>`;
}

// ─── P9 (2026-07-29): lead-magnet title fitting + article-safe prefixing ─────
// Measured on prod: 6,577 hvcoTitles, mean 104 chars, max 318, 79% over 60.
// The generator produces DESCRIPTIONS, not titles — see STATE.md. Until that is
// fixed at the source, every template slot that prints a magnet name has to fit
// one, or it overruns its container (the 137-char title clipped by the FREE
// badge, and the four-line orange run-on inside "in one simple ___.").

/** Longest magnet title any template slot can carry without breaking layout. */
export const MAGNET_TITLE_MAX = 60;

/**
 * Fit a lead-magnet title to a slot. Cuts at a WORD boundary and appends an
 * ellipsis so a clipped title reads as deliberately shortened rather than as a
 * rendering bug. Never mid-word, never mid-entity.
 */
export function fitTitle(s: unknown, max = MAGNET_TITLE_MAX): string {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const kept = cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max)
    // An unclosed bracket left by the cut reads as a rendering fault, not as
    // truncation — "QUALIFIED FOR (BUT…". Drop the dangling group.
    .replace(/\s*\([^)]*$/, "")
    .replace(/[\s,;:—–-]+$/, "");
  return `${kept}…`;
}

/**
 * Drop a leading article so a title can be prefixed without a grammar break.
 * "Get Your Free" + "The 3-Night Settling Sequence Reset" produced
 * "Get Your Free The 3-Night…" on the published page.
 */
export function withoutLeadingArticle(s: unknown): string {
  return String(s ?? "").replace(/^\s*(the|a|an)\s+/i, "").trim();
}

/**
 * Title for a slot that is grammatically prefixed (e.g. "Get Your Free ___").
 * Article-stripped first, then fitted — order matters, otherwise the ellipsis
 * budget is spent on a word that gets removed anyway.
 */
export function fitPrefixedTitle(s: unknown, max = MAGNET_TITLE_MAX): string {
  return fitTitle(withoutLeadingArticle(s), max);
}

/**
 * Fitted title for a slot whose template appends its own punctuation — e.g.
 * "Get Your Free ___ Now!" or "in one simple ___.". A trailing ellipsis there
 * collides with the template's own mark and renders as "Is… Now!" or "Your….".
 * Same fit, no trailing ellipsis, and any dangling connector word removed so the
 * phrase still ends cleanly.
 */
export function fitTitleForPunctuatedSlot(s: unknown, max = MAGNET_TITLE_MAX): string {
  const fitted = fitPrefixedTitle(s, max).replace(/…$/, "").trim();
  // Drop an orphaned opening bracket or a dangling connector left by the cut.
  return fitted
    .replace(/\s*\([^)]*$/, "")
    .replace(/\s+(and|or|but|the|a|an|of|for|to|with|in|on|that|is|are)$/i, "")
    .replace(/[\s,;:—–-]+$/, "")
    .trim();
}
