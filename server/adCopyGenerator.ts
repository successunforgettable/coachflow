import { invokeLLM } from "./_core/llm";
import type { GateItem } from "./_core/pdafGate";
import { BANNED_HEADLINE_PATTERNS, META_COMPLIANCE_NOTES, NO_CREDENTIAL_FABRICATION_RULE, REGISTER_STANDARD, registerPersonGuidance, physicalSubjectGuidance, scoreAdContent } from "./_core/copywritingRules";
import { nanoid } from "nanoid";
import { ensureConceptsForIcp } from "./conceptGenerator";
import { AD_VARIATIONS } from "./_core/adVariations";

function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*|^```\s*|\s*```$/gm, '').trim();
}

// ─── The image-hook surface: ceiling, clamp, and redraft voice ───────────────
// These live at module scope and are exported because the hook is written in TWO
// places — first generation, and the distinctness gate's regeneration callback —
// and the two MUST agree. They did not: the ceiling was enforced only on first
// generation, so every hook the gate recovered came back uncapped. The live proof
// on 2026-08-08 persisted hooks of 74/92/114/127 characters, all four of them
// gate-recovered, and the compositor ellipsised them over the picture.
//
// A hook that runs long is not a cosmetic problem. It is set large over a
// photograph, so the extra lines push the text block into the part of the frame
// the renderer was told to keep clear.

export const HOOK_MAX_CHARS = 60;

/**
 * How many image hooks a deck can use — DERIVED from the tabloid deck, never hardcoded.
 *
 * A hook exists to sit on a picture, so the useful number of hooks is the number of images
 * the deck renders. Deriving it means the 4 -> 8 growth updates this automatically; the
 * `adVariations` docblock records two call sites that hardcoded `i < 5` and would have
 * crashed the coach's Generate button, which is exactly the drift this avoids.
 */
export const IMAGE_HOOK_BAND_MAX = AD_VARIATIONS.length;

/**
 * Normalise and clamp one image-hook line. Cuts at a word boundary rather than
 * mid-word. This is THE single implementation — both the first-generation map and
 * the gate's redraft path call it, so the ceiling cannot drift between them again.
 */
export function clampHookText(raw: unknown): string {
  // ⚠️ TRIM BEFORE STRIPPING QUOTES. The original inline version stripped quotes first,
  // anchored to ^ and $ — so a reply arriving as `  "…"  ` still had whitespace at both
  // ends and the strip matched nothing, leaving the quotation marks the prompt bans on
  // the picture. Corrected here; both call sites intended the strip to work.
  const s = String(raw ?? "").replace(/\s+/g, " ").trim().replace(/^["']|["']$/g, "").trim();
  return s.length <= HOOK_MAX_CHARS ? s : s.slice(0, HOOK_MAX_CHARS).replace(/\s+\S*$/, "");
}

export type RedraftSurface = "body" | "headline" | "image_hook";

/**
 * Which redraft voice a row takes when the distinctness gate regenerates it.
 *
 * ⚠️ THE DEFECT THIS EXISTS TO PREVENT: the callback used to branch on
 * `isBody`, which silently swept `image_hook` into the HEADLINE branch — so a
 * recovered hook was prompted "You are rewriting ONE ad HEADLINE", losing both
 * its 60-character ceiling and the build-spec §3 division of labour. It came
 * back as a flat headline sitting on the picture, which is the exact
 * repeat-across-surfaces collapse the hook was introduced to remove.
 */
export function redraftSurfaceFor(contentType: string | null | undefined): RedraftSurface {
  return contentType === "body" ? "body" : contentType === "image_hook" ? "image_hook" : "headline";
}

/**
 * The redraft instruction for an image hook — the same division of labour the
 * first-generation prompt states (picture = the feeling, headline = the proof or
 * mechanism, body = the context), in the same voice, with the ceiling restated.
 */
export function buildHookRedraftInstruction(args: {
  cascadeContext?: string;
  facts: string;
  axisLine: string;
  register: string;
}): string {
  return `${args.cascadeContext ?? ""}You are rewriting ONE IMAGE HOOK — the short line of text that sits ON the picture itself.

${args.facts}

${args.axisLine}

WHAT AN IMAGE HOOK IS. An ad has three text surfaces and they are read as ONE message: the words on the picture, the headline, and the body. Each does a different job.
- The PICTURE's line is the emotional hook — the feeling, the moment of recognition.
- The HEADLINE carries the proof or the mechanism.
- The BODY carries the context and the specifics.
Your job is the first one only. This is NOT a headline.

HARD RULES:
- ${HOOK_MAX_CHARS} characters maximum. Shorter is better. It is set large on a photograph.
- Name the feeling underneath, where the headline and body name the mechanism or the numbers.
- Plain words. No colons, no hashtags, no quotation marks, no ALL CAPS, no emoji.
- No price, no percentage, no statistic, no client result, no credential.
- It must read as a complete thought on its own, because it is seen before either of the other two surfaces.

${args.register}

Return ONLY the hook line as a single string, no quotes, no explanation.

---

IMPORTANT: an earlier version of this hook was too close to another piece in the same set — the two would be treated as one ad and compete against each other. This rewrite must say something genuinely different, not the same thing in other words.`;
}

// ─── Concurrency-limited map (moved from router) ────────────────────────────
// Processes `items` in sequential chunks of `limit`, each chunk parallel.
// Caps peak parallel work — critical for compliance precompute, where a
// 30-row flagged ad set would otherwise fire 30 × up-to-3-retries = 90
// in-flight Sonnet requests at once.
async function processInChunks<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map((item, offset) => fn(item, i + offset)));
    results.push(...chunkResults);
  }
  return results;
}

// ─── META compliance rules (moved from router) ──────────────────────────────
const META_COMPLIANCE_RULES = `
CRITICAL COMPLIANCE RULES — Every piece of ad copy you generate MUST follow these rules without exception. These are Meta (Facebook/Instagram) advertising policy requirements.

NEVER include:
1. Income or earnings claims — Do NOT write: "make $10k/month", "earn passive income", "quit your 9-5", "replace your salary", "make money from home", "6-figure income", "financial freedom in 30 days"
2. Guaranteed results — Do NOT write: "guaranteed", "100% results", "works every time", "proven to work for everyone"
3. Specific transformation claims — Do NOT write: "lose 20kg in 30 days", "get abs in 6 weeks", "cure your anxiety", "fix your relationship overnight"
4. Superlatives without qualification — Do NOT write: "#1 coach", "the best program", "world's greatest", "unbeatable results" (unless qualified with "in [specific verified category]")
5. Sensationalist language — Do NOT write: "shocking secret", "they don't want you to know", "banned method", "underground technique", "what doctors won't tell you"
6. False urgency or scarcity — Do NOT write: "only 3 spots left" (unless literally true), "offer expires tonight" (unless literally true), "last chance forever"
7. Before/after transformation language — Do NOT write: "before I was broke, now I'm rich", "I used to be fat, now I'm thin" style claims
8. Personal attribute targeting language — Do NOT write copy that singles out age, religion, race, sexual orientation, disability, health conditions, or financial hardship as audience identifiers
9. Misleading claims — Do NOT imply celebrity endorsement, Meta endorsement, government approval, or scientific proof without verified evidence
10. Prohibited CTAs — Do NOT use: "Click here to get rich", "Buy now before it's too late", "You'd be stupid not to"

ALWAYS include:
1. Results qualifier when making any outcome claim: use "results may vary", "typical results", "individual results will differ"
2. Honest benefit language: focus on the process and experience, not guaranteed outcomes
3. Approved CTA formats: "Learn More", "Sign Up", "Book a Call", "Get Started", "Download Free Guide", "Watch Free Training"
4. Professional tone: authoritative but not sensationalist

REFRAME THESE COMMON VIOLATIONS:
- "Make $10k/month" → "Build a sustainable coaching income"
- "Guaranteed results" → "A proven framework used by [X] coaches"
- "Lose 20kg guaranteed" → "A structured approach to sustainable weight loss"
- "Secret method" → "A counterintuitive approach that most coaches overlook"
- "Quit your 9-5" → "Create a coaching business that fits your life"
- "Only 3 spots left" → "Applications now open" (unless truly limited)

Your output must be ad copy that could be submitted directly to Meta without triggering a policy violation review.

${META_COMPLIANCE_NOTES}
`;

// ─── Pre-compute compliance rewrites helper (moved from router) ─────────────
// W5 Phase 2 — pre-compute compliance rewrites for a just-inserted adCopy
// set. Picks up every adCopy row in the set whose complianceScore < 70
// (regardless of contentType — headline/body/link all go through), asks
// Sonnet for a compliant rewrite via rewriteForCompliance, inserts rows
// into complianceRewrites with sourceTable='adCopy'. Runs rewrites in
// concurrency-limited chunks of 5; per-row failures are caught and logged.
//
// Feature flag: ENABLE_COMPLIANCE_REWRITES. Off by default — when unset
// or false, this is a no-op.
export async function precomputeAdCopyComplianceRewrites(
  user: { id: number; subscriptionTier: string | null; role: string | null },
  adSetId: string,
  serviceNiche: string | null,
): Promise<void> {
  if (process.env.ENABLE_COMPLIANCE_REWRITES !== "true") return;

  try {
    const { getDb } = await import("./db");
    const { checkCompliance } = await import("./lib/complianceChecker");
    const db = await getDb();
    if (!db) return;
    const { adCopy: adCopyTable, complianceRewrites } = await import("../drizzle/schema");
    const { eq: eqBg, and: andBg, lt: ltBg } = await import("drizzle-orm");
    const { rewriteForCompliance } = await import("./_core/complianceRewrite");
    const { enforceFreeTierRewriteCap } = await import("./routers/complianceRewrites");

    const flagged = await db
      .select()
      .from(adCopyTable)
      .where(andBg(
        eqBg(adCopyTable.userId, user.id),
        eqBg(adCopyTable.adSetId, adSetId),
        ltBg(adCopyTable.complianceScore, 70),
      ));
    console.log(`[W5.precompute] adCopy set=${adSetId} flagged=${flagged.length}`);
    if (flagged.length === 0) return;

    const serviceId = flagged.find(r => r.serviceId != null)?.serviceId ?? null;
    if (serviceId != null) {
      try { await enforceFreeTierRewriteCap(db, user, serviceId); }
      catch {
        console.log(`[W5.precompute] adCopy free-tier cap hit for user ${user.id}, skipping set ${adSetId}`);
        return;
      }
    }

    const rowsToInsert: Array<typeof complianceRewrites.$inferInsert> = [];
    await processInChunks(flagged, 5, async (row) => {
      if (row.serviceId == null) return;
      // ⚠️ IMAGE HOOKS ARE NOT REWRITTEN, and this is a decision rather than an omission.
      // The `complianceRewrites` table types contentType on its own narrower enum, which
      // does not carry `image_hook` — widening it would be a second migration for a feature
      // that should not exist anyway. A hook is a SHORT field, and Node 7 already declines
      // to retry headlines for exactly that reason: measured on prod, 100% of gate drops
      // were bodies, and a line this short has too little room for a redraft to change a
      // verdict. A hook that fails compliance is dropped by the output gate like any other
      // variant, and the deck composites from the remaining hooks.
      if (row.contentType === "image_hook") return;
      try {
        const storedReasons = Array.isArray(row.violationReasons)
          ? (row.violationReasons as unknown[]).filter((v): v is string => typeof v === "string")
          : [];
        let issues: Array<{ severity: "critical" | "warning" | "info"; phrase: string; reason: string; suggestion: string }>;
        if (storedReasons.length > 0) {
          issues = storedReasons.map(reason => ({
            severity: "warning" as const,
            phrase: "(stored)",
            reason,
            suggestion: "Rephrase to comply with Meta advertising policies",
          }));
        } else {
          const live = await checkCompliance(row.content);
          issues = live.issues;
        }
        if (issues.length === 0) {
          console.log(`[W5.precompute] adCopy row=${row.id} contentType=${row.contentType} no issues — skipping`);
          return;
        }

        const r = await rewriteForCompliance(row.content, issues, row.contentType, {
          niche: serviceNiche,
          mechanism: row.uniqueMechanism,
          mainBenefit: row.desiredOutcome,
        });
        rowsToInsert.push({
          userId: user.id,
          serviceId: row.serviceId,
          contentType: row.contentType,
          sourceTable: "adCopy",
          sourceId: row.id,
          originalText: row.content,
          rewrittenText: r.rewrite,
          violationReasons: issues.map(i => i.reason),
          complianceScore: r.score,
          modelUsed: r.modelUsed,
        });
      } catch (err) {
        console.warn(`[W5.precompute] adCopy row=${row.id} contentType=${row.contentType} failed:`, err instanceof Error ? err.message : err);
      }
    });

    if (rowsToInsert.length > 0) {
      await db.insert(complianceRewrites).values(rowsToInsert);
      console.log(`[W5.precompute] adCopy inserted ${rowsToInsert.length} rewrite(s) for set ${adSetId}`);
    }
  } catch (err) {
    console.error(`[W5.precompute] adCopy unexpected failure for set ${adSetId}:`, err instanceof Error ? err.message : err);
  }
}

