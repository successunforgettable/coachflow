/**
 * ONE-OFF SWEEP — the 4 Cloudinary orphans left by scripts/regen-canvas-proof.ts (2026-08-06).
 *
 * WHY A ONE-OFF AND NOT sweepAdCreativeBatch(): that helper reads public_ids from the STORED ROWS,
 * and this run deleted its rows first — the exact ordering failure its docblock warns about. With
 * the rows gone the URLs are unrecoverable from the DB, so the ids are recovered by listing
 * Cloudinary by prefix instead.
 *
 * SAFETY: matches ONLY `regen-460` / `regen-461` under the ad-creatives/1 prefix — the two throwaway
 * ids from that run. Anything else found is listed and NOT touched. Dry-run unless --execute.
 */
import { v2 as cloudinary } from "cloudinary";

const EXECUTE = process.argv.includes("--execute");
// The two throwaway row ids from run-2026-08-06-regen-canvas. Nothing else is eligible.
const ELIGIBLE = /^ad-creatives_1_(raw-)?regen-46[01]-\d+\.png$/;

async function main() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  // ⚠️ api.resources() caps at 500 per page and is NOT date-ordered — the first attempt returned
  // 500 objects and matched none of the four, because they were on a later page. The Search API
  // filters server-side and sorts newest-first, so the recent run is always in the first page.
  const res: any = await cloudinary.search
    .expression("public_id:ad-creatives_1_*regen-46*")
    .sort_by("created_at", "desc")
    .max_results(100)
    .execute();

  const all: string[] = (res.resources || []).map((r: any) => r.public_id);
  const targets = all.filter((id) => ELIGIBLE.test(id));

  console.log(`[scan] ${all.length} objects matched the search expression`);
  console.log(`[scan] ${targets.length} match the throwaway pattern (expect 4):`);
  for (const id of targets) console.log(`   - ${id}`);

  if (targets.length !== 4) {
    console.log(`[scan] ⚠️ expected 4, found ${targets.length} — NOT deleting. Inspect first.`);
    return;
  }

  if (!EXECUTE) {
    console.log("[dry-run] nothing deleted. Re-run with --execute to sweep these 4.");
    return;
  }

  let ok = 0;
  const failed: string[] = [];
  for (const id of targets) {
    try {
      const r: any = await cloudinary.uploader.destroy(id, { resource_type: "image", invalidate: true });
      if (r?.result === "ok") { ok++; console.log(`[del] ok   ${id}`); }
      else { failed.push(id); console.log(`[del] FAIL ${id} -> ${r?.result}`); }
    } catch (e: any) {
      failed.push(id);
      console.log(`[del] FAIL ${id} -> ${e?.message}`);
    }
  }
  console.log(`[done] deleted ${ok}/4, failed ${failed.length}`);

  const after: any = await cloudinary.api.resources({ type: "upload", prefix: "ad-creatives_1_", max_results: 500 });
  const remaining = (after.resources || []).map((r: any) => r.public_id).filter((id: string) => ELIGIBLE.test(id));
  console.log(`[verify] throwaway objects remaining: ${remaining.length} ${remaining.length === 0 ? "✅ SWEPT" : "🔴"}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e?.message || e); process.exit(1); });
