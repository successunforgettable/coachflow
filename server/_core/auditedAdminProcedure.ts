import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "./trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

/**
 * Admin-only middleware — requires role === "admin" ONLY.
 *
 * Superuser is intentionally excluded: superuser means "unlimited quota,"
 * not "full admin powers." Allowing superuser here would create a
 * privilege escalation chain: admin grants superuser → superuser inherits
 * admin mutations including createSuperUser → unbounded escalation.
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
 * Automatically logs all admin actions to admin_audit_log table.
 *
 * Uses parameterized queries (Drizzle sql`` template tag) to prevent
 * SQL injection via IP addresses, user-agent headers, or audit details.
 *
 * To pass audit metadata from a procedure, attach it to ctx before calling next():
 *   (ctx as any).auditTargetUserId = input.userId;
 *   (ctx as any).auditDetails = { previousTier: user.subscriptionTier, newTier: input.newTier };
 */
export const auditedAdminProcedure = adminProcedure.use(async ({ ctx, next, path }) => {
  const result = await next({ ctx });

  try {
    const db = await getDb();
    if (db) {
      const actionType = path.split(".").pop() || "unknown";
      const ipAddress = String((ctx.req as any).ip || (ctx.req as any).socket?.remoteAddress || "unknown");
      const userAgent = String(ctx.req.headers["user-agent"] || "unknown").substring(0, 500);

      const targetUserId: number | null = (ctx as any).auditTargetUserId ?? null;
      const details: Record<string, unknown> = (ctx as any).auditDetails ?? {};
      const detailsJson = JSON.stringify(details);

      await db.execute(
        sql`INSERT INTO admin_audit_log (admin_user_id, action_type, target_user_id, details, ip_address, user_agent)
            VALUES (${ctx.user.id}, ${actionType}, ${targetUserId}, ${detailsJson}, ${ipAddress}, ${userAgent})`
      );
    }
  } catch (error) {
    console.error("Failed to log admin action to audit trail:", error);
  }

  return result;
});
