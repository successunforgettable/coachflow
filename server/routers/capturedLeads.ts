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

// submissionData is a JSON column — mysql2 usually returns it already parsed, but
// be defensive about a string form too. Returns the answer array or [].
type QuizAnswer = { question: string; answer: string; weight: number | null };
function parseAnswers(v: unknown): QuizAnswer[] {
  let arr: unknown = v;
  if (typeof v === "string") { try { arr = JSON.parse(v); } catch { return []; } }
  if (!Array.isArray(arr)) return [];
  return arr.map((it) => {
    const o = (it ?? {}) as Record<string, unknown>;
    const w = Number(o.weight);
    return { question: String(o.question ?? ""), answer: String(o.answer ?? ""), weight: Number.isFinite(w) ? w : null };
  });
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
        // Quiz zero-party data (null/empty for static magnets): the scored band
        // and the decoded answers, ready for the manage UI to render.
        resultBand: r.resultBand ?? null,
        answers: parseAnswers(r.submissionData),
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

      // Decode each row's answers once, and size the quiz columns to the widest
      // row so a coach gets one readable column per question (never a raw JSON
      // blob in a cell). Static-only exports simply carry no Q columns.
      const decoded = rows.map(r => parseAnswers(r.submissionData));
      const maxQ = decoded.reduce((m, a) => Math.max(m, a.length), 0);
      const qHeaders = Array.from({ length: maxQ }, (_, i) => `Q${i + 1}`);

      const header = ["capturedAt", "email", "name", "resultBand", "serviceId", "hvcoId", "consentGiven", ...qHeaders];
      const lines = [header.map(csvCell).join(",")];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const answers = decoded[i];
        const qCells = qHeaders.map((_, qi) => {
          const a = answers[qi];
          // "question — answer" keeps each cell self-contained and readable.
          return csvCell(a ? (a.question ? `${a.question} — ${a.answer}` : a.answer) : "");
        });
        lines.push([
          csvCell(r.createdAt ? new Date(r.createdAt).toISOString() : ""),
          csvCell(safeDecrypt(r.emailEncrypted)),
          csvCell(r.nameEncrypted ? safeDecrypt(r.nameEncrypted) : ""),
          csvCell(r.resultBand ?? ""),
          csvCell(String(r.serviceId ?? "")),
          csvCell(String(r.hvcoId ?? "")),
          csvCell(r.consentGiven ? "yes" : "no"),
          ...qCells,
        ].join(","));
      }
      return { csv: lines.join("\n"), count: rows.length };
    }),
});

function safeDecrypt(v: string): string {
  try { return decryptPii(v); } catch { return "[decrypt-error]"; }
}
