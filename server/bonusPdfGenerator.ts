import type { LeadMagnetFormat } from "./leadMagnetContentGenerator";

// ─── Bonus PDF generation (forward-sequence step 2, Layer 2) ─────────────────
// Each generated bonus becomes a real hosted deliverable (PDF + URL) riding the lead-magnet pipeline. Runs as a
// DURABLE jobs-table job (enqueueBonusPdfJob) after the 3 concepts persist — the wizard advances immediately;
// PDFs land async (~2 min). The job is resumable (skips bonuses already done) and reaped-if-pending; a process
// recycle mid-run is recovered by reconcileBonusPdfs on Kit load (replaced the earlier fire-and-forget, which
// orphaned bonuses on an interrupted run with no recovery).

/** Bonus format → lead-magnet format (+ toolkit toolType). Mirrors the settled mapping. */
export function bonusFormatToLeadMagnet(format: string): { leadMagnetFormat: LeadMagnetFormat; toolType?: string } {
  switch (format) {
    case "checklist":
    case "cheatsheet":
      return { leadMagnetFormat: "checklist" };
    case "sop":
      return { leadMagnetFormat: "toolkit", toolType: "sop" };
    case "template":
      return { leadMagnetFormat: "toolkit", toolType: "template" };
    case "script":
      return { leadMagnetFormat: "toolkit", toolType: "script" };
    case "swipe":
      return { leadMagnetFormat: "toolkit", toolType: "swipe" };
    default:
      return { leadMagnetFormat: "checklist" };
  }
}

/**
 * Generate + host a PDF deliverable for each bonus in a set. Persists assetBody FIRST (proves content-gen even
 * when publish fails, e.g. the clean-room's no-Cloudflare), then publishes and persists the URLs. Never throws.
 */