// ─── Auto Mode Phase B1 — runAdCopyGeneration ───────────────────────────────
// Gen-core for the adCopy node. Callable directly by:
//   - adCopy.generate (sync tRPC mutation) — wrapped with quota check
//   - adCopy.generateAsync (async tRPC mutation) — wrapped with quota check + jobId enqueue + setImmediate + network-error retry
//   - autoMode.orchestrate (Phase B2 orchestrator) — direct call, no HTTP round-trip
//
// What's inside: Service/SOT/ICP/Campaign/Kit fetches → context building →
// 3 LLM call groups (1 headlines call + N parallel body-angle calls + 1
// links call) → per-row checkCompliance pass → DB insert into adCopy →
// precomputeAdCopyComplianceRewrites await (mandatory inside gen path so
// wizard panel sees rewrites atomically with the ad copy).
// What's outside: quota ENFORCEMENT (caller's job).
//
// Pre-B1 sync user-prompts diverged from async (sync had SCROLL-STOPPER
// RULE + THREE-QUESTION TEST + BANNED PATTERNS + 4-angle guidance; async
// was condensed). B1 unifies on the SYNC prompt set as single source of
// truth — same Option (b) decision as heroMechanisms/hvco/landingPages.
//
// Pre-B1 sync path didn't run precompute (only async did); B1 unifies on
// async behavior (precompute always runs). Improvement, not regression.
export async function runAdCopyGeneration(input: {
  userId: number;
  serviceId: number;
  campaignId?: number;
  adType: "lead_gen" | "ecommerce";
  adStyle: string;
  adCallToAction: string;
  targetMarket: string;
  productCategory: string;
  specificProductName: string;
  pressingProblem: string;
  desiredOutcome: string;
  uniqueMechanism?: string;
  listBenefits?: string;
  specificTechnology?: string;
  scientificStudies?: string;
  credibleAuthority?: string;
  featuredIn?: string;
  numberOfReviews?: string;
  averageReviewRating?: string;
  totalCustomers?: string;
  testimonials?: string;
  powerMode?: boolean;
  liteMode?: boolean;
  userSubscriptionTier?: string | null;
  userRole?: string | null;
}): Promise<{ adSetId: string; count: number; headlineCount: number; bodyCount: number; linkCount: number; imageHookCount: number; generatedCount: number; droppedCount: number }> {
  const { getDb } = await import("./db");
  const { adCopy, services, idealCustomerProfiles, sourceOfTruth, campaigns, campaignKits } = await import("../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");
  const { getCascadeContext } = await import("./_core/cascadeContext");
  const { checkCompliance } = await import("./lib/complianceChecker");

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, input.serviceId), eq(services.userId, input.userId)))
    .limit(1);
  if (!service) throw new Error("Service not found");

  // Campaign + ICP fetch
  let campaignRecord: typeof campaigns.$inferSelect | undefined;
  if (input.campaignId) {
    [campaignRecord] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, input.userId)))
      .limit(1);
  }
  let icp: typeof idealCustomerProfiles.$inferSelect | undefined;
  if (campaignRecord?.icpId) {
    [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, campaignRecord.icpId)).limit(1);
  }
  if (!icp) {
    [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
  }

  // Andromeda per-concept fan-out (DRAFT-only, LAZY): ensure this ICP has a concept set. Runs at the
  // ad-copy entry (after validateCascadePrereqs, which the caller ran) — non-blocking; generates in the
  // background if absent, never delays ad-copy generation. Nothing here reaches Meta until publishToMeta.
  if (icp?.id) {
    void ensureConceptsForIcp({
      userId: input.userId,
      icpId: icp.id,
      serviceId: input.serviceId ?? null,
      campaignId: input.campaignId ?? null,
    }).catch(() => { /* best-effort; failures are logged inside ensureConceptsForIcp */ });
  }

  // campaignType from V2 SoT (campaignKits)
  let campaignType: string = 'course_launch';
  if (icp?.id) {
    const [kit] = await db.select().from(campaignKits)
      .where(and(eq(campaignKits.userId, input.userId), eq(campaignKits.icpId, icp.id)))
      .limit(1);
    if (kit?.campaignType) campaignType = kit.campaignType;
  }
  const campaignTypeContextMap: Record<string, string> = {
    webinar: `CAMPAIGN TYPE: Webinar
Framing: Show-up urgency — the ad must give a compelling reason to attend live, not just register. Sell the event itself, not the offer behind it.
Urgency mechanism: Date and time of the webinar. Limited seats available.
CTA language: Register now / Save your seat / Join us live on [date]`,
    challenge: `CAMPAIGN TYPE: Challenge
Framing: Community commitment — the ad sells the experience of joining a group doing this together. Daily wins build momentum.
Urgency mechanism: Challenge start date. Community closes when the challenge begins.
CTA language: Join the challenge / Claim your spot / Start with us on [date]`,
    course_launch: `CAMPAIGN TYPE: Course Launch
Framing: Transformation journey — who they are now vs who they will become. Enrolment is the decision point.
Urgency mechanism: Enrolment deadline. Cohort size is limited.
CTA language: Enrol now / Join the programme / Claim your place before [date]`,
    product_launch: `CAMPAIGN TYPE: Product Launch
Framing: Early access and founding member status. First to experience something new.
Urgency mechanism: Launch day price increase. Founding member pricing closes on launch day.
CTA language: Get early access / Become a founding member / Lock in launch pricing`,
    discovery_call: `CAMPAIGN TYPE: Discovery Call
Framing: Selectivity and personal attention — the ad sells a free 1:1 conversation, not a mass event. Position the call as a fit-check, not a sales pitch.
Urgency mechanism: Calendar availability is limited. Quality over quantity.
CTA language: Book a discovery call / Apply for a call / Reserve your slot`,
    lead_magnet: `CAMPAIGN TYPE: Lead Magnet
Framing: Specific value before any pitch — the ad sells a single concrete asset (PDF, guide, training, swipe file) the reader can use today. No commitment.
Urgency mechanism: None artificial. The asset itself is the hook. Avoid fake scarcity.
CTA language: Get the free guide / Download free / Send me the [asset]`,
    in_person_event: `CAMPAIGN TYPE: In-Person Event
Framing: Physical-presence value — the ad sells the room, the people, the energy of being there in person. LOCATION LOCK: you are NOT told the city or venue — wherever a location would appear write the literal token [INSERT_EVENT_VENUE]; never invent a city, venue, or address.
Urgency mechanism: Travel logistics + limited room capacity. Real seat limits.
CTA language: Reserve your seat / Register now / Save your spot — write [INSERT_EVENT_VENUE] where a location appears, never a city name`,
  };
  const campaignTypeContext = campaignTypeContextMap[campaignType] || campaignTypeContextMap['course_launch'];

  const cascadeContext = await getCascadeContext(input.userId, icp?.id, "adCopy");

  const icpContext = icp ? `
IDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:
${icp.pains ? `Their daily pains: ${icp.pains}` : ''}
${icp.fears ? `Their deep fears: ${icp.fears}` : ''}
${icp.objections ? `Their objections to buying: ${icp.objections}` : ''}
${icp.buyingTriggers ? `What makes them buy: ${icp.buyingTriggers}` : ''}
${icp.communicationStyle ? `How they communicate: ${icp.communicationStyle}` : ''}
`.trim() : '';

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
  const resolvedPressingProblem = input.pressingProblem?.trim() || service.painPoints || "";
  const resolvedDesiredOutcome = input.desiredOutcome?.trim() || service.mainBenefit || "";
  const resolvedUniqueMechanism = input.uniqueMechanism?.trim() || service.uniqueMechanismSuggestion || "";
  const resolvedCredibleAuthority = input.credibleAuthority?.trim() || service.pressFeatures || "";

  // Social proof
  const socialProof = {
    hasCustomers: !!service.totalCustomers && service.totalCustomers > 0,
    hasRating: !!service.averageRating && parseFloat(service.averageRating) > 0,
    hasReviews: !!service.totalReviews && service.totalReviews > 0,
    hasTestimonials: !!service.testimonial1Name || !!service.testimonial2Name || !!service.testimonial3Name,
    hasPress: !!service.pressFeatures && service.pressFeatures.trim().length > 0,
    customerCount: service.totalCustomers || 0,
    rating: service.averageRating || '',
    reviewCount: service.totalReviews || 0,
    press: service.pressFeatures || '',
  };

  const adSetId = nanoid();
  // Count is configuration now (see _core/variationCounts.ts). Defaults reproduce
  // the previous `liteMode ? 3 : powerMode ? 30 : 15` exactly — no cut happens
  // here. The budget-scaled reduction belongs at the distinctness gate, which
  // needs a surplus to reject from.
  const { resolveAdCopyCount } = await import("./_core/variationCounts");
  const count = resolveAdCopyCount(input);

  const adTypeContext = input.adType === "lead_gen"
    ? "Lead Generation (free webinar, consultation, download)"
    : "E-commerce (direct product sale)";

  const socialProofGuidance = socialProof.hasCustomers || socialProof.hasRating || socialProof.hasReviews
    ? `REAL SOCIAL PROOF AVAILABLE - Use these verified numbers:
- ${socialProof.customerCount} total customers
- ${socialProof.rating} average rating
- ${socialProof.reviewCount} reviews
You MUST use these exact numbers when incorporating social proof. Do not fabricate or inflate.`
    : `LAUNCH-STAGE COPY — this coach's proof is not yet on the record, so the copy earns attention from the coach's own experience of the work and from the method itself:
- Open on the specific moment the coach knows this problem by, in the vocabulary the field uses for it
- Lead with the shift the method creates — how the approach works and why it is different
- Use curiosity: the counterintuitive thing the coach found in this work
- Use contrast: how the work goes with the mechanism in place versus without it
Every number, rating, review count, client story and named outcome in this copy comes from the supplied data above. Where the data above does not carry one, the copy speaks to the coach's own experience and the method instead.`;

  // Headline angles. The result-with-a-number and client-result angles ask for
  // PROOF, so they are offered only when the coach's proof is actually on the
  // record. A launch-stage coach gets situation-led angles instead — the copy
  // still lands, and the prompt never asks for a claim they cannot back.
  const hasRealProof = socialProof.hasCustomers || socialProof.hasRating
    || socialProof.hasReviews || socialProof.hasTestimonials || socialProof.hasPress;
  // Derived from the generation context actually being sent — not a stored band.
  const physicalGuidance = physicalSubjectGuidance(
    [service.name, service.category, service.description, service.targetCustomer, service.mainBenefit,
     resolvedPressingProblem, resolvedDesiredOutcome, input.targetMarket, input.productCategory].join(" "),
  );

  // The headline angles, as a LIST rather than a prose blob. Same angles, same
  // wording — but now each one can be assigned to a specific slot and recorded on
  // the row as that headline's `format`. Per the standing guardrail, format reuses
  // the angle a piece was already written to; nothing new is invented here.
  const headlineAngleList: Array<{ key: string; brief: string }> = hasRealProof
    ? [
        { key: "pain", brief: "name the specific daily frustration (1-2 words max before the hook)" },
        { key: "outcome", brief: "name the exact result with a number or timeframe, drawn from the supplied proof data above" },
        { key: "curiosity", brief: "the counterintuitive reason this problem persists" },
        { key: "social_proof", brief: "name the result a specific type of person got, drawn from the supplied proof data above" },
      ]
    : [
        { key: "pain", brief: "name the specific daily frustration (1-2 words max before the hook)" },
        { key: "situation", brief: "name the moment this work turns, in the vocabulary the field uses" },
        { key: "curiosity", brief: "the counterintuitive reason this problem persists" },
        { key: "mechanism", brief: "name the shift the method creates and what makes the approach different" },
        { key: "contrast", brief: "what a working week looks like once that shift lands" },
      ];

  // ── AWARENESS + ANGLE PLAN FOR THE HEADLINE SET (0097) ──────────────────────
  // Node 7's headlines carried no stage at all, which made them the same
  // 100%-collapse case Node 6 was: every headline in the set differed from its
  // siblings on nothing that was recorded. Measured on prod at Phase 0, all 1,911
  // Node 7 headline pairs collapsed.
  //
  // Planned across the WHOLE SET and dealt, never per angle — the fix proven on
  // Node 6, where per-format planning left 10 zero-axis pairs and starved
  // product_aware of every slot.
  const { awarenessPlanForCount, dealAcrossSlots } = await import("./_core/conceptAxis");
  const { STAGE_HEADLINE_GUIDANCE } = await import("./adCopyAngles");

  // ── DESIRE AXIS ─────────────────────────────────────────────────────────────
  // The third distinctness dimension, read from the concept set the kit-creation
  // trigger generated four nodes ago. Persona stays pinned to the ICP (the concept
  // engine pins it too), so desire is what lets two pieces sharing an awareness
  // stage still count as distinct.
  //
  // FALLBACK IS THE PRE-EXISTING BEHAVIOUR: when no concept set exists — an older
  // ICP, a generation that failed, a coach whose set is still in flight — every
  // piece takes the single deck-constant desire it used before this change, and
  // nothing regresses. The axis simply goes quiet rather than breaking the run.
  // ── The desire axis, and WHICH CONCEPT SUPPLIED IT (migration 0101) ───────
  // This used to select `desire` alone and de-duplicate by that string, so the concept's
  // identity was destroyed before it reached a single row. Step 4 pairs an ad's surfaces by
  // concept, and that join has to be on an integer — two concepts can share an awareness
  // stage, `desire` is long free text a generator may rephrase, and a silent mispair
  // produces a plausible-looking but internally incoherent ad with nothing to detect it.
  //
  // ⚠️ THE DEDUPE IS KEPT, DELIBERATELY. Removing it would let two concepts sharing a desire
  // both enter the deal, which WEAKENS the desire axis — the distinctness comparison is on
  // the desire STRING, so two slots holding the same string differ on zero axes there. The
  // map below preserves insertion order and keeps the FIRST concept per distinct desire, so
  // `conceptDesires` is byte-identical to what the previous code produced and every plan
  // built from it is unchanged. What is new is only that each desire can now name its source.
  //
  // ⚠️ Where two concepts genuinely share a desire, the stamp points at the first. That is a
  // real ambiguity rather than a bug: the column records which concept supplied the DESIRE,
  // and on a shared desire the answer is not unique. Concepts vary Desire × Awareness, so
  // this should be rare — but assembly must not assume conceptId partitions the deck evenly.
  let conceptDesires: string[] = [];
  const conceptIdByDesire = new Map<string, number>();
  if (icp?.id) {
    try {
      const { campaignConcepts } = await import("../drizzle/schema");
      const rows = await db
        .select({ id: campaignConcepts.id, desire: campaignConcepts.desire })
        .from(campaignConcepts)
        .where(eq(campaignConcepts.icpId, icp.id));
      for (const r of rows as any[]) {
        const d = String(r.desire ?? "").trim();
        if (!d || conceptIdByDesire.has(d)) continue;
        conceptIdByDesire.set(d, Number(r.id));
      }
      conceptDesires = Array.from(conceptIdByDesire.keys());
    } catch (err) {
      console.warn(`[adCopyGenerator] desire axis unavailable for icp ${icp.id}:`, err instanceof Error ? err.message : err);
    }
  }
  /** The concept a row's dealt desire came from. NULL for the deck-constant fallback. */
  const conceptIdFor = (desire: unknown): number | null =>
    conceptIdByDesire.get(String(desire ?? "").trim()) ?? null;
  const fallbackDesire = [resolvedPressingProblem, resolvedDesiredOutcome].filter(Boolean).join(" ⁝ ") || null;
  console.log(`[adCopyGenerator] desire axis: ${conceptDesires.length} distinct desires from concepts` +
    `${conceptDesires.length ? "" : " — falling back to the single deck-constant desire"}`);

  const headlineStagePlan = awarenessPlanForCount(count);
  const headlineDesirePlan = dealAcrossSlots(conceptDesires, count);
  // Angles dealt with the capacity-based algorithm ported from Node 6, rather than
  // a plain index rotation. The rotation left 3 pairs differing on ZERO axes on the
  // live Node 7 run, because a stage group longer than the angle list repeated an
  // angle inside that group. Dealing with capacity spreads each stage's slots over
  // as many different angles as the deck size allows.
  const angleSlotsByIndex: Array<{ key: string; brief: string }> = new Array(count);
  {
    const capacity = Math.ceil(count / headlineAngleList.length);
    const used = headlineAngleList.map(() => 0);
    let cursor = 0;
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < headlineAngleList.length; k++) {
        const a = (cursor + k) % headlineAngleList.length;
        if (used[a] < capacity) {
          angleSlotsByIndex[i] = headlineAngleList[a];
          used[a]++;
          cursor = a + 1;
          break;
        }
      }
      if (!angleSlotsByIndex[i]) angleSlotsByIndex[i] = headlineAngleList[i % headlineAngleList.length];
    }
  }

  const headlineSlots = headlineStagePlan.map((stage, i) => ({
    stage,
    angle: angleSlotsByIndex[i],
    desire: headlineDesirePlan[i] ?? fallbackDesire,
  }));

  const headlineAngles = headlineSlots
    .map((s, i) =>
      `HEADLINE ${i + 1} → stage ${s.stage.replace(/_/g, " ").toUpperCase()}, angle "${s.angle.key}"\n` +
      (s.desire ? `  the want this one speaks to: ${s.desire}\n` : "") +
      `  angle brief: ${s.angle.brief}\n` +
      `  ${STAGE_HEADLINE_GUIDANCE[s.stage].split("\n").slice(1).join(" ").trim()}`,
    )
    .join("\n\n");

  // ── Headlines call (sync fuller prompt) ─────────────────────────────────────
  const headlinePrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert Facebook/Instagram ad copywriter. Create ${count} high-converting ad HEADLINES for this service:

