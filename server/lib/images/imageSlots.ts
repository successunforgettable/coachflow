/**
 * imageSlots — direct-response landing-page image slot registry + Cloudinary
 * transform composition. Single source of truth for the pipeline.
 *
 * Spec source: docs/landing-page-research/The Direct-Response Landing Page
 * Image Guide (six-slot taxonomy §1, spec sheet §6).
 *
 * ACTIVE slots (built now): hero_image, headshot (presenter portrait),
 * press_logo (trust logos), value_stack. DEFERRED until a template needs them
 * (documented, not built): social_proof (testimonial 4:3), data_proof (4:3).
 *
 * Storage is Cloudinary, so every transform is a URL param — no client-side
 * cropping required. Transforms split into two kinds:
 *   - STRUCTURAL — applied at render time by slotImageUrl(): crop / aspect /
 *     gravity / width. Deterministic per slot.
 *   - USER-CHOICE — baked into the stored url at save time so no DB column is
 *     needed: e_grayscale (trust-logo colour) and a_hflip (presenter facing).
 *     Read/written via setGrayscale/setFacingFlip below.
 *
 * PARKED hardening pass (verified to work against Cloudinary, intentionally
 * deferred per scope): WebP transcode + quality/byte-size enforcement. It slots
 * into buildStructuralTransform() at the marked HARDENING point — prepend
 * `f_webp` and `q_auto:eco` to the params array. Left off now so the first
 * templates are judged on layout, not compression.
 */

export type SlotAssetType = "hero_image" | "headshot" | "press_logo" | "value_stack";

export interface SlotSpec {
  assetType: SlotAssetType;
  /** Human label for the upload UI. */
  label: string;
  /** Aspect ratio numerator/denominator. null = keep source proportions (wide logo bar). */
  ratioW: number | null;
  ratioH: number | null;
  /** fill = crop to ratio (photos); fit = contain without cropping (logos, transparent stacks). */
  crop: "fill" | "fit";
  /** Cloudinary gravity for fill crops. */
  gravity?: "face" | "auto";
  /** Rendered CSS/px width; also the Cloudinary w_ param and the <img width>. */
  renderWidth: number;
  /** Trust logos default to grayscale; per-logo override removes it. */
  grayscaleDefault?: boolean;
  /** Presenter portrait exposes a manual facing (mirror) toggle — no gaze auto-detection. */
  facingToggle?: boolean;
  /** Value stack must stay transparent (PNG); render on any background. */
  transparent?: boolean;
}

export const IMAGE_SLOTS: Record<SlotAssetType, SlotSpec> = {
  hero_image: {
    assetType: "hero_image",
    label: "Hero Visual",
    ratioW: 16, ratioH: 9, crop: "fill", gravity: "auto", renderWidth: 1280,
  },
  headshot: {
    assetType: "headshot",
    label: "Presenter Portrait",
    ratioW: 2, ratioH: 3, crop: "fill", gravity: "face", renderWidth: 400,
    facingToggle: true,
  },
  press_logo: {
    assetType: "press_logo",
    label: "Trust Logo",
    ratioW: null, ratioH: null, crop: "fit", renderWidth: 300,
    grayscaleDefault: true,
  },
  value_stack: {
    assetType: "value_stack",
    label: "Value Stack",
    ratioW: 3, ratioH: 2, crop: "fit", renderWidth: 1200,
    transparent: true,
  },
};

/** Deferred slots — documented so a future template author knows they're planned, not forgotten. */
export const DEFERRED_SLOTS = ["social_proof", "data_proof"] as const;

export function isSlotAssetType(s: string): s is SlotAssetType {
  return s === "hero_image" || s === "headshot" || s === "press_logo" || s === "value_stack";
}

// ── Cloudinary URL parsing ──────────────────────────────────────────────────
// A delivery URL looks like:
//   https://res.cloudinary.com/<cloud>/image/upload/<baked?>/v123/<publicId>.<ext>
// The optional <baked?> component carries USER-CHOICE tokens (e_grayscale,
// a_hflip). slotImageUrl prepends a STRUCTURAL component before it:
//   /upload/<structural>/<baked?>/v123/<publicId>.<ext>

const UPLOAD_SEG = "/image/upload/";

interface ParsedCloudinary {
  head: string;    // up to and including "/image/upload/"
  baked: string;   // baked user-choice transform component, "" if none
  tail: string;    // "v123/publicId.ext" (version + public id)
}

