/**
 * ingestCoachAssetImage — the ONE shared path for getting an image into a
 * coach's asset library, used by BOTH direct uploads (the upload endpoint /
 * saveCoachAsset) and Has-Assets imported images. Whatever the source, an image
 * lands on Cloudinary, gets its slot-default user-choice bake, and is written to
 * coachAssets exactly once, one way.
 *
 * Source kinds:
 *   - { kind: "url" }     already-on-Cloudinary (direct upload endpoint) or a
 *                         remote URL from imported material (fetched + re-hosted)
 *   - { kind: "buffer" }  raw bytes (direct file upload)
 *   - { kind: "dataUrl" } base64 data URL (Has-Assets multimodal material)
 *
 * User-choice bakes (see imageSlots): trust logos default to grayscale unless
 * grayscale:false; presenter portraits mirror when facingFlip:true. Baked into
 * the stored url — no DB column.
 */
import { getDb } from "../../db";
import { coachAssets } from "../../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { storagePut } from "../../storage";
import { setGrayscale, setFacingFlip, isCloudinaryUrl } from "./imageSlots";

export type CoachAssetType =
  | "headshot" | "logo" | "social_proof" | "hero_image" | "press_logo" | "value_stack";

export type IngestSource =
  | { kind: "url"; url: string }
  | { kind: "buffer"; buffer: Buffer; contentType: string; filename?: string }
  | { kind: "dataUrl"; dataUrl: string; filename?: string };

export interface IngestParams {
  userId: number;
  assetType: CoachAssetType;
  source: IngestSource;
  landingPageId?: number | null;
  /** Trust-logo colour override: false keeps original colour (default is grayscale). */
  grayscale?: boolean;
  /** Presenter portrait: mirror so the subject faces the CTA. */
  facingFlip?: boolean;
}

// One asset per scope (replace on save). hero_image + value_stack are per-LP;
// headshot + logo are per-user. press_logo + social_proof accumulate.
const SINGULAR: CoachAssetType[] = ["headshot", "logo", "hero_image", "value_stack"];
const PER_LP: CoachAssetType[] = ["hero_image", "value_stack"];

async function resolveToCloudinary(userId: number, source: IngestSource): Promise<string> {
  if (source.kind === "url") {
    if (isCloudinaryUrl(source.url)) return source.url;
    // Remote URL from imported material — fetch + re-host so it can be transformed.
    const resp = await fetch(source.url);
    if (!resp.ok) throw new Error(`Could not fetch imported image (${resp.status})`);
    const ct = resp.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await resp.arrayBuffer());
    return putBuffer(userId, buf, ct);
  }
  if (source.kind === "buffer") {
    return putBuffer(userId, source.buffer, source.contentType, source.filename);
  }
  // dataUrl
  const m = source.dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!m) throw new Error("Malformed data URL");
  const buf = Buffer.from(m[2], "base64");
  return putBuffer(userId, buf, m[1], source.filename);
}

async function putBuffer(userId: number, buffer: Buffer, contentType: string, filename?: string): Promise<string> {
  const safe = (filename || "image").replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `coach-assets/${userId}/${Date.now()}-${safe}`;
  const { url } = await storagePut(key, buffer, contentType);
  return url;
}

export async function ingestCoachAssetImage(
  params: IngestParams,
): Promise<{ id: number; url: string; assetType: CoachAssetType }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let url = await resolveToCloudinary(params.userId, params.source);

  // Slot-default user-choice bakes.
  if (params.assetType === "press_logo") {
    url = setGrayscale(url, params.grayscale ?? true);
  }
  if (params.assetType === "headshot" && params.facingFlip) {
    url = setFacingFlip(url, true);
  }

  // Replace-in-scope for singular types.
  if (SINGULAR.includes(params.assetType)) {
    const conds = [
      eq(coachAssets.userId, params.userId),
      eq(coachAssets.assetType, params.assetType),
    ];
    if (PER_LP.includes(params.assetType) && params.landingPageId) {
      conds.push(eq(coachAssets.landingPageId, params.landingPageId));
    }
    await db.delete(coachAssets).where(and(...conds));
  }

  const result: any = await db.insert(coachAssets).values({
    userId: params.userId,
    landingPageId: params.landingPageId ?? null,
    assetType: params.assetType,
    url,
  });
  return { id: result[0].insertId, url, assetType: params.assetType };
}
