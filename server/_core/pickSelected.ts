/**
 * The ONE place a "which row of this generated set do we select?" decision is made.
 *
 * WHY THIS EXISTS. Every set-returning gen-core needs one row promoted into
 * `kit.selected*Id`. That decision used to be `orderBy(asc(id)).limit(1)` —
 * the first-inserted row — duplicated across EIGHT call sites in two layers
 * (the orchestrator and each generator). Insertion order standing in for a
 * choice caused two shipped defects:
 *
 *   - P8: ad-copy bodies, `orderBy(desc(id)).limit(1)`, so all five ad creatives
 *     composited the same body line.
 *   - The hvco selector: the generator inserts tabs long → short → beast_mode,
 *     so the lowest id was ALWAYS the `long` tab. Measured on all 91 prod sets
 *     it picked `long` 91/91 (mean 140 chars, max 271) while the `short` tab
 *     (mean 30, zero over 60) was generated every time and never once selected.
 *     That produced the 137-char title that overran every slot on LP 230.
 *
 * And the duplication is not hypothetical: the first hvco fix landed in the
 * orchestrator only and left `hvcoGenerator.ts` still selecting `long`. A sweep
 * caught it. Collapsing both layers onto this helper is what stops that
 * recurring — a fix here cannot land in one layer and miss the other.
 *
 * MEASURED WASTE this replaces (prod, 2026-07-29): `selectionScore` is computed
 * and stored by the generators and NOTHING selected on it. The ordinal picked a
 * different row than the score would in 82 of 134 adCopy sets (61%, mean 82.5
 * taken where 90.0 was available) and 40 of 104 headline sets (38%, 81.3 vs
 * 87.1).
 */
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { heroMechanisms, hvcoTitles, headlines, adCopy } from "../../drizzle/schema";

export type SelectableKind = "heroMechanisms" | "hvco" | "headlines" | "adCopy";

/**
 * Promote one row from a generated set.
 *
 * SCORED tables order by `selectionScore DESC` with id as the tie-break, so the
 * result stays deterministic across re-runs. `selectionScore` is a real
 * `decimal(5,2)` column, so MySQL orders it numerically and sorts NULLs last —
 * an unscored row can therefore never outrank a scored one.
 *
 * UNSCORED tables get a DELIBERATE RULE, never an ordinal. Both happen to be
 * multi-tab tables where one tab is the right source and the others are not.
 *
 * Returns null only when the set is genuinely empty; every rule falls back to
 * something so this can never return null where the old code returned a row.
 */
export async function pickSelectedFromSet(
  db: any,
  kind: SelectableKind,
  setId: string,
): Promise<number | null> {
  switch (kind) {
    // ── Scored ───────────────────────────────────────────────────────────────
    case "adCopy": {
      const [row] = await db.select({ id: adCopy.id }).from(adCopy)
        .where(eq(adCopy.adSetId, setId))
        .orderBy(desc(adCopy.selectionScore), asc(adCopy.id)).limit(1);
      return row?.id ?? null;
    }
    case "headlines": {
      const [row] = await db.select({ id: headlines.id }).from(headlines)
        .where(eq(headlines.headlineSetId, setId))
        .orderBy(desc(headlines.selectionScore), asc(headlines.id)).limit(1);
      return row?.id ?? null;
    }

    // ── Unscored: deliberate rules ───────────────────────────────────────────
    case "hvco": {
      // The `short` tab is the display title — it lands in the LP cover panel,
      // the card heading and "Get Your Free ___ Now!". Measured: mean 30 chars,
      // ZERO over 60. `long` (mean 133) and `subheadlines` (mean 159, correctly
      // sentences) are legitimate surfaces a coach can pick in the UI, but must
      // never be what Auto Mode silently drops into a display slot.
      const [short] = await db.select({ id: hvcoTitles.id }).from(hvcoTitles)
        .where(and(eq(hvcoTitles.hvcoSetId, setId), eq(hvcoTitles.tabType, "short")))
        .orderBy(asc(hvcoTitles.id)).limit(1);
      if (short?.id) return short.id;
      // Legacy sets predating the short tab: shortest title, not the first row.
      const [shortest] = await db.select({ id: hvcoTitles.id }).from(hvcoTitles)
        .where(eq(hvcoTitles.hvcoSetId, setId))
        .orderBy(asc(sql`CHAR_LENGTH(${hvcoTitles.title})`), asc(hvcoTitles.id)).limit(1);
      return shortest?.id ?? null;
    }
    case "heroMechanisms": {
      // `hero_mechanisms` is the tab that actually names a mechanism — measured
      // mean name 33 chars, max 55. The other tabs are not names: `headline_ideas`
      // averages 150 chars (max 255) and would render a full sentence wherever a
      // method name belongs.
      //
      // The old ordinal already landed here on all 92 prod sets — but only
      // because this tab happens to be inserted first. Stating the rule changes
      // no output today and makes the outcome independent of insertion order,
      // so a future reordering cannot silently promote a 150-char sentence.
      const [hero] = await db.select({ id: heroMechanisms.id }).from(heroMechanisms)
        .where(and(eq(heroMechanisms.mechanismSetId, setId), eq(heroMechanisms.tabType, "hero_mechanisms")))
        .orderBy(asc(heroMechanisms.id)).limit(1);
      if (hero?.id) return hero.id;
      const [any] = await db.select({ id: heroMechanisms.id }).from(heroMechanisms)
        .where(eq(heroMechanisms.mechanismSetId, setId))
        .orderBy(asc(sql`CHAR_LENGTH(${heroMechanisms.mechanismName})`), asc(heroMechanisms.id)).limit(1);
      return any?.id ?? null;
    }
  }
}
