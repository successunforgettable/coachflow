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
 *        o_85          — 85% opacity on the whole layer (bar + text)
 *        fl_layer_apply — close and composite the layer
 *
 * @param uploadUrl   The Cloudinary secure_url returned by storagePut
 * @param headline    Raw plain-text headline string — encoded internally (single-pass, no double-encoding)
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
  //
  // DO NOT use encodeURIComponent here — it causes double-encoding:
  //   encodeURIComponent("90%") → "90%25"
  //   encodeURIComponent("CUT TIME") → "CUT%20TIME"
  // If the URL later passes through any further encoding layer, the %25
  // and %20 each get re-encoded, producing %2525 and %2520 respectively.
  //
  // Single-pass minimal encoder — only encodes chars that would break
  // Cloudinary's URL transformation parser:
  //   - % MUST be encoded first (to avoid re-encoding our own escape sequences)
  //   - Colons → %3A  CRITICAL: Cloudinary uses : as the l_text:font:text separator
  //   - Commas → %2C  Cloudinary uses commas as parameter separators
  //   - Slashes → %2F  slashes split the URL path into new segments
  //   - Spaces → %20  invalid in URL paths
  //   - ? → %3F  query string delimiter
  //   - # → %23  fragment delimiter
  const encoded = headline
    .replace(/%/g,  "%25") // must be first — encodes literal % signs in text
    .replace(/:/g,  "%3A") // CRITICAL: Cloudinary l_text:font:text separator
    .replace(/ /g,  "%20") // spaces invalid in URL path segments
    .replace(/,/g,  "%2C") // Cloudinary parameter separator
    .replace(/\//g, "%2F") // URL path separator
    .replace(/\?/g, "%3F") // query string delimiter
    .replace(/#/g,  "%23"); // fragment delimiter

  const transforms = [
    `l_text:Arial_52_bold:${encoded}`,
    `b_rgb:000000,co_white,g_${gravity},w_1080,o_85,fl_layer_apply`,
  ].join("/");

  // Insert before the version/public_id segment — Cloudinary applies transforms left-to-right
  return uploadUrl.replace("/upload/", `/upload/${transforms}/`);
}
