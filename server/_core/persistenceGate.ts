/**
 * persistenceGate — the backstop where generated content becomes persisted content.
 *
 * 🔴 WHY THIS EXISTS. Guarding each generator means one wiring point per generator, and
 * every wiring point is a future chance to be missed. That is not hypothetical: when the
 * compliance layer landed, SIX generators were left in no guard family at all
 * (heroMechanisms, hvco, leadMagnetContent, headlines, adCreatives, bonusPdf), and the
 * mechanism's invented "over two hundred families" propagated through five downstream
 * assets before anything looked at it. Per-generator checks are still worth having — their
 * real value is the failContext RETRY loop, which a terminal gate cannot do — but they
 * cannot be the only line. This is the one place that cannot be forgotten when generator
 * #17 is added, because it sits on the insert itself.
 *
 * ── Disposition: DEGRADE, NEVER KILL ─────────────────────────────────────────
 * F1(b) is the governing precedent: a throw mid-cascade destroyed a run that had already
 * completed eight nodes. And a launch-stage coach must never be dead-ended. So the gate
 * DROPS offending rows and keeps the rest. If every row in a batch would be dropped it
 * keeps them and records a loud structured warning rather than emptying the node — a
 * half-honest deck the coach can edit beats a dead wizard, and the publish gate
 * (`meta.publishToMeta`) is the hard stop that actually prevents release.
 *
 * ⚠️ Known limitation, deliberately accepted: in that all-would-drop case invented proof
 * still persists. It is visible in logs, it is blocked at publish, and it is the price of
 * not killing the run. Revisit only with a retry path in place.
 */

import type { OutputHit } from "./complianceAxis";

/** Keys that are identifiers, enums, URLs or bookkeeping — never coach-facing copy. */
const NON_COPY_KEYS = new Set([
  "id", "userId", "serviceId", "campaignId", "icpId", "campaignKitId", "conceptId",
  "mechanismSetId", "hvcoSetId", "headlineSetId", "adSetId", "bonusSetId", "batchId",
  "tabType", "formulaType", "adType", "adStyle", "contentType", "bonusType", "format",
  "source", "rating", "isFavorite", "selectionScore", "complianceScore", "complianceVersion",
  "complianceCheckedAt", "violationReasons", "createdAt", "updatedAt", "downloaded",
  "imageUrl", "rawImageUrl", "verticalImageUrl", "magnetHtmlUrl", "magnetPdfUrl",
  "imageFormat", "variationNumber", "styleType", "designStyle", "headlineFormula",
  "automationEnabled", "sequenceType", "activeAngle", "pageType", "publishedStyle",
  "publicUrl", "slug", "value", "assetBody",
]);

/** Every coach-facing string on a row, as gate fields. */
export function copyFieldsOf(row: Record<string, unknown>): Array<{ location: string; text: string }> {
  const out: Array<{ location: string; text: string }> = [];
  for (const [k, v] of Object.entries(row ?? {})) {
    if (NON_COPY_KEYS.has(k)) continue;
    if (typeof v !== "string") continue;
    const t = v.trim();
    // Short enum-ish tokens carry no claim and only add noise.
    if (t.length < 12) continue;
    out.push({ location: k, text: v });
  }
  return out;
}

/**
 * Pull coach-facing strings out of a JSON column (email `emails`, WhatsApp `messages`,
 * landing-page `*Angle`). copyFieldsOf only sees top-level strings, so without this the
 * three biggest published surfaces would be screened as if they were empty.
 */
export function copyFieldsOfJson(value: unknown, prefix: string, depth = 0): Array<{ location: string; text: string }> {
  const out: Array<{ location: string; text: string }> = [];
  if (depth > 4) return out;
  let v: unknown = value;
  if (typeof v === "string") {
    const t = v.trim();
    if (t.startsWith("{") || t.startsWith("[")) { try { v = JSON.parse(t); } catch { /* plain string */ } }
  }
  if (typeof v === "string") {
    if (v.trim().length >= 12) out.push({ location: prefix, text: v });
    return out;
  }
  if (Array.isArray(v)) {
    v.forEach((x, i) => out.push(...copyFieldsOfJson(x, `${prefix}[${i}]`, depth + 1)));
    return out;
  }
  if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (NON_COPY_KEYS.has(k)) continue;
      out.push(...copyFieldsOfJson(x, `${prefix}.${k}`, depth + 1));
    }
  }
  return out;
}

/** A hit from one of the legacy per-asset validators, normalised for folding. */
export type LegacyHit = { classId: string; matched?: string; location?: string };

export type GateOptions<T> = {
  /** Override field extraction — needed wherever the copy lives in a JSON column. */
  textOf?: (row: T) => Array<{ location: string; text: string }>;
  /**
   * Hits the generator's own legacy validator already found. Folded into the SAME verdict
   * rather than evaluated separately — consolidation means one decision, not one regex.
   */
  legacyHits?: LegacyHit[];
};

export type PersistenceGateResult<T> = {
  kept: T[];
  droppedCount: number;
  hits: OutputHit[];
  /** True when everything would have been dropped and the batch was kept instead. */
  floorApplied: boolean;
};

/**
 * Screen a batch about to be inserted. Derives its own grounding context from the rows'
 * own userId/serviceId, so no call site has to plumb anything through.
 */
