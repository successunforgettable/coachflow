import { nanoid } from "nanoid";
import { invokeLLM } from "./_core/llm";
import { BANNED_HEADLINE_PATTERNS, META_COMPLIANCE_NOTES, NO_CREDENTIAL_FABRICATION_RULE, REGISTER_STANDARD, scoreAdContent } from "./_core/copywritingRules";
import { awarenessPlanForCount, dealAcrossSlots, type AwarenessStage } from "./_core/conceptAxis";
import { STAGE_HEADLINE_GUIDANCE } from "./adCopyAngles";
import type { GateItem } from "./_core/pdafGate";
import type { headlines as headlinesTable } from "../drizzle/schema";

function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*|^```\s*|\s*```$/gm, '').trim();
}

/**
 * The model's `headlines` field, as an array — or an empty array when it is anything else.
 *
 * ⚠️ WHY THIS EXISTS. `parsed.headlines.forEach(...)` was called with no shape check. A JSON
 * schema is a REQUEST, not a guarantee: on 2026-08-09 a live Node 6 run died with
 * `TypeError: parsed.headlines.forEach is not a function` after it had already resolved its
 * desires and stage plan. Because the formula loop runs inside `Promise.all`, that one
 * off-shape response killed all five formulas and the entire deck — and it is in DEPLOYED
 * code, so a real coach hits it whenever the model answers oddly.
 *
 * Returning `[]` lets the caller contribute nothing for that formula while the rest of the
 * deck lands. That is the existing "ship short and say so" behaviour, not a new retry.
 *
 * Non-array entries inside a valid array are NOT filtered here: the three call sites read
 * different item shapes (a bare string, `{eyebrow,main,sub}`, `{main,sub}`), so judging item
 * validity belongs to them. This guards the CONTAINER only, which is what threw.
 */
/**
 * One ELEMENT of a structured formula's array, or null when it cannot be used.
 *
 * `eyebrow` reads `item.eyebrow/.main/.sub` and `authority` reads `item.main/.sub`. The
 * container guard below only proves the array is an array — an element inside it can still
 * be a string, a null, or an object missing `main`, and `headline` is a NOT NULL column, so
 * a missing `main` would fail at insert time with an error nowhere near its cause.
 *
 * `sub` and `eyebrow` are nullable columns, so absent ones degrade to null rather than
 * discarding an otherwise good headline. Only a missing `main` drops the element.
 */
export function structuredHeadlineFields(
  item: unknown,
  formulaType: string,
  idx: number,
): { main: string; sub: string | null; eyebrow: string | null } | null {
  const asText = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  if (!item || typeof item !== "object") {
    console.error(`[headlinesGenerator] ${formulaType}[${idx}]: element is ${item === null ? "null" : typeof item}, not an object — skipping it.`);
    return null;
  }
  const main = asText((item as any).main);
  if (!main) {
    console.error(`[headlinesGenerator] ${formulaType}[${idx}]: element has no usable \`main\` — skipping it. Keys: ${Object.keys(item as object).join(",") || "(none)"}`);
    return null;
  }
  return { main, sub: asText((item as any).sub), eyebrow: asText((item as any).eyebrow) };
}

export function headlineItemsFrom(parsed: unknown, formulaType: string): any[] {
  const raw = (parsed as any)?.headlines;
  if (Array.isArray(raw)) return raw;
  console.error(
    `[headlinesGenerator] ${formulaType}: model returned \`headlines\` as ` +
    `${raw === null ? "null" : Array.isArray(raw) ? "array" : typeof raw} — ` +
    `contributing 0 headlines for this formula rather than throwing and killing the deck. ` +
    `Received keys: ${parsed && typeof parsed === "object" ? Object.keys(parsed as object).join(",") || "(none)" : "(not an object)"}`,
  );
  return [];
}

// ─── Pre-compute compliance rewrites helper ─────────────────────────────────
// Moved from server/routers/headlines.ts as part of Auto Mode Phase B1.
// Feature flag: ENABLE_COMPLIANCE_REWRITES. Off by default — when unset or
// false this is a no-op so production sees no change until we flip it.
//
// Picks up every row in the set whose complianceScore is below the same
// threshold the picker uses (70), re-derives the issue list (the headlines
// table only stores the score, not the issues), asks Sonnet for a compliant
// rewrite via rewriteForCompliance, and inserts rows into complianceRewrites.
// Best-effort: per-row failures are caught and logged.
export async function precomputeHeadlinesComplianceRewrites(
  user: { id: number; subscriptionTier: string | null; role: string | null },
  headlineSetId: string,
  serviceNiche: string | null,
): Promise<void> {
  if (process.env.ENABLE_COMPLIANCE_REWRITES !== "true") return;

  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return;
    const { headlines: h, complianceRewrites } = await import("../drizzle/schema");
    const { eq, and, lt } = await import("drizzle-orm");
    const { rewriteForCompliance } = await import("./_core/complianceRewrite");
    const { enforceFreeTierRewriteCap } = await import("./routers/complianceRewrites");
    const { checkCompliance } = await import("./lib/complianceChecker");

    const flagged = await db
      .select()
      .from(h)
      .where(and(
        eq(h.userId, user.id),
        eq(h.headlineSetId, headlineSetId),
        lt(h.complianceScore, 70),
      ));
    if (flagged.length === 0) return;

    const serviceId = flagged.find(r => r.serviceId != null)?.serviceId ?? null;
    if (serviceId != null) {
      try { await enforceFreeTierRewriteCap(db, user, serviceId); }
      catch {
        console.log(`[precomputeHeadlinesComplianceRewrites] free-tier cap hit for user ${user.id}, skipping set ${headlineSetId}`);
        return;
      }
    }

    const rowsToInsert: Array<typeof complianceRewrites.$inferInsert> = [];
    await Promise.all(flagged.map(async (row) => {
      if (row.serviceId == null) return;
      try {
        const c = await checkCompliance(row.headline);
        if (c.issues.length === 0) return;
        const r = await rewriteForCompliance(row.headline, c.issues, "headline", {
          niche: serviceNiche,
          mechanism: row.uniqueMechanism,
          mainBenefit: row.desiredOutcome,
        });
        rowsToInsert.push({
          userId: user.id,
          serviceId: row.serviceId,
          contentType: "headline",
          sourceTable: "headlines",
          sourceId: row.id,
          originalText: row.headline,
          rewrittenText: r.rewrite,
          violationReasons: c.issues.map(i => i.reason),
          complianceScore: r.score,
          modelUsed: r.modelUsed,
        });
      } catch (err) {
        console.warn(`[precomputeHeadlinesComplianceRewrites] Skipped headline ${row.id}:`, err instanceof Error ? err.message : err);
      }
    }));

    if (rowsToInsert.length > 0) {
      await db.insert(complianceRewrites).values(rowsToInsert);
      console.log(`[precomputeHeadlinesComplianceRewrites] Inserted ${rowsToInsert.length} rewrite(s) for set ${headlineSetId}`);
    }
  } catch (err) {
    console.error(`[precomputeHeadlinesComplianceRewrites] unexpected failure for set ${headlineSetId}:`, err instanceof Error ? err.message : err);
  }
}

