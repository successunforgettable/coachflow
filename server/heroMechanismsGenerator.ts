import { invokeLLM } from "./_core/llm";
import { nanoid } from "nanoid";

// Helper to strip markdown code blocks from JSON responses
function stripMarkdownJson(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('```json') && trimmed.endsWith('```')) {
    return trimmed.slice(7, -3).trim();
  }
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
    return trimmed.slice(3, -3).trim();
  }
  return trimmed;
}

// ─── Auto Mode Phase B1 — runHeroMechanismGeneration ────────────────────────
// Gen-core for the heroMechanisms node. Callable directly by:
//   - heroMechanisms.generate (sync tRPC mutation) — wrapped with quota check, returns { mechanismSetId, generationWarning }
//   - heroMechanisms.generateAsync (async tRPC mutation) — wrapped with quota check + jobId enqueue + setImmediate
//   - autoMode.orchestrate (Phase B2 orchestrator) — direct call, no HTTP round-trip
//
// What's inside: Service/SOT/ICP/Campaign fetches → context building → field
// fallbacks → 3× LLM calls (mechanisms, headlineIdeas, powerMode) → DB
// insert via createHeroMechanisms + incrementHeroMechanismCount.
// What's outside: quota ENFORCEMENT (caller's job — wizard wrapper enforces;
// orchestrator skips by design).
//
// Three LLM calls run sequentially in source order, matching the pre-B1
// behavior. Each call receives cascadeContext prepended to its user message.
export async function runHeroMechanismGeneration(input: {
  userId: number;
  serviceId: number;
  campaignId?: number;
  targetMarket: string;
  pressingProblem: string;
  whyProblem: string;
  whatTried: string;
  whyExistingNotWork: string;
  descriptor?: string;
  application?: string;
  desiredOutcome: string;
  credibility: string;
  socialProof: string;
}): Promise<{ mechanismSetId: string; generationWarning?: string }> {
  const { getDb, createHeroMechanisms, incrementHeroMechanismCount } = await import("./db");
  const { services, idealCustomerProfiles, sourceOfTruth, campaigns } = await import("../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");
  const { getCascadeContext } = await import("./_core/cascadeContext");

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, input.serviceId))
    .limit(1);
  if (!service) throw new Error("Service not found");

  // Campaign fetch — Item 1.1b (icpId support)
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

  // Cascade context — read upstream campaignKits selections for this ICP
  const cascadeContext = await getCascadeContext(input.userId, icp?.id, "mechanism");

  const icpContext = icp ? [
    'IDEAL CUSTOMER PROFILE — use this to make every mechanism specific and targeted:',
    icp.pains ? `Their daily pains: ${icp.pains}` : '',
    icp.frustrations ? `Their frustrations: ${icp.frustrations}` : '',
    icp.implementationBarriers ? `What stops them from taking action: ${icp.implementationBarriers}` : '',
  ].filter(Boolean).join('\n').trim() : '';

  // SOT query — Item 1.4
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

  // Item 1.3 — Rule 4: server-side fallbacks for Hero Mechanism
  const resolvedPressingProblem = input.pressingProblem?.trim() || service.painPoints || "";
  const resolvedWhyProblem = input.whyProblem?.trim() || service.whyProblemExists || "";
  const resolvedWhatTried = input.whatTried?.trim() || service.failedSolutions || "";
  const resolvedWhyExistingNotWork = input.whyExistingNotWork?.trim() || service.failedSolutions || "";
  const resolvedCredibility = input.credibility?.trim() || service.pressFeatures || "";

  const mechanismSetId = nanoid();
  const allMechanisms: any[] = [];
  let generationWarning: string | undefined;

  const sharedSystemPrompt = "You are a direct response copywriting expert who specialises in creating proprietary mechanism names and descriptions for coaches and consultants. You write mechanism names that are niche-specific — containing vocabulary from the target market's industry, not generic business language. Your mechanism descriptions make the reader feel the copy was written specifically for them. Return ONLY valid JSON arrays.";

  // ── 1/3: Hero Mechanisms (5 variations) ────────────────────────────────────
  const heroMechanismsPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert direct response copywriter creating compelling Hero Mechanisms.

