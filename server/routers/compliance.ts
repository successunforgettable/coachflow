import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import { bannedPhrases, complianceVersions, complianceHistory } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Admin-only middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

export const complianceRouter = router({
  // Get all banned phrases
  listPhrases: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const phrases = await db.select().from(bannedPhrases).orderBy(bannedPhrases.category, bannedPhrases.phrase);
    return phrases;
  }),

  // Get current compliance version
  getVersion: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [version] = await db.select().from(complianceVersions).orderBy(complianceVersions.id).limit(1);
    return version || null;
  }),

  // Add new banned phrase
  addPhrase: adminProcedure
    .input(
      z.object({
        phrase: z.string().min(1).max(255),
        category: z.enum(["critical", "warning"]),
        description: z.string().optional(),
        suggestion: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const newPhrase = {
        phrase: input.phrase.toLowerCase(),
        category: input.category,
        description: input.description || null,
        suggestion: input.suggestion || null,
        active: true,
      };

      const [result] = await db.insert(bannedPhrases).values(newPhrase);

      // Log to history
      await db.insert(complianceHistory).values({
        adminUserId: ctx.user.id,
        adminUserName: ctx.user.name || "Unknown",
        adminUserEmail: ctx.user.email || "Unknown",
        action: "add",
        phraseId: result.insertId,
        phraseBefore: null,
        phraseAfter: JSON.stringify(newPhrase),
        details: `Added new ${input.category} phrase: "${input.phrase}"`,
      });

      return { success: true, id: result.insertId };
    }),

  // Update banned phrase
  updatePhrase: adminProcedure
    .input(
      z.object({
        id: z.number(),
        phrase: z.string().min(1).max(255),
        category: z.enum(["critical", "warning"]),
        description: z.string().optional(),
        suggestion: z.string().optional(),
        active: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get old phrase for history
      const [oldPhrase] = await db.select().from(bannedPhrases).where(eq(bannedPhrases.id, input.id)).limit(1);

      const updatedPhrase = {
        phrase: input.phrase.toLowerCase(),
        category: input.category,
        description: input.description || null,
        suggestion: input.suggestion || null,
        active: input.active,
        updatedAt: new Date(),
      };

      await db
        .update(bannedPhrases)
        .set(updatedPhrase)
        .where(eq(bannedPhrases.id, input.id));

      // Log to history
      if (oldPhrase) {
        await db.insert(complianceHistory).values({
          adminUserId: ctx.user.id,
          adminUserName: ctx.user.name || "Unknown",
          adminUserEmail: ctx.user.email || "Unknown",
          action: "update",
          phraseId: input.id,
          phraseBefore: JSON.stringify(oldPhrase),
          phraseAfter: JSON.stringify({ ...oldPhrase, ...updatedPhrase }),
          details: `Updated phrase: "${oldPhrase.phrase}" -> "${input.phrase}"`,
        });
      }

      return { success: true };
    }),

  // Delete banned phrase
  deletePhrase: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get phrase for history before deleting
      const [phraseToDelete] = await db.select().from(bannedPhrases).where(eq(bannedPhrases.id, input.id)).limit(1);

      await db.delete(bannedPhrases).where(eq(bannedPhrases.id, input.id));

      // Log to history
      if (phraseToDelete) {
        await db.insert(complianceHistory).values({
          adminUserId: ctx.user.id,
          adminUserName: ctx.user.name || "Unknown",
          adminUserEmail: ctx.user.email || "Unknown",
          action: "delete",
          phraseId: input.id,
          phraseBefore: JSON.stringify(phraseToDelete),
          phraseAfter: null,
          details: `Deleted ${phraseToDelete.category} phrase: "${phraseToDelete.phrase}"`,
        });
      }

      return { success: true };
    }),

  // Export all banned phrases as CSV
  exportCSV: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const phrases = await db.select().from(bannedPhrases).orderBy(bannedPhrases.category, bannedPhrases.phrase);
    
    // Generate CSV content
    const headers = ["phrase", "category", "description", "suggestion", "active"];
    const rows = phrases.map(p => [
      p.phrase,
      p.category,
      p.description || "",
      p.suggestion || "",
      p.active ? "true" : "false"
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    return { csv: csvContent };
  }),

  // Import banned phrases from CSV
  importCSV: adminProcedure
    .input(
      z.object({
        csv: z.string(),
        mode: z.enum(["replace", "append"]), // replace = delete all existing, append = add to existing
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Parse CSV
      const lines = input.csv.trim().split("\n");
      if (lines.length < 2) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "CSV must have at least a header row and one data row" });
      }

      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
      const requiredHeaders = ["phrase", "category"];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      
      if (missingHeaders.length > 0) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: `CSV missing required headers: ${missingHeaders.join(", ")}` 
        });
      }

      // Parse data rows
      const dataRows = lines.slice(1).map(line => {
        // Simple CSV parser (handles quoted fields)
        const values: string[] = [];
        let current = "";
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        values.push(current.trim());
        
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || "";
        });
        return row;
      });

      // Validate data
      const validPhrases: Array<{
        phrase: string;
        category: "critical" | "warning";
        description: string | null;
        suggestion: string | null;
        active: boolean;
      }> = [];
      
      const errors: string[] = [];
      
      dataRows.forEach((row, index) => {
        const lineNum = index + 2; // +2 because header is line 1, data starts at line 2
        
        if (!row.phrase || row.phrase.trim() === "") {
          errors.push(`Line ${lineNum}: phrase is required`);
          return;
        }
        
        if (row.category !== "critical" && row.category !== "warning") {
          errors.push(`Line ${lineNum}: category must be 'critical' or 'warning'`);
          return;
        }
        
        validPhrases.push({
          phrase: row.phrase.toLowerCase().trim(),
          category: row.category as "critical" | "warning",
          description: row.description?.trim() || null,
          suggestion: row.suggestion?.trim() || null,
          active: row.active === "true" || row.active === "1",
        });
      });
      
      if (errors.length > 0) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: `CSV validation errors:\n${errors.join("\n")}` 
        });
      }
      
      if (validPhrases.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No valid phrases found in CSV" });
      }

      // Replace mode: delete all existing phrases first
      if (input.mode === "replace") {
        await db.delete(bannedPhrases);
      }

      // Insert new phrases
      await db.insert(bannedPhrases).values(validPhrases);

      // Log to history
      await db.insert(complianceHistory).values({
        adminUserId: ctx.user.id,
        adminUserName: ctx.user.name || "Unknown",
        adminUserEmail: ctx.user.email || "Unknown",
        action: "import",
        phraseId: null,
        phraseBefore: null,
        phraseAfter: null,
        details: `Imported ${validPhrases.length} phrases (${input.mode} mode)`,
      });

      return { 
        success: true, 
        imported: validPhrases.length,
        mode: input.mode 
      };
    }),

  // Update compliance version (increment version, update dates)
  updateVersion: adminProcedure
    .input(
      z.object({
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get current version
      const [currentVersion] = await db.select().from(complianceVersions).orderBy(complianceVersions.id).limit(1);

      if (!currentVersion) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No compliance version found" });
      }

      // Parse version number (e.g., "v1.0" -> 1.0)
      const versionMatch = currentVersion.version.match(/v(\d+\.\d+)/);
      const currentVersionNumber = versionMatch ? parseFloat(versionMatch[1]) : 1.0;
      const newVersionNumber = (currentVersionNumber + 0.1).toFixed(1);
      const newVersion = `v${newVersionNumber}`;

      // Calculate new dates (today + 90 days)
      const today = new Date();
      const nextReview = new Date(today);
      nextReview.setDate(nextReview.getDate() + 90);

      // Insert new version record
      await db.insert(complianceVersions).values({
        version: newVersion,
        lastUpdated: new Date(today.toISOString().split('T')[0]),
        nextReviewDue: new Date(nextReview.toISOString().split('T')[0]),
        notes: input.notes || `Updated compliance rules to ${newVersion}`,
      });

      // Log to history
      await db.insert(complianceHistory).values({
        adminUserId: ctx.user.id,
        adminUserName: ctx.user.name || "Unknown",
        adminUserEmail: ctx.user.email || "Unknown",
        action: "version_update",
        phraseId: null,
        phraseBefore: JSON.stringify({ version: currentVersion.version }),
        phraseAfter: JSON.stringify({ version: newVersion }),
        details: input.notes || `Updated compliance version from ${currentVersion.version} to ${newVersion}`,
      });

      return { success: true, version: newVersion };
    }),

  // Get compliance history (audit log)
  getHistory: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const history = await db
        .select()
        .from(complianceHistory)
        .orderBy(complianceHistory.id)
        .limit(input.limit);

      return history;
    }),
});