export async function runBonusPdfGeneration(input: { userId: number; bonusSetId: string }): Promise<void> {
  const { getDb } = await import("./db");
  const { bonuses: bonusesTable } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const { generateLeadMagnetContent } = await import("./leadMagnetContentGenerator");
  const { publishDeliverableBody } = await import("./leadMagnetPublisher");
  const { getCoachLogoUrl } = await import("./lib/coachLogo");

  const db = await getDb();
  if (!db) return;
  const rows = await db.select().from(bonusesTable).where(eq(bonusesTable.bonusSetId, input.bonusSetId));
  if (!rows.length) return;
  const coachLogoUrl = await getCoachLogoUrl(input.userId);

  for (const b of rows) {
    try {
      if (!b.serviceId) continue;
      if (b.assetBody != null && b.magnetPdfUrl) continue; // RESUMABLE — already fully done; only fill the gaps
      const { leadMagnetFormat } = bonusFormatToLeadMagnet(b.format);
      // The MUST-MATCH brief: the bonus's advertised description + the ICP obstacle it dissolves, so the PDF
      // body delivers exactly what the offer/LP already promise (no title-only re-derivation).
      const contentBrief = `${b.description}\n\nThis asset solves this specific buyer obstacle: ${b.derivedFromObstacle}`;
      const body = await generateLeadMagnetContent({
        userId: input.userId,
        serviceId: b.serviceId,
        icpId: null,
        campaignId: b.campaignId ?? null,
        title: b.title,
        formatOverride: leadMagnetFormat,
        contentBrief,
        mode: "bonus", // post-purchase framing (buyer already enrolled) + howToUse orientation
      });
      if (!body) {
        console.warn(`[bonusPdf] no body generated for bonus ${b.id} ("${b.title}")`);
        continue;
      }
      // Persist the content FIRST — independent of publish (which needs Cloudflare).
      {
        // Backstop for the bonus BODY. Screen-not-drop for the same reason as the lead magnet.
        const { screenOnPersist, copyFieldsOfJson } = await import("./_core/persistenceGate");
        await screenOnPersist("bonusPdf", (b as any).serviceId, copyFieldsOfJson(body, "assetBody"));
      }
      await db.update(bonusesTable).set({ assetBody: body as any }).where(eq(bonusesTable.id, b.id));

      let published: { deliverableUrl: string; pdfUrl: string } | null = null;
      try {
        published = await publishDeliverableBody(body, {
          userId: input.userId,
          slug: `bonus-${b.id}`,
          storageKey: `bonuses/${input.userId}/${b.id}.pdf`,
          coachLogoUrl,
        });
      } catch (pubErr) {
        console.warn(`[bonusPdf] publish failed for bonus ${b.id}: ${pubErr instanceof Error ? pubErr.message : String(pubErr)}`);
      }
      if (published) {
        await db.update(bonusesTable)
          .set({ magnetHtmlUrl: published.deliverableUrl, magnetPdfUrl: published.pdfUrl || null })
          .where(eq(bonusesTable.id, b.id));
        console.log(`[bonusPdf] bonus ${b.id} published: ${published.deliverableUrl} pdf=${published.pdfUrl ? "yes" : "none"}`);
      }
    } catch (e) {
      console.warn(`[bonusPdf] bonus ${b.id} errored: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

// ─── Durable job wrapper + reconciliation (Layer 2 robustness) ───────────────
// The bonus-PDF work runs as a real jobs-table job — durable + resumable (the loop above skips bonuses already
// done). Deterministic job id `bpdf-{setId}` is an idempotency lock (one active job per set). Reaped-if-pending
// by the existing stuck-job reaper; a running-interrupted loss (process recycle mid-run) is recovered by
// reconcileBonusPdfs on Kit load — this is what fixes the fire-and-forget orphaning.
const BONUS_PDF_JOB_PREFIX = "bpdf-";
const RECONCILE_STALE_MS = 10 * 60 * 1000; // a bonus with a concept but no assetBody after 10 min is orphaned

export async function enqueueBonusPdfJob(userId: number, bonusSetId: string): Promise<void> {
  const { getDb } = await import("./db");
  const { jobs } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return;
  const jobId = `${BONUS_PDF_JOB_PREFIX}${bonusSetId}`;
  const progress = JSON.stringify({ kind: "bonusPdf", bonusSetId });
  // Upsert: fresh id → insert pending; an existing failed/complete/stale row → reset to pending + fresh timestamp.
  await db.insert(jobs).values({ id: jobId, userId: String(userId), status: "pending", progress })
    .onDuplicateKeyUpdate({ set: { status: "pending", progress, error: null, createdAt: new Date() } });
  setImmediate(async () => {
    try {
      await db.update(jobs).set({ status: "running" }).where(eq(jobs.id, jobId));
      await runBonusPdfGeneration({ userId, bonusSetId }); // resumable — only fills the bonuses still missing a PDF
      await db.update(jobs).set({ status: "complete" }).where(eq(jobs.id, jobId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[bonusPdf] job ${jobId} failed: ${msg}`);
      try { await db.update(jobs).set({ status: "failed", error: msg.slice(0, 1024) }).where(eq(jobs.id, jobId)); } catch { /* non-fatal */ }
    }
  });
}

// Self-heal on Kit load: any bonus in this kit with a concept but no assetBody, older than the stale window and
// not covered by an active (pending/running + recent) job, gets a fresh durable job. Non-blocking; safe to call
// on every Kit render — the idempotency lock + resumable loop make duplicate calls harmless.
export async function reconcileBonusPdfs(userId: number, campaignKitId: number): Promise<void> {
  const { getDb } = await import("./db");
  const { bonuses, jobs } = await import("../drizzle/schema");
  const { eq, and, isNull, lt } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return;
  const cutoff = new Date(Date.now() - RECONCILE_STALE_MS);
  const stale = await db.select({ bonusSetId: bonuses.bonusSetId })
    .from(bonuses)
    .where(and(eq(bonuses.campaignKitId, campaignKitId), eq(bonuses.userId, userId), isNull(bonuses.assetBody), lt(bonuses.updatedAt, cutoff)));
  const setIds = Array.from(new Set(stale.map((s) => s.bonusSetId)));
  for (const setId of setIds) {
    const jobId = `${BONUS_PDF_JOB_PREFIX}${setId}`;
    const [job] = await db.select({ status: jobs.status, createdAt: jobs.createdAt }).from(jobs).where(eq(jobs.id, jobId)).limit(1);
    const active = !!job && (job.status === "pending" || job.status === "running") && job.createdAt > cutoff;
    if (active) continue;
    await enqueueBonusPdfJob(userId, setId);
    console.log(`[bonusPdf] reconcile: re-enqueued set ${setId} (kit ${campaignKitId})`);
  }
}