Service: ${service.name}
Category: ${service.category}
Target Market: ${input.targetMarket}
Product Category: ${input.productCategory}
Specific Product Name: ${input.specificProductName}
Pressing Problem: ${resolvedPressingProblem}
Desired Outcome: ${resolvedDesiredOutcome}
Unique Mechanism: ${resolvedUniqueMechanism || '[INSERT_UNIQUE_MECHANISM]'}
Key Benefits: ${input.listBenefits || '[INSERT_KEY_BENEFITS]'}
Specific Technology: ${input.specificTechnology || '[INSERT_SPECIFIC_TECHNOLOGY]'}
Scientific Studies: ${input.scientificStudies || '[INSERT_SCIENTIFIC_STUDIES]'}
Credible Authority: ${resolvedCredibleAuthority || '[INSERT_CREDIBLE_AUTHORITY]'}

${socialProofGuidance}

${icpContext}

${campaignTypeContext}

Ad Type: ${adTypeContext}
Ad Style: ${input.adStyle}
Call To Action: ${input.adCallToAction}

SCROLL-STOPPER RULE: The first word of every headline must arrest the scroll. Open on the specific situation this work turns on, or on a counterintuitive insight — not a benefit, not the service name.

THREE-QUESTION TEST — every headline must pass all three:
1. Does it name a specific situation rather than a category? (Not "for coaches" — "the follow-up that decides the whole month")
2. Does it name a specific outcome, not a category of outcomes? (Not "more clients" — "3 clients booked in 10 days")
3. Could this headline ONLY be written for this service? If it works for any coach's service, rewrite it.

