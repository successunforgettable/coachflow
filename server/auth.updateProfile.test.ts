import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Auth.updateProfile Tests
 * 
 * Tests for the profile update functionality:
 * - Update name and email
 * - Validate input (name required, email format)
 * - Prevent duplicate emails
 * - Handle authentication
 */

describe("Auth.updateProfile", () => {
  let testUserId: number;
  let mockUser: any;
  let mockContext: any;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test user
    const userResult: any = await db.insert(users).values({
      openId: `test-profile-${Date.now()}`,
      name: "Original Name",
      email: `test-profile-${Date.now()}@example.com`,
    });
    testUserId = userResult[0].insertId;

    mockUser = {
      id: testUserId,
      openId: `test-profile-${Date.now()}`,
      name: "Original Name",
      email: `test-profile-${Date.now()}@example.com`,
      role: "user" as const,
      subscriptionTier: "trial" as const,
      subscriptionStatus: "active" as const,
      stripeCustomerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    mockContext = {
      user: mockUser,
      db,
    };
    
    // Reset user to original values
    await db
      .update(users)
      .set({
        name: "Original Name",
        email: mockUser.email,
      })
      .where(eq(users.id, mockUser.id));
  });

  const getCaller = () => appRouter.createCaller(mockContext as any);

  describe("Successful updates", () => {
    it("should update name only", async () => {
      const caller = getCaller();
      const result = await caller.auth.updateProfile({
        name: "New Name",
        email: mockUser.email,
      });

      expect(result.success).toBe(true);
      expect(result.user.name).toBe("New Name");
      expect(result.user.email).toBe(mockUser.email);

      // Verify in database
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, mockUser.id))
        .limit(1);
      
      expect(updatedUser.name).toBe("New Name");
    });

    it("should update email only", async () => {
      const caller = getCaller();
      const newEmail = `updated-${Date.now()}@example.com`;
      const result = await caller.auth.updateProfile({
        name: "Original Name",
        email: newEmail,
      });

      expect(result.success).toBe(true);
      expect(result.user.name).toBe("Original Name");
      expect(result.user.email).toBe(newEmail);

      // Verify in database
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, mockUser.id))
        .limit(1);
      
      expect(updatedUser.email).toBe(newEmail);
    });

    it("should update both name and email", async () => {
      const caller = getCaller();
      const newEmail = `both-updated-${Date.now()}@example.com`;
      const result = await caller.auth.updateProfile({
        name: "Completely New Name",
        email: newEmail,
      });

      expect(result.success).toBe(true);
      expect(result.user.name).toBe("Completely New Name");
      expect(result.user.email).toBe(newEmail);

      // Verify in database
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, mockUser.id))
        .limit(1);
      
      expect(updatedUser.name).toBe("Completely New Name");
      expect(updatedUser.email).toBe(newEmail);
    });

    it("should allow updating to same email (no change)", async () => {
      const caller = getCaller();
      const result = await caller.auth.updateProfile({
        name: "New Name",
        email: mockUser.email, // Same email
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Validation", () => {
    it("should reject empty name", async () => {
      const caller = getCaller();
      
      await expect(
        caller.auth.updateProfile({
          name: "",
          email: mockUser.email,
        })
      ).rejects.toThrow();
    });

    it("should reject name that is too long", async () => {
      const caller = getCaller();
      const longName = "a".repeat(101); // Max is 100
      
      await expect(
        caller.auth.updateProfile({
          name: longName,
          email: mockUser.email,
        })
      ).rejects.toThrow();
    });

    it("should reject invalid email format", async () => {
      const caller = getCaller();
      
      await expect(
        caller.auth.updateProfile({
          name: "Valid Name",
          email: "not-an-email",
        })
      ).rejects.toThrow();
    });

    it("should reject email without @", async () => {
      const caller = getCaller();
      
      await expect(
        caller.auth.updateProfile({
          name: "Valid Name",
          email: "notemail.com",
        })
      ).rejects.toThrow();
    });

    it("should reject email that is too long", async () => {
      const caller = getCaller();
      const longEmail = "a".repeat(250) + "@test.com"; // Max is 255
      
      await expect(
        caller.auth.updateProfile({
          name: "Valid Name",
          email: longEmail,
        })
      ).rejects.toThrow();
    });
  });

  describe("Duplicate email prevention", () => {
    it("should reject email already used by another user", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Create another user with a different email
      const otherUserResult: any = await db.insert(users).values({
        openId: `other-user-${Date.now()}`,
        name: "Other User",
        email: `other-user-${Date.now()}@example.com`,
      });
      const otherUserId = otherUserResult[0].insertId;

      // Get the other user's email
      const [otherUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, otherUserId))
        .limit(1);

      const caller = getCaller();
      
      // Try to update current user's email to other user's email
      await expect(
        caller.auth.updateProfile({
          name: "My Name",
          email: otherUser.email,
        })
      ).rejects.toThrow("Email is already in use by another account");

      // Clean up
      await db.delete(users).where(eq(users.id, otherUserId));
    });
  });

  describe("Authentication", () => {
    it("should reject unauthenticated requests", async () => {
      const unauthContext = {
        user: null,
        db: await getDb(),
      };
      const caller = appRouter.createCaller(unauthContext as any);
      
      await expect(
        caller.auth.updateProfile({
          name: "New Name",
          email: "new@example.com",
        })
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("Edge cases", () => {
    it("should trim whitespace from name", async () => {
      const caller = getCaller();
      const result = await caller.auth.updateProfile({
        name: "  Trimmed Name  ",
        email: mockUser.email,
      });

      // The mutation trims the input
      expect(result.user.name).toBe("Trimmed Name");
    });

    it("should trim whitespace from email", async () => {
      const caller = getCaller();
      const newEmail = `trimmed-${Date.now()}@example.com`;
      const result = await caller.auth.updateProfile({
        name: "Name",
        email: `  ${newEmail}  `,
      });

      expect(result.user.email).toBe(newEmail);
    });

    it("should handle special characters in name", async () => {
      const caller = getCaller();
      const result = await caller.auth.updateProfile({
        name: "José O'Brien-Smith",
        email: mockUser.email,
      });

      expect(result.success).toBe(true);
      expect(result.user.name).toBe("José O'Brien-Smith");
    });

    it("should handle plus addressing in email", async () => {
      const caller = getCaller();
      const newEmail = `user+tag-${Date.now()}@example.com`;
      const result = await caller.auth.updateProfile({
        name: "Name",
        email: newEmail,
      });

      expect(result.success).toBe(true);
      expect(result.user.email).toBe(newEmail);
    });
  });
});