Product: ${service.name}
Target Market: ${input.targetMarket}
Pressing Problem: ${resolvedPressingProblem}
Why Problem Exists: ${resolvedWhyProblem}
What They've Tried: ${resolvedWhatTried}
Why Existing Solutions Fail: ${resolvedWhyExistingNotWork}
Descriptor: ${input.descriptor || "[INSERT_DESCRIPTOR]"}
Application: ${input.application || "[INSERT_APPLICATION_METHOD]"}
Desired Outcome: ${input.desiredOutcome}
Credibility: ${resolvedCredibility}
Social Proof: ${input.socialProof}
${icpContext ? `\n${icpContext}\n` : ''}
MECHANISM NAME RULES — apply to every name generated:
- Must contain a specific process word or metaphor FROM THIS NICHE (not from generic business language)
- Must sound proprietary and outcome-specific — not transferable to a different coaching niche
- BANNED names (never generate anything like these): The Success Blueprint, The Growth System, The Transformation Framework, The Mindset Method, The Achievement Protocol, The Breakthrough System, The Empowerment Method, The Results Framework
- GOOD name structure: [Niche-specific process word] + [Specific outcome word] + [Descriptor]. The first word must come from the vocabulary of this specific niche.
- Test: Could this mechanism name appear in a different coaching niche? If yes, it fails — rewrite it.

Create 5 HERO MECHANISMS. Each mechanism must have:
1. A proprietary-sounding NAME that:
   - Contains at least one word specific to the target market's niche or industry
   - Names the specific transformation (not "growth" or "success" — what specifically changes?)
   - Sounds like something that exists as a real system, not a marketing concept
2. A full PARAGRAPH description (150-200 words) that includes:
   - The specific problem it solves (name the problem, not a category of problems)
   - Who developed it and why (credibility tied to niche, not generic "award-winning expert")
   - A concrete outcome with a number or timeframe ($X/month, X clients in Y weeks, etc.)
   - What specifically makes it different from what they've already tried (name the failed approaches)
   - One before/after moment that makes the transformation real and believable

