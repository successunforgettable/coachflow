import type { LeadMagnetFormat } from "./leadMagnetContentGenerator";

// ─── Bonus PDF generation (forward-sequence step 2, Layer 2) ─────────────────
// Each generated bonus becomes a real hosted deliverable (PDF + URL) riding the lead-magnet pipeline.
// Runs as a fire-and-forget background task after the 3 bonus CONCEPTS are persisted (Layer 1) — the wizard
// advances immediately; PDFs land async (~2 min). Durability tradeoff: fire-and-forget is not reaped/retried
// like the jobs-table cascade, but the concepts persist (offer/LP already show them), so a lost PDF is
// regenerable — acceptable for the deliverable layer; a formal job row is a future hardening.

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
      });
      if (!body) {
        console.warn(`[bonusPdf] no body generated for bonus ${b.id} ("${b.title}")`);
        continue;
      }
      // Persist the content FIRST — independent of publish (which needs Cloudflare).
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
