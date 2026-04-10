/**
 * Transforms Cloudinary URLs to serve JPEG with auto quality.
 * Use for all Cloudinary image URLs across the codebase.
 *
 * Inserts /f_jpg,q_auto/ before the /upload/ segment so Cloudinary
 * transcodes HEIC, WebP, PNG etc. to JPEG on the fly — no re-upload needed.
 * Safe no-op for non-Cloudinary URLs and empty strings.
 *
 * @example
 * cfImg("https://res.cloudinary.com/abc/image/upload/v123/photo.heic")
 * // → "https://res.cloudinary.com/abc/image/upload/f_jpg,q_auto/v123/photo.heic"
 */
export function cfImg(url: string | null | undefined): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com")) return url;
  return url.replace("/upload/", "/upload/f_jpg,q_auto/");
}

/**
 * Construct a Cloudinary transformation URL that composites a headline text
 * overlay with a dark semi-transparent background onto an already-uploaded image.
 *
 * Uses Cloudinary's URL-based transformation API — no server-side fonts, no
 * librsvg, no sharp text rendering. Cloudinary renders the text using its own
 * font stack (standard web-safe fonts + Google Fonts).
 *
 * Transformation chain applied:
 *   1. Open text layer — l_text:Arial_52_bold:{url-encoded headline}
 *   2. Apply layer params:
 *        b_rgb:000000  — black background behind the text block
 *        co_white      — white text colour
 *        g_{gravity}   — north (screenshot) / center (object) / south (person styles)
 *        w_1080        — wrap text at full image width
 *        pa_30         — 30 px padding on all sides of the text block
 *        o_85          — 85% opacity on the whole layer (bar + text)
 *        fl_layer_apply — close and composite the layer
 *
 * @param uploadUrl   The Cloudinary secure_url returned by storagePut
 * @param headline    Raw headline string — encoded internally
 * @param designStyle One of: screenshot | object | person_shocked | person_intense | person_curious
 * @returns Cloudinary delivery URL with text overlay baked into the transformation chain
 */
export function buildHeadlineUrl(
  uploadUrl: string,
  headline: string,
  designStyle: string,
): string {
  if (!uploadUrl || !uploadUrl.includes("res.cloudinary.com")) return uploadUrl;

  // Gravity: matches the R2b layout rules (screenshot=north, object=center, person*=south)
  const gravity =
    designStyle === "screenshot" ? "north" :
    designStyle === "object"     ? "center" :
    "south"; // person_shocked, person_intense, person_curious, default

  // Encode headline for safe embedding in a Cloudinary URL path segment.
  // encodeURIComponent handles most characters; additionally double-encode
  // commas (%2C → %252C) and slashes (%2F → %252F) because these are
  // Cloudinary transformation delimiters and must not be decoded server-side.
  const encoded = encodeURIComponent(headline)
    .replace(/%2C/gi, "%252C")
    .replace(/%2F/gi, "%252F");

  const transforms = [
    `l_text:Arial_52_bold:${encoded}`,
    `b_rgb:000000,co_white,g_${gravity},w_1080,pa_30,o_85,fl_layer_apply`,
  ].join("/");

  // Insert before the version/public_id segment — Cloudinary applies transforms left-to-right
  return uploadUrl.replace("/upload/", `/upload/${transforms}/`);
}
