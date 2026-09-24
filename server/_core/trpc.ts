import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { UsageLimitCause } from "../lib/tierAccess";
import { GhlConnectionCause } from "./ghlToken";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  // A trial limit (quota, expiry, Pro-only) carries a UsageLimitCause. Surface it as `data.usageLimit` so the client
  // recognises a limit without parsing the message; every other error keeps its default shape.
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    if (cause instanceof UsageLimitCause) {
      return { ...shape, data: { ...shape.data, usageLimit: { kind: cause.kind, generator: cause.generator } } };
    }
    // A GoHighLevel connection problem (not connected, reconnect required, GHL down) — the push window and Settings
    // show the matching message and button from this, never by parsing text.
    if (cause instanceof GhlConnectionCause) {
      return { ...shape, data: { ...shape.data, ghlConnection: { kind: cause.kind } } };
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
