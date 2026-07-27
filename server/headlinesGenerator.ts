import { nanoid } from "nanoid";
import { invokeLLM } from "./_core/llm";
import { BANNED_HEADLINE_PATTERNS, META_COMPLIANCE_NOTES, NO_CREDENTIAL_FABRICATION_RULE, REGISTER_STANDARD, scoreAdContent } from "./_core/copywritingRules";
import type { headlines as headlinesTable } from "../drizzle/schema";

function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*|^```\s*|\s*```$/gm, '').trim();
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

  if (input.serviceId) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const serviceData = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
    if (serviceData.length > 0) {
      const service = serviceData[0];
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

  // 5 formulas in parallel via tool-use; per-formula filter respects
  // input.headlineStyle (undefined = all 5; specific enum = 1).
  await Promise.all(
    Object.entries(FORMULA_PROMPTS)
      .filter(([k]) => !input.headlineStyle || k === input.headlineStyle)
      .map(async ([formulaType, promptTemplate]) => {
        const modifiedTemplate = promptTemplate.replace(/Generate 5/g, `Generate ${5 * countMultiplier}`);
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
              { role: "user", content: cascadeContext + promptWithSot },
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

          if (formulaType === "story" || formulaType === "question" || formulaType === "urgency") {
            parsed.headlines.forEach((headline: string) => {
              allHeadlines.push({
                userId: input.userId,
                serviceId: input.serviceId,
                campaignId: input.campaignId,
                headlineSetId,
                formulaType: formulaType as any,
                headline,
                subheadline: null,
                eyebrow: null,
                targetMarket: input.targetMarket,
                pressingProblem: input.pressingProblem,
                desiredOutcome: input.desiredOutcome,
                uniqueMechanism: input.uniqueMechanism,
              });
            });
          } else if (formulaType === "eyebrow") {
            parsed.headlines.forEach((item: { eyebrow: string; main: string; sub: string }) => {
              allHeadlines.push({
                userId: input.userId,
                serviceId: input.serviceId,
                campaignId: input.campaignId,
                headlineSetId,
                formulaType: "eyebrow",
                headline: item.main,
                subheadline: item.sub,
                eyebrow: item.eyebrow,
                targetMarket: input.targetMarket,
                pressingProblem: input.pressingProblem,
                desiredOutcome: input.desiredOutcome,
                uniqueMechanism: input.uniqueMechanism,
              });
            });
          } else if (formulaType === "authority") {
            parsed.headlines.forEach((item: { main: string; sub: string }) => {
              allHeadlines.push({
                userId: input.userId,
                serviceId: input.serviceId,
                campaignId: input.campaignId,
                headlineSetId,
                formulaType: "authority",
                headline: item.main,
                subheadline: item.sub,
                eyebrow: null,
                targetMarket: input.targetMarket,
                pressingProblem: input.pressingProblem,
                desiredOutcome: input.desiredOutcome,
                uniqueMechanism: input.uniqueMechanism,
              });
            });
          }
        } catch (error) {
          console.error(`Failed to generate ${formulaType} headlines:`, error);
          throw new Error(`Failed to generate ${formulaType} headlines`);
        }
      })
  );

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

  await createHeadlines(headlinesWithCompliance);
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
        const { asc } = await import("drizzle-orm");
        const [firstRow] = await db2.select({ id: headlines.id }).from(headlines)
          .where(eq(headlines.headlineSetId, headlineSetId)).orderBy(asc(headlines.id)).limit(1);
        if (firstRow) {
          const { autoSelectBest } = await import("./routers/campaignKits");
          await autoSelectBest(input.userId, resolvedIcpId, "selectedHeadlineId", firstRow.id);
        }
      }
    }
  } catch (e) { console.warn("[auto-select] headlines failed:", e); }

  return {
    headlineSetId,
    count: allHeadlines.length,
  };
}
