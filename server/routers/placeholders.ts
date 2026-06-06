/**
 * Placeholder Editor — P2 server CRUD + resolve helper.
 *
 * Two-level registry for [INSERT_*] token values:
 *   serviceId IS NULL  → account-level default (remembered across campaigns)
 *   serviceId = N      → per-campaign override (frozen at save time)
 *
 * list():  returns resolved map (campaign > default > absent) for editor pre-fill.
 * save():  dual-writes campaign row + account default in one pass.
 * resolve(): substitutes tokens in text using the resolved map.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { placeholderValues } from "../../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";

export type ResolvedEntry = {
  token: string;
  value: string;
  source: "campaign" | "default";
};

/**
 * Build the resolved map for a given user + service.
 * Precedence: campaign-specific (serviceId = N) > account default (serviceId IS NULL) > absent.
 */
export async function buildResolvedMap(
  userId: number,
  serviceId: number,
): Promise<Map<string, ResolvedEntry>> {
  const db = await getDb();
  if (!db) return new Map();

  const rows = await db
    .select()
    .from(placeholderValues)
    .where(
      and(
        eq(placeholderValues.userId, userId),
        // Drizzle doesn't have OR for nullable, so fetch all for user and filter in-app
      ),
    );

  // Filter to relevant rows: account defaults + this campaign
  const relevant = rows.filter(
    (r) => r.serviceId === null || r.serviceId === serviceId,
  );

  const map = new Map<string, ResolvedEntry>();

  // Pass 1: account defaults
  for (const row of relevant) {
    if (row.serviceId === null) {
      map.set(row.token, { token: row.token, value: row.value, source: "default" });
    }
  }

  // Pass 2: campaign-specific overrides
  for (const row of relevant) {
    if (row.serviceId === serviceId) {
      map.set(row.token, { token: row.token, value: row.value, source: "campaign" });
    }
  }

  return map;
}

/**
 * Synonym normalization map: LLM-invented variants → canonical token.
 * Applied at resolution time so the registry keys on canonical names
 * regardless of which variant the LLM emitted. Fixes existing campaigns
 * at runtime with no DB migration.
 */
export const TOKEN_SYNONYMS: Record<string, string> = {
  "[INSERT_CART_CLOSE]":       "[INSERT_COHORT_CLOSE_DATE]",
  "[INSERT_NEXT_COHORT_DATE]": "[INSERT_COHORT_CLOSE_DATE]",
  "[INSERT_REMAINING_SPOTS]":  "[INSERT_COHORT_LIMIT]",
  "[INSERT_SPOTS_REMAINING]":  "[INSERT_COHORT_LIMIT]",
  "[INSERT_AVAILABLE_SPOTS]":  "[INSERT_COHORT_LIMIT]",
  "[INSERT_SUPPORT_EMAIL]":    "[INSERT_CONTACT_EMAIL]",
  "[INSERT_REFUND_EMAIL]":     "[INSERT_CONTACT_EMAIL]",
  "[INSERT_BOOKING_LINK]":     "[INSERT_BOOKING_URL]",
  "[INSERT_START_DATE]":       "[INSERT_PROGRAMME_START_DATE]",
  "[INSERT_NEXT_LAUNCH_DATE]": "[INSERT_PROGRAMME_START_DATE]",
  "[INSERT_NEXT_OPEN_DATE]":   "[INSERT_PROGRAMME_START_DATE]",
  "[INSERT_LAUNCH_DATE]":      "[INSERT_DEADLINE]",
};

/** Normalize a token through the synonym map. */
export function normalizeToken(token: string): string {
  return TOKEN_SYNONYMS[token] ?? token;
}

/**
 * Substitute [INSERT_*] tokens in text using the resolved map.
 * Normalizes through synonym map before lookup so registry values
 * resolve regardless of which token variant the LLM emitted.
 * Tokens with no registry value are left intact.
 */
export function resolveTokensInText(
  text: string,
  resolvedMap: Map<string, ResolvedEntry>,
): string {
  return text.replace(/\[INSERT_[A-Z][A-Z0-9_]*\]/g, (match) => {
    const canonical = normalizeToken(match);
    const entry = resolvedMap.get(canonical) ?? resolvedMap.get(match);
    return entry ? entry.value : match;
  });
}

export const placeholdersRouter = router({
  /**
   * list — returns the resolved map for the editor to pre-fill.
   * Each entry has token, value, and source (campaign | default).
   */
  list: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const map = await buildResolvedMap(ctx.user.id, input.serviceId);
      return Array.from(map.values());
    }),

  /**
   * save — dual-write: campaign row + account default per token.
   * A save to campaign B never touches campaign A's rows.
   */
  save: protectedProcedure
    .input(
      z.object({
        serviceId: z.number(),
        entries: z.array(
          z.object({
            token: z.string().min(1).max(100),
            value: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user.id;

      for (const entry of input.entries) {
        // 1. Upsert campaign-specific row (serviceId = N)
        const [existingCampaign] = await db
          .select()
          .from(placeholderValues)
          .where(
            and(
              eq(placeholderValues.userId, userId),
              eq(placeholderValues.serviceId, input.serviceId),
              eq(placeholderValues.token, entry.token),
            ),
          )
          .limit(1);

        if (existingCampaign) {
          await db
            .update(placeholderValues)
            .set({ value: entry.value, updatedAt: new Date() })
            .where(eq(placeholderValues.id, existingCampaign.id));
        } else {
          await db.insert(placeholderValues).values({
            userId,
            serviceId: input.serviceId,
            token: entry.token,
            value: entry.value,
          });
        }

        // 2. Upsert account default (serviceId IS NULL)
        const [existingDefault] = await db
          .select()
          .from(placeholderValues)
          .where(
            and(
              eq(placeholderValues.userId, userId),
              isNull(placeholderValues.serviceId),
              eq(placeholderValues.token, entry.token),
            ),
          )
          .limit(1);

        if (existingDefault) {
          await db
            .update(placeholderValues)
            .set({ value: entry.value, updatedAt: new Date() })
            .where(eq(placeholderValues.id, existingDefault.id));
        } else {
          await db.insert(placeholderValues).values({
            userId,
            serviceId: null,
            token: entry.token,
            value: entry.value,
          });
        }
      }

      return { success: true };
    }),

  /**
   * resolve — substitute [INSERT_*] tokens in text for this campaign.
   * Returns the text with filled tokens replaced and unfilled tokens intact.
   */
  resolve: protectedProcedure
    .input(z.object({ serviceId: z.number(), text: z.string() }))
    .query(async ({ ctx, input }) => {
      const map = await buildResolvedMap(ctx.user.id, input.serviceId);
      return { resolved: resolveTokensInText(input.text, map) };
    }),
});