export async function gateBeforePersist<T extends Record<string, any>>(
  assetType: string,
  rows: T[],
  opts: GateOptions<T> = {},
): Promise<PersistenceGateResult<T>> {
  const empty: PersistenceGateResult<T> = { kept: rows, droppedCount: 0, hits: [], floorApplied: false };
  if (!Array.isArray(rows) || rows.length === 0) return empty;

  const serviceId = rows.find((r) => r?.serviceId != null)?.serviceId as number | undefined;
  if (serviceId == null) return empty;

  try {
    const { getDb } = await import("../db");
    const { services, idealCustomerProfiles } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return empty;

    const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
    if (!service) return empty;
    const [icp] = await db.select().from(idealCustomerProfiles)
      .where(eq(idealCustomerProfiles.serviceId, serviceId)).limit(1);

    const { checkOutput } = await import("./complianceAxis");
    const { buildCoachCorpus, buildProofSupplied } = await import("./groundingCorpus");
    const grounding = {
      corpus: buildCoachCorpus({ service: service as any, groundingMeta: (icp as any)?.groundingMeta }),
      supplied: buildProofSupplied(service as any),
    };

    const kept: T[] = [];
    const hits: OutputHit[] = [];
    for (const row of rows) {
      const fields = opts.textOf ? opts.textOf(row) : copyFieldsOf(row);
      if (fields.length === 0) { kept.push(row); continue; }
      const res = checkOutput(fields.map((f) => ({ ...f, role: "body" as const })), grounding);
      if (res.ok) { kept.push(row); continue; }
      hits.push(...res.blocking);
    }

    // ── ONE VERDICT ─────────────────────────────────────────────────────────
    // The legacy per-asset validators (_core/validator.ts) run inside the generators and
    // carry detection this layer does not model. Folding their hits in HERE — rather than
    // letting each family reach its own conclusion — is what makes the two systems one
    // decision. It is deliberately additive: replacing the old detectors outright cost five
    // real detections the first time it was tried.
    const legacy = (opts.legacyHits ?? []).map((h) => ({
      classId: String(h.classId), tier: 1 as const,
      description: "Flagged by the asset's own validator.",
      matched: String(h.matched ?? ""), location: String(h.location ?? assetType),
    }));
    if (legacy.length > 0) hits.push(...(legacy as unknown as OutputHit[]));

    if (kept.length === 0 && rows.length > 0) {
      console.warn(
        `[persistenceGate] ${assetType}: every row carried a blocking claim ` +
        `(classes=[${Array.from(new Set(hits.map((h) => String(h.classId)))).join(",")}]). ` +
        `Keeping the batch rather than emptying the node — publish gate remains the hard stop.`,
      );
      return { kept: rows, droppedCount: 0, hits, floorApplied: true };
    }

    if (hits.length > 0) {
      console.warn(
        `[persistenceGate] ${assetType}: dropped ${rows.length - kept.length}/${rows.length} rows ` +
        `(classes=[${Array.from(new Set(hits.map((h) => String(h.classId)))).join(",")}]).`,
      );
    }
    return { kept, droppedCount: rows.length - kept.length, hits, floorApplied: false };
  } catch (err) {
    // A backstop must never be the thing that breaks a write.
    console.error(`[persistenceGate] ${assetType}: screening failed, persisting unchanged —`,
      err instanceof Error ? err.message : String(err));
    return empty;
  }
}

/**
 * Screen without dropping. For assets where removing the row is the WRONG remedy:
 *   - adCreatives — the image is already rendered and uploaded, so dropping the row orphans it
 *   - lead-magnet / bonus `assetBody` — written by UPDATE, and blanking a deliverable a coach
 *     is about to hand out is worse than shipping copy they can edit
 * Records a structured warning so the claim is visible and countable, and leaves the write
 * alone. The publish gate remains the hard stop.
 */
export async function screenOnPersist(
  assetType: string,
  serviceId: number | null | undefined,
  fields: Array<{ location: string; text: string }>,
): Promise<OutputHit[]> {
  if (serviceId == null || fields.length === 0) return [];
  try {
    const { getDb } = await import("../db");
    const { services, idealCustomerProfiles } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return [];
    const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
    if (!service) return [];
    const [icp] = await db.select().from(idealCustomerProfiles)
      .where(eq(idealCustomerProfiles.serviceId, serviceId)).limit(1);
    const { checkOutput } = await import("./complianceAxis");
    const { buildCoachCorpus, buildProofSupplied } = await import("./groundingCorpus");
    const res = checkOutput(fields.map((f) => ({ ...f, role: "body" as const })), {
      corpus: buildCoachCorpus({ service: service as any, groundingMeta: (icp as any)?.groundingMeta }),
      supplied: buildProofSupplied(service as any),
    });
    if (res.blocking.length > 0) {
      console.warn(
        `[persistenceGate] ${assetType} (service ${serviceId}): ${res.blocking.length} blocking claim(s) ` +
        `persisted without dropping — classes=[${Array.from(new Set(res.blocking.map((h) => String(h.classId)))).join(",")}]`,
      );
    }
    return res.blocking;
  } catch (err) {
    console.error(`[persistenceGate] ${assetType}: screen failed —`, err instanceof Error ? err.message : String(err));
    return [];
  }
}