${registerPersonGuidance(hasRealProof)}

${physicalGuidance}

BANNED PATTERNS — never generate:
- ${BANNED_HEADLINE_PATTERNS.map(p => `"${p}..."`).join(', ')}
- Generic power words without context: skyrocket, explode, dominate, crush, master, unlock, transform

MANDATORY: Include at least one word from the pressing problem field — the actual vocabulary the target market uses to describe their situation.

Create ${count} attention-grabbing headlines (max 40 characters each).

SLOT ASSIGNMENT — each headline below is written for a DIFFERENT reader and to a
DIFFERENT angle. Two headlines that differ only in wording are treated as one ad and
compete against each other, so write one headline per slot, in this exact order, and
return them in that order:

${headlineAngles}

Format as JSON array:
{
  "headlines": ["headline 1", "headline 2", ...]
}`;

  const headlineResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `${META_COMPLIANCE_RULES}\n\nYou are an expert ad copywriter who specializes in Meta-compliant advertising for coaches, speakers and consultants. Always respond with valid JSON.\n\n${REGISTER_STANDARD}`,
      },
      { role: "user", content: cascadeContext + headlinePrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ad_headlines",
        strict: true,
        schema: {
          type: "object",
          properties: { headlines: { type: "array", items: { type: "string" } } },
          required: ["headlines"],
          additionalProperties: false,
        },
      },
    },
  });
  const headlineContent = headlineResponse.choices[0].message.content;
  if (typeof headlineContent !== "string") throw new Error("Invalid headline response");
  const headlineData = JSON.parse(stripMarkdownJson(headlineContent));

  // ── Body angles in parallel (sync fuller prompt with PAS structure) ────────
  const { ALL_BODY_ANGLES, PROOF_DEPENDENT_ANGLES, BODY_ANGLE_PROMPTS } = await import('./adCopyAngles');
  // Proof-dependent angles are STRUCTURALLY built around a client account or a
  // figure — their beat structure asks for one, so a launch-stage coach handed one
  // of these has to invent the client to fill it. (Verified 2026-07-27: the
  // social-proof angle produced "One client sat through…" plus an invented quote for
  // a coach with zero supplied proof, even with the angle's own text reframed.)
  // Withheld until the coach's proof is on the record — the deck simply uses the
  // other angles, so a beginner still gets a full set.
  const availableAngles = hasRealProof
    ? [...ALL_BODY_ANGLES]
    : ALL_BODY_ANGLES.filter((a) => !PROOF_DEPENDENT_ANGLES.includes(a));

  // ── AWARENESS-STAGE SELECTION ───────────────────────────────────────────────
  // Schwartz: the same offer needs different copy depending on what the reader already knows.
  // Previously this was `availableAngles.slice(0, 3)` in liteMode — the first three angles in
  // ARRAY ORDER, with no strategic basis. For a coach with testimonials that resolved to
  // pain_agitation + social_proof + authority: two of three cold-traffic ads aimed at people who
  // already know the brand, and nothing for the Unaware reader the prospecting research allocates
  // 37.5% of the batch to.
  //
  // The stage per slot comes from awarenessPlanForCount — the SAME deterministic allocation the
  // concept generator uses, so ad copy and concepts describe the same funnel shape.
  //
  // ⚠️ Why the plan and not a concept row: ensureConceptsForIcp above is fire-and-forget and
  // explicitly never delays ad-copy generation, so no concept exists yet when this runs. Reading
  // one here would be a race. Deriving the stage from the shared plan gives the same stages the
  // concepts will carry, with no ordering dependency.
  //
  // Verified at the deck sizes actually used: the plan's largest-remainder apportionment already
  // spans a warmer stage at 3 slots (unaware, problem_aware, solution_aware) and all four at 8+.
  // The 25% warmer tail that …Prospecting Campaign Ad Concept Distribution §3 calls "a vital
  // safeguard against Entity-ID pigeonholing" is therefore preserved without special-casing.
  // awarenessPlanForCount is already in scope — imported above for the headline
  // plan, so headlines, bodies and links all spend the SAME allocation function.
  const { angleForStage, STAGE_COPY_GUIDANCE } = await import('./adCopyAngles');
  const slotCount = input.liteMode ? 3 : availableAngles.length;
  const stagePlan = awarenessPlanForCount(slotCount);

  // One angle per planned slot. Where a stage's mapped angles are exhausted — inevitable on the
  // full 18-slot deck, since 4 stages × 3 mapped angles cannot cover 18 — the slot backfills from
  // the remaining angles in the previous array order but KEEPS its planned stage guidance. Deck
  // size is therefore byte-identical to the old slice(0, n) behaviour, with no angle issued twice.
  const usedAngles = new Set<(typeof availableAngles)[number]>();
  const slots: Array<{ angle: (typeof availableAngles)[number]; stage: (typeof stagePlan)[number] }> = [];
  for (const stage of stagePlan) {
    const mapped = angleForStage(stage, availableAngles, usedAngles);
    const angle = mapped ?? availableAngles.find((a) => !usedAngles.has(a));
    if (!angle) break; // angles exhausted — cannot happen while slotCount <= availableAngles.length
    usedAngles.add(angle);
    slots.push({ angle, stage });
  }
  // Desire per body slot, from the same concept set the headlines used.
  const bodyDesirePlan = dealAcrossSlots(conceptDesires, slots.length);

  // ── FIELD CHAINING (build spec §3) ──────────────────────────────────────────
  // The three text surfaces used to be generated in parallel silos: headlines,
  // then bodies, then links, none of them seeing the others. Andromeda fuses the
  // fields of ONE ad into a single meaning, so the redundancy that costs delivery
  // is redundancy WITHIN an ad — a headline and a body saying the same thing in
  // the same words. Each body is therefore paired with the headline it is most
  // likely to ship beside (same awareness stage, so the pair is coherent as well
  // as non-redundant) and told to complement it.
  //
  // The pairing is a generation-time device, not a stored relationship: there is
  // no pairing column and this step does not add one.
  const headlineTexts: string[] = Array.isArray(headlineData.headlines) ? headlineData.headlines : [];
  const headlineByStage = new Map<string, string[]>();
  headlineSlots.forEach((s, i) => {
    const t = headlineTexts[i];
    if (!t) return;
    const pool = headlineByStage.get(s.stage) ?? [];
    pool.push(String(t));
    headlineByStage.set(s.stage, pool);
  });
  const stageCursor: Record<string, number> = {};
  const partnerHeadlineFor = (stage: string, idx: number): string | null => {
    const pool = headlineByStage.get(stage);
    if (pool && pool.length) {
      const c = stageCursor[stage] ?? 0;
      stageCursor[stage] = c + 1;
      return pool[c % pool.length];
    }
    return headlineTexts.length ? String(headlineTexts[idx % headlineTexts.length]) : null;
  };

  const bodyPartners: Array<string | null> = slots.map(({ stage }, i) => partnerHeadlineFor(stage, i));

  const bodyPromises = slots.map(async ({ angle, stage }, slotIdx) => {
    const anglePrompt = BODY_ANGLE_PROMPTS[angle];
    const stageGuidance = STAGE_COPY_GUIDANCE[stage];
    const partnerHeadline = bodyPartners[slotIdx];
    const slotDesire = bodyDesirePlan[slotIdx] ?? fallbackDesire;

    // The desire is written INTO the prompt, not merely recorded on the row. A
    // dimension that labels output without changing it is the fake-diversity the
    // whole exercise exists to remove.
    const desireBlock = bodyDesirePlan.length
      ? `THE WANT THIS PIECE SPEAKS TO — the single thread it follows:
${slotDesire}

Other pieces in this batch speak to different wants. Stay on this one. Do not try to
cover every reason someone might hire this coach; the copy that names one want
precisely is what the right reader recognises, and it is what keeps this piece from
being read as a restatement of its siblings.`
      : "";

    const chainBlock = partnerHeadline
      ? `PAIRED HEADLINE — this body copy will run in the same ad as this headline:
"${partnerHeadline}"

COMPLEMENT IT, DO NOT RESTATE IT. The headline and the body are read together as one
message. Repeating the headline's wording in the body wastes the second surface and
makes the ad read as one narrow idea instead of a complete one.
- Do NOT reuse the headline's key nouns and verbs. Where the same subject has to be
  referred to, refer to it a different way.
- Do NOT open the body with a paraphrase of the headline.
- The headline has done the work of stopping the scroll. The body's job is the part
  the headline could not carry: the specific situation behind it, and what changes.`
      : "";

    const primingBlock = `OPENING WORDS — the first sentence carries more weight than any other.
The opening 5 to 10 words decide how this ad is categorised and therefore who sees it,
so they must be the most specific words in the whole piece.
- Open on the concrete situation, in the vocabulary this field actually uses for it.
- Name the reader's world in those first words — the work they do, the thing that keeps
  happening — not a greeting, not a wind-up, not a question that could open any ad.
- Do NOT open with filler: "Hey", "So", "Look", "Let me tell you", "Imagine", "What if",
  "Are you tired of", "Ever wondered", "Picture this", "Here's the thing".