/** True for Cloudinary delivery URLs we can transform. */
export function isCloudinaryUrl(url: string | null | undefined): url is string {
  return !!url && url.includes("res.cloudinary.com") && url.includes(UPLOAD_SEG);
}

/** A transform component is comma-joined `xx_yy` params; the version is `v<digits>`. */
function looksLikeTransform(seg: string): boolean {
  if (/^v\d+$/.test(seg)) return false;
  return /(^|,)[a-z]{1,3}_/.test(seg);
}

function parse(url: string): ParsedCloudinary | null {
  const i = url.indexOf(UPLOAD_SEG);
  if (i < 0) return null;
  const head = url.slice(0, i + UPLOAD_SEG.length);
  const rest = url.slice(i + UPLOAD_SEG.length);
  const firstSlash = rest.indexOf("/");
  const firstSeg = firstSlash < 0 ? rest : rest.slice(0, firstSlash);
  if (firstSlash >= 0 && looksLikeTransform(firstSeg)) {
    return { head, baked: firstSeg, tail: rest.slice(firstSlash + 1) };
  }
  return { head, baked: "", tail: rest };
}

// ── USER-CHOICE tokens (baked into the stored url at save time) ──────────────

function bakedTokens(url: string): string[] {
  const p = parse(url);
  return p && p.baked ? p.baked.split(",").filter(Boolean) : [];
}

function withBakedTokens(url: string, tokens: string[]): string {
  const p = parse(url);
  if (!p) return url;
  const uniq = Array.from(new Set(tokens));
  return uniq.length ? `${p.head}${uniq.join(",")}/${p.tail}` : `${p.head}${p.tail}`;
}

function setToken(url: string, token: string, on: boolean): string {
  if (!isCloudinaryUrl(url)) return url;
  const tokens = bakedTokens(url).filter(t => t !== token);
  if (on) tokens.push(token);
  return withBakedTokens(url, tokens);
}

/** Trust-logo colour: default is grayscale; the override sets on=false to keep original colour. */
export function setGrayscale(url: string, on: boolean): string {
  return setToken(url, "e_grayscale", on);
}
export function hasGrayscale(url: string): boolean {
  return bakedTokens(url).includes("e_grayscale");
}

/** Presenter facing: mirror the portrait so the subject looks toward the CTA. Manual, no gaze detection. */
export function setFacingFlip(url: string, on: boolean): string {
  return setToken(url, "a_hflip", on);
}
export function hasFacingFlip(url: string): boolean {
  return bakedTokens(url).includes("a_hflip");
}

// ── STRUCTURAL transform (applied at render) ────────────────────────────────

function buildStructuralTransform(spec: SlotSpec): string {
  const params: string[] = [];
  // ── HARDENING (parked): prepend "f_webp", "q_auto:eco" here, then enforce
  //    the byte cap (200KB hero/value-stack, 100KB portrait/logo). Verified to
  //    work against Cloudinary; left off intentionally per scope. ──
  params.push(`c_${spec.crop}`);
  if (spec.ratioW && spec.ratioH) params.push(`ar_${spec.ratioW}:${spec.ratioH}`);
  if (spec.crop === "fill" && spec.gravity) params.push(`g_${spec.gravity}`);
  params.push(`w_${spec.renderWidth}`);
  return params.join(",");
}

/**
 * Compose the render-time delivery URL for a slot: prepends the structural
 * transform, preserving any baked user-choice tokens and the version/publicId.
 * Non-Cloudinary or unknown-slot urls pass through unchanged.
 */
export function slotImageUrl(url: string | null | undefined, assetType: SlotAssetType): string {
  if (!url) return "";
  if (!isCloudinaryUrl(url)) return url;
  const spec = IMAGE_SLOTS[assetType];
  if (!spec) return url;
  const p = parse(url)!;
  const structural = buildStructuralTransform(spec);
  const chained = p.baked ? `${structural}/${p.baked}` : structural;
  return `${p.head}${chained}/${p.tail}`;
}

// ── PDF page-1 → cover image (lead-magnet composite) ────────────────────────
// The lead-magnet delivery layer renders each magnet to a PDF and stores it on
// Cloudinary (resource_type auto → PDFs are image resources). Cloudinary renders
// page 1 as a JPEG via a pure URL transform, so the coach's REAL magnet cover can
// fill the Burchard composite when they haven't uploaded their own — no new API,
// no render job. Verified live against the prod account (dunshei0y): the derived
// URL returns 200 image/jpeg. The "Created with ZAP · 1/N" footer on page 1 is
// accepted as-is (optional later polish: crop it out).
const PDF_COVER_TRANSFORM = "pg_1,f_jpg,c_fit,w_800";

