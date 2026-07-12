/**
 * Trail deck-card transforms — pure functions (no React), so the two Manual-wizard
 * contract points that silently broke can be unit-tested and can't drift again:
 *
 *  1. hvco (Lead Magnet) titles carry DB enum tabType "long" — NOT "long_titles".
 *     The old inline filter used "long_titles", which matched zero rows every run,
 *     producing an empty option deck.
 *  2. headlines.getBySetId returns a GROUPED object ({ headlines: { story, ... } }),
 *     not a flat array. The old inline code iterated it as an array (for..of), which
 *     throws on a non-iterable object and silently killed the Manual loop.
 *
 * These helpers encode the correct contract; server/deckCards.test.ts guards them.
 */

/** Lead-magnet "long" titles for the option deck. DB enum: long | short | beast_mode | subheadlines. */
export function pickHvcoLongTitles<T extends { tabType: string }>(items: T[]): T[] {
  return (items ?? []).filter((i) => i.tabType === "long");
}

/** Formula order for the headline deck — one card per formula, in this order. */
export const HEADLINE_FORMULAS = ["story", "eyebrow", "question", "authority", "urgency"] as const;

/**
 * Flatten headlines.getBySetId's grouped shape into an ordered pick list:
 * the first headline from each formula group, up to 5. Tolerates missing/empty
 * groups and a null/undefined response without throwing.
 */
export function flattenHeadlineGroups<T>(
  res: { headlines?: Record<string, T[] | undefined> } | null | undefined,
): T[] {
  const groups = res?.headlines ?? {};
  const picks: T[] = [];
  for (const formula of HEADLINE_FORMULAS) {
    const first = groups[formula]?.[0];
    if (first !== undefined) picks.push(first);
  }
  return picks.slice(0, 5);
}
