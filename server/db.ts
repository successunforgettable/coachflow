import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, headlines, hvcoTitles, InsertHvcoTitle, heroMechanisms, InsertHeroMechanism } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.

// Headlines helpers

export async function createHeadlines(headlineData: Array<typeof headlines.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(headlines).values(headlineData);
}

export async function getHeadlinesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Group by headlineSetId to get unique sets
  const result = await db
    .select()
    .from(headlines)
    .where(eq(headlines.userId, userId))
    .orderBy(desc(headlines.createdAt));
  
  return result;
}

export async function getHeadlinesBySetId(headlineSetId: string, userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(headlines)
    .where(and(
      eq(headlines.headlineSetId, headlineSetId),
      eq(headlines.userId, userId)
    ))
    .orderBy(headlines.formulaType, headlines.id);
  
  return result;
}

export async function updateHeadlineRating(headlineId: number, userId: number, rating: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(headlines)
    .set({ rating })
    .where(and(
      eq(headlines.id, headlineId),
      eq(headlines.userId, userId)
    ));
}

export async function deleteHeadlineSet(headlineSetId: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(headlines)
    .where(and(
      eq(headlines.headlineSetId, headlineSetId),
      eq(headlines.userId, userId)
    ));
}

export async function incrementHeadlineCount(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(users)
    .set({ headlineGeneratedCount: sql`${users.headlineGeneratedCount} + 1` })
    .where(eq(users.id, userId));
}


// ============================================================================
// HVCO Titles Helpers
// ============================================================================

export async function createHvcoTitles(titles: InsertHvcoTitle[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(hvcoTitles).values(titles);
}

export async function getHvcoSetsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get one title from each set to display in list
  const result = await db
    .select({
      hvcoSetId: hvcoTitles.hvcoSetId,
      targetMarket: hvcoTitles.targetMarket,
      hvcoTopic: hvcoTitles.hvcoTopic,
      createdAt: hvcoTitles.createdAt,
      sampleTitle: hvcoTitles.title,
    })
    .from(hvcoTitles)
    .where(eq(hvcoTitles.userId, userId))
    .groupBy(hvcoTitles.hvcoSetId)
    .orderBy(desc(hvcoTitles.createdAt));
  
  return result;
}

export async function getHvcoTitlesBySetId(hvcoSetId: string, userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(hvcoTitles)
    .where(and(
      eq(hvcoTitles.hvcoSetId, hvcoSetId),
      eq(hvcoTitles.userId, userId)
    ))
    .orderBy(hvcoTitles.tabType, hvcoTitles.id);
  
  return result;
}

export async function updateHvcoTitleRating(titleId: number, userId: number, rating: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(hvcoTitles)
    .set({ rating })
    .where(and(
      eq(hvcoTitles.id, titleId),
      eq(hvcoTitles.userId, userId)
    ));
}

export async function toggleHvcoTitleFavorite(titleId: number, userId: number, isFavorite: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(hvcoTitles)
    .set({ isFavorite })
    .where(and(
      eq(hvcoTitles.id, titleId),
      eq(hvcoTitles.userId, userId)
    ));
}

export async function deleteHvcoSet(hvcoSetId: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(hvcoTitles)
    .where(and(
      eq(hvcoTitles.hvcoSetId, hvcoSetId),
      eq(hvcoTitles.userId, userId)
    ));
}

export async function incrementHvcoCount(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(users)
    .set({ hvcoGeneratedCount: sql`${users.hvcoGeneratedCount} + 1` })
    .where(eq(users.id, userId));
}

// ============================================================================
// Hero Mechanisms Helpers
// ============================================================================

export async function createHeroMechanisms(mechanisms: InsertHeroMechanism[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(heroMechanisms).values(mechanisms);
}

export async function getHeroMechanismSetsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get one mechanism from each set to display in list
  const result = await db
    .select({
      mechanismSetId: heroMechanisms.mechanismSetId,
      targetMarket: heroMechanisms.targetMarket,
      pressingProblem: heroMechanisms.pressingProblem,
      desiredOutcome: heroMechanisms.desiredOutcome,
      createdAt: heroMechanisms.createdAt,
      sampleName: heroMechanisms.mechanismName,
    })
    .from(heroMechanisms)
    .where(eq(heroMechanisms.userId, userId))
    .groupBy(heroMechanisms.mechanismSetId)
    .orderBy(desc(heroMechanisms.createdAt));
  
  return result;
}

export async function getHeroMechanismsBySetId(mechanismSetId: string, userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(heroMechanisms)
    .where(and(
      eq(heroMechanisms.mechanismSetId, mechanismSetId),
      eq(heroMechanisms.userId, userId)
    ))
    .orderBy(heroMechanisms.tabType, heroMechanisms.id);
  
  return result;
}

export async function updateHeroMechanismRating(mechanismId: number, userId: number, rating: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(heroMechanisms)
    .set({ rating })
    .where(and(
      eq(heroMechanisms.id, mechanismId),
      eq(heroMechanisms.userId, userId)
    ));
}

export async function toggleHeroMechanismFavorite(mechanismId: number, userId: number, isFavorite: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(heroMechanisms)
    .set({ isFavorite })
    .where(and(
      eq(heroMechanisms.id, mechanismId),
      eq(heroMechanisms.userId, userId)
    ));
}

export async function deleteHeroMechanismSet(mechanismSetId: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(heroMechanisms)
    .where(and(
      eq(heroMechanisms.mechanismSetId, mechanismSetId),
      eq(heroMechanisms.userId, userId)
    ));
}

export async function incrementHeroMechanismCount(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(users)
    .set({ heroMechanismGeneratedCount: sql`${users.heroMechanismGeneratedCount} + 1` })
    .where(eq(users.id, userId));
}
