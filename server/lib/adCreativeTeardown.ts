/**
 * Ad-creative batch teardown — DB rows AND their Cloudinary objects.
 *
 * WHY THIS EXISTS. Teardown reconciled the database only, so every torn-down
 * proof run left its images hosted forever: 30 orphans accumulated across three
 * runs on 2026-07-29 alone, and nothing swept them. A DB delete never touches
 * Cloudinary, and once the rows are gone the URLs are unrecoverable — so the
 * public_ids MUST be read before the rows are deleted. That ordering is the
 * whole point of this module and is why it is not two separate helpers.
 *
 * Cloudinary is left to a best-effort pass: a failed image delete must never
 * block the row delete, or a half-torn-down run leaves rows above baseline,
 * which is the worse failure. Failures are returned for the caller to report.
 */
import { adCreatives } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { storageDelete } from "../storage";

export type BatchTeardownResult = {
  batchId: string;
  rowsFound: number;
  rowsDeleted: number;
  publicIds: string[];
  cloudinaryDeleted: number;
  cloudinaryFailed: string[];
  dryRun: boolean;
};

/**
 * Extract the Cloudinary public_id from a stored secure_url.
 *
 * `https://res.cloudinary.com/<cloud>/image/upload/v1785333244/a_b_c.png.png`
 *   -> `a_b_c.png`
 *
 * The trailing extension Cloudinary appends is stripped; the `.png` that is part
 * of the key itself is kept — that double suffix is the known storage-key bug
 * (`.pdf.pdf` / `.png.png`) and the public_id genuinely contains the inner one.
 * Exported for unit testing without touching Cloudinary.
 */
export function publicIdFromUrl(url: unknown): string | null {
  const s = String(url ?? "");
  const afterUpload = s.split("/upload/")[1];
  if (!afterUpload) return null;
  const withoutVersion = afterUpload.replace(/^v\d+\//, "");
  if (!withoutVersion) return null;
  let id: string;
  try { id = decodeURIComponent(withoutVersion); } catch { id = withoutVersion; }
  // Strip ONLY the final delivery extension.
  return id.replace(/\.(png|jpe?g|webp|gif|pdf)$/i, "") || null;
}

/**
 * Delete a batch's Cloudinary objects and then its DB rows, in that order.
 * `dryRun` reports exactly what would go without deleting anything — use it to
 * show Arfeen the list before asking for the go-ahead.
 */
export async function sweepAdCreativeBatch(
  db: any,
  batchId: string,
  opts: { dryRun?: boolean } = {},
): Promise<BatchTeardownResult> {
  const dryRun = opts.dryRun ?? false;
  const rows = await db
    .select({ id: adCreatives.id, imageUrl: adCreatives.imageUrl, rawImageUrl: adCreatives.rawImageUrl })
    .from(adCreatives)
    .where(eq(adCreatives.batchId, batchId));

  // Read the ids BEFORE any delete — they are only recoverable from these rows.
  const publicIds: string[] = Array.from(new Set<string>(
    (rows as { imageUrl?: string | null; rawImageUrl?: string | null }[])
      .flatMap(r => [publicIdFromUrl(r.imageUrl), publicIdFromUrl(r.rawImageUrl)])
      .filter((v): v is string => typeof v === "string" && v.length > 0),
  ));

  const result: BatchTeardownResult = {
    batchId, rowsFound: rows.length, rowsDeleted: 0,
    publicIds, cloudinaryDeleted: 0, cloudinaryFailed: [], dryRun,
  };
  if (dryRun) return result;

  for (const id of publicIds) {
    try { await storageDelete(id); result.cloudinaryDeleted += 1; }
    catch { result.cloudinaryFailed.push(id); }
  }

  // Rows go last and unconditionally — a Cloudinary failure must not leave the
  // database above baseline.
  const del = await db.delete(adCreatives).where(eq(adCreatives.batchId, batchId));
  result.rowsDeleted = (del as { affectedRows?: number })?.affectedRows ?? rows.length;
  return result;
}