// ─── Formula prompts + schemas (moved from router) ──────────────────────────
const FORMULA_PROMPTS = {
  story: `Generate 5 story-based headlines using this EXACT format:
"How a [Triggering Event] Led/Pushed/Triggered a [Person] to [Discovery] that [Result]!"

Context:
- Target Market: {targetMarket}
- Pressing Problem: {pressingProblem}
- Desired Outcome: {desiredOutcome}
- Unique Mechanism: {uniqueMechanism}

Requirements:
- Use varied triggering events (embarrassing moment, unexpected discovery, crisis, weekend event, etc.)
- Make the person relatable to target market
- Highlight the unique mechanism as the discovery
- Promise the desired outcome as the result
- Each headline should be 15-25 words
- Return ONLY a JSON object with a "headlines" field containing the array of 5 headline strings, nothing else

Example output format:
{"headlines": ["How A Proposal That Sat Unsent For Nine Days Led Me To A Four-Minute Scoping Sequence", "How Losing Three Retainers In One Quarter Pushed Me To Rebuild How I Run Discovery Calls", ...]}`,

  eyebrow: `Generate 5 three-part headlines with eyebrow, main headline, and subheadline:

Eyebrow format: "[Authority] Unveils/Reveals"
Main format: "[Unique Mechanism] Turns [Audience] into [Result]"
Subheadline format: "Without [Pain Point 1], [Pain Point 2] or [Pain Point 3]"

Context:
- Target Market: {targetMarket}
- Pressing Problem: {pressingProblem}
- Desired Outcome: {desiredOutcome}
- Unique Mechanism: {uniqueMechanism}

Requirements:
- Eyebrow should establish authority/credibility
- Main headline should feature the unique mechanism prominently
- Subheadline should address 3 pain points from pressing problem
- Return ONLY a JSON object with a "headlines" field containing the array of 5 objects with this structure: {"eyebrow": "...", "main": "...", "sub": "..."}

Example output format:
{"headlines": [{"eyebrow": "[INSERT_COACH_CREDENTIAL] Introduces", "main": "The Scope-First Method: Settle The Brief Before Anyone Talks Price", "sub": "Without Scripts, Discounting, Or Another Tool In The Stack"}, ...]}`,

  question: `Generate 5 question-based headlines that highlight obstacles or mistakes:

Format: "[Question about obstacle/mistake]?"

Context:
- Target Market: {targetMarket}
- Pressing Problem: {pressingProblem}
- Desired Outcome: {desiredOutcome}

Requirements:
- Frame as a question about the obstacle itself — why it persists, what it quietly costs, what gets missed
- Focus on hidden obstacles, sneaky pitfalls, or overlooked mistakes
- Use words like "preventing", "stopping", "sabotaging", "devouring", "sapping"
- Each question should be 10-20 words
- Return ONLY a JSON object with a "headlines" field containing the array of 5 question strings, nothing else

Example output format:
{"headlines": ["Which Part Of The Discovery Call Is Quietly Deciding The Whole Thing?", "What Happens To A Quote In The Nine Days Nobody Talks About?", ...]}`,

  authority: `Generate 5 authority-based headlines with main headline and subheadline:

Main format: "[Authority Figure] [Action] [Unique Mechanism] [Result]"
Subheadline format: "This is why [Old Way 1], [Old Way 2], and [Old Way 3] have failed to produce [Desired Outcome]"

Context:
- Target Market: {targetMarket}
- Pressing Problem: {pressingProblem}
- Desired Outcome: {desiredOutcome}
- Unique Mechanism: {uniqueMechanism}

Requirements:
- Authority figure should be credible (award-winning, published, certified, etc.) — BUT see system-prompt rule NO_CREDENTIAL_FABRICATION_RULE: do not invent these credentials. The credibility examples below are illustrative formula structure only; the system rule overrides them and instructs you to use real input-field credentials, bracketed [INSERT_*] placeholders, or generic role framing instead. The example output below predates that rule and is retained only for formula-shape guidance, not as content to copy.
- Action verbs: unearthed, discovered, revealed, disclosed, unveiled
- Subheadline should debunk 3 old/failed methods
- Return ONLY a JSON object with a "headlines" field containing the array of 5 objects with this structure: {"main": "...", "sub": "..."}

Example output format (formula structure only — credentials in this example are illustrative; do not copy them per NO_CREDENTIAL_FABRICATION_RULE):
{"headlines": [{"main": "[INSERT_AUTHORITY_TITLE] Reveals The Scoping Sequence Behind Every Booked Retainer", "sub": "This is why tighter scripts, faster follow-up, and lower pricing all leave the real problem untouched"}, ...]}`,

  urgency: `Generate 5 urgency-based headlines with specific timeframes:

Format: "[Action] [Unique Mechanism], and [Result] in [Timeframe]!"

Context:
- Target Market: {targetMarket}
- Desired Outcome: {desiredOutcome}
- Unique Mechanism: {uniqueMechanism}

Requirements:
- Start with action verbs: Discover, Unearth, Leverage, Unlock, Access
- Include specific timeframe: "in 30 days", "in 6 months", "in just one month", "under 30 days"
- Promise the desired outcome
- Use exciting result language with specific concrete outcomes: "scale", "build", "deliver", "claim", "secure" — paired to a measurable result (e.g., "scale your booked-call rate to 8/week"). Do NOT use clickbait-puffery verbs like "skyrocket", "explode", "rains", "dominate", "crush" — these are banned per the system-prompt rule below and read as low-quality scam-ad copy.
- Return ONLY a JSON object with a "headlines" field containing the array of 5 headline strings, nothing else

Example output format:
{"headlines": ["Apply The Scope-First Method, And Settle Your Next Brief In One Call!", "Rebuild Your Discovery Call, And Know Where Every Quote Stands In 30 Days!", ...]}`,
};

