import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import { bannedPhrases, complianceVersions, complianceHistory, phraseUsageStats, users } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

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
  /**
   * Coach-facing compliance advisories for one Campaign Kit.
   *
   * COMPUTED ON READ, NOT PERSISTED — deliberately, and this is why there is no
   * migration for it:
   *   - the advisory must reflect the copy as it stands NOW. A stored flag goes stale
   *     the moment the coach hand-edits a headline in the Kit, and would then either
   *     warn about text that no longer exists or stay silent about text that does.
   *   - it is pure text analysis, no LLM call, so recomputing costs nothing.
   *   - nothing needs backfilling for kits that already exist.
   * Same reasoning as the held publish gate being content-agnostic so it catches
   * hand-edits.
   *
   * Returns ADVISORIES ONLY (tier 2). Nothing here gates anything: blocking checks
   * live at generation and at the publish gates. Check 5 in particular rests on
   * practitioner reports rather than Meta's published policy, so it must warn and
   * never block — see docs/compliance/META_AD_COMPLIANCE_REFERENCE.md Tier 2.
   */
  advisoriesForKit: protectedProcedure
    .input(z.object({ campaignKitId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { campaignKits, adCopy, landingPages, headlines } = await import("../../drizzle/schema");
      const { checkComplianceAxis } = await import("../_core/complianceAxis");

      const [kit] = await db.select().from(campaignKits)
        .where(and(eq(campaignKits.id, input.campaignKitId), eq(campaignKits.userId, ctx.user.id))).limit(1);
      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Kit not found" });

      const fields: Array<{ location: string; text: string | null | undefined; role?: "short" | "body" | "cta" }> = [];

      if (kit.selectedAdCopyId) {
        const [row] = await db.select().from(adCopy)
          .where(and(eq(adCopy.id, kit.selectedAdCopyId), eq(adCopy.userId, ctx.user.id))).limit(1);
        if (row?.content) {
          fields.push({
            location: "Ad copy",
            text: row.content,
            role: row.contentType === "headline" ? "short" : row.contentType === "link" ? "cta" : "body",
          });
        }
      }
      if (kit.selectedHeadlineId) {
        const [row] = await db.select().from(headlines)
          .where(and(eq(headlines.id, kit.selectedHeadlineId), eq(headlines.userId, ctx.user.id))).limit(1);
        const h = row as Record<string, unknown> | undefined;
        for (const key of ["main", "eyebrow", "sub", "content"]) {
          const v = h?.[key];
          if (typeof v === "string" && v.trim()) fields.push({ location: "Headline", text: v, role: "short" });
        }
      }
      if (kit.selectedLandingPageId) {
        const [row] = await db.select().from(landingPages)
          .where(and(eq(landingPages.id, kit.selectedLandingPageId), eq(landingPages.userId, ctx.user.id))).limit(1);
        const content = (row as Record<string, any> | undefined)?.content;
        if (content && typeof content === "object") {
          for (const [k, role] of [["eyebrowHeadline", "short"], ["mainHeadline", "short"], ["subheadline", "short"],
                                   ["problemAgitation", "body"], ["solutionIntro", "body"], ["whyOldFail", "body"]] as const) {
            const v = content[k];
            if (typeof v === "string" && v.trim()) fields.push({ location: `Landing page — ${k}`, text: v, role });
          }
        }
      }

      if (fields.length === 0) return { advisories: [] as Array<{ classId: string; where: string; matched: string }> };

      const result = checkComplianceAxis(fields);

      // Collapse to one advisory per class — the coach needs to know the ad uses career
      // language once, not once per sentence.
      const seen = new Map<string, { classId: string; where: string; matched: string }>();
      for (const h of result.advisories) {
        if (!seen.has(h.classId)) seen.set(h.classId, { classId: h.classId, where: h.location, matched: h.matched });
      }
      return { advisories: Array.from(seen.values()) };
    }),

  /**
   * REWORD — the coach's own choice, never automatic.
   *
   * The advisory it answers rests on practitioner reports, not Meta's published policy.
   * Auto-stripping legitimate career language for a risk that may not apply would be
   * wrong, so nothing here runs unless the coach asks for it.
   *
   * NON-DESTRUCTIVE and NO MIGRATION: the reworded copy is inserted as a NEW adCopy row
   * in the same ad set, and the kit is repointed at it. The coach's original stays in the
   * deck, so choosing this can be undone by re-selecting the previous variant.
   *
   * SCOPE: only the flagged asset is regenerated — not the campaign, not the deck. A
   * narrow rewrite also preserves the copy the coach already chose, rather than re-rolling
   * it into something unrecognisable.
   *
   * The Employment Special Ad Category declaration is deliberately NOT touched. That is a
   * legal declaration the advertiser makes in their own Ads Manager, and ZAP must not make
   * it on their behalf — the banner explains it, and that is where it ends.
   */
  rewordForAdvisory: protectedProcedure
    .input(z.object({ campaignKitId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { campaignKits, adCopy } = await import("../../drizzle/schema");
      const { checkOutput } = await import("../_core/complianceAxis");
      const { invokeLLM } = await import("../_core/llm");
      const { REGISTER_STANDARD } = await import("../_core/copywritingRules");

      const [kit] = await db.select().from(campaignKits)
        .where(and(eq(campaignKits.id, input.campaignKitId), eq(campaignKits.userId, ctx.user.id))).limit(1);
      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Kit not found" });
      if (!kit.selectedAdCopyId) throw new TRPCError({ code: "BAD_REQUEST", message: "No ad copy selected for this campaign yet." });

      const [row] = await db.select().from(adCopy)
        .where(and(eq(adCopy.id, kit.selectedAdCopyId), eq(adCopy.userId, ctx.user.id))).limit(1);
      if (!row?.content) throw new TRPCError({ code: "NOT_FOUND", message: "Selected ad copy not found" });

      // Positive-framed (§14): describes the copy wanted rather than listing words to avoid.
      const system = `You are an expert Meta ad copywriter rewriting one piece of copy for a coach.\n\n${REGISTER_STANDARD}`;
      const user = `Rewrite the copy below so the offer is described in terms of the COACHING ITSELF — the method, what it changes, what someone leaves with, the situation it addresses — rather than in terms of jobs, hiring, recruitment, promotions, salaries or CVs.

Keep everything else: the same length, the same structure, the same specific detail, the same voice, the same call to action. The point is not to soften it. The outcome the reader wants stays exactly as vivid; only the vocabulary describing it moves away from employment framing.

COPY TO REWRITE:
${row.content}

Return ONLY the rewritten copy as plain text. No preamble, no quotes around it, no explanation.`;

      const role = row.contentType === "headline" ? "short" as const
        : row.contentType === "link" ? "cta" as const : "body" as const;

      let rewritten = "";
      let advisoriesLeft = 1;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const resp = await invokeLLM({ messages: [{ role: "system", content: system }, { role: "user", content: user }] });
        const raw = resp.choices[0]?.message?.content;
        const text = typeof raw === "string" ? raw.trim() : "";
        if (!text) continue;
        const gate = checkOutput([{ location: String(row.contentType), text, role }]);
        advisoriesLeft = gate.advisories.filter((h) => h.classId === "special_ad_category_employment").length;
        // Accept only copy that is BLOCKING-clean; the advisory clearing is the goal but a
        // rewrite that introduced a real violation would be worse than the original.
        if (gate.ok) { rewritten = text; if (advisoriesLeft === 0) break; }
      }
      if (!rewritten) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The reword didn't produce copy that cleared the checks. Your original copy is unchanged — try again, or edit the wording yourself.",
        });
      }

      const insert: any = await db.insert(adCopy).values({
        ...row, id: undefined, content: rewritten, createdAt: undefined, updatedAt: undefined,
      } as any);
      const newId = insert[0].insertId;
      await db.update(campaignKits).set({ selectedAdCopyId: newId }).where(eq(campaignKits.id, input.campaignKitId));

      return { rewordedAdCopyId: newId, previousAdCopyId: row.id, content: rewritten, advisoryCleared: advisoriesLeft === 0 };
    }),

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

    const [version] = await db.select().from(complianceVersions).orderBy(desc(complianceVersions.id)).limit(1);
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

      // Send notification to owner
      await notifyOwner({
        title: "Compliance Rules Updated",
        content: `${ctx.user.name} imported ${validPhrases.length} banned phrases in ${input.mode} mode. ${input.mode === "replace" ? "All previous phrases were replaced." : "Phrases were added to existing rules."}`,
      }).catch(err => console.error("Failed to send notification:", err));

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

  // Get phrase usage analytics
  getUsageAnalytics: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        days: z.number().min(1).max(365).optional().default(30),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days);

      // Get most frequently detected phrases
      const topPhrases = await db
        .select({
          phrase: phraseUsageStats.phrase,
          category: phraseUsageStats.category,
          count: sql<number>`COUNT(*)`
        })
        .from(phraseUsageStats)
        .where(sql`${phraseUsageStats.detectedAt} >= ${cutoffDate}`)
        .groupBy(phraseUsageStats.phrase, phraseUsageStats.category)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(input.limit);

      // Get usage by generator type
      const byGenerator = await db
        .select({
          generatorType: phraseUsageStats.generatorType,
          count: sql<number>`COUNT(*)`
        })
        .from(phraseUsageStats)
        .where(sql`${phraseUsageStats.detectedAt} >= ${cutoffDate}`)
        .groupBy(phraseUsageStats.generatorType)
        .orderBy(desc(sql`COUNT(*)`));

      // Get total detections
      const [totalResult] = await db
        .select({
          total: sql<number>`COUNT(*)`
        })
        .from(phraseUsageStats)
        .where(sql`${phraseUsageStats.detectedAt} >= ${cutoffDate}`);

      return {
        topPhrases,
        byGenerator,
        totalDetections: totalResult?.total || 0,
        periodDays: input.days,
      };
    }),

  // Get usage timeline (daily breakdown)
  getUsageTimeline: adminProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).optional().default(30),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days);

      const timeline = await db
        .select({
          date: sql<string>`DATE(${phraseUsageStats.detectedAt})`,
          category: phraseUsageStats.category,
          count: sql<number>`COUNT(*)`
        })
        .from(phraseUsageStats)
        .where(sql`${phraseUsageStats.detectedAt} >= ${cutoffDate}`)
        .groupBy(sql`DATE(${phraseUsageStats.detectedAt})`, phraseUsageStats.category)
        .orderBy(sql`DATE(${phraseUsageStats.detectedAt})`);

      return timeline;
    }),
});
