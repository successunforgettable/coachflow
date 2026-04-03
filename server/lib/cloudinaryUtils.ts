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