const HEADLINE_STRING_ARRAY_SCHEMA = {
  type: "object" as const,
  properties: {
    headlines: { type: "array", items: { type: "string" } },
  },
  required: ["headlines"],
  additionalProperties: false,
};
const FORMULA_SCHEMAS = {
  story: HEADLINE_STRING_ARRAY_SCHEMA,
  question: HEADLINE_STRING_ARRAY_SCHEMA,
  urgency: HEADLINE_STRING_ARRAY_SCHEMA,
  eyebrow: {
    type: "object" as const,
    properties: {
      headlines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            eyebrow: { type: "string" },
            main: { type: "string" },
            sub: { type: "string" },
          },
          required: ["eyebrow", "main", "sub"],
          additionalProperties: false,
        },
      },
    },
    required: ["headlines"],
    additionalProperties: false,
  },
  authority: {
    type: "object" as const,
    properties: {
      headlines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            main: { type: "string" },
            sub: { type: "string" },
          },
          required: ["main", "sub"],
          additionalProperties: false,
        },
      },
    },
    required: ["headlines"],
    additionalProperties: false,
  },
} as const;

// ─── Auto Mode Phase B1 — runHeadlinesGeneration ────────────────────────────
// Gen-core for the headlines node. Callable directly by:
//   - headlines.generate (sync tRPC mutation) — wrapped with quota check
//   - headlines.generateAsync (async tRPC mutation) — wrapped with quota check + jobId enqueue + setImmediate
//   - autoMode.orchestrate (Phase B2 orchestrator) — direct call, no HTTP round-trip
//
// What's inside: Service/SOT/ICP/Campaign/Kit fetches → context building →
// 5 PARALLEL LLM calls (story, eyebrow, question, authority, urgency
// formulas), each with per-formula JSON schema + per-formula result-shape
// branching → per-row checkCompliance pass → DB insert via createHeadlines +
// incrementHeadlineCount → precomputeHeadlinesComplianceRewrites await
// (compliance rewrites must land before runX returns so wizard panel sees
// them atomically with the headlines).
// What's outside: quota ENFORCEMENT (caller's job).
//
// Pre-B1 sync system prompt diverged from async (sync had full THREE-QUESTION
// TEST + banned openers; async was condensed). B1 unifies on the SYNC prompt
// as single source of truth.
//
// headlineStyle filter: undefined → all 5 formulas; specific enum key → 1.
export async function runHeadlinesGeneration(input: {
  userId: number;
  serviceId?: number;
  campaignId?: number;
  targetMarket: string;
  pressingProblem: string;
  desiredOutcome: string;
  uniqueMechanism: string;
  powerMode?: boolean;
  liteMode?: boolean;
  headlineStyle?: "story" | "eyebrow" | "question" | "authority" | "urgency";
  // ── AWARENESS STAGE (0097) ────────────────────────────────────────────────
  // Omitted (the normal case) → the set is DISTRIBUTED across stages using
  // awarenessPlanForCount, the same cold-weighted allocation the ad-copy node
  // already uses, so headlines and body copy describe one funnel shape.
  // Supplied → every headline in the set is written to that one stage, for a
  // caller that wants a single-stage set (e.g. a warm retargeting batch).
  awarenessStage?: AwarenessStage;
  // Caller-provided user tier/role for compliance-rewrite free-tier cap.
  userSubscriptionTier?: string | null;
  userRole?: string | null;
}): Promise<{ headlineSetId: string; count: number }> {
  const { getDb, createHeadlines, incrementHeadlineCount } = await import("./db");
  const { headlines, services, idealCustomerProfiles, sourceOfTruth, campaigns, campaignKits } = await import("../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");
  const { getCascadeContext } = await import("./_core/cascadeContext");
  const { checkCompliance } = await import("./lib/complianceChecker");

  // Service/ICP/SOT/campaignType context build — only when serviceId provided
  let autoPopData: any = {};
  let icpContext = '';
  let sotContext = '';
  let cascadeContext = '';
  let campaignTypeContext = '';
  let serviceCategory: string | null = null;
  let resolvedIcpId: number | undefined;
  // Hoisted to function scope so the BLOCKING compliance pass below can build the same
  // grounding corpus the persistence backstop builds. They were block-local, which is part
  // of why Node 6 never had a blocking pass of its own.
  let resolvedService: typeof services.$inferSelect | undefined;
  let resolvedIcp: typeof idealCustomerProfiles.$inferSelect | undefined;

  if (input.serviceId) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const serviceData = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
    if (serviceData.length > 0) {
      const service = serviceData[0];
      resolvedService = service;
      autoPopData = {
        avatarName: service.avatarName,
        avatarTitle: service.avatarTitle,
        mechanismDescriptor: service.mechanismDescriptor,
        resolvedPressingProblem: input.pressingProblem?.trim() || service.painPoints || "",
        resolvedDesiredOutcome: input.desiredOutcome?.trim() || service.mainBenefit || "",
        resolvedUniqueMechanism: input.uniqueMechanism?.trim() || service.uniqueMechanismSuggestion || "",
        category: service.category,
      };
      serviceCategory = service.category;
    }

    let campaignRecord: typeof campaigns.$inferSelect | undefined;
    if (input.campaignId) {
      [campaignRecord] = await db.select().from(campaigns)
        .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, input.userId))).limit(1);
    }
    let icp: typeof idealCustomerProfiles.$inferSelect | undefined;
    if (campaignRecord?.icpId) {
      [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, campaignRecord.icpId)).limit(1);
    }
    if (!icp) {
      [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
    }
    if (icp) {
      resolvedIcpId = icp.id;
      resolvedIcp = icp;
      icpContext = [
        'IDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:',
        icp.pains ? `Their daily pains: ${icp.pains}` : '',
        icp.fears ? `Their deep fears: ${icp.fears}` : '',
        icp.buyingTriggers ? `What makes them buy: ${icp.buyingTriggers}` : '',
      ].filter(Boolean).join('\n').trim();
    }

    // campaignType from campaignKits (V2 SoT)
    let campaignType: string = 'course_launch';
    if (icp?.id) {
      const [kit] = await db.select().from(campaignKits)
        .where(and(eq(campaignKits.userId, input.userId), eq(campaignKits.icpId, icp.id)))
        .limit(1);
      if (kit?.campaignType) campaignType = kit.campaignType;
    }
    const campaignTypeContextMap: Record<string, string> = {
      webinar: `CAMPAIGN CONTEXT: Webinar
The headline must give a reason to attend live — sell the event itself. Reference the show-up moment ("how I [outcome] in 60 minutes live"). Avoid evergreen-funnel language.`,
      challenge: `CAMPAIGN CONTEXT: Challenge
The headline must hint at a community doing this together over a fixed window. Daily-wins framing. Reference the challenge name or duration ("5-day", "21-day", "by [date]").`,
      course_launch: `CAMPAIGN CONTEXT: Course Launch
The headline must hint at transformation — who they are now vs who they will become. Cohort framing acceptable. Reference the programme outcome, not the lessons.`,
      product_launch: `CAMPAIGN CONTEXT: Product Launch
The headline must signal early access or founding-member status. Reference the new thing being launched, the access window, or the price ceiling.`,
      discovery_call: `CAMPAIGN CONTEXT: Discovery Call
The headline must invite a 1:1 conversation, not a course or event. Selectivity framing — application, qualification, fit-check. Avoid mass-event language.`,
      lead_magnet: `CAMPAIGN CONTEXT: Lead Magnet
The headline must promise a specific concrete asset (the title of the PDF, guide, training, swipe). No commitment. The asset name is often the headline.`,
      in_person_event: `CAMPAIGN CONTEXT: In-Person Event
The headline must signal physical presence — city, venue, date. Reference the room or the live experience. Avoid digital-event language.`,
    };
    campaignTypeContext = campaignTypeContextMap[campaignType] || campaignTypeContextMap['course_launch'];

    cascadeContext = await getCascadeContext(input.userId, icp?.id, "headlines");

    const [sot] = await db.select().from(sourceOfTruth).where(eq(sourceOfTruth.userId, input.userId)).limit(1);
    const sotLines = sot ? [
      sot.coreOffer        ? `Core offer: ${sot.coreOffer}` : '',
      sot.targetAudience   ? `Target audience: ${sot.targetAudience}` : '',
      sot.mainPainPoint    ? `Main pain point: ${sot.mainPainPoint}` : '',
      sot.mainBenefits     ? `Main benefits: ${sot.mainBenefits}` : '',
      sot.uniqueValue      ? `Unique value: ${sot.uniqueValue}` : '',
      sot.idealCustomerAvatar ? `Ideal customer: ${sot.idealCustomerAvatar}` : '',
    ].filter(Boolean) : [];
    sotContext = sotLines.length > 0
      ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n')
      : '';
  }

  const headlineSetId = nanoid();
  const allHeadlines: Array<typeof headlinesTable.$inferInsert> = [];
  const countMultiplier = input.liteMode ? 0.4 : input.powerMode ? 3 : 1;

  // ── AWARENESS PLAN FOR THE WHOLE SET (0097) ─────────────────────────────────
  // Planned across the SET, then dealt to the formulas — never planned per formula
  // independently. The distinction is not cosmetic. Five formulas each planning
  // their own 5 slots gives every formula the same [unaware, unaware, problem,
  // problem, solution] shape, which has two consequences, both measured on a live
  // run: the same (stage × formula) cell repeats inside every formula — 10 pairs
  // differing on ZERO axes — and product_aware receives no headline at all, because
  // its 1/8 share rounds away at a count of five. Planning the whole set spends the
  // cold-weighted mix once, across 25 slots, so the small stages survive rounding.
  //
  // This mirrors awarenessDeckPlan on the image side, where the same rule is stated
  // as "a repeated (stage × style) cell is a repeated Entity ID".
  const activeFormulas = Object.entries(FORMULA_PROMPTS)
    .filter(([k]) => !input.headlineStyle || k === input.headlineStyle);
  const perFormulaCount = Math.max(1, Math.round(5 * countMultiplier));
  const totalSlots = perFormulaCount * activeFormulas.length;
  const wholeSetPlan: AwarenessStage[] = input.awarenessStage
    ? Array.from({ length: totalSlots }, () => input.awarenessStage as AwarenessStage)
    : awarenessPlanForCount(totalSlots);

  // ── DESIRE AXIS ─────────────────────────────────────────────────────────────
  // Read from the concept set for this ICP. Node 6 resolves an ICP only on the
  // serviceId path; called WITHOUT a service (the sync wizard entry and the proof
  // harness both do this) there is no ICP to look up, so there are no concepts and
  // the desire axis falls back to the single deck-constant value — exactly the
  // behaviour before this change, so that path cannot regress.
  //
  // ⚠️ SURFACED, NOT SILENTLY RESOLVED: whether the no-service entry SHOULD resolve
  // an ICP is a product question, not a mechanical one. It would mean Node 6 either
  // demanding a service or guessing which ICP a headline set belongs to. Left as
  // the documented fallback; flagged for Arfeen rather than decided here.
  let conceptDesires: string[] = [];
  if (resolvedIcpId) {
    try {
      const { getDb: getDb2 } = await import("./db");
      const db2 = await getDb2();
      if (db2) {
        const { campaignConcepts } = await import("../drizzle/schema");
        const { eq: eqC } = await import("drizzle-orm");
        const rows = await db2
          .select({ desire: campaignConcepts.desire })
          .from(campaignConcepts)
          .where(eqC(campaignConcepts.icpId, resolvedIcpId));
        conceptDesires = Array.from(
          new Set(rows.map((r: any) => String(r.desire ?? "").trim()).filter(Boolean)),
        );
      }
    } catch (err) {
      console.warn(`[headlinesGenerator] desire axis unavailable for icp ${resolvedIcpId}:`, err instanceof Error ? err.message : err);
    }
  }
  const wholeSetDesires = dealAcrossSlots(conceptDesires, totalSlots);
  console.log(`[headlinesGenerator] desire axis: ${conceptDesires.length} distinct desires` +
    `${conceptDesires.length ? "" : " — falling back to the single deck-constant desire"}`);

  // Deal the plan across formulas in rotation. awarenessPlanForCount returns the
  // stages grouped, so rotating spreads each stage over as many different formulas
  // as it has slots — which is what keeps (stage × formula) cells from repeating
  // more often than the pigeonhole minimum for the deck size.
  type HeadlineSlot = { stage: AwarenessStage; desire: string | null };
  const slotsByFormula: HeadlineSlot[][] = activeFormulas.map(() => []);
  let dealCursor = 0;
  wholeSetPlan.forEach((stage, globalIdx) => {
    for (let k = 0; k < slotsByFormula.length; k++) {
      const f = (dealCursor + k) % slotsByFormula.length;
      if (slotsByFormula[f].length < perFormulaCount) {
        slotsByFormula[f].push({ stage, desire: wholeSetDesires[globalIdx] ?? null });
        dealCursor = f + 1;
        break;
      }
    }
  });

  // 5 formulas in parallel via tool-use; per-formula filter respects
  // input.headlineStyle (undefined = all 5; specific enum = 1).
  //
  // ⚠️ allSettled, NOT all. This was `Promise.all`, so ONE formula rejecting took the whole
  // batch down and the coach got ZERO headlines — which is what a single off-shape model
  // response did on 2026-08-09. The per-branch guards below stop the common cause, but a
  // wholesale-rejecting batch means any future throw anywhere in a formula's body has the
  // same catastrophic blast radius. Isolation is the structural fix; the guards are the
  // specific one, and both are wanted.
  //
  // No retry, deliberately: this generator has never had one around the LLM call, and
  // adding one inside a crash fix would smuggle in new behaviour. Considered separately.
  const formulaOutcomes = await Promise.allSettled(
    activeFormulas
      .map(async ([formulaType, promptTemplate], formulaIndex) => {
        const modifiedTemplate = promptTemplate
          .replace(/Generate 5/g, `Generate ${perFormulaCount}`)
          // The templates also say "the array of 5 …" further down. Left unreplaced
          // it contradicts the count above, and the stage list below is positional —
          // a short return would silently shift every stage by one slot.
          .replace(/array of 5\b/g, `array of ${perFormulaCount}`);

        // This formula's slice of the whole-set plan built above. Without a stage,
        // every headline in a set differs from its siblings on FORMAT ALONE — one
        // axis of four — which is a guaranteed Entity-ID collapse under the 2-of-4
        // rule (docs/andromeda/copy-research/Andromeda_Copy_EntityID_Distinctness.md).
        // Measured before this change: 1,809 of 1,809 headline pairs on prod
        // collapsed. Adding the stage is what moves a pair from one axis to two.
        const slotPlan: HeadlineSlot[] = slotsByFormula[formulaIndex];
        const stagePlan: AwarenessStage[] = slotPlan.map((s) => s.stage);

        const stageBlock = [
          `AWARENESS-STAGE ASSIGNMENT — read this before writing anything.`,
          ``,
          `These ${perFormulaCount} headlines are deliberately spread across awareness stages. Two`,
          `headlines that differ only in wording are treated as the same ad and compete against`,
          `each other, so each slot below is written to a DIFFERENT reader.`,
          ``,
          `Write one headline per slot, in this exact order, and return them in this order:`,
          ``,
          ...stagePlan.map((s, i) =>
            `── HEADLINE ${i + 1} → ${s.replace(/_/g, " ").toUpperCase()} ──\n` +
            (slotPlan[i]?.desire ? `the want this one speaks to: ${slotPlan[i].desire}\n` : "") +
            STAGE_HEADLINE_GUIDANCE[s],
          ),
          ``,
          `Every headline still obeys the ${formulaType} format specified above. The stage decides`,
          `WHAT the headline is about and how much it is allowed to reveal; the formula decides its`,
          `shape. A stage assignment never overrides the compliance rules or the banned patterns.`,
        ].join("\n");
        const resolvedPressingProblem = autoPopData.resolvedPressingProblem ?? input.pressingProblem;
        const resolvedDesiredOutcome = autoPopData.resolvedDesiredOutcome ?? input.desiredOutcome;
        const resolvedUniqueMechanism = autoPopData.resolvedUniqueMechanism ?? input.uniqueMechanism;
        const prompt = modifiedTemplate
          .replace(/{targetMarket}/g, input.targetMarket)
          .replace(/{pressingProblem}/g, resolvedPressingProblem)
          .replace(/{desiredOutcome}/g, resolvedDesiredOutcome)
          .replace(/{uniqueMechanism}/g, resolvedUniqueMechanism);

        const icpAndCampaignBlock = [icpContext, campaignTypeContext].filter(Boolean).join('\n\n');
        const promptWithIcp = icpAndCampaignBlock ? prompt.replace(/\n\nGenerate /, `\n\n${icpAndCampaignBlock}\n\nGenerate `) : prompt;
        const promptWithSot = sotContext ? `${sotContext}\n\n${promptWithIcp}` : promptWithIcp;
        const promptWithStage = `${promptWithSot}\n\n${stageBlock}`;

        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are an expert direct response copywriter specialising in Meta ad headlines for coaches, consultants and speakers. You apply a THREE-QUESTION TEST to every headline before including it:
1. Does it name a specific person in a specific situation? (Not "coaches" but "coaches who've been running ads for 3 months with zero leads")
2. Does it promise a specific outcome — not a vague benefit? (Not "more clients" but "8 discovery calls booked in the next 14 days")
3. Could this headline ONLY be written for THIS service? (If it works equally well for any coach, rewrite it)

BANNED OPENERS AND PHRASES — never generate headlines using these patterns:
- ${BANNED_HEADLINE_PATTERNS.map(p => `"${p}..."`).join(', ')}, "Everything you need to..."
- Generic power words used without specific context: skyrocket, explode, dominate, crush it, master

MANDATORY: Every headline must contain at least ONE word that comes directly from the ICP's pain language, desire language, or niche-specific vocabulary — a word that signals to the ideal customer "this was written for me specifically."

Return ONLY valid JSON, no markdown, no explanations.\n\n${META_COMPLIANCE_NOTES}\n\n${NO_CREDENTIAL_FABRICATION_RULE}\n\n${REGISTER_STANDARD}`,
              },
              { role: "user", content: cascadeContext + promptWithStage },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: `headlines_${formulaType}`,
                strict: true,
                schema: FORMULA_SCHEMAS[formulaType as keyof typeof FORMULA_SCHEMAS],
              },
            },
          });

          const content = response.choices[0].message.content;
          if (typeof content !== "string") throw new Error("Invalid LLM response");
          const parsed = JSON.parse(stripMarkdownJson(content));

          // ── P.D.A.F. AXES (0097) ────────────────────────────────────────────
          // Stamped from what the generator ASSIGNED, never re-read from the
          // finished headline. stagePlan is positional — slot i was written to
          // stage i — so the recorded stage is the instruction that was actually
          // issued, not a guess about what came back. This is the whole reason the
          // columns exist: the distinctness gate has to compare assignments.
          // `format` reuses formulaType. No parallel format taxonomy is created.
          const axesFor = (idx: number) => ({
            persona: input.targetMarket || null,
            desire: slotPlan[idx]?.desire
              || ([resolvedPressingProblem, resolvedDesiredOutcome].filter(Boolean).join(" ⁝ ") || null),
            awareness: (stagePlan[idx] ?? stagePlan[stagePlan.length - 1]) ?? null,
            format: formulaType,
          });

          if (formulaType === "story" || formulaType === "question" || formulaType === "urgency") {
            // ⚠️ GUARD THE MODEL'S SHAPE. `parsed.headlines` was consumed with a bare
            // `.forEach`, which throws `TypeError: … is not a function` the moment the model
            // answers with anything but an array. Observed live 2026-08-09: the run died
            // AFTER resolving its desires and its stage plan, and because this map runs
            // inside a `Promise.all` over the five formulas, ONE off-shape response killed
            // the whole deck rather than costing one formula.
            //
            // Degrading = this formula contributes NOTHING and the rest of the deck lands.
            // That matches the standing "a short set ships short and says so" rule; it does
            // not pad, and it does not invent a retry this generator has never had.
            const items = headlineItemsFrom(parsed, formulaType);
            if (items.length === 0) return;
            items.forEach((raw: unknown, idx: number) => {
              // These elements are bare strings. A non-string here would reach the insert
              // as an object and fail far from its cause, so it is skipped the same way a
              // malformed structured element is.
              const headline = typeof raw === "string" ? raw.trim() : "";
              if (!headline) {
                console.error(`[headlinesGenerator] ${formulaType}[${idx}]: element is ${raw === null ? "null" : typeof raw}, not a usable string — skipping it.`);
                return;
              }
              allHeadlines.push({
                userId: input.userId,
                serviceId: input.serviceId,
                campaignId: input.campaignId,
                headlineSetId,
                formulaType: formulaType as any,
                headline,
                subheadline: null,
                eyebrow: null,
                ...axesFor(idx),
                targetMarket: input.targetMarket,
                pressingProblem: input.pressingProblem,
                desiredOutcome: input.desiredOutcome,
                uniqueMechanism: input.uniqueMechanism,
              });
            });
          } else if (formulaType === "eyebrow") {
            // Same container guard as `story` — and it matters as much here, because the
            // formulas run in one settled batch: an unguarded throw in ANY branch used to
            // reject the whole thing and zero the deck, so guarding 579 alone closed
            // nothing on its own.
            const items = headlineItemsFrom(parsed, formulaType);
            if (items.length === 0) return;
            items.forEach((raw: unknown, idx: number) => {
              const item = structuredHeadlineFields(raw, "eyebrow", idx);
              if (!item) return;   // one bad element is skipped; its siblings still land
              allHeadlines.push({
                userId: input.userId,
                serviceId: input.serviceId,
                campaignId: input.campaignId,
                headlineSetId,
                formulaType: "eyebrow",
                headline: item.main,
                subheadline: item.sub,
                eyebrow: item.eyebrow,
                ...axesFor(idx),
                targetMarket: input.targetMarket,
                pressingProblem: input.pressingProblem,
                desiredOutcome: input.desiredOutcome,
                uniqueMechanism: input.uniqueMechanism,
              });
            });
          } else if (formulaType === "authority") {
            const items = headlineItemsFrom(parsed, formulaType);
            if (items.length === 0) return;
            items.forEach((raw: unknown, idx: number) => {
              const item = structuredHeadlineFields(raw, "authority", idx);
              if (!item) return;
              allHeadlines.push({
                userId: input.userId,
                serviceId: input.serviceId,
                campaignId: input.campaignId,
                headlineSetId,
                formulaType: "authority",
                headline: item.main,
                subheadline: item.sub,
                eyebrow: null,
                ...axesFor(idx),
                targetMarket: input.targetMarket,
                pressingProblem: input.pressingProblem,
                desiredOutcome: input.desiredOutcome,
                uniqueMechanism: input.uniqueMechanism,
              });
            });
          }
        } catch (error) {
          // Logged loudly and NOT rethrown: this formula contributes nothing and the rest
          // of the deck lands. A short deck is never silent — the line below plus the
          // summary after the batch are what make it visible.
          console.error(`[headlinesGenerator] ${formulaType}: FAILED, contributing 0 headlines —`, error);
        }
      })
  );

  // Anything that escaped the per-formula catch (a throw outside the try, an async edge)
  // is isolated by allSettled and surfaced here rather than silently swallowed.
  const rejected = formulaOutcomes.filter((o) => o.status === "rejected");
  for (const r of rejected) {
    console.error("[headlinesGenerator] a formula rejected OUTSIDE its own catch —", (r as PromiseRejectedResult).reason);
  }
  console.log(
    `[headlinesGenerator] formulas: ${activeFormulas.length} attempted · ` +
    `${formulaOutcomes.length - rejected.length} settled · ${rejected.length} rejected · ` +
    `${allHeadlines.length} headline(s) collected before compliance`,
  );
  if (allHeadlines.length === 0) {
    // Every formula produced nothing. That is a genuine failure worth surfacing rather
    // than persisting an empty set and reporting success.
    throw new Error(
      `Headline generation produced no usable headlines across ${activeFormulas.length} formula(s) — ` +
      `see the per-formula errors above.`,
    );
  }

  // Per-headline compliance check + score before insert
  const headlinesWithCompliance = await Promise.all(
    allHeadlines.map(async (headline) => {
      const complianceResult = await checkCompliance(headline.headline, {
        userId: input.userId,
        generatorType: 'headlines',
        trackUsage: true,
      });
      return {
        ...headline,
        complianceScore: complianceResult.score,
        complianceVersion: complianceResult.version,
        complianceCheckedAt: new Date(),
        selectionScore: String(scoreAdContent('headline', headline.headline ?? '')),
        violationReasons: complianceResult.issues.length > 0
          ? complianceResult.issues.map(i => i.reason)
          : null,
      };
    })
  );

  // ── TEMPLATE-TOKEN RESOLUTION — no raw [INSERT_*] placeholder ever persists ──
  // PRE-EXISTING DEFECT, found in persisted rows on the 2026-08-07 Node 6 run:
  //   "[INSERT_AUTHORITY_TITLE] Revealed What Operations Consultants Who Moved to Retainers…"
  // Two of eleven shipped headlines carried the raw token. It reaches coaches today.
  //
  // The token is not a bug in the model's behaviour — NO_CREDENTIAL_FABRICATION_RULE
  // explicitly OFFERS "bracketed [INSERT_*] placeholders" as one of three legal ways to
  // avoid inventing a credential, and that rule is right: a placeholder is far better than
  // a fabricated award. The bug is that nothing ever RESOLVED the placeholder before the
  // row was written.
  //
  // Resolution order, matching what the rule already permits:
  //   1. the coach's REAL authority material (services.pressFeatures — the same field
  //      Node 7 resolves for its "Credible Authority" slot);
  //   2. otherwise GENERIC ROLE FRAMING, the rule's third option — a description of who is
  //      speaking that claims no credential at all.
  // Never a fabricated credential, and never the raw token.
  {
    const realAuthority = String((resolvedService as any)?.pressFeatures ?? "").trim();
    // Generic role framing: names the role, asserts nothing. Deliberately not "award-winning
    // expert" or similar — inventing standing is precisely what the rule forbids, and a
    // placeholder is only safe to replace with something that claims no more than it did.
    const genericRole = "One experienced practitioner";
    const substitute = realAuthority || genericRole;
    const TOKEN_RE = /\[INSERT_[A-Z0-9_]*\]/g;
    let tokensFound = 0;
    for (const row of headlinesWithCompliance as any[]) {
      for (const field of ["headline", "subheadline", "eyebrow"] as const) {
        const v = row[field];
        if (typeof v !== "string" || !TOKEN_RE.test(v)) continue;
        TOKEN_RE.lastIndex = 0;
        tokensFound += (v.match(TOKEN_RE) ?? []).length;
        // Collapse a doubled space if the token was mid-sentence and the substitute is empty.
        row[field] = v.replace(TOKEN_RE, substitute).replace(/\s{2,}/g, " ").trim();
      }
      TOKEN_RE.lastIndex = 0;
    }
    if (tokensFound > 0) {
      console.log(
        `[headlinesGenerator] resolved ${tokensFound} unfilled template token(s) using ` +
        `${realAuthority ? "the coach's real authority material" : "generic role framing"}.`,
      );
    }
  }

  // ── BLOCKING COMPLIANCE PASS — RUNS BEFORE THE DISTINCTNESS GATE ────────────
  // Restores the designed order, which Node 7 already had and Node 6 did not.
  //
  // WHAT WAS WRONG. `checkCompliance` above only SCORES; it drops nothing. The only
  // blocking check was `gateBeforePersist` inside createHeadlines, which runs AFTER the
  // distinctness gate. Measured live 2026-08-07: the gate kept 12, the backstop then
  // dropped 1 for `promised_result`, and 11 landed. That wasted redraft effort on a piece
  // compliance was always going to discard, and could push a deck under the band floor
  // with nothing left to backfill from.
  //
  // This uses the SAME checkOutput + grounding corpus the backstop builds, so the two
  // cannot disagree about what is compliant. The backstop stays where it is and becomes a
  // true backstop — it should now find nothing.
  //
  // ⚠️ SCOPE MATCHES THE BACKSTOP EXACTLY. gateBeforePersist no-ops without a serviceId
  // (it cannot build a corpus without a service), so this pass skips in the same case
  // rather than inventing enforcement the no-service path never had.
  let compliantHeadlines = headlinesWithCompliance;
  if (resolvedService) {
    const { checkOutput } = await import("./_core/complianceAxis");
    const { buildCoachCorpus, buildProofSupplied } = await import("./_core/groundingCorpus");
    const grounding = {
      corpus: buildCoachCorpus({ service: resolvedService as any, groundingMeta: (resolvedIcp as any)?.groundingMeta }),
      supplied: buildProofSupplied(resolvedService as any),
    };
    const blockedClasses: string[] = [];
    compliantHeadlines = headlinesWithCompliance.filter((row: any) => {
      // Headlines are a SHORT field — the same role the backstop's copyFieldsOf assigns and
      // the role the compliance axis's short-field checks are written for.
      const res = checkOutput(
        [{ location: "headline", text: String(row.headline ?? ""), role: "short" as const }],
        grounding,
      );
      if (!res.ok) blockedClasses.push(...res.blocking.map((h) => String(h.classId)));
      return res.ok;
    });
    const blocked = headlinesWithCompliance.length - compliantHeadlines.length;
    if (blocked > 0) {
      console.log(
        `[headlinesGenerator] compliance gate: blocked ${blocked}/${headlinesWithCompliance.length} ` +
        `headlines before the distinctness gate (classes=[${Array.from(new Set(blockedClasses)).join(",")}]).`,
      );
    }
    // ⚠️ NO RETRY HERE, MATCHING NODE 7'S MEASURED DECISION. Node 7 retries bodies only:
    // on prod, 100% of its drops were bodies, and a 40-character headline has too little
    // room for a redraft to change a verdict. Building a headline retry would be building
    // for a case that has never occurred. The distinctness gate below still has a surplus
    // to work from, because generation is deliberately larger than the band.
  }

  // ── P.D.A.F. DISTINCTNESS GATE ──────────────────────────────────────────────
  // Runs after the per-headline compliance check above and before persistence, the same
  // order Node 7 uses. Node 6 produces one surface only, so there are no bodies here and
  // therefore nothing for the deck-wide anti-echo check to act on — it is Node 7 that
  // carries a body opening capable of echoing a headline. No rewriteEcho is supplied.
  //
  // WHAT THE TRIM RETIRES HERE. 25 headlines across 20 (stage × formula) cells must repeat
  // a cell by pigeonhole, which is exactly where Node 6's 3 residual zero-axis pairs came
  // from. Trimming to the band puts the count under the cell count so pigeonhole no longer
  // FORCES a repeat — and the eviction pass above is what guarantees zero, because a
  // colliding piece is removed by construction rather than hoped away.
  let gatedHeadlines = compliantHeadlines;
  {
    const { runDistinctnessGate, formatLedger } = await import("./_core/pdafGate");
    const rowById = new Map<string, any>();
    const items: Array<GateItem<string>> = compliantHeadlines.map((row: any, i: number) => {
      const id = `headline#${i}`;
      rowById.set(id, row);
      return {
        id,
        surface: "headline",
        text: String(row.headline ?? ""),
        labels: {
          persona: row.persona ?? null,
          desire: row.desire ?? null,
          awareness: row.awareness ?? null,
          format: row.format ?? null,
        },
      };
    });

    const deckFacts = [
      `Target Market: ${input.targetMarket}`,
      `Pressing Problem: ${autoPopData.resolvedPressingProblem ?? input.pressingProblem}`,
      `Desired Outcome: ${autoPopData.resolvedDesiredOutcome ?? input.desiredOutcome}`,
      `Unique Mechanism: ${autoPopData.resolvedUniqueMechanism ?? input.uniqueMechanism}`,
    ].join("\n");

    const gateResult = await runDistinctnessGate<string>({
      node: "headlines (Node 6)",
      items,
      pools: {
        desires: conceptDesires.length
          ? conceptDesires
          : ([[autoPopData.resolvedPressingProblem ?? input.pressingProblem,
               autoPopData.resolvedDesiredOutcome ?? input.desiredOutcome]
              .filter(Boolean).join(" ⁝ ")].filter(Boolean) as string[]),
        awarenessPlan: wholeSetPlan,
        formats: activeFormulas.map(([f]) => String(f)),
        // Node 6 cannot move format — see the regenerate callback below for why. Declaring
        // it here means the gate never PROPOSES format, so no attempt is ever burned on a
        // move this node would have to refuse.
        movable: ["desire", "awareness"],
      },
      regenerate: async ({ item, moves }) => {
        const row = rowById.get(String(item.id));
        if (!row) return null;
        // FORMAT IS NOT MOVABLE HERE — declared to the gate via pools.movable above, so the
        // gate never proposes it and never wastes an attempt on it. Moving format means
        // moving the headline to a different FORMULA, and the formulas do not share a row
        // shape: `eyebrow` carries an eyebrow plus a subheadline, `authority` a subheadline,
        // `story`/`question`/`urgency` neither. Redrafting across that boundary would have
        // to re-derive the other fields from a different JSON schema, and a half-filled row
        // is worse than an honest drop. Node 7 has no such constraint — its formats are
        // angles over one row shape — and moves on all three axes.
        const axisLine = moves.map(({ dimension, value }) => dimension === "desire"
          ? `THE WANT THIS HEADLINE SPEAKS TO — the single thread it follows:\n${value}\n\nOther headlines in this set speak to different wants. Stay on this one.`
          : `AWARENESS STAGE — write this headline to a reader at this stage:\n${String(value).replace(/_/g, " ").toUpperCase()}\n\n${STAGE_HEADLINE_GUIDANCE[value as AwarenessStage] ?? ""}`,
        ).join("\n\n");
        const resp = await invokeLLM({
          messages: [
            { role: "system", content: `You are an expert direct response copywriter specialising in Meta ad headlines for coaches, consultants and speakers.\n\n${META_COMPLIANCE_NOTES}\n\n${NO_CREDENTIAL_FABRICATION_RULE}\n\n${REGISTER_STANDARD}` },
            { role: "user", content: `${cascadeContext}You are rewriting ONE ad headline in the ${row.formulaType} format.\n\n${deckFacts}\n\n${axisLine}\n\nBANNED PATTERNS — never use: ${BANNED_HEADLINE_PATTERNS.map((p) => `"${p}..."`).join(", ")}\n\nReturn ONLY the headline text as a single string, no quotes, no explanation.\n\n---\n\nIMPORTANT: an earlier version of this headline was too close to another headline in the same set — the two would be treated as one ad and compete against each other. This rewrite must say something genuinely different, not the same thing in other words.` },
          ],
        });
        const raw = resp.choices[0]?.message?.content;
        const text = typeof raw === "string" ? raw.trim().replace(/^["']|["']$/g, "") : "";
        if (!text) return null;
        const nextLabels = { ...item.labels };
        const next: any = { ...row, headline: text, selectionScore: String(scoreAdContent("headline", text)) };
        for (const { dimension, value } of moves) {
          next[dimension] = value;
          (nextLabels as any)[dimension] = value;
        }
        rowById.set(String(item.id), next);
        return { id: item.id, surface: item.surface, text, labels: nextLabels };
      },
    });

    gatedHeadlines = gateResult.kept.map((it) => rowById.get(String(it.id))).filter(Boolean) as typeof compliantHeadlines;
    console.log(formatLedger(gateResult.ledger));
    (globalThis as any).__ZAP_LAST_PDAF_LEDGER__ = gateResult.ledger;
  }

  // ⚠️ ORDERING DEVIATION, RECORDED RATHER THAN SILENTLY LIVED WITH.
  // The design is compliance-then-distinctness, and Node 7 does exactly that: its
  // `checkOutput` gate drops violators before the distinctness gate ever sees them. Node 6
  // has NO blocking compliance pass of its own — `checkCompliance` above only SCORES — so
  // the real blocking check is `gateBeforePersist` inside createHeadlines, which runs
  // AFTER this gate. Measured live 2026-08-07: the gate kept 12 and the persistence gate
  // then dropped 1 for `promised_result`, so 11 landed.
  //
  // Consequences, none of which threaten the distinctness guarantee (removing a row can
  // never CREATE a collapse, so Verdict A holds either way):
  //   1. effort is spent regenerating pieces compliance later discards;
  //   2. the deck can land under the band floor with nothing left to backfill from.
  // Fixing it means giving Node 6 a blocking compliance pass before the gate. Left as-is
  // for now, deliberately and visibly, rather than reordered without a decision.
  const persistedCount = await createHeadlines(gatedHeadlines);
  await incrementHeadlineCount(input.userId);

  // Pre-compute compliance rewrites — must land before runX returns so the
  // wizard panel sees headlines + rewrites atomically. Mirrors prior sync
  // and async behavior. No-op when ENABLE_COMPLIANCE_REWRITES flag is off.
  await precomputeHeadlinesComplianceRewrites(
    {
      id: input.userId,
      subscriptionTier: input.userSubscriptionTier ?? null,
      role: input.userRole ?? null,
    },
    headlineSetId,
    serviceCategory,
  );

  // Auto-select first headline into campaign kit (creates kit if needed)
  try {
    if (resolvedIcpId) {
      const db2 = await getDb();
      if (db2) {
        const { pickSelectedFromSet } = await import("./_core/pickSelected");
          const __pickedId = await pickSelectedFromSet(db2, "headlines", headlineSetId);
          const firstRow = __pickedId ? { id: __pickedId } : undefined;
        if (firstRow) {
          const { autoSelectBest } = await import("./routers/campaignKits");
          await autoSelectBest(input.userId, resolvedIcpId, "selectedHeadlineId", firstRow.id);
        }
      }
    }
  } catch (e) { console.warn("[auto-select] headlines failed:", e); }

  return {
    headlineSetId,
    // ⚠️ THE PERSISTED COUNT. This was `allHeadlines.length` — correct while every generated
    // headline was persisted, and a lie the moment the distinctness gate began dropping and
    // trimming. `gatedHeadlines.length` was the second wrong answer: the compliance backstop
    // inside createHeadlines drops rows after this gate (12 in, 11 landed, live 2026-08-07).
    // The wizard shows this number, so it must be what the database actually holds.
    count: persistedCount,
  };
}