Return ONLY a JSON array of 5 objects with "name" and "description" fields, nothing else.`;

  const heroMechanismsResponse = await invokeLLM({
    messages: [
      { role: "system", content: sharedSystemPrompt },
      { role: "user", content: cascadeContext + heroMechanismsPrompt },
    ],
  });
  const heroMechanismsContent = typeof heroMechanismsResponse.choices[0].message.content === 'string'
    ? heroMechanismsResponse.choices[0].message.content
    : JSON.stringify(heroMechanismsResponse.choices[0].message.content);
  let heroMechanisms: { name: string; description: string }[] = [];
  try {
    const parsed = JSON.parse(stripMarkdownJson(heroMechanismsContent));
    heroMechanisms = Array.isArray(parsed) ? parsed : [];
    if (!Array.isArray(parsed)) generationWarning = "Mechanism generation returned unexpected format — please try again.";
  } catch {
    heroMechanisms = [];
    generationWarning = "Mechanism generation returned unexpected format — please try again.";
  }
  heroMechanisms.forEach((mechanism) => {
    allMechanisms.push({
      userId: input.userId,
      serviceId: input.serviceId,
      campaignId: input.campaignId,
      mechanismSetId,
      tabType: "hero_mechanisms" as const,
      mechanismName: mechanism.name,
      mechanismDescription: mechanism.description,
      targetMarket: input.targetMarket,
      pressingProblem: input.pressingProblem,
      whyProblem: input.whyProblem,
      whatTried: input.whatTried,
      whyExistingNotWork: input.whyExistingNotWork,
      descriptor: input.descriptor,
      application: input.application,
      desiredOutcome: input.desiredOutcome,
      credibility: input.credibility,
      socialProof: input.socialProof,
    });
  });

  // ── 2/3: Headline Ideas (5 variations) ─────────────────────────────────────
  const headlineIdeasPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert direct response copywriter creating compelling headlines for Hero Mechanisms.

Product: ${service.name}
Target Market: ${input.targetMarket}
Pressing Problem: ${resolvedPressingProblem}
Desired Outcome: ${input.desiredOutcome}
${icpContext ? `\n${icpContext}\n` : ''}
THREE-QUESTION TEST — every headline must pass all three:
1. Does it name a specific type of person in a specific situation? (not "entrepreneurs" but "coaches who've been running webinars to empty rooms")
2. Does it promise a specific outcome — not a vague benefit? (not "more clients" but "8 discovery calls booked in 14 days")
3. Could this headline ONLY be written for this service? (if it works for any coach, rewrite it)

BANNED HEADLINE OPENERS AND PHRASES — never use:
- "Are you ready to...", "Do you want to...", "The secret to...", "How to finally...", "Everything you need to..."
- "Transform your...", "Unlock your...", "Discover how to...", "The ultimate guide to..."
- Generic power words: skyrocket, explode, crush it, dominate, master

Create 5 HEADLINE IDEAS for the hero mechanism. Each headline must:
- Contain at least one word directly from the ICP's pain language or niche vocabulary
- Name a concrete outcome (number, timeframe, or named situation) not a category of outcomes
- Be written as a real headline, not a template with [brackets]

Each headline should have:
1. A creative NAME (the headline itself — a real, complete headline)
2. A supporting DESCRIPTION (50-100 words explaining specifically: which ICP pain word it uses, which ad angle it applies, and what makes this niche-specific rather than generic)

Return ONLY a JSON array of 5 objects with "name" and "description" fields, nothing else.`;

  const headlineIdeasResponse = await invokeLLM({
    messages: [
      { role: "system", content: sharedSystemPrompt },
      { role: "user", content: cascadeContext + headlineIdeasPrompt },
    ],
  });
  const headlineIdeasContent = typeof headlineIdeasResponse.choices[0].message.content === 'string'
    ? headlineIdeasResponse.choices[0].message.content
    : JSON.stringify(headlineIdeasResponse.choices[0].message.content);
  let headlineIdeas: { name: string; description: string }[] = [];
  try {
    const parsed = JSON.parse(stripMarkdownJson(headlineIdeasContent));
    headlineIdeas = Array.isArray(parsed) ? parsed : [];
    if (!Array.isArray(parsed)) generationWarning = "Mechanism generation returned unexpected format — please try again.";
  } catch {
    headlineIdeas = [];
    generationWarning = "Mechanism generation returned unexpected format — please try again.";
  }
  headlineIdeas.forEach((mechanism) => {
    allMechanisms.push({
      userId: input.userId,
      serviceId: input.serviceId,
      campaignId: input.campaignId,
      mechanismSetId,
      tabType: "headline_ideas" as const,
      mechanismName: mechanism.name,
      mechanismDescription: mechanism.description,
      targetMarket: input.targetMarket,
      pressingProblem: input.pressingProblem,
      whyProblem: input.whyProblem,
      whatTried: input.whatTried,
      whyExistingNotWork: input.whyExistingNotWork,
      descriptor: input.descriptor,
      application: input.application,
      desiredOutcome: input.desiredOutcome,
      credibility: input.credibility,
      socialProof: input.socialProof,
    });
  });

  // ── 3/3: Power Mode (5 variations) ─────────────────────────────────────────
  const powerModePrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert direct response copywriter creating BEAST MODE Hero Mechanisms - the most powerful, compelling versions.

