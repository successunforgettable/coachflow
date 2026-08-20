import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { coachMethods, services, sourceOfTruth } from "../../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";
import { extractMethod, hasSubstance, type DistilledMethod, type RawMaterial } from "../_core/methodExtractor";
import { METHOD_WALKTHROUGH, PROBE_LIMIT } from "../_core/mechanismStandard";

/**
 * methods — the guided method walkthrough, server side.
 *
 * 🔑 THE SCRIPT LIVES HERE, NOT IN THE COMPONENT. Every line Zappy says comes back from
 * `walkthroughTurn` as `text`; the client hardcodes no question. That is what makes
 * `METHOD_WALKTHROUGH` the single source of truth rather than a copy that drifts from a second
 * copy in a .tsx file — the shape this codebase has already been bitten by five times.
 *
 * 🔑 THE EXTRACTOR STAYS SOURCE-AGNOSTIC. Chat turns are converted to `RawMaterial[]` HERE, at the
 * router boundary, and handed to the same `extractMethod` that Auto Mode calls with a service
 * description. There is no mode flag and no branch on origin anywhere below the boundary: the
 * brain never learns that a human was typing.
 */

const turnSchema = z.object({
  role: z.enum(["zappy", "coach"]),
  text: z.string().max(4000),
});
export type WalkthroughTurn = z.infer<typeof turnSchema>;

/** The coach tapped "Skip this one" on the optional differentiator beat. */
const SKIP = "__SKIP__";

/** What the client should render next. The client switches on this and renders `text` verbatim. */
export type WalkthroughNext = "opener" | "probe" | "differentiator" | "reflect" | "insufficient";

function toRawMaterial(turns: WalkthroughTurn[]): RawMaterial[] {
  // The boundary. Zappy's own prompts are carried too — they are the questions the answers
  // respond to, and an answer like "then the worksheet" is unreadable without its question.
  return turns
    .filter((t) => t.text.trim() && t.text.trim() !== SKIP)
    .map((t) => ({ label: t.role === "coach" ? "coach" : "zappy asked", text: t.text.trim() }));
}

function coachTurns(turns: WalkthroughTurn[]): WalkthroughTurn[] {
  return turns.filter((t) => t.role === "coach" && t.text.trim() && t.text.trim() !== SKIP);
}

/** How many probes Zappy has already fired, read off the transcript rather than tracked client-side. */
function probesUsed(turns: WalkthroughTurn[]): number {
  const probes = METHOD_WALKTHROUGH.probes as readonly string[];
  return turns.filter((t) => t.role === "zappy" && probes.includes(t.text.trim())).length;
}

function differentiatorAsked(turns: WalkthroughTurn[]): boolean {
  return turns.some((t) => t.role === "zappy" && t.text.trim() === METHOD_WALKTHROUGH.differentiator);
}

/** The reflect-back line: recognition, not articulation. The coach only confirms or corrects. */
function reflectBackText(method: DistilledMethod): string {
  const moves = method.steps.map((s, i) => `${i + 1}. ${s.name} — ${s.whatHappens}`).join("\n");
  return `${METHOD_WALKTHROUGH.reflectBackPrefix}\n\n${moves}\n\n${METHOD_WALKTHROUGH.reflectBackSuffix}`;
}

async function nicheFor(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number, serviceId: number): Promise<string> {
  const [svc] = await db.select().from(services)
    .where(and(eq(services.id, serviceId), eq(services.userId, userId))).limit(1);
  return svc?.targetCustomer || svc?.name || "";
}

