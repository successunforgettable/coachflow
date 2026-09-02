/**
 * TEARDOWN for the Layer 1+2 live proof. Deletes ONLY the declared throwaway scope:
 * the adCreatives rows for the proof service, the ICP, and the service itself.
 *
 * REFUSES TO RUN unless the proof images are already on disk — teardown outranks the artifact
 * read, and a deleted row takes its image with it.
 *
 * Usage: npx tsx scripts/layer12-live-teardown.ts <serviceId> <icpId>
 */
import { existsSync, readdirSync, statSync } from "fs";
import { resolve } from "path";

const STAMP = process.env.PROOF_STAMP || "run-2026-08-05-layer12-proof";
const OUTDIR = resolve(process.cwd(), "docs/screenshots", STAMP);

(async () => {
  const serviceId = Number(process.argv[2]);
  const icpId = Number(process.argv[3]);
  if (!serviceId) throw new Error("usage: layer12-live-teardown.ts <serviceId> <icpId>");

  // ── HARD GATE: images must already be saved ────────────────────────────────
  const files = existsSync(OUTDIR) ? readdirSync(OUTDIR).filter((f) => f.endsWith(".png")) : [];
  const nonEmpty = files.filter((f) => statSync(resolve(OUTDIR, f)).size > 0);
  console.log(`[GATE] proof images on disk: ${nonEmpty.length} in ${OUTDIR}`);
  if (nonEmpty.length === 0) {
    throw new Error("ABORT: no proof images on disk. Refusing to tear down — the rows carry the only copy.");
  }

  const { getDb } = await import("../server/db");
  const schema = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("no db");

  const countOf = async (t: any) => (await db.select().from(t)).length;
  const preCreatives = await countOf(schema.adCreatives);
  const prePublished = await countOf(schema.metaPublishedAds);
  console.log(`[PRE-TEARDOWN] adCreatives=${preCreatives}  meta_published_ads=${prePublished}`);

  const mine: any[] = await db.select().from(schema.adCreatives).where(eq(schema.adCreatives.serviceId, serviceId));
  console.log(`[TEARDOWN] deleting ${mine.length} adCreatives for service ${serviceId}`);
  await db.delete(schema.adCreatives).where(eq(schema.adCreatives.serviceId, serviceId));

  if (icpId) {
    await db.delete(schema.idealCustomerProfiles).where(eq(schema.idealCustomerProfiles.id, icpId));
    console.log(`[TEARDOWN] deleted icp ${icpId}`);
  }
  await db.delete(schema.services).where(eq(schema.services.id, serviceId));
  console.log(`[TEARDOWN] deleted service ${serviceId}`);

  const postCreatives = await countOf(schema.adCreatives);
  const postPublished = await countOf(schema.metaPublishedAds);
  const svcGone = (await db.select().from(schema.services).where(eq(schema.services.id, serviceId))).length === 0;
  console.log(`[POST] adCreatives=${postCreatives}  meta_published_ads=${postPublished}  serviceGone=${svcGone}`);
  console.log(`[RECONCILE] adCreatives delta vs pre-teardown: ${postCreatives - preCreatives} (expect -${mine.length})`);
  console.log(`[RECONCILE] meta_published_ads unchanged: ${postPublished === prePublished}`);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(2); });