/**
 * Given a Cloudinary PDF delivery URL, return the delivery URL for page 1 as a
 * JPEG cover image. Non-Cloudinary or empty urls return "" (caller falls through
 * to the next cover source). Any baked user-choice tokens are preserved.
 */
export function pdfPageOneCoverUrl(pdfUrl: string | null | undefined): string {
  if (!isCloudinaryUrl(pdfUrl)) return "";
  const p = parse(pdfUrl)!;
  const chained = p.baked ? `${PDF_COVER_TRANSFORM}/${p.baked}` : PDF_COVER_TRANSFORM;
  return `${p.head}${chained}/${p.tail}`;
}

/**
 * Resolve the composite's product-cover URL with the locked fallback order:
 * coach-uploaded value_stack → PDF-derived magnet cover → null (graceful
 * empty-state, handled in the template). Pure so the ordering is unit-tested
 * without a DB.
 */
export function resolveProductCoverUrl(
  uploadedUrl: string | null | undefined,
  magnetPdfUrl: string | null | undefined,
): string | null {
  if (typeof uploadedUrl === "string" && uploadedUrl.trim().length > 0) return uploadedUrl;
  const derived = pdfPageOneCoverUrl(magnetPdfUrl);
  return derived || null;
}

// ── Presenter cutout (hero figure) ──────────────────────────────────────────
// The reference heroes (Rajsekar webinar, Iman event) show the presenter as a
// free-standing CUTOUT — a transparent-background figure over the design, NOT a
// framed rectangular photo. Cloudinary's AI Background Removal add-on (verified
// live on the prod account dunshei0y: e_background_removal,f_png → 200 image/png,
// synchronous, cached) produces the cutout as a PURE delivery-URL transform — the
// exact pattern as pdfPageOneCoverUrl: no new API, no upload job, no migration.
// Chains e_background_removal → c_fit resize → f_png (alpha), preserving any baked
// user-choice tokens (a_hflip facing). Non-Cloudinary or empty urls return "" so
// the caller stages a review-draft ([INSERT_PRESENTER_PHOTO]) rather than shipping
// a framed rectangle. Applied to the RAW headshot (never the g_face slot crop) so
// background removal sees the whole figure.
const PRESENTER_CUTOUT_TRANSFORM = "e_background_removal,c_fit,w_800,f_png";

export function presenterCutoutUrl(url: string | null | undefined): string {
  if (!isCloudinaryUrl(url)) return "";
  const p = parse(url)!;
  const chained = p.baked ? `${PRESENTER_CUTOUT_TRANSFORM}/${p.baked}` : PRESENTER_CUTOUT_TRANSFORM;
  return `${p.head}${chained}/${p.tail}`;
}

/**
 * Publish-time resolution of the presenter cutout, with the same verified-live
 * discipline as the magnet cover: build the background-removal URL and HEAD-verify
 * it. Returns the cutout URL on 200; returns null when removal is impossible or
 * fails (non-Cloudinary source, add-on quota exhausted, unprocessable photo) so the
 * caller emits [INSERT_PRESENTER_PHOTO] and the publish hard-gate stages a
 * review-draft — never a framed rectangle pretending to be a cutout. Applies to
 * BOTH the webinar (Rajsekar) and event (Iman) heroes.
 */
export async function resolvePresenterCutoutUrl(
  rawHeadshotUrl: string | null | undefined,
): Promise<string | null> {
  const cutout = presenterCutoutUrl(rawHeadshotUrl);
  if (!cutout) return null;
  try {
    const res = await fetch(cutout, { method: "HEAD" });
    return res.ok ? cutout : null;
  } catch {
    return null;
  }
}

/**
 * Explicit width/height for the rendered <img>, preventing Cumulative Layout
 * Shift (research §6 rule 3). null height = intrinsic (wide logo bar).
 */
export function slotDimensions(assetType: SlotAssetType): { width: number; height: number | null } {
  const spec = IMAGE_SLOTS[assetType];
  if (!spec || spec.ratioW == null || spec.ratioH == null) {
    return { width: IMAGE_SLOTS[assetType]?.renderWidth ?? 0, height: null };
  }
  return {
    width: spec.renderWidth,
    height: Math.round((spec.renderWidth * spec.ratioH) / spec.ratioW),
  };
}
