/**
 * leadMagnetQuizReview — derived state for the quiz review gate (no column, no
 * migration). A coach's FIRST quiz must be reviewed before it goes live; every
 * quiz after publishes immediately. Both facts are derivable from existing rows:
 *   - "has approved a quiz before" == any quiz-format hvco already published
 *     (magnetHtmlUrl set) — publish only ever happens on approval.
 *   - a single row's review state == quiz + assetBody present + magnetHtmlUrl NULL
 *     → review_required; quiz + magnetHtmlUrl set → published.
 */
import { getDb } from "./db";
import { hvcoTitles } from "../drizzle/schema";
import { and, eq, isNotNull, ne, sql } from "drizzle-orm";

/** True once the coach has at least one published (i.e. approved) quiz. Pass the
 *  hvco being generated as excludeHvcoId so it never counts itself. */
export async function coachHasApprovedQuiz(userId: number, excludeHvcoId?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: hvcoTitles.id })
    .from(hvcoTitles)
    .where(and(
      eq(hvcoTitles.userId, userId),
      isNotNull(hvcoTitles.magnetHtmlUrl),
      sql`JSON_UNQUOTE(JSON_EXTRACT(${hvcoTitles.assetBody}, '$.format')) = 'quiz'`,
      ...(excludeHvcoId ? [ne(hvcoTitles.id, excludeHvcoId)] : []),
    ))
    .limit(1);
  return rows.length > 0;
}

export type QuizReviewState = "not_quiz" | "review_required" | "published";

/** Derive the review state of one hvco row from its own fields (no column). */
export function quizReviewState(row: { assetBody: unknown; magnetHtmlUrl: string | null }): QuizReviewState {
  const fmt = (row.assetBody as { format?: string } | null)?.format;
  if (fmt !== "quiz") return "not_quiz";
  return row.magnetHtmlUrl ? "published" : "review_required";
}
