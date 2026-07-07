/**
 * capturedLeads router — data-handling surface for ZAP-owned lead capture.
 * Every procedure is owner-scoped (a customer only ever sees/affects their own
 * leads). Export decrypts PII; list returns decrypted email for the manage UI.
 *
 *  - list       : the customer's captured leads (decrypted email + context)
 *  - deleteLead : per-lead hard delete (GDPR erasure)
 *  - exportCsv  : per-customer export (all leads, or one campaign)
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { capturedLeads } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { decryptPii } from "../lib/piiCrypto";

function csvCell(v: string): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const capturedLeadsRouter = router({
  list: protectedProcedure
    .input(z.object({ serviceId: z.number().int().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const where = input?.serviceId
        ? and(eq(capturedLeads.userId, ctx.user.id), eq(capturedLeads.serviceId, input.serviceId))
        : eq(capturedLeads.userId, ctx.user.id);
      const rows = await db.select().from(capturedLeads).where(where).orderBy(desc(capturedLeads.createdAt)).limit(1000);
      return rows.map(r => ({
        id: r.id,
        email: safeDecrypt(r.emailEncrypted),
        name: r.nameEncrypted ? safeDecrypt(r.nameEncrypted) : "",
        serviceId: r.serviceId,
        hvcoId: r.hvcoId,
        consentGiven: r.consentGiven,
        capturedAt: r.createdAt,
      }));
    }),

  deleteLead: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Owner-scoped: only the owning customer can delete their lead.
      await db.delete(capturedLeads).where(and(eq(capturedLeads.id, input.id), eq(capturedLeads.userId, ctx.user.id)));
      return { success: true };
    }),

  exportCsv: protectedProcedure
    .input(z.object({ serviceId: z.number().int().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { csv: "", count: 0 };
      const where = input?.serviceId
        ? and(eq(capturedLeads.userId, ctx.user.id), eq(capturedLeads.serviceId, input.serviceId))
        : eq(capturedLeads.userId, ctx.user.id);
      const rows = await db.select().from(capturedLeads).where(where).orderBy(desc(capturedLeads.createdAt));
      const header = ["email", "name", "serviceId", "hvcoId", "consentGiven", "capturedAt"];
      const lines = [header.join(",")];
      for (const r of rows) {
        lines.push([
          csvCell(safeDecrypt(r.emailEncrypted)),
          csvCell(r.nameEncrypted ? safeDecrypt(r.nameEncrypted) : ""),
          csvCell(String(r.serviceId ?? "")),
          csvCell(String(r.hvcoId ?? "")),
          csvCell(r.consentGiven ? "yes" : "no"),
          csvCell(r.createdAt ? new Date(r.createdAt).toISOString() : ""),
        ].join(","));
      }
      return { csv: lines.join("\n"), count: rows.length };
    }),
});

function safeDecrypt(v: string): string {
  try { return decryptPii(v); } catch { return "[decrypt-error]"; }
}
