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
import { and, eq } from "drizzle-orm";
import { storageDelete } from "../storage";

/**
 * ─── PROTECTED SERVICES — NEVER DELETABLE THROUGH THIS HELPER ────────────────
 *
 * 29 creatives live on these services: 25 belong to the E2E smoke account (117174) and 4
 * are Arfeen's own. They are the reason teardown must never be user-scoped — the smoke
 * user OWNS protected rows, so "delete this user's creatives" would destroy them.
 *
 * This list is a SECOND, INDEPENDENT line of defence behind the userId guard, deliberately
 * not derived from it. If a batchId is wrong, stale or reused, the guard alone would not
 * help: a wrong batch belonging to the same user passes the userId check cleanly. So the
 * resolved rows are inspected for these services and the sweep REFUSES before deleting
 * anything, regardless of what the guard said.
 *
 * The cost of being wrong here is unrecoverable — a DB delete makes the Cloudinary URLs
 * unreadable and the images stay hosted forever with no way to find them.
 */
export const PROTECTED_SERVICE_IDS: readonly number[] = [272, 273, 274, 275, 276, 277, 285] as const;

export class ProtectedServiceError extends Error {
  constructor(public readonly serviceIds: number[], public readonly batchId: string) {
    super(
      `REFUSING to sweep batch ${batchId}: it resolves rows on protected service(s) ` +
      `${serviceIds.join(", ")}. Protected services are ${PROTECTED_SERVICE_IDS.join(", ")} ` +
      `and are never deletable through this helper. Nothing was deleted.`,
    );
    this.name = "ProtectedServiceError";
  }
}

export type BatchTeardownResult = {
  batchId: string;
  userId: number;
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
 *
 * ⚠️ `userId` IS REQUIRED, NOT OPTIONAL. The standing rule is that teardown is always
 * id-scoped AND userId-guarded, never scoped by one alone. An optional guard is a guard a
 * caller forgets, and this helper deletes rows whose Cloudinary URLs become unrecoverable
 * the moment they go — so the type system enforces it instead of a comment asking nicely.
 * Both the read and the delete carry the guard; guarding only the read would report the
 * right rows and delete the wrong ones.
 *
 * THROWS `ProtectedServiceError` before deleting anything if the resolved rows touch a
 * protected service. See PROTECTED_SERVICE_IDS for why that check is independent of the
 * userId guard rather than implied by it.
 */
export async function sweepAdCreativeBatch(
  db: any,
  batchId: string,
  userId: number,
  opts: { dryRun?: boolean } = {},
): Promise<BatchTeardownResult> {
  const dryRun = opts.dryRun ?? false;
  const scope = and(eq(adCreatives.batchId, batchId), eq(adCreatives.userId, userId));

  const rows = await db
    .select({
      id: adCreatives.id,
      serviceId: adCreatives.serviceId,
      imageUrl: adCreatives.imageUrl,
      rawImageUrl: adCreatives.rawImageUrl,
    })
    .from(adCreatives)
    .where(scope);

  // ── HARD REFUSAL, BEFORE ANY DELETE AND BEFORE ANY CLOUDINARY CALL ────────
  // Checked on the RESOLVED ROWS, not on the arguments: the question is not "did the
  // caller mean well" but "what would actually be destroyed". A wrong batchId owned by the
  // same user passes the userId guard cleanly, which is precisely the case this catches.
  const touched = Array.from(new Set(
    (rows as { serviceId?: number | null }[])
      .map((r) => r.serviceId)
      .filter((s): s is number => typeof s === "number" && PROTECTED_SERVICE_IDS.includes(s)),
  )).sort((a, b) => a - b);
  if (touched.length > 0) throw new ProtectedServiceError(touched, batchId);

  // Read the ids BEFORE any delete — they are only recoverable from these rows.
  const publicIds: string[] = Array.from(new Set<string>(
    (rows as { imageUrl?: string | null; rawImageUrl?: string | null }[])
      .flatMap(r => [publicIdFromUrl(r.imageUrl), publicIdFromUrl(r.rawImageUrl)])
      .filter((v): v is string => typeof v === "string" && v.length > 0),
  ));

  const result: BatchTeardownResult = {
    batchId, userId, rowsFound: rows.length, rowsDeleted: 0,
    publicIds, cloudinaryDeleted: 0, cloudinaryFailed: [], dryRun,
  };
  if (dryRun) return result;

  for (const id of publicIds) {
    try { await storageDelete(id); result.cloudinaryDeleted += 1; }
    catch { result.cloudinaryFailed.push(id); }
  }

  // Rows go last and unconditionally — a Cloudinary failure must not leave the
  // database above baseline. Same guarded scope as the read.
  const del = await db.delete(adCreatives).where(scope);
  result.rowsDeleted = (del as { affectedRows?: number })?.affectedRows ?? rows.length;
  return result;
}
