import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "./trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

/**
 * Admin-only middleware
 * Checks if the authenticated user has admin role
 */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "superuser") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

/**
 * Audited Admin Procedure
 * Automatically logs all admin actions to admin_audit_log table.
 *
 * To pass audit metadata from a procedure, attach it to ctx before calling next():
 *   (ctx as any).auditTargetUserId = input.userId;
 *   (ctx as any).auditDetails = { previousTier: user.subscriptionTier, newTier: input.newTier };
 */
export const auditedAdminProcedure = adminProcedure.use(async ({ ctx, next, path }) => {
  // Execute the action first — procedures can attach auditTargetUserId / auditDetails to ctx
  const result = await next({ ctx });

  // Log to audit table after successful execution
  try {
    const db = await getDb();
    if (db) {
      const actionType = path.split(".").pop() || "unknown";
      const ipAddress = (ctx.req as any).ip || (ctx.req as any).socket?.remoteAddress || "unknown";
      const userAgent = ctx.req.headers["user-agent"] || "unknown";

      // Read audit metadata attached by the procedure (if any)
      const targetUserId: number | null = (ctx as any).auditTargetUserId ?? null;
      const details: Record<string, unknown> = (ctx as any).auditDetails ?? {};
      const detailsJson = JSON.stringify(details).replace(/'/g, "''");
      const safeUserAgent = String(userAgent).replace(/'/g, "''").substring(0, 500);

      await db.execute(
        sql.raw(
          `INSERT INTO admin_audit_log (admin_user_id, action_type, target_user_id, details, ip_address, user_agent) VALUES (${ctx.user.id}, '${actionType}', ${targetUserId ?? "NULL"}, '${detailsJson}', '${ipAddress}', '${safeUserAgent}')`
        )
      );
    }
  } catch (error) {
    // Don't fail the action if audit logging fails, but log the error
    console.error("Failed to log admin action to audit trail:", error);
  }

  return result;
});