- The first sentence should be impossible to reuse for a different coach in a different
  field.`;
    const bodyPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert Facebook/Instagram ad copywriter. Create ONE high-converting ad BODY COPY using the ${angle.replace('_', ' ')} angle:

Service: ${service.name}
Category: ${service.category}
Target Market: ${input.targetMarket}
Product Category: ${input.productCategory}
Specific Product Name: ${input.specificProductName}
Pressing Problem: ${resolvedPressingProblem}
Desired Outcome: ${resolvedDesiredOutcome}
Unique Mechanism: ${resolvedUniqueMechanism || '[INSERT_UNIQUE_MECHANISM]'}
Key Benefits: ${input.listBenefits || '[INSERT_KEY_BENEFITS]'}
Specific Technology: ${input.specificTechnology || '[INSERT_SPECIFIC_TECHNOLOGY]'}
Scientific Studies: ${input.scientificStudies || '[INSERT_SCIENTIFIC_STUDIES]'}
Credible Authority: ${resolvedCredibleAuthority || '[INSERT_CREDIBLE_AUTHORITY]'}

${socialProofGuidance}

${icpContext}

${campaignTypeContext}

Ad Type: ${adTypeContext}
Ad Style: ${input.adStyle}
Call To Action: ${input.adCallToAction}

${anglePrompt}

${stageGuidance}

${registerPersonGuidance(hasRealProof)}

${physicalGuidance}

${desireBlock}

${chainBlock}

${primingBlock}

PAS STRUCTURE — apply to every body copy in this order:
PAIN (1-2 sentences): Open on the specific moment the coach knows this problem by — from their own experience of it, or from doing this work up close. Use the vocabulary the field actually uses for it. Concrete moment, not a category.
AGITATE (2-3 sentences): Stay with that moment and show what it costs — what it takes out of a week, and which of the usual fixes do not hold.
SOLUTION (2-3 sentences): Introduce the mechanism. Name what makes it different from the usual approach. Include a specific outcome or timeframe drawn from the supplied material.
CTA (1 sentence): One clear next step. Use the approved CTA format from Meta compliance rules.

FORMATTING RULES (applied to every body copy):
- Maximum 15 words per sentence. Absolute maximum 20 words.
- Maximum 2 sentences per paragraph.
- One blank line between every paragraph.
- No run-on sentences. Break long ideas into multiple short sentences.
- Write at Grade 6 reading level — short words, short sentences, direct language.

Create ONE body copy (125-150 words) following the ${angle.replace('_', ' ')} angle AND the PAS structure above.
End with clear call-to-action: ${input.adCallToAction}

Return ONLY the body text as a single string, no JSON wrapper.`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${META_COMPLIANCE_RULES}\n\nYou are an expert ad copywriter who specializes in Meta-compliant advertising for coaches, speakers and consultants.\n\n${NO_CREDENTIAL_FABRICATION_RULE}\n\n${REGISTER_STANDARD}`,
        },
        { role: "user", content: cascadeContext + bodyPrompt },
      ],
    });
    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) throw new Error(`Empty response for ${angle} angle`);
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    if (!content) throw new Error(`Invalid content type for ${angle} angle`);
    return { angle, body: content };
  });
  const bodyResults = await Promise.all(bodyPromises);
  const bodyData = { bodies: bodyResults.map(r => r.body) };

  // ── Link descriptions — the third link in the chain ────────────────────────
  // Generated LAST and, unlike before, aware of both surfaces that precede them.
  // Each slot sees the headline and the opening of the body it will ship with, so
  // it can close the message rather than restate it. Links also carry an awareness
  // stage now, from the same whole-set allocation — previously they had none, which
  // made every link in a set indistinguishable from every other on the axes that
  // decide Entity-ID clustering.
  const linkStagePlan = awarenessPlanForCount(count);
  const linkDesirePlan = dealAcrossSlots(conceptDesires, count);
  const linkSlotBlock = linkStagePlan
    .map((stage, i) => {
      const hl = headlineTexts.length ? String(headlineTexts[i % headlineTexts.length]) : "(none)";
      const bodyOpening = bodyResults.length
        ? String(bodyResults[i % bodyResults.length].body).replace(/\s+/g, " ").slice(0, 140)
        : "(none)";
      return (
        `LINK ${i + 1} → stage ${stage.replace(/_/g, " ").toUpperCase()}\n` +
        `  its headline: "${hl}"\n` +
        `  its body opens: "${bodyOpening}…"\n` +
        `  finish this ad's message — do not repeat the headline's words or the body's opening.`
      );
    })
    .join("\n\n");

  const linkPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert Facebook/Instagram ad copywriter. Create ${count} high-converting LINK DESCRIPTIONS for this service:

Service: ${service.name}
Category: ${service.category}
Target Market: ${input.targetMarket}
Product Category: ${input.productCategory}
Specific Product Name: ${input.specificProductName}
Desired Outcome: ${resolvedDesiredOutcome}
Call To Action: ${input.adCallToAction}

${icpContext}

${campaignTypeContext}

Ad Type: ${adTypeContext}
Ad Style: ${input.adStyle}

Create ${count} clear, action-oriented link descriptions (max 30 characters each) that:
- State the clear next step aligned with the CTA (${input.adCallToAction})
- Create urgency or excitement
- Are benefit-focused
- Match the ad style tone

SLOT ASSIGNMENT — each link description completes an ad that already has a headline and
a body. It is the third and last text surface, so its job is to finish the message, not
to repeat either of them. Write one link description per slot, in this exact order, and
return them in that order:

${linkSlotBlock}

Return them in slot order.