Product: ${service.name}
Target Market: ${input.targetMarket}
Pressing Problem: ${resolvedPressingProblem}
Why Problem Exists: ${resolvedWhyProblem}
What They've Tried: ${resolvedWhatTried}
Why Existing Solutions Fail: ${resolvedWhyExistingNotWork}
Descriptor: ${input.descriptor || "[INSERT_DESCRIPTOR]"}
Desired Outcome: ${input.desiredOutcome}
Credibility: ${resolvedCredibility}
Social Proof: ${input.socialProof}
${icpContext ? `\n${icpContext}\n` : ''}
MECHANISM NAME RULES — apply strictly to every name:
- Must contain a specific process word or metaphor FROM THIS NICHE — not from generic business language
- Must be so niche-specific that someone from a different coaching niche would not recognise it as applying to them
- BANNED: The Success Blueprint, The Growth System, The Transformation Framework, The Mindset Method, The Achievement Protocol, The Breakthrough System — or anything that sounds like these
- GOOD: names where the first or second word comes from the vocabulary this specific target market uses every day
- Test: If you replaced the service name with a different coaching service, would the mechanism name still make sense? If yes, it fails.

Create 5 POWER MODE mechanisms — the most compelling, most niche-specific, most conversion-ready versions:
- Names are even more proprietary and niche-rooted than the standard set
- Descriptions are 200-250 words and go deeper on: the exact mechanism of action, the named enemy (the thing that has been failing them until now), the specific before/after moment, and the concrete result with a number
- Address the top objection preemptively within the description itself
- Build credibility through niche-specific authority (not generic "award-winning expert" — name the specific credibility relevant to this target market)

Each mechanism must have:
1. A NAME that could only apply to this specific niche and target market
2. A comprehensive DESCRIPTION (200-250 words) that makes someone in this target market feel: "This was built for someone exactly like me"

Return ONLY a JSON array of 5 objects with "name" and "description" fields, nothing else.`;

  const powerModeResponse = await invokeLLM({
    messages: [
      { role: "system", content: sharedSystemPrompt },
      { role: "user", content: cascadeContext + powerModePrompt },
    ],
  });
  const powerModeContent = typeof powerModeResponse.choices[0].message.content === 'string'
    ? powerModeResponse.choices[0].message.content
    : JSON.stringify(powerModeResponse.choices[0].message.content);
  let powerMode: { name: string; description: string }[] = [];
  try {
    const parsed = JSON.parse(stripMarkdownJson(powerModeContent));
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
      powerMode = parsed;
    } else {
      console.error('[heroMechanisms] power mode: unexpected JSON shape, falling back to empty array. Content:', powerModeContent.slice(0, 300));
      generationWarning = "Mechanism generation returned unexpected format — please try again.";
    }
  } catch {
    console.error('[heroMechanisms] power mode: JSON.parse failed, falling back to empty array. Content:', powerModeContent.slice(0, 300));
    generationWarning = "Mechanism generation returned unexpected format — please try again.";
  }
  powerMode.forEach((mechanism) => {
    allMechanisms.push({
      userId: input.userId,
      serviceId: input.serviceId,
      campaignId: input.campaignId,
      mechanismSetId,
      tabType: "beast_mode" as const,
      mechanismName: mechanism.name,
      mechanismDescription: mechanism.description,
      targetMarket: input.targetMarket,
      pressingProblem: input.pressingProblem,
      whyProblem: input.whyProblem,
      whatTried: input.whatTried,
      whyExistingNotWork: input.whyExistingNotWork,
      descriptor: input.descriptor,
      application: input.application,
      desiredOutcome: input.desiredOutcome,
      credibility: input.credibility,
      socialProof: input.socialProof,
    });
  });

  await createHeroMechanisms(allMechanisms);
  await incrementHeroMechanismCount(input.userId);

  // Auto-select first mechanism into campaign kit (creates kit if needed)
  try {
    if (icp?.id) {
      const { heroMechanisms } = await import("../drizzle/schema");
      const { asc } = await import("drizzle-orm");
      const [firstRow] = await db.select({ id: heroMechanisms.id }).from(heroMechanisms)
        .where(eq(heroMechanisms.mechanismSetId, mechanismSetId)).orderBy(asc(heroMechanisms.id)).limit(1);
      if (firstRow) {
        const { autoSelectBest } = await import("./routers/campaignKits");
        await autoSelectBest(input.userId, icp.id, "selectedMechanismId", firstRow.id);
      }
    }
  } catch (e) { console.warn("[auto-select] mechanism failed:", e); }

  return { mechanismSetId, generationWarning };
}
