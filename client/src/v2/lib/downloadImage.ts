/**
 * Real file downloads for Cloudinary-hosted ad creatives.
 *
 * ─── WHY THIS EXISTS: `a.download` DOES NOT WORK CROSS-ORIGIN ────────────────
 *
 * The obvious implementation is already in this codebase, twice, and it does not
 * download anything:
 *
 *   V2AdImageCreator.tsx:200  handleDownload()
 *   V2AssetLibrary.tsx:195    downloadFile()
 *
 *   const a = document.createElement("a");
 *   a.href = creative.imageUrl;          // https://res.cloudinary.com/...
 *   a.download = "zap-ad-12.png";        // ← SILENTLY IGNORED
 *   a.target = "_blank";                 // ← guarantees a tab instead
 *   a.click();
 *
 * The HTML spec makes the `download` attribute apply only to same-origin URLs
 * (and blob:/data:). For a cross-origin href the browser drops it and performs a
 * plain navigation — which, with target="_blank", opens the image in a new tab.
 * That is exactly the wall a user hits: a tab they cannot save from, because the
 * image is the document, and "Save image as" on a top-level image navigation is
 * inconsistent across browsers.
 *
 * ─── WHAT ACTUALLY WORKS ────────────────────────────────────────────────────
 *
 * Two mechanisms, both verified against the live Cloudinary account (dunshei0y)
 * on 2026-08-01 with a real creative URL:
 *
 *   1. fetch → Blob → object URL → a.download → revoke.
 *      A blob: URL is same-origin, so `download` is honoured and we control the
 *      filename completely. Requires CORS; Cloudinary delivery returns
 *      `access-control-allow-origin: *`, confirmed by request.
 *      This is the same pattern `V2AssetLibrary.triggerZipDownload` already uses
 *      successfully for zips — it works there precisely because it is a blob.
 *
 *   2. Cloudinary `fl_attachment:<name>` delivery flag.
 *      Rewriting .../upload/... to .../upload/fl_attachment:my-name/... makes
 *      Cloudinary send `content-disposition: attachment; filename="my-name.png"`,
 *      so a plain navigation downloads. Confirmed returning that exact header.
 *      Needs no CORS and no memory, but depends on the account not enabling
 *      strict transformations (it has not).
 *
 * (1) is primary because it fails loudly and lets us surface an error; (2) is the
 * fallback if the fetch is ever blocked, so a download still happens rather than
 * the user getting nothing.
 */

/** Filesystem- and human-safe slug. Collapses everything else to single dashes. */
export function slugify(input: string, maxLength = 40): string {
  const s = (input ?? "")
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= maxLength) return s;
  // Cut at a dash boundary so words are not sliced mid-token.
  const cut = s.slice(0, maxLength);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > maxLength * 0.5 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "");
}

/**
 * A filename a coach can tell apart at a glance in their Downloads folder.
 * Shape: `zap-ad-1-benefit-money-in-your-name.png`
 *
 * Deliberately leads with the variation number so the four files of a batch sort
 * in deck order, then the register, then the headline — the part a human
 * actually recognises. Falls back progressively so a row missing fields still
 * gets something better than a Cloudinary hash.
 */
export function adCreativeFilename(creative: {
  variationNumber?: number | null;
  headlineFormula?: string | null;
  designStyle?: string | null;
  headline?: string | null;
  id?: number | string | null;
}): string {
  const parts = ["zap-ad"];
  if (creative.variationNumber != null) parts.push(String(creative.variationNumber));
  const register = creative.headlineFormula || creative.designStyle;
  if (register) parts.push(slugify(register, 20));
  const headlineSlug = slugify(creative.headline ?? "", 40);
  if (headlineSlug) parts.push(headlineSlug);
  // Nothing usable at all — fall back to the row id rather than a bare "zap-ad".
  if (parts.length === 1 && creative.id != null) parts.push(String(creative.id));
  return `${parts.join("-")}.png`;
}

/**
 * Cloudinary delivery URL → same URL with the attachment flag and our filename.
 * Returns the input unchanged if it is not a recognisable Cloudinary upload URL,
 * so the caller can still attempt a plain navigation.
 */
export function withCloudinaryAttachment(url: string, filename: string): string {
  // Cloudinary wants the flag as a transformation segment right after /upload/.
  // The name is passed without extension; Cloudinary appends the real format.
  const base = filename.replace(/\.[a-z0-9]+$/i, "");
  return url.replace(/\/(image|raw|video)\/upload\//, `/$1/upload/fl_attachment:${encodeURIComponent(base)}/`);
}

/** Click a synthetic anchor. Kept in one place so the download path is uniform. */
function clickAnchor(href: string, opts: { filename?: string; newTab?: boolean } = {}): void {
  const a = document.createElement("a");
  a.href = href;
  if (opts.filename) a.download = opts.filename;
  if (opts.newTab) a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** How the file was delivered. Lets a caller tell a real save from a fallback. */
export type DownloadOutcome = "downloaded" | "opened-in-tab";

/**
 * Save `url` to disk as `filename`.
 *
 * Returns "downloaded" when a real file save was triggered, or "opened-in-tab"
 * when neither download mechanism was available and we fell back to today's
 * behaviour rather than failing outright.
 *
 * ─── WHY THE TAB FALLBACK STILL EXISTS ───────────────────────────────────────
 * Not every asset can be downloaded from the client. Measured 2026-08-01:
 *
 *   Ad images  — Cloudinary  → `access-control-allow-origin: *`   ✅ blob works
 *   Videos     — Remotion S3 → NO access-control-allow-origin      ❌ CORS blocked
 *
 * The Remotion bucket serves ~18MB mp4s with no CORS header, so `fetch` is
 * blocked and `fl_attachment` is Cloudinary-only. For those the honest outcome
 * is the pre-existing new-tab behaviour — no regression — rather than an error
 * state on a button that used to do something. Making video a true download
 * needs a bucket CORS rule or a server proxy that sets Content-Disposition;
 * neither is a client change.
 *
 * `target="_blank"` appears ONLY on that last-resort path. It is what turns a
 * would-be download into a tab, so it must never be on the primary path.
 */
export async function downloadRemoteFile(url: string, filename: string): Promise<DownloadOutcome> {
  // 1. Real download: blob URLs are same-origin, so `download` is honoured.
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    clickAnchor(objectUrl, { filename });
    // Revoke late: revoking synchronously can cancel the download in some
    // browsers before they have finished reading the blob.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    return "downloaded";
  } catch {
    // 2. Real download via Cloudinary's own Content-Disposition.
    const attachmentUrl = withCloudinaryAttachment(url, filename);
    if (attachmentUrl !== url) {
      clickAnchor(attachmentUrl);
      return "downloaded";
    }
    // 3. Not downloadable from the client — preserve existing behaviour.
    clickAnchor(url, { newTab: true });
    return "opened-in-tab";
  }
}

/** @deprecated Use `downloadRemoteFile`. Kept so no call site silently breaks. */
export const downloadImageFile = downloadRemoteFile;
