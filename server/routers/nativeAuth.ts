/**
 * Native email/password authentication router
 * Provides register, login, forgotPassword, resetPassword procedures
 * that work without Manus OAuth — users stay on zapcampaigns.com
 */
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users, emailVerificationTokens, passwordResetTokens } from "../../drizzle/schema";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { notifyOwner } from "../_core/notification";
import { sendPasswordResetEmail, sendWelcomeEmail } from "../email";

const BCRYPT_ROUNDS = 12;
const TOKEN_EXPIRY_HOURS = 24;
const RESET_TOKEN_EXPIRY_HOURS = 1;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function tokenExpiresAt(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export const nativeAuthRouter = router({
  /**
   * Register a new user with email + password
   * Creates user with loginMethod = 'email', sets passwordHash
   * Sends email verification (via owner notification for now)
   */
  register: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
        email: z.string().trim().email("Invalid email address").toLowerCase(),
        password: z
          .string()
          .min(8, "Password must be at least 8 characters")
          .max(128, "Password is too long"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if email already exists
      const [existing] = await db
        .select({ id: users.id, loginMethod: users.loginMethod })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existing) {
        throw new Error("An account with this email already exists. Please log in instead.");
      }

      // Hash password
      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

      // Generate a unique openId for native users (prefixed to distinguish from Manus OAuth)
      const openId = `native_${crypto.randomBytes(16).toString("hex")}`;

      // Create user
      const [result] = await db.insert(users).values({
        openId,
        name: input.name,
        email: input.email,
        passwordHash,
        loginMethod: "email",
        emailVerified: false,
        subscriptionTier: "trial",
        subscriptionStatus: "trialing",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
        onboardingComplete: false,
        onboardingStage: 1,
        lastSignedIn: new Date(),
      });

      const userId = (result as { insertId: number }).insertId;

      // Create email verification token
      const verifyToken = generateToken();
      await db.insert(emailVerificationTokens).values({
        userId,
        token: verifyToken,
        expiresAt: tokenExpiresAt(TOKEN_EXPIRY_HOURS),
      });

      // Send welcome email (non-critical)
      try {
        await sendWelcomeEmail({ to: input.email, name: input.name });
      } catch {
        // Non-critical — don't fail registration
      }

      // Notify owner of new signup
      try {
        await notifyOwner({
          title: "New ZAP Signup",
          content: `New user registered: ${input.name} (${input.email})`,
        });
      } catch {
        // Non-critical — don't fail registration
      }

      // Auto-login: create session cookie
      const sessionToken = await sdk.createSessionToken(openId, {
        name: input.name,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return {
        success: true,
        message: "Account created successfully. Welcome to ZAP!",
      };
    }),

  /**
   * Login with email + password
   * Sets session cookie on success
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().trim().email("Invalid email address").toLowerCase(),
        password: z.string().min(1, "Password is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      // Generic error to prevent email enumeration
      const invalidError = "Invalid email or password. Please try again.";

      if (!user) throw new Error(invalidError);
      if (!user.passwordHash) {
        // User signed up via OAuth — guide them
        throw new Error(
          "This account was created with Google/Apple/Microsoft. Please use the 'Continue with OAuth' option."
        );
      }

      const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
      if (!passwordMatch) throw new Error(invalidError);

      // Update last signed in
      await db
        .update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user.id));

      // Set session cookie
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return {
        success: true,
        message: "Logged in successfully.",
      };
    }),

  /**
   * Request a password reset email
   * Creates a reset token valid for 1 hour
   */
  forgotPassword: publicProcedure
    .input(
      z.object({
        email: z.string().trim().email("Invalid email address").toLowerCase(),
        origin: z.string().url("Invalid origin"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Always return success to prevent email enumeration
      const successResponse = {
        success: true,
        message:
          "If an account exists with that email, you will receive a password reset link shortly.",
      };

      const [user] = await db
        .select({ id: users.id, name: users.name, passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (!user || !user.passwordHash) return successResponse;

      // Delete any existing unused reset tokens for this user
      await db
        .delete(passwordResetTokens)
        .where(and(eq(passwordResetTokens.userId, user.id), eq(passwordResetTokens.used, false)));

      // Create new reset token
      const resetToken = generateToken();
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token: resetToken,
        expiresAt: tokenExpiresAt(RESET_TOKEN_EXPIRY_HOURS),
        used: false,
      });

      const resetUrl = `${input.origin}/reset-password?token=${resetToken}`;

      // Send password reset email via Resend
      try {
        await sendPasswordResetEmail({
          to: input.email,
          name: user.name || "there",
          resetUrl,
        });
      } catch (emailErr) {
        console.error("[ForgotPassword] Email send failed:", emailErr);
        // Silently fail — token is still created, owner notification as fallback
        try {
          await notifyOwner({
            title: "Password Reset Request (Email Failed)",
            content: `User ${input.email} requested a password reset.\n\nReset link: ${resetUrl}\n\nThis link expires in 1 hour.`,
          });
        } catch { /* ignore */ }
      }

      return successResponse;
    }),

  /**
   * Reset password using a valid reset token
   */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1, "Reset token is required"),
        password: z
          .string()
          .min(8, "Password must be at least 8 characters")
          .max(128, "Password is too long"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [resetRecord] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(eq(passwordResetTokens.token, input.token), eq(passwordResetTokens.used, false))
        )
        .limit(1);

      if (!resetRecord) throw new Error("Invalid or expired reset link. Please request a new one.");
      if (resetRecord.expiresAt < new Date())
        throw new Error("This reset link has expired. Please request a new one.");

      // Hash new password
      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

      // Update user password
      await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, resetRecord.userId));

      // Mark token as used
      await db
        .update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, resetRecord.id));

      // Fetch user for auto-login
      const [user] = await db
        .select({ openId: users.openId, name: users.name })
        .from(users)
        .where(eq(users.id, resetRecord.userId))
        .limit(1);

      if (user) {
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      }

      return {
        success: true,
        message: "Password reset successfully. You are now logged in.",
      };
    }),
});
