/**
 * Product event tracking — fires on generation, upgrade, and node completion.
 * Non-blocking — never throws, just logs warnings on failure.
 */
import { getDb } from "../db";
import { productEvents } from "../../drizzle/schema";

export async function trackEvent(userId: number, eventType: string, metadata?: Record<string, any>) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(productEvents).values({
      userId,
      eventType,
      metadata: metadata ?? null,
    });
  } catch (e: any) {
    console.warn(`[ProductEvents] Failed to track ${eventType}:`, e.message);
  }
}
