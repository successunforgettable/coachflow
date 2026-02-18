import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "./trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

/**
 * Admin-only middleware
 * Checks if the authenticated user has admin role
 */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

/**
 * Audited Admin Procedure
 * Automatically logs all admin actions to admin_audit_log table
 */
export const auditedAdminProcedure = adminProcedure.use(async ({ ctx, next, path }) => {
  // Execute the action first
  const result = await next();

  // Log to audit table after successful execution
  try {
    const db = await getDb();
    if (db) {
      const actionType = path.split(".").pop() || "unknown";
      const ipAddress = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
      const userAgent = ctx.req.headers["user-agent"] || "unknown";

      await db.execute(
        sql`INSERT INTO admin_audit_log (admin_user_id, action_type, target_user_id, details, ip_address, user_agent)
            VALUES (${ctx.user.id}, ${actionType}, NULL, '{}', ${ipAddress}, ${userAgent})`
      );
    }
  } catch (error) {
    // Don't fail the action if audit logging fails, but log the error
    console.error("Failed to log admin action to audit trail:", error);
  }

  return result;
});
