import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "../routers";
import { getDb } from "../db";
import { services, users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Services Router", () => {
  let testUserId: number;
  let testServiceId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create a test user
    const result: any = await db.insert(users).values({
      openId: "test-openid-services",
      name: "Test User",
      email: "test@example.com",
      role: "user",
    });

    testUserId = result[0].insertId;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Clean up test data
    await db.delete(services).where(eq(services.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  it("should create a service", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: "test-openid-services", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const service = await caller.services.create({
      name: "Executive Coaching",
      category: "coaching",
      description: "High-level coaching for executives",
      targetCustomer: "C-suite executives in tech",
      mainBenefit: "Double your leadership effectiveness",
      price: 5000,
    });

    expect(service).toBeDefined();
    expect(service.name).toBe("Executive Coaching");
    expect(service.category).toBe("coaching");
    expect(service.userId).toBe(testUserId);

    testServiceId = service.id;
  });

  it("should list services for user", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: "test-openid-services", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const servicesList = await caller.services.list();

    expect(servicesList).toBeDefined();
    expect(servicesList.length).toBeGreaterThan(0);
    expect(servicesList[0].name).toBe("Executive Coaching");
  });

  it("should get a single service", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: "test-openid-services", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const service = await caller.services.get({ id: testServiceId });

    expect(service).toBeDefined();
    expect(service.id).toBe(testServiceId);
    expect(service.name).toBe("Executive Coaching");
  });

  it("should update a service", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: "test-openid-services", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const updated = await caller.services.update({
      id: testServiceId,
      name: "Executive Coaching Pro",
      price: 7500,
    });

    expect(updated).toBeDefined();
    expect(updated.name).toBe("Executive Coaching Pro");
    expect(updated.price).toBe("7500.00");
  });

  it("should delete a service", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: "test-openid-services", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.services.delete({ id: testServiceId });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // Verify deletion
    const servicesList = await caller.services.list();
    expect(servicesList.length).toBe(0);
  });

  it("should not allow accessing other users' services", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create another user
    const result: any = await db.insert(users).values({
      openId: "test-openid-other",
      name: "Other User",
      email: "other@example.com",
      role: "user",
    });

    const otherUserId = result[0].insertId;

    // Create service for other user
    const serviceResult: any = await db.insert(services).values({
      userId: otherUserId,
      name: "Other Service",
      category: "coaching",
      description: "Test",
      targetCustomer: "Test",
      mainBenefit: "Test",
    });

    const otherServiceId = serviceResult[0].insertId;

    // Try to access with first user
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: "test-openid-services", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    await expect(caller.services.get({ id: otherServiceId })).rejects.toThrow("Service not found");

    // Clean up
    await db.delete(services).where(eq(services.id, otherServiceId));
    await db.delete(users).where(eq(users.id, otherUserId));
  });
});