export const methodsRouter = router({
  /**
   * One turn of the conversation. The client posts the whole transcript so far and gets back the
   * next thing to say — so the client holds no script, no probe counter, and no completion rule.
   *
   * ENDS ON SUBSTANCE, NOT A FIELD COUNT: the loop advances to the reflect-back the moment
   * `hasSubstance` is true (two or more evidenced steps), regardless of how many turns that took.
   */
  walkthroughTurn: protectedProcedure
    .input(z.object({ serviceId: z.number(), turns: z.array(turnSchema).max(40) }))
    .mutation(async ({ ctx, input }): Promise<{
      next: WalkthroughNext;
      text?: string;
      chips?: string[];
      method?: DistilledMethod | null;
    }> => {
      const db = await getDb();
      if (!db) return { next: "insufficient", text: METHOD_WALKTHROUGH.opener };

      // Nothing said yet → open with the walk-me-through.
      if (coachTurns(input.turns).length === 0) {
        return { next: "opener", text: METHOD_WALKTHROUGH.opener };
      }

      const niche = await nicheFor(db, ctx.user.id, input.serviceId);
      const method = await extractMethod({
        rawMaterial: toRawMaterial(input.turns),
        tier: "coach_stated",
        niche,
      });

      if (hasSubstance(method)) {
        // The optional beat runs once, only after there is already a method to attach it to, and
        // it never gates completion — a coach with nothing to add taps the skip chip and moves on.
        if (!differentiatorAsked(input.turns)) {
          return {
            next: "differentiator",
            text: METHOD_WALKTHROUGH.differentiator,
            chips: [METHOD_WALKTHROUGH.skipChip],
          };
        }
        return {
          next: "reflect",
          text: reflectBackText(method),
          chips: [METHOD_WALKTHROUGH.confirmChip, METHOD_WALKTHROUGH.correctChip],
          method,
        };
      }

      // Not enough yet — probe, while there is budget.
      const used = probesUsed(input.turns);
      if (used < PROBE_LIMIT) {
        return { next: "probe", text: METHOD_WALKTHROUGH.probes[used] };
      }

      // Budget spent and still no method. Say so plainly and stop pushing; the cascade falls
      // through to tier 2/3, which is a correct outcome rather than a failure.
      return { next: "insufficient", method: null };
    }),

  /**
   * Persist the distilled method. Re-extracts from the transcript rather than trusting a client
   * payload — the client is a renderer and must never be the origin of what lands in the row.
   *
   * Upserts on the (userId, serviceId) unique key, so re-running the walkthrough sharpens the
   * method in place instead of accumulating rows nobody can choose between.
   */
  saveMethod: protectedProcedure
    .input(z.object({ serviceId: z.number(), turns: z.array(turnSchema).max(40) }))
    .mutation(async ({ ctx, input }): Promise<{ saved: boolean; methodId?: number; reason?: string }> => {
      const db = await getDb();
      if (!db) return { saved: false, reason: "database unavailable" };

      const niche = await nicheFor(db, ctx.user.id, input.serviceId);
      const method = await extractMethod({
        rawMaterial: toRawMaterial(input.turns),
        tier: "coach_stated",
        niche,
      });
      if (!hasSubstance(method)) return { saved: false, reason: "not enough to work from yet" };

      const row = {
        userId: ctx.user.id,
        serviceId: input.serviceId,
        steps: method.steps,
        operationalTwist: method.operationalTwist,
        ump: method.ump,
        ums: method.ums,
        oldVehicle: method.oldVehicle,
        differentiator: method.differentiator,
        sourceTier: "coach_stated" as const,
        confidence: method.confidence,
        evidence: method.evidence,
        rawMaterial: toRawMaterial(input.turns),
      };

      const [existing] = await db.select({ id: coachMethods.id }).from(coachMethods)
        .where(and(eq(coachMethods.userId, ctx.user.id), eq(coachMethods.serviceId, input.serviceId)))
        .limit(1);

      if (existing) {
        await db.update(coachMethods).set(row as any).where(eq(coachMethods.id, existing.id));
        return { saved: true, methodId: existing.id };
      }
      const res: any = await db.insert(coachMethods).values(row as any);
      return { saved: true, methodId: res?.[0]?.insertId };
    }),

  /** Whether this service already has a captured method — drives whether the offer is made at all. */
  getMethod: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const [scoped] = await db.select().from(coachMethods)
        .where(and(eq(coachMethods.userId, ctx.user.id), eq(coachMethods.serviceId, input.serviceId)))
        .limit(1);
      if (scoped) return scoped;
      const [general] = await db.select().from(coachMethods)
        .where(and(eq(coachMethods.userId, ctx.user.id), isNull(coachMethods.serviceId)))
        .limit(1);
      return general ?? null;
    }),
});
