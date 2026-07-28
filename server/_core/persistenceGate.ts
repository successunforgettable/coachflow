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
      const fields = copyFieldsOf(row);
      if (fields.length === 0) { kept.push(row); continue; }
      const res = checkOutput(fields.map((f) => ({ ...f, role: "body" as const })), grounding);
      if (res.ok) { kept.push(row); continue; }
      hits.push(...res.blocking);
    }

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