Format as JSON array:
{
  "links": ["link 1", "link 2", ...]
}`;

  const linkResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `${META_COMPLIANCE_RULES}\n\nYou are an expert ad copywriter who specializes in Meta-compliant advertising for coaches, speakers and consultants. Always respond with valid JSON.\n\n${REGISTER_STANDARD}`,
      },
      { role: "user", content: cascadeContext + linkPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ad_links",
        strict: true,
        schema: {
          type: "object",
          properties: { links: { type: "array", items: { type: "string" } } },
          required: ["links"],
          additionalProperties: false,
        },
      },
    },
  });
  const linkContent = linkResponse.choices[0].message.content;
  if (typeof linkContent !== "string") throw new Error("Invalid link response");
  const linkData = JSON.parse(stripMarkdownJson(linkContent));

  // ── IMAGE HOOK — the text baked INTO the picture, as its own surface ────────
  //
  // WHAT THIS REPLACES. The compositor's `bodyText` was `resolveAdBodyTexts`, which
  // truncates an ad-copy BODY row to 140 characters. So the string Meta's OCR reads off the
  // picture was the body's opening, verbatim — the same words on two of the three surfaces
  // Meta fuses into one meaning, which the research names as collapse-inducing and which
  // has been live in production.
  //
  // WHY IT IS GENERATED HERE AND NOT IN THE IMAGE PATH. This generator assigns and stamps
  // the four P.D.A.F. axes. Generating the hook image-side would mean re-deriving axes that
  // already exist — a label that differs while the copy does not, which is the fake
  // diversity this whole chapter exists to remove. Written here, the hook arrives carrying
  // the same persona/desire/awareness/format stamps as the headline and body it ships with,
  // and one generator can actually enforce the build spec §3 division of labour:
  //   image = the emotional hook · headline = the proof/mechanism · body = context, opening
  //   on the priming words.
  //
  // ⚠️ THE BODY'S OPENING STAYS FREE. The fix is explicitly NOT to constrain the body — its
  // first 5-10 words are what decides who Meta shows the ad to. The hook moves out of the
  // body's way, never the other way round.
  // HOOK_MAX_CHARS is module-scope and shared with the gate's redraft path — see its
  // docblock for why it must not be re-declared locally.
  const hookStagePlan = awarenessPlanForCount(count);
  const hookDesirePlan = dealAcrossSlots(conceptDesires, count);
  const hookSlotBlock = hookStagePlan
    .map((stage, i) => {
      const hl = headlineTexts.length ? String(headlineTexts[i % headlineTexts.length]) : "(none)";
      const bodyOpening = bodyResults.length
        ? String(bodyResults[i % bodyResults.length].body).replace(/\s+/g, " ").slice(0, 140)
        : "(none)";
      const d = hookDesirePlan[i] ?? fallbackDesire;
      return (
        `IMAGE HOOK ${i + 1} → stage ${stage.replace(/_/g, " ").toUpperCase()}\n` +
        (d ? `  the want this ad speaks to: ${d}\n` : "") +
        `  its headline (the proof/mechanism): "${hl}"\n` +
        `  its body opens (the context): "${bodyOpening}…"\n` +
        `  say the FEELING those two explain — in words neither of them uses.`
      );
    })
    .join("\n\n");

  const hookPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert Facebook/Instagram ad copywriter. Write ${count} IMAGE HOOK lines — the short line of text that sits ON the picture itself.

Service: ${service.name}
Target Market: ${input.targetMarket}
Pressing Problem: ${resolvedPressingProblem}
Desired Outcome: ${resolvedDesiredOutcome}
Unique Mechanism: ${resolvedUniqueMechanism}

${icpContext}

WHAT AN IMAGE HOOK IS. An ad has three text surfaces and they are read as ONE message:
the words on the picture, the headline, and the body. Each does a different job.
- The PICTURE's line is the emotional hook — the feeling, the moment of recognition.
- The HEADLINE carries the proof or the mechanism.
- The BODY carries the context and the specifics.
Your job is the first one only.

HARD RULES:
- ${HOOK_MAX_CHARS} characters maximum. Shorter is better. It is set large on a photograph.
- Say something the headline and body do NOT say. Where they name the mechanism or the
  numbers, you name the feeling underneath.
- Use different words from its headline and from its body's opening. Not a paraphrase,
  not a shortening — a different angle on the same idea.
- Plain words. No colons, no hashtags, no quotation marks, no ALL CAPS, no emoji.
- No price, no percentage, no statistic, no client result, no credential.
- It must read as a complete thought on its own, because it is seen before either of the
  other two surfaces.

${registerPersonGuidance(hasRealProof)}

SLOT ASSIGNMENT — write one hook per slot, in this exact order, and return them in that order:

${hookSlotBlock}

Format as JSON:
{
  "hooks": ["hook 1", "hook 2", ...]
}`;

  const hookResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `${META_COMPLIANCE_RULES}\n\nYou are an expert ad copywriter who specializes in Meta-compliant advertising for coaches, speakers and consultants. Always respond with valid JSON.\n\n${NO_CREDENTIAL_FABRICATION_RULE}\n\n${REGISTER_STANDARD}`,
      },
      { role: "user", content: cascadeContext + hookPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ad_image_hooks",
        strict: true,
        schema: {
          type: "object",
          properties: { hooks: { type: "array", items: { type: "string" } } },
          required: ["hooks"],
          additionalProperties: false,
        },
      },
    },
  });
  const hookContent = hookResponse.choices[0].message.content;
  if (typeof hookContent !== "string") throw new Error("Invalid image-hook response");
  const hookData = JSON.parse(stripMarkdownJson(hookContent));
  // Enforce the ceiling in code as well as in the prompt, via the shared clamp the gate's
  // redraft path also calls. The compositor sets this large over a photograph; a model that
  // runs long would push the text block into the picture the prompt told the renderer to
  // keep clear.
  const hookTexts: string[] = (hookData.hooks ?? [])
    .map((h: unknown) => clampHookText(h))
    .filter((h: string) => h.length > 0);
  console.log(`[adCopyGenerator] image hooks: ${hookTexts.length}/${count} generated, longest ${Math.max(0, ...hookTexts.map((h) => h.length))} chars`);

  // ── Compliance + insert ────────────────────────────────────────────────────
  const allInserts: any[] = [];

  // P.D.A.F. axes, stamped from what the generator ASSIGNED — never re-read from
  // the finished text. persona and desire are deck-constant today (one ICP, one
  // pressing problem), which is exactly the pinned-ceiling the persona/pain
  // widening phase exists to lift; recording them now means the gate reads one
  // shape whether or not that phase has landed.
  const pdafPersona = input.targetMarket || null;
  const pdafDesire = [resolvedPressingProblem, resolvedDesiredOutcome].filter(Boolean).join(" ⁝ ") || null;

  let headlineIdx = 0;
  for (const headline of headlineData.headlines) {
    const complianceResult = await checkCompliance(headline, {
      userId: input.userId,
      generatorType: 'adCopy',
      trackUsage: true,
    });
    allInserts.push({
      userId: input.userId,
      serviceId: input.serviceId,
      campaignId: input.campaignId || null,
      adSetId,
      adType: input.adType,
      adStyle: input.adStyle,
      adCallToAction: input.adCallToAction,
      contentType: "headline" as const,
      content: headline,
      // Slot i of the headline plan produced headline i — positional, as issued.
      persona: pdafPersona,
      desire: headlineSlots[headlineIdx]?.desire ?? pdafDesire,
      // Stamped from the SAME value written to `desire` above, so the column can never
      // disagree with the axis it names. NULL when the deck-constant fallback supplied it.
      conceptId: conceptIdFor(headlineSlots[headlineIdx]?.desire),
      awareness: headlineSlots[headlineIdx]?.stage ?? null,
      format: headlineSlots[headlineIdx]?.angle.key ?? null,
      targetMarket: input.targetMarket,
      productCategory: input.productCategory,
      specificProductName: input.specificProductName,
      pressingProblem: input.pressingProblem,
      desiredOutcome: input.desiredOutcome,
      uniqueMechanism: input.uniqueMechanism || null,
      listBenefits: input.listBenefits || null,
      specificTechnology: input.specificTechnology || null,
      scientificStudies: input.scientificStudies || null,
      credibleAuthority: input.credibleAuthority || null,
      featuredIn: input.featuredIn || null,
      numberOfReviews: input.numberOfReviews || null,
      averageReviewRating: input.averageReviewRating || null,
      totalCustomers: input.totalCustomers || null,
      testimonials: input.testimonials || null,
      complianceScore: complianceResult.score,
      complianceVersion: complianceResult.version,
      complianceCheckedAt: new Date(),
      selectionScore: String(scoreAdContent('headline', headline)),
      violationReasons: complianceResult.issues.length > 0 ? complianceResult.issues.map(i => i.reason) : null,
    });
    headlineIdx++;
  }

  let bodyIdx = 0;
  for (const result of bodyResults) {
    const complianceResult = await checkCompliance(result.body, {
      userId: input.userId,
      generatorType: 'adCopy',
      trackUsage: true,
    });
    allInserts.push({
      userId: input.userId,
      serviceId: input.serviceId,
      campaignId: input.campaignId || null,
      adSetId,
      adType: input.adType,
      adStyle: input.adStyle,
      adCallToAction: input.adCallToAction,
      contentType: "body" as const,
      bodyAngle: result.angle,
      content: result.body,
      // Bodies already carried a stage and an angle; 0097 records them. `format`
      // reuses bodyAngle rather than introducing a second label for the same idea.
      persona: pdafPersona,
      desire: bodyDesirePlan[bodyIdx] ?? pdafDesire,
      conceptId: conceptIdFor(bodyDesirePlan[bodyIdx]),
      awareness: slots[bodyIdx]?.stage ?? null,
      format: result.angle,
      targetMarket: input.targetMarket,
      productCategory: input.productCategory,
      specificProductName: input.specificProductName,
      pressingProblem: input.pressingProblem,
      desiredOutcome: input.desiredOutcome,
      uniqueMechanism: input.uniqueMechanism || null,
      listBenefits: input.listBenefits || null,
      specificTechnology: input.specificTechnology || null,
      scientificStudies: input.scientificStudies || null,
      credibleAuthority: input.credibleAuthority || null,
      featuredIn: input.featuredIn || null,
      numberOfReviews: input.numberOfReviews || null,
      averageReviewRating: input.averageReviewRating || null,
      totalCustomers: input.totalCustomers || null,
      testimonials: input.testimonials || null,
      complianceScore: complianceResult.score,
      complianceVersion: complianceResult.version,
      complianceCheckedAt: new Date(),
      selectionScore: String(scoreAdContent('body', result.body, result.angle)),
      violationReasons: complianceResult.issues.length > 0 ? complianceResult.issues.map(i => i.reason) : null,
    });
    bodyIdx++;
  }

  let linkIdx = 0;
  for (const link of linkData.links) {
    const complianceResult = await checkCompliance(link);
    allInserts.push({
      userId: input.userId,
      serviceId: input.serviceId,
      campaignId: input.campaignId || null,
      adSetId,
      adType: input.adType,
      adStyle: input.adStyle,
      adCallToAction: input.adCallToAction,
      contentType: "link" as const,
      content: link,
      // Links now carry a stage from the same whole-set allocation. Their format
      // axis is the surface itself — a link description is one architecture, not a
      // family of angles — so it is recorded as such rather than left null, which
      // would read as "no format assigned" to the gate.
      persona: pdafPersona,
      desire: linkDesirePlan[linkIdx] ?? pdafDesire,
      // Links are excluded from the distinctness POPULATION but still carry their axes for
      // coordination; stamping them too keeps the table coherent and costs nothing.
      conceptId: conceptIdFor(linkDesirePlan[linkIdx]),
      awareness: linkStagePlan[linkIdx] ?? null,
      format: "link_description",
      targetMarket: input.targetMarket,
      productCategory: input.productCategory,
      specificProductName: input.specificProductName,
      pressingProblem: input.pressingProblem,
      desiredOutcome: input.desiredOutcome,
      uniqueMechanism: input.uniqueMechanism || null,
      listBenefits: input.listBenefits || null,
      specificTechnology: input.specificTechnology || null,
      scientificStudies: input.scientificStudies || null,
      credibleAuthority: input.credibleAuthority || null,
      featuredIn: input.featuredIn || null,
      numberOfReviews: input.numberOfReviews || null,
      averageReviewRating: input.averageReviewRating || null,
      totalCustomers: input.totalCustomers || null,
      testimonials: input.testimonials || null,
      complianceScore: complianceResult.score,
      complianceVersion: complianceResult.version,
      complianceCheckedAt: new Date(),
      selectionScore: String(scoreAdContent('link', link)),
      violationReasons: complianceResult.issues.length > 0 ? complianceResult.issues.map(i => i.reason) : null,
    });
    linkIdx++;
  }

  let hookIdx = 0;
  for (const hook of hookTexts) {
    const complianceResult = await checkCompliance(hook, {
      userId: input.userId,
      generatorType: 'adCopy',
      trackUsage: true,
    });
    allInserts.push({
      userId: input.userId,
      serviceId: input.serviceId,
      campaignId: input.campaignId || null,
      adSetId,
      adType: input.adType,
      adStyle: input.adStyle,
      adCallToAction: input.adCallToAction,
      contentType: "image_hook" as const,
      content: hook,
      // Same four axes as the headline and body this hook ships beside — that is the whole
      // reason it is generated here. `format` is the surface itself: an image hook is one
      // architecture, not a family of angles, so recording it as such is truthful, where
      // leaving it null would read to the gate as "no format assigned".
      persona: pdafPersona,
      desire: hookDesirePlan[hookIdx] ?? pdafDesire,
      conceptId: conceptIdFor(hookDesirePlan[hookIdx]),
      awareness: hookStagePlan[hookIdx] ?? null,
      format: "image_hook",
      targetMarket: input.targetMarket,
      productCategory: input.productCategory,
      specificProductName: input.specificProductName,
      pressingProblem: input.pressingProblem,
      desiredOutcome: input.desiredOutcome,
      uniqueMechanism: input.uniqueMechanism || null,
      listBenefits: input.listBenefits || null,
      specificTechnology: input.specificTechnology || null,
      scientificStudies: input.scientificStudies || null,
      credibleAuthority: input.credibleAuthority || null,
      featuredIn: input.featuredIn || null,
      numberOfReviews: input.numberOfReviews || null,
      averageReviewRating: input.averageReviewRating || null,
      totalCustomers: input.totalCustomers || null,
      testimonials: input.testimonials || null,
      complianceScore: complianceResult.score,
      complianceVersion: complianceResult.version,
      complianceCheckedAt: new Date(),
      selectionScore: String(scoreAdContent('headline', hook)),
      violationReasons: complianceResult.issues.length > 0 ? complianceResult.issues.map(i => i.reason) : null,
    });
    hookIdx++;
  }

  // ── OUTPUT GATE (compliance axis + fabrication), one shared pass ────────────
  // Disposition here is DROP-THE-VARIANT rather than throw: a deck carries 15-30
  // variants, so removing the few that violate leaves a usable deck and never
  // dead-ends a launch-stage coach mid-cascade. The publish gate is the hard stop.
  const { checkOutput } = await import("./_core/complianceAxis");
  const { buildCoachCorpus, buildProofSupplied } = await import("./_core/groundingCorpus");
  const gateGrounding = {
    corpus: buildCoachCorpus({ service, groundingMeta: (icp as any)?.groundingMeta }),
    supplied: buildProofSupplied(service),
  };
  // `image_hook` is a SHORT field, like a headline — a single line set large over a photo.
  // Left to fall through to "body" it would be judged as prose by the compliance axis, whose
  // short-field checks exist precisely because a 40-character line cannot carry a
  // first-person moment and so needs different handling.
  const gateRole = (t: unknown) =>
    t === "headline" || t === "image_hook" ? "short" as const
      : t === "link" ? "cta" as const
        : "body" as const;
  const gateOne = (row: any) =>
    checkOutput([{ location: String(row.contentType), text: String(row.content ?? ""), role: gateRole(row.contentType) }], gateGrounding);

  const keptInserts: typeof allInserts = [];
  const droppedClasses: string[] = [];
  const retryable: Array<{ row: any; failContext: string }> = [];
  for (const row of allInserts) {
    const res = gateOne(row);
    if (res.ok) { keptInserts.push(row); continue; }
    droppedClasses.push(...res.blocking.map((h) => String(h.classId)));
    // BODY copy is retried; headlines and links are not. Measured on prod: 100% of drops
    // were bodies (46 generated → 34 kept = 15 headlines + 4 bodies + 15 links), and a
    // 40-character headline has little room for a redraft to change anything.
    if (row.contentType === "body" && res.failContext) retryable.push({ row, failContext: res.failContext });
  }

  // ── CAPPED REGENERATION ─────────────────────────────────────────────────────
  // HARD-BLOCK + AUTO-REGENERATE (Arfeen's call, 2026-08-04). A variant that fails the gate is
  // never shown to the coach — it is already excluded from keptInserts above, which IS the hard
  // block. This loop then tries to replace it with a compliant one so the coach still gets a
  // working deck rather than a thinner one.
  //
  // CAP: COMPLIANCE_RETRY_MAX_ATTEMPTS (3), shared with conceptGenerator and the script generator
  // so every path has the same ceiling. Previously this was exactly ONE round, hardcoded. Each
  // attempt re-gates its own output, so a redraft that violates again is discarded, not kept.
  //
  // Measured on a career-shaped offer: 10/16 bodies survived the first draft and 6/6 dropped
  // angles recovered on a SINGLE redraft, taking the deck to 16/16 — so attempt 1 does most of
  // the work and the extra attempts are the tail, not the norm.
  //
  // BODIES ONLY, deliberately: measured on prod, 100% of drops were bodies (46 generated → 34
  // kept = 15 headlines + 4 bodies + 15 links), and a 40-character headline has too little room
  // for a redraft to change the verdict. Extending regeneration to headlines would be building
  // for a case that has never occurred.
  //
  // Runs in parallel within an attempt, so cost is one round-trip per attempt regardless of how
  // many variants failed.
  const { COMPLIANCE_RETRY_MAX_ATTEMPTS: MAX_REGEN } = await import("./_core/complianceAxis");
  const blockedFirstPass = allInserts.length - keptInserts.length;
  const firstPassClasses = [...droppedClasses];
  let recoveredCount = 0;
  let pending = [...retryable];
  for (let attempt = 1; attempt <= MAX_REGEN && pending.length > 0; attempt++) {
    const stillFailing: typeof pending = [];
    const { BODY_ANGLE_PROMPTS: ANGLE_PROMPTS } = await import('./adCopyAngles');
    const retried = await Promise.all(pending.map(async ({ row, failContext }) => {
      try {
        const anglePrompt = ANGLE_PROMPTS[row.bodyAngle as keyof typeof ANGLE_PROMPTS] ?? "";
        const resp = await invokeLLM({
          messages: [
            { role: "system", content: `${META_COMPLIANCE_RULES}\n\nYou are an expert ad copywriter who specializes in Meta-compliant advertising for coaches, speakers and consultants.\n\n${NO_CREDENTIAL_FABRICATION_RULE}\n\n${REGISTER_STANDARD}` },
            { role: "user", content: `${cascadeContext}You are rewriting ONE ad body copy using the ${String(row.bodyAngle).replace('_', ' ')} angle.\n\nService: ${service.name}\nTarget Market: ${input.targetMarket}\nPressing Problem: ${resolvedPressingProblem}\nDesired Outcome: ${resolvedDesiredOutcome}\nUnique Mechanism: ${resolvedUniqueMechanism}\n\n${anglePrompt}\n\n${registerPersonGuidance(hasRealProof)}\n\n${physicalGuidance}\n\nCreate ONE body copy (125-150 words). End with: ${input.adCallToAction}.\nReturn ONLY the body text as a single string.\n\n---\n\nIMPORTANT: your previous attempt failed validation. ${failContext}` },
          ],
        });
        const raw = resp.choices[0]?.message?.content;
        const text = typeof raw === "string" ? raw.trim() : "";
        if (!text) return { ok: false as const, row, failContext };
        const candidate = { ...row, content: text };
        const res = gateOne(candidate);
        if (res.ok) return { ok: true as const, candidate };
        // Still violating — carry it into the next attempt with the FRESH failContext, so each
        // redraft is corrected against what it actually got wrong this time.
        return { ok: false as const, row, failContext: res.failContext || failContext };
      } catch { return { ok: false as const, row, failContext }; }
    }));
    for (const r of retried) {
      if (r.ok) { keptInserts.push(r.candidate); recoveredCount++; }
      else if (attempt < MAX_REGEN) stillFailing.push({ row: r.row, failContext: r.failContext });
    }
    pending = stillFailing;
  }
  if (retryable.length > 0) {
    console.log(
      `[adCopyGenerator] regeneration: ${recoveredCount}/${retryable.length} body variants recovered ` +
      `within ${MAX_REGEN} attempts; ${retryable.length - recoveredCount} exhausted the cap.`,
    );
  }

  // ── BLOCK-RATE INSTRUMENTATION ──────────────────────────────────────────────
  // The gate is the safety net; this number says how well the PROMPTS are doing. blockedFirstPass
  // counts variants the model produced in violation before any regeneration — recoveries do not
  // reduce it, because a recovered variant still represents a draft the prompt should not have
  // produced. See _core/complianceTelemetry.ts.
  {
    const { recordComplianceGate } = await import("./_core/complianceTelemetry");
    recordComplianceGate({
      asset: "adCopy",
      generated: allInserts.length,
      blockedFirstPass,
      recovered: recoveredCount,
      kept: keptInserts.length,
      classes: firstPassClasses,
      labels: retryable.map((r) => String(r.row.bodyAngle ?? "")).filter(Boolean),
    });
  }
  if (droppedClasses.length > 0 && keptInserts.length < allInserts.length) {
    console.warn(
      `[adCopyGenerator] dropped ${allInserts.length - keptInserts.length}/${allInserts.length} variants ` +
      `after retry (classes=[${Array.from(new Set(droppedClasses)).join(",")}]); ${keptInserts.length} kept.`,
    );
  }
  if (keptInserts.length === 0) {
    throw new Error(
      `Every ad-copy variant in this set carried a policy or grounding issue (classes=[${Array.from(new Set(droppedClasses)).join(",")}]). ` +
      `Nothing was saved — regenerate, or add your real figures and client material to your profile first.`,
    );
  }

  // ── P.D.A.F. DISTINCTNESS GATE ──────────────────────────────────────────────
  // Runs AFTER the compliance gate, deliberately: spending distinctness redrafts on a
  // variant that will be hard-blocked anyway is wasted work, and every redraft issued
  // here is re-gated for compliance before it is accepted (see `regenerate` below), so
  // the two gates cannot disagree about what ships.
  //
  // Headlines AND bodies form ONE fused population — publishing recombines them, and the
  // research treats them as two of the three surfaces Meta fuses into a single meaning.
  // Link descriptions are excluded by `partitionPopulation`; they keep their awareness
  // stamp for coordination and are never counted.
  let gatedInserts: typeof keptInserts = keptInserts;
  {
    const { runDistinctnessGate } = await import("./_core/pdafGate");
    const { BODY_ANGLE_PROMPTS: REGEN_ANGLE_PROMPTS } = await import("./adCopyAngles");

    // Row identity before the DB assigns one: position in the kept array. Stable for the
    // life of this call, which is all the gate needs.
    const rowById = new Map<string, any>();
    const idOf = (i: number) => `${keptInserts[i].contentType}#${i}`;

    // GENERATION PARTNERS, recorded so the deck-wide claim can be checked rather than
    // argued. The chaining step paired each body with one headline (bodyPartners, by slot);
    // mapping that back to the headline's gate id lets the ledger say, of every echo it
    // catches, whether the body echoed its OWN partner — which pairwise checking would also
    // have caught — or a DIFFERENT headline in the deck, which only a deck-wide check finds
    // and which is the case that actually ships once publishing recombines the surfaces.
    const headlineIdByText = new Map<string, string>();
    keptInserts.forEach((row, i) => {
      if (row.contentType === "headline") headlineIdByText.set(String(row.content ?? ""), idOf(i));
    });
    const partnerTextByAngle = new Map<string, string>();
    slots.forEach(({ angle }, slotIdx) => {
      const p = bodyPartners[slotIdx];
      if (p) partnerTextByAngle.set(String(angle), p);
    });

    const items: Array<GateItem<string>> = keptInserts.map((row, i) => {
      const id = idOf(i);
      rowById.set(id, row);
      const partnerText = row.contentType === "body"
        ? partnerTextByAngle.get(String(row.bodyAngle ?? ""))
        : undefined;
      return {
        id,
        surface: String(row.contentType),
        text: String(row.content ?? ""),
        partnerId: partnerText ? (headlineIdByText.get(partnerText) ?? null) : null,
        labels: {
          persona: row.persona ?? null,
          desire: row.desire ?? null,
          awareness: row.awareness ?? null,
          format: row.format ?? null,
        },
      };
    });

    const populationSize = items.filter((it) => it.surface !== "link").length;
    const pools = {
      desires: conceptDesires.length ? conceptDesires : (fallbackDesire ? [fallbackDesire] : []),
      awarenessPlan: awarenessPlanForCount(populationSize),
      formats: Array.from(new Set([
        ...headlineAngleList.map((a) => a.key),
        ...availableAngles.map((a) => String(a)),
      ])),
    };

    // Redraft ONE piece at a new position on one axis. Returns null unless the redraft is
    // non-empty AND clears the compliance gate — a distinctness fix that reintroduces a
    // policy violation must never reach the deck.
    const redraft = async (row: any, instruction: string): Promise<string | null> => {
      const resp = await invokeLLM({
        messages: [
          { role: "system", content: `${META_COMPLIANCE_RULES}\n\nYou are an expert ad copywriter who specializes in Meta-compliant advertising for coaches, speakers and consultants.\n\n${NO_CREDENTIAL_FABRICATION_RULE}\n\n${REGISTER_STANDARD}` },
          { role: "user", content: instruction },
        ],
      });
      const raw = resp.choices[0]?.message?.content;
      const text = typeof raw === "string" ? raw.trim() : "";
      if (!text) return null;
      return gateOne({ ...row, content: text }).ok ? text : null;
    };

    const facts = `Service: ${service.name}\nTarget Market: ${input.targetMarket}\nPressing Problem: ${resolvedPressingProblem}\nDesired Outcome: ${resolvedDesiredOutcome}\nUnique Mechanism: ${resolvedUniqueMechanism}`;

    const gateResult = await runDistinctnessGate<string>({
      node: "adCopy (Node 7)",
      items,
      pools,
      // ── Per-surface bands (settled 2026-08-08) ──────────────────────────────
      // One shared band of 12 let three surfaces starve each other: the live run of
      // 2026-08-08 kept 6 headlines / 5 hooks / 1 BODY, because 15 of ~17 bodies were
      // dropped at the cap competing with hooks for the same distinct cells. Each surface
      // now gets its own allowance and cannot spend another's.
      //
      // `image_hook` is capped at the number of images the deck will actually render — a
      // hook with no picture to sit on is not a shippable asset. This is the value that
      // moves when the deck grows 4 -> 8.
      surfaceBands: {
        image_hook: { min: 1, max: IMAGE_HOOK_BAND_MAX },
      },
      // ── The hook's format IS its surface ────────────────────────────────────
      // Taking `format` off the hook's movable axes stops the gate stamping a body/headline
      // taxonomy onto a hook row — the live run produced hooks labelled `pain_agitation`
      // and `story`, vocabularies that describe a body angle rather than a picture line.
      //
      // ⚠️ CONSEQUENCE, STATED PLAINLY: with persona pinned and format now fixed, a hook has
      // exactly TWO movable axes. Two differing axes is precisely the pass threshold, so a
      // hook pair sharing both desire and awareness cannot be recovered at all. That is
      // acceptable at four hooks and gets tighter as the count rises — measure hook recovery
      // rate before growing this surface to eight.
      surfacePools: {
        image_hook: { movable: ["desire", "awareness"] },
      },
      // Hook OPENINGS are now a source, not only a target. Previously `openingRoles` was
      // ["body"], so a hook echoing another hook — or echoing a headline — was structurally
      // invisible: hooks could only ever be the thing echoed.
      antiEcho: { openingRoles: ["body", "image_hook"], targetRoles: ["headline", "image_hook"] },
      regenerate: async ({ item, moves }) => {
        const row = rowById.get(String(item.id));
        if (!row) return null;
        const isBody = row.contentType === "body";
        // EVERY move is written INTO the prompt and stamped on the row. An axis that labels
        // output without changing it is precisely the fake diversity this gate exists to
        // remove — and when the gate says two axes must move to clear the rule, writing only
        // one of them into the prompt would make the row's labels a lie about its text.
        const axisLine = moves.map(({ dimension, value }) =>
          dimension === "desire"
            ? `THE WANT THIS PIECE SPEAKS TO — the single thread it must follow:\n${value}\n\nStay on this one want. Do not cover every reason someone might hire this coach.`
            : dimension === "awareness"
              ? `AWARENESS STAGE — write this to a reader at this stage:\n${String(value).replace(/_/g, " ").toUpperCase()}\n\n${(STAGE_COPY_GUIDANCE as any)[value] ?? (STAGE_HEADLINE_GUIDANCE as any)[value] ?? ""}`
              : `FORMAT — rewrite this using the "${String(value).replace(/_/g, " ")}" angle:\n${isBody ? (REGEN_ANGLE_PROMPTS as any)[value] ?? "" : ""}`,
        ).join("\n\n");

        // ⚠️ BRANCH ON THE SURFACE, NEVER ON `isBody` ALONE. A two-way isBody split sent
        // `image_hook` rows down the HEADLINE path — uncapped and in the wrong voice.
        const surface = redraftSurfaceFor(row.contentType);
        const instruction =
          surface === "body"
            ? `${cascadeContext}You are rewriting ONE ad body copy.\n\n${facts}\n\n${axisLine}\n\n${registerPersonGuidance(hasRealProof)}\n\n${physicalGuidance}\n\nCreate ONE body copy (125-150 words). End with: ${input.adCallToAction}.\nReturn ONLY the body text as a single string.\n\n---\n\nIMPORTANT: an earlier version of this piece was too close to another ad in the same set — the two would be treated as one ad and compete against each other. This rewrite must be a genuinely different piece, not a rewording.`
            : surface === "image_hook"
              ? buildHookRedraftInstruction({
                  cascadeContext,
                  facts,
                  axisLine,
                  register: registerPersonGuidance(hasRealProof),
                })
              : `${cascadeContext}You are rewriting ONE ad HEADLINE.\n\n${facts}\n\n${axisLine}\n\n${registerPersonGuidance(hasRealProof)}\n\nReturn ONLY the headline text as a single string, no quotes, no explanation.\n\n---\n\nIMPORTANT: an earlier version of this headline was too close to another headline in the same set — the two would be treated as one ad and compete against each other. This rewrite must say something genuinely different, not the same thing in other words.`;

        const drafted = await redraft(row, instruction);
        if (!drafted) return null;
        // The ceiling is re-applied HERE as well as in the prompt. A prompt-only rule is a
        // rule the model can run past, which is exactly how the defect reached production.
        const text = surface === "image_hook" ? clampHookText(drafted) : drafted;
        if (!text) return null;
        const nextLabels = { ...item.labels };
        const next: any = { ...row, content: text };
        for (const { dimension, value } of moves) {
          next[dimension] = value;
          (nextLabels as any)[dimension] = value;
          if (dimension === "format" && isBody) next.bodyAngle = value;
          // ⚠️ THE STAMP MUST FOLLOW THE AXIS. The gate moves `desire` to a different value
          // drawn from the same concept-derived pool, so a conceptId left pointing at the
          // ORIGINAL concept would silently become a lie — precisely the label-that-does-
          // not-match-content failure this chapter exists to remove, and invisible because
          // the row would still look fully stamped.
          if (dimension === "desire") next.conceptId = conceptIdFor(value);
        }
        next.selectionScore = String(
          scoreAdContent(isBody ? "body" : "headline", text, isBody ? next.bodyAngle : undefined),
        );
        rowById.set(String(item.id), next);
        return {
          id: item.id,
          surface: item.surface,
          text,
          partnerId: item.partnerId ?? null,
          labels: nextLabels,
        };
      },
      // Deck-wide anti-echo. The avoid list is EVERY headline in the deck, not just the
      // one this body happened to echo — otherwise the redraft simply lands on a
      // different headline and the check fires again next round.
      rewriteEcho: async ({ item, finding, avoidPhrases }) => {
        const row = rowById.get(String(item.id));
        if (!row) return null;

        // ── Hooks are rewritable too ───────────────────────────────────────────
        // This callback used to return null for anything that was not a body, so a hook
        // echo was DETECTED and then silently discarded — the finding went in the ledger
        // and nothing changed. With hook openings now a source, that would have made the
        // new detection useless. A hook rewrite is a fresh short line, not an opening
        // repair, so it takes the hook voice and the hook ceiling.
        if (row.contentType === "image_hook") {
          const hookInstruction = `${cascadeContext}You are rewriting ONE IMAGE HOOK — the short line of text that sits ON the picture itself.\n\n${facts}\n\nTHE PROBLEM: this hook shares wording with another piece running in the same set — the shared phrase is "${finding.shared}". When the picture, the headline and the body all say the same thing, the ad is read as one narrow idea and its variants compete against each other instead of reaching different people.\n\nWORDING ALREADY IN THIS SET — do not reuse any of it:\n${avoidPhrases.map((p) => `- ${p}`).join("\n")}\n\nWHAT AN IMAGE HOOK IS. The picture's line is the emotional hook — the feeling, the moment of recognition. The headline carries the proof or the mechanism; the body carries the context. Your job is the first one only. This is NOT a headline.\n\nHARD RULES:\n- ${HOOK_MAX_CHARS} characters maximum. Shorter is better. It is set large on a photograph.\n- Name the feeling underneath, in words none of the lines above use.\n- Plain words. No colons, no hashtags, no quotation marks, no ALL CAPS, no emoji.\n- No price, no percentage, no statistic, no client result, no credential.\n\nHere is the current hook:\n${row.content}\n\n${registerPersonGuidance(hasRealProof)}\n\nReturn ONLY the hook line as a single string, no quotes, no explanation.`;
          const drafted = await redraft(row, hookInstruction);
          if (!drafted) return null;
          const hookText = clampHookText(drafted);
          if (!hookText) return null;
          const nextRow: any = { ...row, content: hookText };
          rowById.set(String(item.id), nextRow);
          return {
            id: item.id,
            surface: item.surface,
            text: hookText,
            partnerId: item.partnerId ?? null,
            labels: { ...item.labels },
          };
        }

        if (row.contentType !== "body") return null;
        const instruction = `${cascadeContext}You are rewriting the OPENING of ONE ad body copy. Everything else about it stays the same.\n\n${facts}\n\nTHE PROBLEM: this body opens with wording that repeats a headline running in the same set — the shared phrase is "${finding.shared}". When the picture, the headline and the body all say the same thing, the ad is read as one narrow idea and its variants compete against each other instead of reaching different people.\n\nHEADLINES ALREADY IN THIS SET — do not reuse their wording in your opening:\n${avoidPhrases.map((p) => `- ${p}`).join("\n")}\n\nOPENING WORDS — the first sentence carries more weight than any other. The opening 5 to 10 words decide how this ad is categorised and therefore who sees it.\n- Open on the concrete situation, in the vocabulary this field actually uses for it.\n- Do NOT reuse the key nouns and verbs of any headline above.\n- Do NOT open with filler: "Hey", "So", "Look", "Let me tell you", "Imagine", "What if", "Are you tired of", "Ever wondered", "Picture this", "Here's the thing".\n\nHere is the current body copy:\n${row.content}\n\nRewrite it so the opening carries the same meaning in genuinely different words. Keep the length (125-150 words), keep the angle, and end with: ${input.adCallToAction}.\nReturn ONLY the body text as a single string.`;
        const text = await redraft(row, instruction);
        if (!text) return null;
        const next = { ...row, content: text, selectionScore: String(scoreAdContent("body", text, row.bodyAngle)) };
        rowById.set(String(item.id), next);
        return { ...item, text };
      },
    });

    // Links rejoin the deck untouched — excluded from the population, never dropped by it.
    gatedInserts = [
      ...gateResult.kept.map((it) => rowById.get(String(it.id))).filter(Boolean),
      ...gateResult.excluded.map((it) => rowById.get(String(it.id))).filter(Boolean),
    ];

    const { formatLedger } = await import("./_core/pdafGate");
    console.log(formatLedger(gateResult.ledger));
    (globalThis as any).__ZAP_LAST_PDAF_LEDGER__ = gateResult.ledger;
  }

  // Persistence backstop. The per-variant gate above already dropped violators and drives
  // the retry; this catches anything that gate's field selection missed.
  {
    const { gateBeforePersist } = await import("./_core/persistenceGate");
    const __g = await gateBeforePersist("adCopy", gatedInserts as any[]);
    await db.insert(adCopy).values(__g.kept as any);
  }

  // Compliance precompute — must land before runX returns so wizard panel
  // sees ad copy + rewrites atomically. Mirrors prior async behavior.
  // No-op when ENABLE_COMPLIANCE_REWRITES flag is off.
  await precomputeAdCopyComplianceRewrites(
    {
      id: input.userId,
      subscriptionTier: input.userSubscriptionTier ?? null,
      role: input.userRole ?? null,
    },
    adSetId,
    service.category ?? null,
  );

  // Auto-select first ad copy into campaign kit (creates kit if needed)
  try {
    if (icp?.id) {
      const { pickSelectedFromSet } = await import("./_core/pickSelected");
        const __pickedId = await pickSelectedFromSet(db, "adCopy", adSetId);
        const firstRow = __pickedId ? { id: __pickedId } : undefined;
      if (firstRow) {
        const { autoSelectBest } = await import("./routers/campaignKits");
        await autoSelectBest(input.userId, icp.id, "selectedAdCopyId", firstRow.id);
      }
    }
  } catch (e) { console.warn("[auto-select] adCopy failed:", e); }

  // Counts report what was actually PERSISTED, not what was generated. The output gate
  // above drops variants, so returning the pre-drop totals would hand the caller (and the
  // wizard) a number that does not match the deck in the database.
  // keptInserts already includes anything the compliance retry round recovered.
  //
  // ⚠️ COUNTED OFF gatedInserts, NOT keptInserts. keptInserts is the post-COMPLIANCE array;
  // the distinctness gate then evicts, recovers and trims on top of it. Counting the earlier
  // array told the wizard a deck was larger than the database held — the same defect the
  // comment above was written to prevent, reintroduced one layer up when the gate landed.
  const keptOf = (t: string) => gatedInserts.filter((r: any) => r.contentType === t).length;
  return {
    adSetId,
    count: gatedInserts.length,
    headlineCount: keptOf("headline"),
    bodyCount: keptOf("body"),
    linkCount: keptOf("link"),
    imageHookCount: keptOf("image_hook"),
    generatedCount: allInserts.length,
    droppedCount: allInserts.length - gatedInserts.length,
  };
}
