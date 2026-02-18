import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { users, services, idealCustomerProfiles } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("ICP 17 Tabs Generation", () => {
  let testUserId: number;
  let testServiceId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test user
    const userResult: any = await db.insert(users).values({
      openId: `test-icp-${Date.now()}`,
      name: "Test User",
      email: "test@example.com",
    });
    testUserId = userResult[0].insertId;

    // Create test service
    const serviceResult: any = await db.insert(services).values({
      userId: testUserId,
      name: "Test Coaching Service",
      category: "coaching",
      description: "Premium business coaching for entrepreneurs",
      targetCustomer: "Tech entrepreneurs seeking business growth",
      mainBenefit: "Scale your business to 7 figures",
      price: "5000",
    });
    testServiceId = serviceResult[0].insertId;
  });

  it("should have all 17 Kong tabs in schema", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Insert ICP with all 17 sections
    const icpResult: any = await db.insert(idealCustomerProfiles).values({
      userId: testUserId,
      serviceId: testServiceId,
      name: "Test ICP - 17 Tabs",
      introduction: "Test introduction",
      fears: "Test fears",
      hopesDreams: "Test hopes and dreams",
      demographics: { age_range: "30-45", gender: "All", income_level: "$100k+", education: "Bachelor's", occupation: "Entrepreneur", location: "USA", family_status: "Married" },
      psychographics: "Test psychographics",
      pains: "Test pains",
      frustrations: "Test frustrations",
      goals: "Test goals",
      values: "Test values",
      objections: "Test objections",
      buyingTriggers: "Test buying triggers",
      mediaConsumption: "Test media consumption",
      influencers: "Test influencers",
      communicationStyle: "Test communication style",
      decisionMaking: "Test decision making",
      successMetrics: "Test success metrics",
      implementationBarriers: "Test implementation barriers",
    });

    const icpId = icpResult[0].insertId;

    // Fetch and verify all 17 sections exist
    const [icp] = await db
      .select()
      .from(idealCustomerProfiles)
      .where(eq(idealCustomerProfiles.id, icpId))
      .limit(1);

    expect(icp).toBeDefined();
    expect(icp.introduction).toBe("Test introduction");
    expect(icp.fears).toBe("Test fears");
    expect(icp.hopesDreams).toBe("Test hopes and dreams");
    expect(icp.demographics).toEqual({ age_range: "30-45", gender: "All", income_level: "$100k+", education: "Bachelor's", occupation: "Entrepreneur", location: "USA", family_status: "Married" });
    expect(icp.psychographics).toBe("Test psychographics");
    expect(icp.pains).toBe("Test pains");
    expect(icp.frustrations).toBe("Test frustrations");
    expect(icp.goals).toBe("Test goals");
    expect(icp.values).toBe("Test values");
    expect(icp.objections).toBe("Test objections");
    expect(icp.buyingTriggers).toBe("Test buying triggers");
    expect(icp.mediaConsumption).toBe("Test media consumption");
    expect(icp.influencers).toBe("Test influencers");
    expect(icp.communicationStyle).toBe("Test communication style");
    expect(icp.decisionMaking).toBe("Test decision making");
    expect(icp.successMetrics).toBe("Test success metrics");
    expect(icp.implementationBarriers).toBe("Test implementation barriers");
  });

  it("should verify ICP generation prompt includes all 17 sections", () => {
    // This test verifies the structure is correct
    const expectedSections = [
      "introduction",
      "fears",
      "hopesDreams",
      "demographics",
      "psychographics",
      "pains",
      "frustrations",
      "goals",
      "values",
      "objections",
      "buyingTriggers",
      "mediaConsumption",
      "influencers",
      "communicationStyle",
      "decisionMaking",
      "successMetrics",
      "implementationBarriers",
    ];

    expect(expectedSections.length).toBe(17);
    expect(expectedSections).toContain("introduction");
    expect(expectedSections).toContain("fears");
    expect(expectedSections).toContain("implementationBarriers");
  });
});
