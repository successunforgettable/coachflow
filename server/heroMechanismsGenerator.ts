import { invokeLLM } from "./_core/llm";
import { nanoid } from "nanoid";
import { extractMethod, hasSubstance, rawMaterialWeight, type DistilledMethod, type RawMaterial } from "./_core/methodExtractor";
import { mechanismStandardBlock, validateMechanismName } from "./_core/mechanismStandard";
import { neutraliseProfileCurrency } from "./_core/copywritingRules";

/**
 * The two extra tabs (`headline_ideas`, `beast_mode`) can NEVER be selected into the cascade —
 * `pickSelected.ts` and the trail deck both hard-filter to `tabType = "hero_mechanisms"`. Measured
 * on prod: 713 of 1,095 rows, 65% of the table and two thirds of this node's token spend, none of
 * it reachable. They are gated here rather than deleted only because `V2UniqueMethodResultPanel`
 * still renders their tabs; cutting the calls without that UI pass would ship two empty tabs.
 * Flip to false the moment the panel drops them — see the follow-up in the plan.
 */
const MECHANISM_EXTRA_TABS_ENABLED = true;

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
  const { eq, and, isNull } = await import("drizzle-orm");
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

  // ── ICP context — now carrying the fields the old-vehicle pivot is actually built from ────────
  // `fears` is the one that matters most here and was missing: the UMP's whole job is to answer
  // "why what you tried before failed you", and the fear of it failing again is what the reader
  // brings to the page. `hopesDreams` gives the pivot somewhere to land and `objections` says what
  // the mechanism has to survive. Currency figures are neutralised for the same reason as the
  // offer node: since ICP Phase A these fields legitimately carry the coach's own numbers, and a
  // figure copied into a mechanism description is a fabricated result.
  const icpContext = icp ? [
    'IDEAL CUSTOMER PROFILE — evidence about the person who reads this. It describes the BUYER;',
    'it is never a source of facts about the method itself.',
    '',
    icp.pains ? `Their daily pains: ${neutraliseProfileCurrency(icp.pains)}` : '',
    icp.fears ? `WHAT THEY FEAR — the risk they feel in trying again: ${neutraliseProfileCurrency(icp.fears)}` : '',
    icp.frustrations ? `Their frustrations: ${neutraliseProfileCurrency(icp.frustrations)}` : '',
    icp.hopesDreams ? `What they are reaching for: ${neutraliseProfileCurrency(icp.hopesDreams)}` : '',
    icp.objections ? `What they push back on: ${neutraliseProfileCurrency(icp.objections)}` : '',
    icp.implementationBarriers ? `What stops them from taking action: ${neutraliseProfileCurrency(icp.implementationBarriers)}` : '',
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
  // 🔴 THESE TWO USED TO FALL BACK TO THE SAME COLUMN. "What they've tried" and "why it failed"
  // arrived at the prompt as the IDENTICAL string, so the old-vehicle contrast — the single most
  // important input to a UMP — collapsed into one input repeated twice. `falseBeliefsVsRealReasons`
  // is the honest second source: it is literally "what they think is stopping them | what actually
  // is", which is the structural failure the UMP has to name.
  const resolvedWhyExistingNotWork =
    input.whyExistingNotWork?.trim() || service.falseBeliefsVsRealReasons || service.hiddenReasons || "";
  const resolvedCredibility = input.credibility?.trim() || service.pressFeatures || "";
  // Auto Mode passes "" for all eight form fields and only five had a fallback. Measured on prod,
  // targetMarket was empty on 71% of rows, desiredOutcome on 73%, socialProof on 84% — the prompt
  // literally read "Target Market:" with nothing after it. These three now resolve too.
  const resolvedTargetMarket = input.targetMarket?.trim() || service.targetCustomer || "";
  const resolvedDesiredOutcome = input.desiredOutcome?.trim() || service.mainBenefit || "";
  const resolvedSocialProof = input.socialProof?.trim() || service.socialProofStat || "";

  // ── THE METHOD — three tiers, one extractor ───────────────────────────────────────────────────
  // Tier 1 is a stored row from the guided conversation. Tier 2 mines the same extractor over
  // material the coach already gave. Tier 3 is the guarded fallback, and it is reached only when
  // the first two genuinely produce nothing — never as a silent default.
  const { coachMethods } = await import("../drizzle/schema");
  let method: DistilledMethod | null = null;
  let coachMethodId: number | null = null;

  const [storedMethod] = await db.select().from(coachMethods)
    .where(and(eq(coachMethods.userId, input.userId), eq(coachMethods.serviceId, input.serviceId)))
    .limit(1);
  const [generalMethod] = storedMethod ? [storedMethod] : await db.select().from(coachMethods)
    .where(and(eq(coachMethods.userId, input.userId), isNull(coachMethods.serviceId)))
    .limit(1);
  const row = storedMethod ?? generalMethod;
  if (row) {
    coachMethodId = row.id;
    method = {
      steps: (row.steps as any) ?? [],
      operationalTwist: (row.operationalTwist as any) ?? null,
      ump: row.ump, ums: row.ums, oldVehicle: row.oldVehicle, differentiator: row.differentiator,
      sourceTier: row.sourceTier as any,
      confidence: row.confidence as any,
      evidence: (row.evidence as any) ?? [],
    };
    if (!hasSubstance(method)) method = null;
  }

  if (!method) {
    // Tier 2 — Auto Mode and any coach who never ran the chat. Same extractor, different feed.
    const rawMaterial: RawMaterial[] = [
      { label: "service.description", text: service.description ?? "" },
      { label: "service.mainBenefit", text: service.mainBenefit ?? "" },
      { label: "service.applicationMethod", text: service.applicationMethod ?? "" },
      { label: "sourceOfTruth.uniqueValue", text: sot?.uniqueValue ?? "" },
      { label: "sourceOfTruth.coreOffer", text: sot?.coreOffer ?? "" },
      { label: "sourceOfTruth.mainBenefits", text: sot?.mainBenefits ?? "" },
    ];
    // `services.uniqueMechanismSuggestion` is DELIBERATELY ABSENT from that list. It is
    // LLM-invented at the service node and unconditionally overwritten there, so feeding it back
    // in would launder an invention into evidence — the exact loop this rebuild exists to break.
    if (rawMaterialWeight(rawMaterial) >= 120) {
      method = await extractMethod({
        rawMaterial,
        tier: "extracted",
        niche: service.targetCustomer || service.name || "",
      });
    }
  }

  const sourceTier: "coach_stated" | "extracted" | "guarded_fallback" =
    method?.sourceTier ?? "guarded_fallback";
  console.log(`[mechanism] serviceId=${input.serviceId} tier=${sourceTier} ` +
    `steps=${method?.steps.length ?? 0} confidence=${method?.confidence ?? "n/a"}`);

  const mechanismSetId = nanoid();
  const allMechanisms: any[] = [];
  let generationWarning: string | undefined;

  const sharedSystemPrompt = "You are a direct response copywriting expert who specialises in creating proprietary mechanism names and descriptions for coaches and consultants. You write mechanism names that are niche-specific — containing vocabulary from the target market's industry, not generic business language. Your mechanism descriptions make the reader feel the copy was written specifically for them. Return ONLY valid JSON arrays.";

  // ── 1/3: Hero Mechanisms (5 variations) ────────────────────────────────────
  // Rebuilt onto the B2C Mechanism Standard (`_core/mechanismStandard.ts`). The prompt that stood
  // here had real craft in its NAMING rules and nothing else: no UMP/UMS pair, no mechanism-type
  // taxonomy, no operational twist, no old-vehicle framing beyond a single clause. It also asked
  // for proof it had no way of knowing existed — the 2026-07-28 invention — which was fixed for
  // this call and left unfixed in the other two.
  //
  // The proof ask is retained EXACTLY as it was: conditional on real supplied proof, positive
  // framing, no failure shape shown. It is orthogonal to the standard and was already correct.
  const { buildCoachCorpus: __bcc, buildProofSupplied: __bps } = await import("./_core/groundingCorpus");
  const __corpus = __bcc({ service: service as any });
  const __supplied = __bps(service as any);
  const mechanismProofGuidance = __corpus.isLaunchStage
    ? `   - What the method is DESIGNED to produce, described as the outcome it aims at rather than a
     figure anyone has already hit — the mechanism stands on how it works, not on a track record
   - Why this approach exists: the reasoning and the insight behind it, in the first person`
    : `   - Who developed it and why, drawing ONLY on this supplied background: ${JSON.stringify(__supplied.coachBackground ?? "")}
   - A concrete outcome, using ONLY figures present in the supplied material above; where none is
     supplied, describe what the method is designed to produce instead`;

  const heroMechanismsPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are a direct response strategist building the mechanism for a solo practitioner who sells to individuals.

Product: ${service.name}
Target Market: ${resolvedTargetMarket}
Pressing Problem: ${resolvedPressingProblem}
Why Problem Exists: ${resolvedWhyProblem}
What They've Tried: ${resolvedWhatTried}
Why Existing Solutions Fail: ${resolvedWhyExistingNotWork}
Descriptor: ${input.descriptor || "[INSERT_DESCRIPTOR]"}
Application: ${input.application || "[INSERT_APPLICATION_METHOD]"}
Desired Outcome: ${resolvedDesiredOutcome}
Credibility: ${resolvedCredibility}
Social Proof: ${resolvedSocialProof}
${icpContext ? `\n${icpContext}\n` : ''}
${mechanismStandardBlock(method)}

Create 5 HERO MECHANISMS. Each is one NAME and one PARAGRAPH (150-200 words).

The paragraph carries, in this order:
   - The UMP: the structural reason the usual approach fails these specific people
   - The old vehicle named, and what it leaves out
   - The UMS: what this method does that answers exactly that
${mechanismProofGuidance}
   - What the reader would notice happening differently, written as what the method is designed to
     produce rather than as a result anyone has already had

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
  // ── NAME VALIDATION — deterministic, applied to every tier ────────────────────────────────────
  // A prompt instruction is not a guard. `validateMechanismName` rejects names that carry a result
  // rather than a process, borrow authority from an unrelated discipline, carry a number, run long,
  // or match the generic-template shape. One repair pass, then whatever survives is kept — the
  // degrade-never-kill floor applies here as everywhere else, and an unrepaired name is still an
  // editable card, whereas an empty node is a dead one.
  {
    const bad = heroMechanisms
      .map((m, i) => ({ i, m, v: validateMechanismName(m?.name ?? "") }))
      .filter((x) => !x.v.ok);
    if (bad.length > 0) {
      console.warn(`[mechanism] ${bad.length}/${heroMechanisms.length} names failed validation: ` +
        bad.map((b) => `"${b.m?.name}" (${b.v.reasons.join("; ")})`).join(" | "));
      try {
        const repair = await invokeLLM({
          messages: [
            { role: "system", content: sharedSystemPrompt },
            { role: "user", content:
`These mechanism names name a result, borrow vocabulary from an unrelated discipline, carry a
number, or run long. Rewrite each to describe the PROCESS instead, under six words, in the
vocabulary of: ${resolvedTargetMarket || service.name}.

${bad.map((b) => `- "${b.m?.name}" — ${b.v.reasons.join("; ")}`).join("\n")}

Return ONLY a JSON array of the rewritten names as strings, in the same order.` },
          ],
        });
        const rc = typeof repair.choices[0].message.content === 'string'
          ? repair.choices[0].message.content : JSON.stringify(repair.choices[0].message.content);
        const fixed = JSON.parse(stripMarkdownJson(rc));
        if (Array.isArray(fixed)) {
          bad.forEach((b, k) => {
            const candidate = typeof fixed[k] === "string" ? fixed[k].trim() : "";
            if (candidate && validateMechanismName(candidate).ok) heroMechanisms[b.i].name = candidate;
          });
        }
      } catch { /* keep the originals — an editable card beats an empty node */ }
    }
  }

  heroMechanisms.forEach((mechanism) => {
    allMechanisms.push({
      userId: input.userId,
      serviceId: input.serviceId,
      campaignId: input.campaignId,
      mechanismSetId,
      tabType: "hero_mechanisms" as const,
      sourceTier,
      coachMethodId,
      mechanismName: mechanism.name,
      mechanismDescription: mechanism.description,
      // 🔴 RESOLVED, not raw. These columns are documented as "input data used to generate (stored
      // for regeneration)" and stored `input.*` — which Auto Mode passes as "". Measured on prod:
      // targetMarket blank on 773/1095 rows, application on 1065/1095. Every one of those rows is
      // un-regenerable by construction. Storing what the prompt actually saw fixes it at source.
      targetMarket: resolvedTargetMarket,
      pressingProblem: resolvedPressingProblem,
      whyProblem: resolvedWhyProblem,
      whatTried: resolvedWhatTried,
      whyExistingNotWork: resolvedWhyExistingNotWork,
      descriptor: input.descriptor,
      application: input.application,
      desiredOutcome: resolvedDesiredOutcome,
      credibility: resolvedCredibility,
      socialProof: resolvedSocialProof,
    });
  });

  // ── 2/3 and 3/3 — GATED. Neither tabType can be selected into the cascade (pickSelected.ts and
  // the trail deck both hard-filter to hero_mechanisms), yet both carried the unconditional
  // "concrete result with a number" ask that the 2026-07-28 fix removed from call 1. Gating stops
  // the spend and the invention together; the flag exists so the panel's tabs can be dropped in a
  // separate UI pass without this file changing again.
  if (MECHANISM_EXTRA_TABS_ENABLED) {
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
- Name a concrete situation rather than a category of outcomes. Any number or timeframe comes
  only from the supplied material above; where none is supplied, name the situation instead
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
      sourceTier,
      coachMethodId,
      mechanismName: mechanism.name,
      mechanismDescription: mechanism.description,
      // 🔴 RESOLVED, not raw. These columns are documented as "input data used to generate (stored
      // for regeneration)" and stored `input.*` — which Auto Mode passes as "". Measured on prod:
      // targetMarket blank on 773/1095 rows, application on 1065/1095. Every one of those rows is
      // un-regenerable by construction. Storing what the prompt actually saw fixes it at source.
      targetMarket: resolvedTargetMarket,
      pressingProblem: resolvedPressingProblem,
      whyProblem: resolvedWhyProblem,
      whatTried: resolvedWhatTried,
      whyExistingNotWork: resolvedWhyExistingNotWork,
      descriptor: input.descriptor,
      application: input.application,
      desiredOutcome: resolvedDesiredOutcome,
      credibility: resolvedCredibility,
      socialProof: resolvedSocialProof,
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
- Descriptions are 200-250 words and go deeper on: the exact mechanism of action, the named enemy (the thing that has been failing them until now), the specific moment the reader would notice a difference, described as what the method is designed to produce
- Address the top objection preemptively within the description itself
- Where the supplied material carries real credibility, use it exactly as supplied; where it does not, let the mechanism stand on how it works

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
      sourceTier,
      coachMethodId,
      mechanismName: mechanism.name,
      mechanismDescription: mechanism.description,
      // 🔴 RESOLVED, not raw. These columns are documented as "input data used to generate (stored
      // for regeneration)" and stored `input.*` — which Auto Mode passes as "". Measured on prod:
      // targetMarket blank on 773/1095 rows, application on 1065/1095. Every one of those rows is
      // un-regenerable by construction. Storing what the prompt actually saw fixes it at source.
      targetMarket: resolvedTargetMarket,
      pressingProblem: resolvedPressingProblem,
      whyProblem: resolvedWhyProblem,
      whatTried: resolvedWhatTried,
      whyExistingNotWork: resolvedWhyExistingNotWork,
      descriptor: input.descriptor,
      application: input.application,
      desiredOutcome: resolvedDesiredOutcome,
      credibility: resolvedCredibility,
      socialProof: resolvedSocialProof,
    });
  });

  } // end MECHANISM_EXTRA_TABS_ENABLED

  await createHeroMechanisms(allMechanisms);
  await incrementHeroMechanismCount(input.userId);

  // Auto-select first mechanism into campaign kit (creates kit if needed)
  try {
    if (icp?.id) {
      const { heroMechanisms } = await import("../drizzle/schema");
      const { pickSelectedFromSet } = await import("./_core/pickSelected");
        const __pickedId = await pickSelectedFromSet(db, "heroMechanisms", mechanismSetId);
        const firstRow = __pickedId ? { id: __pickedId } : undefined;
      if (firstRow) {
        const { autoSelectBest } = await import("./routers/campaignKits");
        await autoSelectBest(input.userId, icp.id, "selectedMechanismId", firstRow.id);
      }
    }
  } catch (e) { console.warn("[auto-select] mechanism failed:", e); }

  return { mechanismSetId, generationWarning };
}
