import { invokeLLM } from "./_core/llm";
import { BANNED_COPYWRITING_WORDS, REGISTER_STANDARD } from "./_core/copywritingRules";
import { nanoid } from "nanoid";

function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
}

// ─── Auto Mode Phase B1 — runHvcoGeneration ────────────────────────────────
// Gen-core for the hvco (lead-magnet titles) node. Callable directly by:
//   - hvco.generate (sync tRPC mutation) — wrapped with quota check, returns { hvcoSetId }
//   - hvco.generateAsync (async tRPC mutation) — wrapped with quota check + jobId enqueue + setImmediate
//   - autoMode.orchestrate (Phase B2 orchestrator) — direct call, no HTTP round-trip
//
// What's inside: Service/SOT/ICP/Campaign/Kit fetches → context building →
// campaignType-context dispatch (7 funnel types) → field fallbacks → 4×
// LLM calls (long titles, short titles, power mode, subheadlines) → DB
// insert via createHvcoTitles + incrementHvcoCount.
// What's outside: quota ENFORCEMENT (caller's job).
//
// Pre-B1 sync prompts diverged from async prompts (sync had WHY-THIS-
// SPECIFICALLY test, banned words, banned patterns; async used condensed
// variants). B1 unifies on the SYNC prompt set as the single source of
// truth — async path now produces equally-detailed output.
export async function runHvcoGeneration(input: {
  userId: number;
  serviceId: number;
  campaignId?: number;
  targetMarket: string;
  hvcoTopic: string;
  powerMode?: boolean;
  liteMode?: boolean;
  /**
   * TEST-HARNESS ONLY — both of the following exist so the traceability proof can
   * measure the title prompt without writing to production. Neither appears in any
   * tRPC router input schema, and neither is reachable from any product path:
   * `hvcoTitles.generate` and the orchestration callers construct this object
   * field-by-field and never spread caller-supplied input into it.
   *
   * `persist: false` suppresses the DB write and the quota increment. Verified by
   * counting hvcoTitles across the run, not by assuming (§15c).
   */
  persist?: boolean;
  /**
   * TEST-HARNESS ONLY. Substitutes the product name for THIS CALL so a clean
   * before/after read is possible without writing `services.name` on production.
   *
   * 🔴 This value reaches an LLM prompt. It is therefore reachable ONLY from
   * `server/scripts/`, never from a router input schema, and must never be wired
   * to anything a client can supply — that is the no-client-supplied-prompt-text
   * guardrail, and this parameter is the exact shape it forbids.
   */
  nameOverride?: string;
}): Promise<{ hvcoSetId: string; titles?: string[] }> {
  const { getDb, createHvcoTitles, incrementHvcoCount } = await import("./db");
  const { services, idealCustomerProfiles, sourceOfTruth, campaigns, campaignKits } = await import("../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");
  const { getCascadeContext } = await import("./_core/cascadeContext");

  const countMultiplier = input.liteMode ? 0.25 : input.powerMode ? 3 : 1;

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, input.serviceId))
    .limit(1);
  if (!service) throw new Error("Service not found");

  // Campaign fetch — Item 1.1b
  let campaignRecord: typeof campaigns.$inferSelect | undefined;
  if (input.campaignId) {
    [campaignRecord] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, input.userId)))
      .limit(1);
  }

  // ICP fetch — campaign-specific first, serviceId fallback
  let icp: typeof idealCustomerProfiles.$inferSelect | undefined;
  if (campaignRecord?.icpId) {
    [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, campaignRecord.icpId)).limit(1);
  }
  if (!icp) {
    [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
  }

  // Cascade context
  const cascadeContext = await getCascadeContext(input.userId, icp?.id, "hvco");

  const icpContext = icp ? [
    'IDEAL CUSTOMER PROFILE — use this to make every title specific and targeted:',
    icp.pains ? `Their daily pains: ${icp.pains}` : '',
    icp.goals ? `Their goals and aspirations: ${icp.goals}` : '',
    icp.implementationBarriers ? `What stops them from taking action: ${icp.implementationBarriers}` : '',
  ].filter(Boolean).join('\n').trim() : '';

  // campaignType — V2 SoT via campaignKits
  let campaignType: string = 'course_launch';
  if (icp?.id) {
    const [kit] = await db
      .select()
      .from(campaignKits)
      .where(and(eq(campaignKits.userId, input.userId), eq(campaignKits.icpId, icp.id)))
      .limit(1);
    if (kit?.campaignType) campaignType = kit.campaignType;
  }
  const campaignTypeContextMap: Record<string, string> = {
    webinar: `CAMPAIGN CONTEXT: Webinar
The titles will name a webinar / live training. Format examples: "[Specific Outcome] in 60 Minutes Live", "Live Webinar: How [Person] [Outcome]", "The [Topic] Webinar: [Specific Promise]". Reference the live-attendance-only nature.`,
    challenge: `CAMPAIGN CONTEXT: Challenge
The titles will name a multi-day challenge. Format examples: "[N]-Day [Topic] Challenge", "The [Outcome] Sprint", "[Time period] [Action] Challenge". Reference the duration and the daily-action structure.`,
    course_launch: `CAMPAIGN CONTEXT: Course Launch
The titles will name a course or programme. Format examples: "The [Topic] [System / Method / Programme]", "[Outcome] in [Period]", "How to [Outcome] in [Timeframe]". Reference the structured-programme nature.`,
    product_launch: `CAMPAIGN CONTEXT: Product Launch
The titles will name a product or tool. Format: short, distinctive product names. Avoid generic descriptors. Reference what the product does in the title.`,
    discovery_call: `CAMPAIGN CONTEXT: Discovery Call
The titles will name a free strategy call or audit. Format examples: "The [Topic] Audit", "[Outcome] Strategy Call", "Free [Niche] Diagnostic". Reference the 1:1 nature and the specific framework being applied during the call.`,
    lead_magnet: `CAMPAIGN CONTEXT: Lead Magnet
The titles will name a downloadable asset (PDF, guide, training, swipe file). This is HVCO's native use case — every existing title rule applies fully. Reference the asset format in the framing.`,
    in_person_event: `CAMPAIGN CONTEXT: In-Person Event
The titles will name a live in-person workshop, mastermind, or training day. Format examples: "[Topic] Intensive", "[Period] [Topic] Live Training", "The [Topic] Workshop". LOCATION LOCK: you are NOT told the city or venue — if a title would name WHERE it is, write the literal token [INSERT_EVENT_VENUE]; never invent a city, venue, or "[City]" placeholder.`,
  };
  const campaignTypeContext = campaignTypeContextMap[campaignType] || campaignTypeContextMap['course_launch'];

  // SOT
  const [sot] = await db
    .select()
    .from(sourceOfTruth)
    .where(eq(sourceOfTruth.userId, input.userId))
    .limit(1);
  const sotLines = sot ? [
    sot.coreOffer        ? `Core offer: ${sot.coreOffer}` : '',
    sot.targetAudience   ? `Target audience: ${sot.targetAudience}` : '',
    sot.mainPainPoint    ? `Main pain point: ${sot.mainPainPoint}` : '',
    sot.mainBenefits     ? `Main benefits: ${sot.mainBenefits}` : '',
    sot.uniqueValue      ? `Unique value: ${sot.uniqueValue}` : '',
    sot.idealCustomerAvatar ? `Ideal customer: ${sot.idealCustomerAvatar}` : '',
  ].filter(Boolean) : [];
  const sotContext = sotLines.length > 0
    ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n')
    : '';

  // Field fallbacks
  // nameOverride is applied HERE and nowhere else, so every prompt that
  // interpolates `service.name` sees the same value. Test-harness only.
  const resolvedProductName = input.nameOverride?.trim() || service.name || "";
  const resolvedTargetMarket = input.targetMarket?.trim() || service.targetCustomer || "";
  const resolvedHvcoTopic = input.hvcoTopic?.trim() || service.hvcoTopic || "";

  const hvcoSetId = nanoid();
  const allTitles: any[] = [];

  const sharedSystem = "You are a direct response copywriting expert who specialises in HVCO titles for coaches and consultants. You write titles that are niche-specific — every title contains at least one of: a specific number, a specific timeframe, a named enemy or obstacle, or an insider term from the niche. You never write generic titles that could apply to any coaching offer. Return ONLY valid JSON arrays.\n\n" + REGISTER_STANDARD;

  // ── 1/4: Long Titles (20 variations × multiplier) ──────────────────────────
  const longTitlesPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert copywriter creating compelling HVCO (High-Value Content Offer) titles.

Product: ${resolvedProductName}
Target Market: ${resolvedTargetMarket}
HVCO Topic: ${resolvedHvcoTopic}
${icpContext ? `\n${icpContext}\n` : ''}
${campaignTypeContext ? `${campaignTypeContext}\n\n` : ''}MANDATORY TITLE RULE — every title must contain at least ONE of these:
1. A specific number (5 steps, 7 mistakes, 3 ways — not "multiple" or "several")
2. A specific timeframe (in 30 days, this week, before Friday — not "quickly" or "fast")
3. A named enemy or obstacle (cold outreach, algorithm changes, discount pricing — the specific thing blocking them)
4. An insider term from the niche (a word or phrase that only someone in this exact niche would recognise and use)

WHY-THIS-SPECIFICALLY TEST: Before including any title, ask: why would this specific audience download THIS over any other lead magnet? If the title doesn't answer that question, it fails.

BANNED COPYWRITING WORDS — never use in any title: ${BANNED_COPYWRITING_WORDS.join(', ')}

BANNED TITLE PATTERNS — never generate:
- "The Ultimate Guide to [X]" — too generic, no specificity
- "Everything You Need to Know About [X]" — sounds like homework, not a gift
- "How to Improve Your [X]" — no specific outcome, no urgency
- "The [X] Blueprint/Playbook/Handbook" — unless followed by a specific outcome
- Any title that works equally well for a different coaching niche

GOOD examples (pass the test):
- "7 Secrets to Close 50% More Deals in 30 Days" — specific number + specific timeframe + specific outcome
- "The 4 Questions That Book 8 Discovery Calls a Week" — specific number + specific outcome + insider mechanism
- "Why Posting Daily Kills Your Reach (And What to Do Instead)" — named enemy + contrarian insight

Create 20 LONG, benefit-first titles following this pattern:
[Specific Number/Timeframe] [Action/Benefit] [to/for] [Concrete Outcome]

LENGTH: each of these is 7 to 15 WORDS — one line, the length of a book title or
a magazine cover line. "LONG" here means longer than the short tab, not a
sentence: the pattern above is four slots filled once, and it ends when the
outcome is named. The three GOOD examples above are the target length.

Requirements:
- Every title must pass the WHY-THIS-SPECIFICALLY test
- Include at least one mandatory element per title
- Make the outcome concrete and measurable — a number, timeframe, or named situation
- Avoid alliteration if it sacrifices clarity

Return ONLY a JSON array of ${20 * countMultiplier} title strings, nothing else.`;

  const longTitlesResponse = await invokeLLM({
    messages: [
      { role: "system", content: sharedSystem },
      { role: "user", content: cascadeContext + longTitlesPrompt },
    ],
  });
  const longTitlesContent = typeof longTitlesResponse.choices[0].message.content === 'string'
    ? longTitlesResponse.choices[0].message.content
    : JSON.stringify(longTitlesResponse.choices[0].message.content);
  const longTitles = JSON.parse(stripMarkdownJson(longTitlesContent));
  longTitles.forEach((title: string) => {
    allTitles.push({
      userId: input.userId,
      serviceId: input.serviceId,
      campaignId: input.campaignId,
      hvcoSetId,
      tabType: "long" as const,
      title,
      targetMarket: input.targetMarket,
      hvcoTopic: input.hvcoTopic,
    });
  });

  // ── 2/4: Short Titles (20 variations × multiplier) ─────────────────────────
  const shortTitlesPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert copywriter creating compelling HVCO titles.

Product: ${resolvedProductName}
Target Market: ${resolvedTargetMarket}
HVCO Topic: ${resolvedHvcoTopic}
${icpContext ? `\n${icpContext}\n` : ''}
${campaignTypeContext ? `${campaignTypeContext}\n\n` : ''}LENGTH RULE (READ TWICE):
- Every title MUST be 60 characters or fewer. This is a TITLE, not a description — it has to fit a landing-page cover panel, a card heading, and the phrase "Get Your Free ___ Now!".
- Plan each title as 4 to 9 WORDS before writing it. Word-count planning is more reliable than counting characters afterwards.
- After writing each title, count the characters. If 60 or fewer, keep it. If longer, cut the explanatory clause and keep the naming part.
- A title names the thing. Any sentence that explains what happens, who it is for, or what the reader will feel is a description, not a title.

MANDATORY TITLE RULE — every short title must contain at least ONE of:
1. A specific number or timeframe (5-step, 30-day, $10k — not vague amounts)
2. A named obstacle or enemy this audience specifically faces (the exact frustration, not a category of frustrations)
3. An insider word from this niche — a term only someone in this niche would use

BANNED COPYWRITING WORDS — never use in any title: ${BANNED_COPYWRITING_WORDS.join(', ')}

BANNED TITLE PATTERNS — never generate these:
- "[X] Formula/Blueprint/Playbook" without a specific outcome attached
- "[X] Unlocked/Mastered/Hacked" — too vague
- "The [X] Breakthrough" — what is the breakthrough, specifically?
- Generic success language: "freedom", "wealth", "success", "results" — without a specific definition

GOOD examples (short titles that pass):
- "30-Day Client Sprint" — timeframe + niche-specific action
- "5-Figure Funnel Fix" — specific outcome + named problem
- "Zero-Follower Launch System" — named enemy + specific mechanism
- "The Discovery Call Closer" — niche-specific insider term

Create 20 SHORT titles (3-7 words) that are concise, niche-specific, and contain at least one mandatory element.

Return ONLY a JSON array of ${20 * countMultiplier} title strings, nothing else.`;

  const shortTitlesResponse = await invokeLLM({
    messages: [
      { role: "system", content: sharedSystem },
      { role: "user", content: cascadeContext + shortTitlesPrompt },
    ],
  });
  const shortTitlesContent = typeof shortTitlesResponse.choices[0].message.content === 'string'
    ? shortTitlesResponse.choices[0].message.content
    : JSON.stringify(shortTitlesResponse.choices[0].message.content);
  const shortTitles = JSON.parse(stripMarkdownJson(shortTitlesContent));
  shortTitles.forEach((title: string) => {
    allTitles.push({
      userId: input.userId,
      serviceId: input.serviceId,
      campaignId: input.campaignId,
      hvcoSetId,
      tabType: "short" as const,
      title,
      targetMarket: input.targetMarket,
      hvcoTopic: input.hvcoTopic,
    });
  });

  // ── 3/4: Power Mode Titles (30 always — no multiplier) ─────────────────────
  const powerModeTitlesPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert copywriter creating compelling HVCO titles.

Product: ${resolvedProductName}
Target Market: ${resolvedTargetMarket}
HVCO Topic: ${resolvedHvcoTopic}
${icpContext ? `\n${icpContext}\n` : ''}
${campaignTypeContext ? `${campaignTypeContext}\n\n` : ''}MANDATORY RULE — every title must contain at least ONE of:
1. A specific number or timeframe
2. A named enemy, obstacle, or mistake this exact audience faces
3. An insider term from this niche that only someone in it would recognise
4. A counterintuitive or contrarian insight (why the obvious approach doesn't work)

WHY-THIS-SPECIFICALLY TEST: Would someone in this exact niche stop scrolling for THIS title, or would any coach's lead magnet do? If they'd stop for any lead magnet, the title fails.

BANNED COPYWRITING WORDS — never use in any title: ${BANNED_COPYWRITING_WORDS.join(', ')}

BANNED — never generate:
- "The Ultimate Guide to [X]" — too generic
- "Everything You Need to Know About [X]" — sounds like homework
- "How to Improve Your [X]" — no specificity or urgency
- "Escape The 9-5 Grind Forever" — far too generic and clichéd
- "Secret Millionaire Method Revealed" — forbidden sensationalist language

Create 30 POWER MODE titles — a mix of long (7-15 words) and short (3-7 words), all maximally specific to this niche, all passing the WHY-THIS-SPECIFICALLY test.

Return ONLY a JSON array of 30 title strings, nothing else.`;

  const powerModeTitlesResponse = await invokeLLM({
    messages: [
      { role: "system", content: sharedSystem },
      { role: "user", content: cascadeContext + powerModeTitlesPrompt },
    ],
  });
  const powerModeTitlesContent = typeof powerModeTitlesResponse.choices[0].message.content === 'string'
    ? powerModeTitlesResponse.choices[0].message.content
    : JSON.stringify(powerModeTitlesResponse.choices[0].message.content);
  const powerModeTitles = JSON.parse(stripMarkdownJson(powerModeTitlesContent));
  powerModeTitles.forEach((title: string) => {
    allTitles.push({
      userId: input.userId,
      serviceId: input.serviceId,
      campaignId: input.campaignId,
      hvcoSetId,
      tabType: "beast_mode" as const,
      title,
      targetMarket: input.targetMarket,
      hvcoTopic: input.hvcoTopic,
    });
  });

  // ── 4/4: Subheadlines (20 always — no multiplier) ──────────────────────────
  const subheadlinesPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert copywriter creating compelling subheadlines for HVCOs.

Product: ${resolvedProductName}
Target Market: ${resolvedTargetMarket}
HVCO Topic: ${resolvedHvcoTopic}
${icpContext ? `\n${icpContext}\n` : ''}
${campaignTypeContext ? `${campaignTypeContext}\n\n` : ''}Create 20 SUBHEADLINES. Each subheadline must do ONE of the following:
1. Name a specific obstacle or enemy this audience faces and promise to remove it
2. Give a specific number, timeframe, or result that makes the promise concrete
3. Explain WHY this lead magnet is different from the thing they've already tried
4. Use an insider term or niche-specific language that signals "this was written for you"

BANNED patterns:
- "No experience needed" — too generic
- "From zero to [vague word like freedom or success]" — no specific outcome
- "Discover the proven system" — vague claim without niche anchor
- Generic superlatives: "the best", "the ultimate", "the most powerful"

Each subheadline must reference a specific situation, obstacle, or desired outcome that is recognisable to someone in this exact niche — not someone in coaching generally.

Return ONLY a JSON array of 20 subheadline strings, nothing else.`;

  const subheadlinesResponse = await invokeLLM({
    messages: [
      { role: "system", content: sharedSystem },
      { role: "user", content: cascadeContext + subheadlinesPrompt },
    ],
  });
  const subheadlinesContent = typeof subheadlinesResponse.choices[0].message.content === 'string'
    ? subheadlinesResponse.choices[0].message.content
    : JSON.stringify(subheadlinesResponse.choices[0].message.content);
  const subheadlines = JSON.parse(stripMarkdownJson(subheadlinesContent));
  subheadlines.forEach((title: string) => {
    allTitles.push({
      userId: input.userId,
      serviceId: input.serviceId,
      campaignId: input.campaignId,
      hvcoSetId,
      tabType: "subheadlines" as const,
      title,
      targetMarket: input.targetMarket,
      hvcoTopic: input.hvcoTopic,
    });
  });

  // TEST-HARNESS DRY RUN. `persist` defaults to true, so every product path is
  // byte-unchanged; only a caller that explicitly passes `persist: false` — which
  // is reachable only from server/scripts — takes this branch. Returns the titles
  // in memory so the harness has something to measure, and skips the quota
  // increment and the kit auto-select along with the insert.
  if (input.persist === false) {
    console.log(`[hvco] DRY RUN — persist:false. ${allTitles.length} titles generated, ZERO rows written, quota untouched.`);
    return { hvcoSetId, titles: allTitles.map((t: any) => String(t?.title ?? "")).filter(Boolean) };
  }

  await createHvcoTitles(allTitles);
  await incrementHvcoCount(input.userId);

  // Auto-select first HVCO into campaign kit (creates kit if needed)
  try {
    if (icp?.id) {
      const { hvcoTitles } = await import("../drizzle/schema");
      const { pickSelectedFromSet } = await import("./_core/pickSelected");
        const __pickedId = await pickSelectedFromSet(db, "hvco", hvcoSetId);
        const firstRow = __pickedId ? { id: __pickedId } : undefined;
      if (firstRow) {
        const { autoSelectBest } = await import("./routers/campaignKits");
        await autoSelectBest(input.userId, icp.id, "selectedHvcoId", firstRow.id);
      }
    }
  } catch (e) { console.warn("[auto-select] hvco failed:", e); }

  return { hvcoSetId };
}
