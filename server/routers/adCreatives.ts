import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { adCreatives, services, users, jobs, headlines } from "../../drizzle/schema";
import { eq, and, desc, gte, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateImage } from "../_core/imageGeneration";
import { storagePut } from "../storage";
import { renderAdCreative, resolveAdBodyText, resolveAdBodyTexts } from "../_core/compositeHeadline";
import { resolveCampaignCta } from "../_core/campaignCta";
import { randomBytes, randomUUID } from "crypto";
import { runAdCreativesGeneration, resolveSubjectForService } from "../adCreativesGenerator";
import { subjectClausesForBatch, describeResolution } from "../_core/subjectDescriptor";
import { AD_VARIATIONS, liveStyleFor } from "../_core/adVariations";
import { fitTitle } from "../lib/templates/templatePrimitives";
import { validateCascadePrereqs } from "../_core/cascadeContext";

// Meta-prohibited phrases for compliance checking
const PROHIBITED_PHRASES = [
  "make $",
  "earn money while you sleep",
  "turn $",
  "into $",
  "guaranteed",
  "get rich quick",
  "proven to make money",
  "easy money",
  "fast cash",
];

// Meta-compliant scroll-stopper headline formulas
// These use curiosity, benefit claims, social proof, contrast, challenge, and pain without prohibited language
// Note on curiosity formula: "EXPERTS DON'T TALK ABOUT" is banned Meta suppressed-information framing — replaced
// Note on social_proof fallback: "PROS LOVE THIS" replaced with transformation-implying copy
// IMAGE STYLE GUIDE for future angle-matched creative selection:
//   person_shocked  → best for proof/results angles (concrete outcome, social proof)
//   screenshot      → best for mechanism/demonstration angles (show the tool, show the result)
//   person_intense  → best for identity/authority angles (aspiration, credibility)
//   object          → best for mechanism reveal angles (show the asset or deliverable)
//   person_curious  → best for curiosity/contrarian angles (intrigue, challenge to belief)
//   pain formula    → best for LOSS angles (name the shared pain, create recognition)
// ─── HOUSE HEADLINE LIMIT ────────────────────────────────────────────────────
//
// 38 is ZAP's OWN craft standard — what reads well in the ad-creative image
// templates. It is NOT a Meta rule. Per docs/compliance/META_AD_COMPLIANCE_REFERENCE.md
// §1.4a: Meta publishes **27** characters as a display/truncation recommendation
// under "Text Recommendations", exceeding it is not a policy violation, and
// **neither 38 nor 40 appears anywhere in Meta's documentation**. The old "40"
// in checkCompliance below was unsourced. Never describe this as a Meta limit.
export const AD_HEADLINE_HOUSE_MAX = 38;

/**
 * A (2026-07-31) — recover the mechanism NAME from a field that holds a description.
 *
 * `services.uniqueMechanismSuggestion` is documented as "A proprietary-sounding
 * NAME" (routers/services.ts:194) but is persisted with trunc(…, 65535), so
 * nothing enforces that shape. Measured on production: of 101 services carrying
 * a mechanism, **94 exceed 255 characters** — long enough to blow the
 * `adCreatives.headline` varchar(255) and crash the coach's Generate button
 * outright. Mean length 394, max 622.
 *
 * 93 of those 101 are shaped `Name — description`, so the name is recoverable by
 * splitting on the em-dash. Verified against real rows: this yields
 * "The Skills-to-Title Translation Method" (38), "The Role Translation Method"
 * (27), "The Postpartum Recalibration Protocol" (37) — exactly what the field's
 * own prompt asked for.
 *
 * ⚠️ Extraction alone is NOT sufficient and must never be relied on by itself:
 * after it, service 277's five headlines still measure 52/25/57/54/76 chars.
 * The fit guard below is the load-bearing half. This helper only improves what
 * gets fitted, so the trim lands on a whole name instead of mid-sentence.
 */
export function resolveMechanismName(raw: unknown): string {
  const t = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  // Em-dash, en-dash and " - " all appear as the name/description separator.
  const head = t.split(/\s+[—–-]\s+/)[0]?.trim() ?? t;
  // A separator inside the first few words means this was never a name/description
  // split (e.g. "Skills-to-Title" is hyphenated); fall back to the whole string
  // and let the fit guard handle it rather than returning a fragment.
  return head.length >= 3 ? head : t;
}

/**
 * B (2026-07-31) — the load-bearing guard. Trim-to-fit, NEVER reject.
 *
 * Applied inside every formula below rather than at the four call sites, so a
 * call site cannot forget it and a new one inherits it for free. That is
 * deliberate: the 2026-07-30 site sweep found P8/P6/zone each wired at some
 * call sites and missed at others.
 *
 * Rejection is explicitly not an option here. A length gate that throws already
 * killed a live beginner cascade once — one headline came a single character
 * over 38 and the whole batch was rejected eight nodes into a run
 * (META_AD_COMPLIANCE_REFERENCE §1.4a). Fit and continue.
 *
 * `fitTitle` cuts at a word boundary and appends an ellipsis AFTER cutting to
 * `max`, so its result can be max + 1. We pass max - 1 so the finished headline
 * is never above the house limit.
 */
function fitAdHeadline(s: string): string {
  return fitTitle(s, AD_HEADLINE_HOUSE_MAX - 1);
}

/**
 * "MADE FOR COACHING COACHES" — observed on real service 277, whose
 * `category` is literally "coaching". Appending the noun to a niche that
 * already names the audience reads as a bug. Only used where a noun is
 * appended; "COACHING PROS" and "STILL DOING COACHING…" read fine untouched.
 */
function audienceLabel(niche: string): string {
  const n = String(niche ?? "").replace(/\s+/g, " ").trim();
  if (!n) return "COACHES";
  if (/\bcoaching$/i.test(n)) return n.replace(/\bcoaching$/i, "coaches").toUpperCase();
  if (/\bcoaches$/i.test(n)) return n.toUpperCase();
  if (/\bcoach$/i.test(n)) return `${n}es`.toUpperCase();
  return `${n.toUpperCase()} COACHES`;
}

// ─── FALLBACK HEADLINES — CLAIM-FREE BY CONSTRUCTION (2026-07-30) ───────────
//
// These are TEMPLATE fallbacks, used whenever a caller supplies no LLM-generated
// headlines. Two live paths ALWAYS land here — generateAsync (the coach's
// "Generate Ad Images" button) and generateAdCreativesBatch (the V1 campaign
// dashboard) — so whatever is written here renders onto real ads for real
// coaches. It is not test scaffolding.
//
// The previous versions asserted things nobody had measured: a 90% time
// reduction, a 40-hours-to-4-hours before/after, a retention claim ("don't go
// back"), an adoption trend ("are switching to"), and a population statistic
// ("EVERY … MOST never fix it"). None of it came from the coach; all of it was
// hardcoded here in 2024 and would be published under the coach's name.
//
// RULE FOR ANYONE EDITING THIS BLOCK: a fallback headline may name the offer,
// the niche or the mechanism, and may ask a question. It may NOT assert an
// outcome, a percentage, a timeframe, a quantity, a popularity or a retention
// rate — because at fallback time we have no data for any of those.
//
// The ONE number still permitted is `customers`, and only when it is > 0: that
// value is the coach's own `services.totalCustomers`, supplied by them. When it
// is absent there is no social proof to state, so the fallback states none.
// Every formula runs its mechanism through resolveMechanismName (A) and its
// finished string through fitAdHeadline (B). Both are inside the formula, so
// all four call sites get them and none can skip them.
export const HEADLINE_FORMULAS = {
  benefit: (mechanism: string, niche: string, _customers?: number) =>
    fitAdHeadline(`${resolveMechanismName(mechanism).toUpperCase()}: HOW IT WORKS`),
  social_proof: (mechanism: string, niche: string, customers?: number) =>
    fitAdHeadline(
      customers && customers > 0
        ? `${customers.toLocaleString()}+ ${niche.toUpperCase()} PROS USE THIS ${resolveMechanismName(mechanism).toUpperCase()}`
        : `MADE FOR ${audienceLabel(niche)}`,
    ),
  curiosity: (mechanism: string, niche: string, _customers?: number) =>
    fitAdHeadline(`WHAT ${resolveMechanismName(mechanism).toUpperCase()} ACTUALLY DOES`),
  contrast: (mechanism: string, niche: string, _customers?: number) =>
    fitAdHeadline(`THE OLD WAY, OR ${resolveMechanismName(mechanism).toUpperCase()}`),
  challenge: (mechanism: string, niche: string, _customers?: number) =>
    fitAdHeadline(`STILL DOING ${niche.toUpperCase()} THE OLD WAY? TRY ${resolveMechanismName(mechanism).toUpperCase()}`),
  pain: (mechanism: string, niche: string, _customers?: number) =>
    fitAdHeadline(`ABOUT THAT ${niche.toUpperCase()} PROBLEM`),
};

// Check for Meta compliance issues
export function checkCompliance(headline: string, benefit: string, problem: string): string[] {
  const issues: string[] = [];
  const textToCheck = `${headline} ${benefit} ${problem}`.toLowerCase();
  
  for (const phrase of PROHIBITED_PHRASES) {
    if (textToCheck.includes(phrase.toLowerCase())) {
      issues.push(`Contains prohibited phrase: "${phrase}"`);
    }
  }
  
  // RELABELLED 2026-07-31. This used to read "exceeds 40 characters (Meta
  // recommendation)". The 40 was unsourced and the wording implied Meta gates on
  // headline length — it does not. Meta publishes 27 as a DISPLAY recommendation
  // and exceeding it is not a policy violation
  // (docs/compliance/META_AD_COMPLIANCE_REFERENCE.md §1.4a). This is an advisory
  // about ZAP's own craft standard, and it stays advisory: the fit guard in
  // HEADLINE_FORMULAS already makes over-length structurally impossible on the
  // template path, and a hard length gate has previously killed a live cascade.
  if (headline.length > AD_HEADLINE_HOUSE_MAX) {
    issues.push(
      `Headline exceeds ${AD_HEADLINE_HOUSE_MAX} characters (ZAP house craft standard, not a Meta rule)`,
    );
  }
  
  return issues;
}

// Generate ad image prompt — visual scene only, no text instructions.
// Headline, body and CTA are composited server-side via opentype.js + resvg-js
// after generation (see server/_core/compositeHeadline.ts), so the photograph
// must be a clean plate.
//
// FIX C (2026-07-29) — three changes, all evidenced by the 2026-07-28 run
// (docs/handovers/P6-P8_INVESTIGATION_ad-creatives.md):
//
//  1. The base style no longer asks for a magazine. "Gossip magazine style,
//     tabloid aesthetic" requests a PAGE — masthead, headline, standfirst, body
//     columns. Run v3 rendered exactly that, correctly, with every glyph
//     garbled. We now ask for a photograph, keeping the raw non-studio feel
//     without the publication metaphor.
//
//  2. The old `noText` hard negative ("NO text, NO words, NO letters…") is
//     DELETED. It was concatenated into flux-1.1-pro's POSITIVE prompt — this
//     endpoint has no negative-prompt input, and diffusion conditioning has no
//     logical NOT, so every one of those tokens pushed text toward the image.
//     Same negative-priming failure CLAUDE.md §14 bans for LLM prompts. The
//     only lever that works is not naming text at all; the surrounding
//     description now carries the clean-surface requirement positively.
//
//  3. Green circle / arrow / checkmark annotations are DROPPED. An empty
//     callout is the most caption-inviting shape in a frame — run v4's
//     "Parenting books" and "Baby time parents" were Flux labelling the bubbles
//     it was told to draw. Annotations, if wanted, belong in the resvg layer
//     that already draws the headline, body and CTA in real type.
export function generateAdImagePrompt(
  style: string,
  niche: string,
  problem: string,
  uglyMode = false,
  // P6 cause 2: the resolved subject clause for THIS variation slot, from
  // subjectDescriptor.subjectClause(). Optional so the legacy call sites keep
  // their previous behaviour — omitted falls back to the neutral wording, which
  // is exactly what those sites rendered before.
  subject?: string,
): string {
  const baseStyle = uglyMode
    ? "Raw UGC aesthetic, shot on iPhone, unpolished and authentic, slightly messy real-world environment, natural handheld camera shake, lit only by whatever light is already in the room, bare skin and everyday hair, low-budget realism, observational documentary style, native social feed feel"
    : "Candid documentary photograph, available light, dramatic directional lighting, high contrast, shallow depth of field, phone-quality realism rather than polished studio work";

  // P6 cause 1 (2026-07-29): nicheContext is STYLE-AWARE. It used to be a single
  // person-worded string appended to all five styles, including the two that are
  // explicitly person-free — so the `object` prompt read "…no person in frame.
  // […] The person and setting must visually match … their clothing, environment
  // and expression…", contradicting itself four words later. That is why the
  // object slot kept returning a person. It predates fix C, and the fix-C re-run
  // (upsampling OFF) still drifted, which ruled out prompt_upsampling as the cause.
  const nicheContextPerson = `The person and setting must visually match the ${niche} niche — their clothing, environment, and expression must be recognisable to someone in that world. A fitness coach's client looks different from a crypto trader's client looks different from a corporate executive's client.`;
  const nicheContextSetting = `The setting, props and styling must visually match the ${niche} niche — the room, surfaces and objects must be recognisable to someone in that world. A fitness coach's workspace looks different from a crypto trader's looks different from a corporate executive's.`;
  // NEGATION SWEEP (2026-07-30). This string used to open "Do not generate images
  // that imply medical treatment, guaranteed financial results, or dramatic
  // physical before/after transformation" — it NAMED all three failure shapes in
  // order to ban them, which on a diffusion model is how you request them. Same
  // mechanism CLAUDE.md §14 documents for LLM prompts and the same trap that put
  // text in frame via the deleted `noText` string. Restated as the picture we want.
  //
  // L4 (2026-07-31) — STYLE-AWARE. The single shared version said "The image shows
  // an ordinary PERSON in an ordinary moment of their working life" and was
  // appended to all five styles, so the two person-free still lifes carried
  // person-wording four words from "an object study only". That is the FOURTH
  // instance of this class (P6 cause 1 nicheContext, the composition clause, and
  // now this) and it was introduced by the negation sweep itself. Same failure
  // mode every time: one string written for the person styles, pasted onto the
  // still lifes without re-reading it there.
  const complianceNotePerson = `The image shows an ordinary person in an ordinary moment of their working life — aspiration and possibility, held in an everyday setting.`;
  const complianceNoteStill = `The mood is ordinary and grounded — aspiration and possibility in an everyday working life.`;

  // P6: `problem` was a DEAD parameter — passed by all five call sites,
  // interpolated into none of the templates. That is why the 2026-07-28 v1 showed
  // a newborn for an ICP whose baby is seven months old: nothing about the actual
  // scenario reached the image. Now carried as a scene constraint. Trimmed at a
  // word boundary — the raw painPoints field can be several sentences, and a long
  // tail dilutes the rest of the prompt.
  const gist = (s: string, max: number): string => {
    const t = (s ?? "").replace(/\s+/g, " ").trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const lastSpace = cut.lastIndexOf(" ");
    return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max)}…`;
  };
  const problemGist = gist(problem, 180);
  const scene = problemGist
    ? `The moment depicted should be recognisable to someone living this situation: ${problemGist}`
    : "";

  // Positive framing of the clean-plate requirement. Describes what the surfaces
  // ARE (blank, plain, unmarked) rather than listing what must not appear —
  // naming "text"/"letters"/"captions" at all is what put them in the frame.
  const cleanPlate = "Every surface in frame is blank and unmarked: plain walls, unbranded plain objects, blank paper, blank screens, plain untitled book covers, plain clothing in solid colours. A purely photographic scene with clear empty space around the subject.";

  // Positive framing: describes the person to depict, never the one to avoid.
  const who = subject && subject.trim() ? subject.trim() : "Person (30-45 years old)";

  // ZONE CONTRACT, prompt half (2026-07-29). The compositor stacks headline +
  // body + CTA upward from the bottom edge and cannot see the photograph, so
  // whatever occupies the lower half of the frame gets text laid over it — which
  // is how headlines ended up across a mouth, an arm and a chest.
  //
  // Editorial has always had this contract (its zone "matches the zone the
  // editorial photo prompt was told to leave clean"); tabloid had NEITHER half.
  // This is the prompt half; `zone: "lower"` in renderAdCreative is the other.
  //
  // Stated as the composition we WANT. Diffusion has no logical NOT, and this
  // codebase has now been bitten twice by phrasing a requirement as an absence:
  // the deleted `noText` string, and "No people in the frame" which Flux ignored
  // on the same run where "an object study only" worked.
  // STYLE-AWARE, for the same reason nicheContext had to be: a person-worded
  // composition line on a still-life style is a self-contradiction, and that is
  // exactly what kept putting people in the `object` frame.
  //
  // ⚠️ SELF-CONTRADICTION FIXED 2026-07-29 (bake-off finding). The first draft
  // asked for the subject "framed from the chest up" AND for "the lower half
  // calm open space". A chest-up portrait fills the frame with torso by
  // definition — those two cannot both hold, and all THREE models in the
  // bake-off duly filled the lower half with body. That was our prompt losing
  // to itself, not a model failure, and it is the same class as nicheContext
  // being person-worded on the still-life styles.
  //
  // Resolved by changing the SHOT rather than the wording: pull back to a
  // medium-wide frame, put the head in the upper third, and give the lower half
  // to a foreground surface falling into shadow. That is a real photograph a
  // photographer could take, and the scrim then darkens an area that is already
  // low-detail instead of fighting a lit torso.
  // ─── OBJECT SLOT RETIRED, 2026-08-01 ───────────────────────────────────────
  //
  // The `object` template and its four object-only strings (nicheContextObject,
  // seamlessBackdropObject, cleanPlateObject, unmarkedSurfacesObject) lived here
  // and were deleted with the slot. Three successive prompt layers each closed
  // the text vector they named and the leak moved to the next surface —
  // background signage, then engraved plinths, then embroidered fabric and a
  // debossed block. See _core/adVariations.ts for the full disposition.
  //
  // ⚠️ WHAT STAYED. `cleanPlate`, `compositionSetting`, `nicheContextSetting`
  // and `complianceNoteStill` are SHARED with the `screenshot` style and are
  // untouched. `complianceNoteStill` in particular was CREATED by the L4 object
  // work — a git-revert of the L1–L5 commits would drag it back into the
  // person-worded `complianceNotePerson` and silently regress screenshot. That
  // is why this was deleted surgically by identifier and never reverted.
  const compositionPerson = "Composed for a portrait-format advertisement: a medium-wide shot with the subject seated behind a plain table or against a plain wall, their head and shoulders in the upper third of the frame and the camera far enough back to include space around them. The lower half of the picture is the bare foreground surface falling away into shadow — a calm, dark, low-detail area of plain, unbroken surface.";
  const compositionSetting = "Composed for a portrait-style advertisement: the main object sits high in the frame, in the upper half, with the arrangement kept to the top of the picture. The lower half of the image is calm open space — bare surface or softly defocused background — an unbroken area with room to breathe below.";

  const stylePrompts = {
    person_shocked: `${baseStyle}. ${who} dressed and styled for the ${niche} world, with EXCITED expression, wide eyes, enthusiastic smile, gesturing toward the camera. Dark grey/black background. ${nicheContextPerson} ${scene} ${compositionPerson} ${cleanPlate} ${complianceNotePerson}`,

    // "No people in the frame" was a bare NEGATION and Flux ignored it — the same
    // trap as the deleted noText string. The `object` style's positively-framed
    // "an object study only" worked on the identical run. Positive framing only.
    screenshot: `${baseStyle}. An unattended desk at night, photographed as a still life: a laptop open at an angle on a dark surface, its screen showing a plain abstract chart shape in flat blocks of colour, a cold coffee cup beside it. The room is empty, the chair pushed back. ${nicheContextSetting} ${scene} ${compositionSetting} ${cleanPlate} ${complianceNoteStill}`,

    person_intense: `${baseStyle}. ${who} dressed and styled for the ${niche} world, with CONFIDENT expression, serious face, leaning forward, direct eye contact. Dark background with a spotlight on the face. ${nicheContextPerson} ${scene} ${compositionPerson} ${cleanPlate} ${complianceNotePerson}`,

    person_curious: `${baseStyle}. ${who} dressed and styled for the ${niche} world, with INTRIGUED expression, raised eyebrow, interested smile, head tilted. Dark grey background. ${nicheContextPerson} ${scene} ${compositionPerson} ${cleanPlate} ${complianceNotePerson}`,
  };

  return stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.person_shocked;
}

// Free-tier ad image gate — stops trial/free users from spamming Generate or
// Regenerate. Each click triggers a paid Replicate image call, so unlimited
// free usage is a direct money leak. Paid tiers (pro/agency) are ungated here
// (separate credit-deduction sprint will cover them).
// Threshold: once the user has ≥ FREE_TIER_AD_IMAGE_LIMIT total adCreatives
// rows across all their campaigns, both Generate and Regenerate are blocked.
const FREE_TIER_AD_IMAGE_LIMIT = 2;

async function enforceFreeTierAdImageGate(
  userId: number,
  subscriptionTier: string | null | undefined,
  userRole: string | null | undefined,
): Promise<void> {
  // Superusers and paid tiers (pro/agency) are ungated
  if (userRole === "superuser") return;
  const tier = subscriptionTier || "trial";
  if (tier !== "trial") return;

  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  const [row] = await db
    .select({ n: count() })
    .from(adCreatives)
    .where(eq(adCreatives.userId, userId));

  const total = row?.n ?? 0;
  if (total >= FREE_TIER_AD_IMAGE_LIMIT) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Free tier ad image limit reached. Upgrade to Pro to regenerate.",
    });
  }
}

const generateAdCreativesSchema = z.object({
  serviceId: z.coerce.number(),
  niche: z.string().min(1, "Niche is required"),
  productName: z.string().min(1, "Product name is required"),
  uniqueMechanism: z.string().optional(),
  targetAudience: z.string().min(1, "Target audience is required"),
  mainBenefit: z.string().min(1, "Main benefit is required"),
  pressingProblem: z.string().min(1, "Pressing problem is required"),
  adType: z.enum(["lead_gen", "ecommerce"]).default("lead_gen"),
});

/**
 * Verify the submitted headlineId belongs to a Node 6 headline for this
 * campaign's service, and return the authoritative text from the DB so the
 * caller composites with server-trusted bytes — never the client's string.
 *
 * Contract: id match, not text match. Eliminates a class of bugs tied to the
 * headlines column's collation (utf8mb4_unicode_ci is case-insensitive, so a
 * text-based `eq(headlines.headline, x)` would false-match "hello" against
 * "Hello"), trailing-whitespace stripping, and Unicode normalization drift
 * through tRPC serialization. Also makes a future "edit headline" feature on
 * Node 6 safe — the id is stable across edits.
 *
 * Ownership: filters on userId AND serviceId so another user's or another
 * campaign's headline can't be passed off as this campaign's.
 */
async function assertHeadlineIsApproved(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  serviceId: number | null,
  headlineId: number,
): Promise<{ headline: string }> {
  if (serviceId == null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Headline must be selected from your campaign's approved headlines.",
    });
  }
  const [match] = await db
    .select({ headline: headlines.headline })
    .from(headlines)
    .where(and(
      eq(headlines.id, headlineId),
      eq(headlines.userId, userId),
      eq(headlines.serviceId, serviceId),
    ))
    .limit(1);
  if (!match) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Headline must be selected from your campaign's approved headlines.",
    });
  }
  return { headline: match.headline };
}

export const adCreativesRouter = router({
  // List all ad creative batches for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const creatives = await db
      .select()
      .from(adCreatives)
      .where(eq(adCreatives.userId, ctx.user.id))
      .orderBy(desc(adCreatives.createdAt));
    
    // Group by batchId
    const batches = new Map<string, typeof creatives>();
    for (const creative of creatives) {
      const batchId = creative.batchId || `single-${creative.id}`;
      if (!batches.has(batchId)) {
        batches.set(batchId, []);
      }
      batches.get(batchId)!.push(creative);
    }
    
    return Array.from(batches.values()).map(batch => ({
      batchId: batch[0].batchId || `single-${batch[0].id}`,
      creatives: batch,
      createdAt: batch[0].createdAt,
      niche: batch[0].niche,
      productName: batch[0].productName,
    }));
  }),

  // Get single batch by batchId
  getBatch: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      
      const creatives = await db
        .select()
        .from(adCreatives)
        .where(
          and(
            eq(adCreatives.userId, ctx.user.id),
            eq(adCreatives.batchId, input.batchId)
          )
        )
        .orderBy(adCreatives.variationNumber);
      
      if (creatives.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Batch not found",
        });
      }
      
      return creatives;
    }),

  // Generate 5 ad creative variations.
  // Phase C C1 refactor: generation logic extracted to runAdCreativesGeneration
  // (server/adCreativesGenerator.ts) so the Auto Mode orchestrator can call it
  // directly. This mutation now wraps the gen-core with the existing wizard-
  // facing return shape (batchId + creatives[] for backward compat with the
  // V2 wizard's AdCreativesGenerator page, which reads data.batchId only —
  // creatives[] is preserved defensively for any other consumer not surfaced
  // in the kit-13/14/15 audits).
  generate: protectedProcedure
    .input(generateAdCreativesSchema)
    .mutation(async ({ ctx, input }) => {
      const prereqs = await validateCascadePrereqs(ctx.user.id, input.serviceId, "adCopy");
      if (!prereqs.ok) throw new TRPCError({ code: "PRECONDITION_FAILED", message: prereqs.message });

      const { batchId } = await runAdCreativesGeneration({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        niche: input.niche,
        productName: input.productName,
        uniqueMechanism: input.uniqueMechanism,
        targetAudience: input.targetAudience,
        mainBenefit: input.mainBenefit,
        pressingProblem: input.pressingProblem,
        adType: input.adType,
      });

      // Re-fetch the batch's rows for the wizard-facing return shape.
      // ~1 extra query vs the inline-collection pattern; acceptable cost
      // for single-source-of-truth on the generation logic.
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const rows = await db
        .select()
        .from(adCreatives)
        .where(and(eq(adCreatives.userId, ctx.user.id), eq(adCreatives.batchId, batchId)))
        .orderBy(adCreatives.variationNumber);

      return {
        batchId,
        creatives: rows.map((r) => ({
          id: r.id,
          headline: r.headline,
          imageUrl: r.imageUrl,
          style: r.designStyle,
          formula: r.headlineFormula,
          complianceIssues: r.complianceIssues ? JSON.parse(r.complianceIssues) : [],
        })),
        message: "5 ad creatives generated successfully",
      };
    }),

  // Delete batch
  deleteBatch: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      
      await db
        .delete(adCreatives)
        .where(
          and(
            eq(adCreatives.userId, ctx.user.id),
            eq(adCreatives.batchId, input.batchId)
          )
        );
      
      return { success: true };
    }),

  // Regenerate a single ad creative by ID — async job pattern to avoid
  // Cloudflare's 100s read timeout killing the connection during Flux generation.
  // Returns { jobId } immediately; client polls /api/jobs/:jobId for completion.
  regenerateSingle: protectedProcedure
    .input(z.object({
      id: z.number(),
      // Optional: override the stored headline with a new one, identified by
      // its Node 6 headlines.id. When provided, the server resolves the id to
      // the authoritative headline text and composites with that; the row's
      // headline column is updated so subsequent regenerates reuse it.
      headlineOverrideId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Free-tier gate — block regenerate once the user has ≥ 2 ad creatives
      await enforceFreeTierAdImageGate(ctx.user.id, ctx.user.subscriptionTier, ctx.user.role);

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Validate the creative exists before firing the job
      const [existing] = await db
        .select()
        .from(adCreatives)
        .where(and(eq(adCreatives.id, input.id), eq(adCreatives.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Creative not found" });
      }

      // Compliance gate: if caller supplied a new headlineId, resolve it
      // through the approved-Node-6 helper and use the DB's text downstream.
      // Skip entirely when no override — existing.headline was already
      // compliance-checked when the row was generated.
      // Stage 3: ad images always use the campaign's short ad headline — the
      // long landing-page (Node-6) headline override is retired, so we ignore
      // input.headlineOverrideId and regenerate on the existing headline.
      const overrideHeadline: string | null = null;

      // Persist the new headline now so it survives even if the background
      // job fails — user's edit is preserved and visible on retry.
      const nextHeadline = overrideHeadline ?? existing.headline ?? "";
      if (overrideHeadline) {
        await db
          .update(adCreatives)
          .set({ headline: nextHeadline })
          .where(and(eq(adCreatives.id, input.id), eq(adCreatives.userId, ctx.user.id)));
      }

      // Create job record and return immediately — pipeline runs in background
      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(ctx.user.id), status: "pending" });

      const capturedUserId  = ctx.user.id;
      const capturedId      = input.id;
      // Retired styles remapped explicitly — see liveStyleFor(). A historical
      // `object` row must not re-enter the retired prompt path on regenerate.
      const capturedStyle   = liveStyleFor(existing.designStyle);
      const capturedNiche   = existing.niche;
      const capturedProblem = existing.pressingProblem;
      const capturedHeadline = nextHeadline;
      const capturedServiceId  = existing.serviceId;
      const capturedCampaignId = existing.campaignId;
      const capturedStyleType  = existing.styleType;

      setImmediate(async () => {
        try {
          const { getDb: getDbBg }                    = await import("../db");
          const { eq: eqBg, and: andBg }              = await import("drizzle-orm");
          const { adCreatives: adCreativesTable, jobs: jobsTable } = await import("../../drizzle/schema");
          const { generateImage: genImg }             = await import("../_core/imageGeneration");
          const { storagePut: s3Put }                 = await import("../storage");
          const { renderAdCreative: doRender, resolveAdBodyText: resolveBody } = await import("../_core/compositeHeadline");
          const { resolveCampaignCta: resolveCta }    = await import("../_core/campaignCta");
          const { generateEditorialImage: genEditorial } = await import("../_core/imageGeneration");
          const { buildEditorialPrompt, generateEditorialSceneBriefs } = await import("../_core/editorialPrompt");
          const bgDb = await getDbBg();
          if (!bgDb) throw new Error("Database not available in background job");

          console.log(`[adCreatives.regenerateSingle] Job ${jobId} — regenerating creative ${capturedId} (styleType=${capturedStyleType})`);

          // Editorial-aware + headline-driven: regenerate an editorial creative on
          // the flux-2 gold-on-black recipe with a scene derived from THIS
          // creative's headline (micro-call, falls back per-slot internally).
          const editorialScene = capturedStyleType === "editorial"
            ? (await generateEditorialSceneBriefs([capturedHeadline], capturedNiche))[0]
            : null;

          const imageResult = editorialScene
            ? await genEditorial({ prompt: buildEditorialPrompt(editorialScene, capturedNiche), aspectRatio: "4:5" })
            : await genImg({ prompt: generateAdImagePrompt(capturedStyle, capturedNiche, capturedProblem) });
          if (!imageResult.url) throw new Error("Failed to generate replacement image");

          const imageResponse = await fetch(imageResult.url);
          const rawBuffer = Buffer.from(await imageResponse.arrayBuffer());

          // Dual upload — raw Flux stays around so future recompositeText
          // calls start from a clean background.
          const rawKey = `ad-creatives/${capturedUserId}/raw-regen-${capturedId}-${Date.now()}.png`;
          const { url: rawImageUrl } = await s3Put(rawKey, rawBuffer, "image/png");
          const [rgCta, rgBody] = await Promise.all([
            resolveCta(bgDb, { campaignId: capturedCampaignId, serviceId: capturedServiceId }),
            resolveBody(bgDb, capturedUserId, capturedServiceId),
          ]);
          const compositedBuffer = await doRender(rawBuffer, { headline: capturedHeadline, bodyText: rgBody, ctaLabel: rgCta, zone: editorialScene?.zone });
          const fileKey = `ad-creatives/${capturedUserId}/regen-${capturedId}-${Date.now()}.png`;
          const { url: s3Url } = await s3Put(fileKey, compositedBuffer, "image/png");

          await bgDb
            .update(adCreativesTable)
            .set({ imageUrl: s3Url, rawImageUrl })
            .where(andBg(eqBg(adCreativesTable.id, capturedId), eqBg(adCreativesTable.userId, capturedUserId)));

          await bgDb
            .update(jobsTable)
            .set({ status: "complete", result: JSON.stringify({ id: capturedId, imageUrl: s3Url }) })
            .where(eqBg(jobsTable.id, jobId));

          console.log(`[adCreatives.regenerateSingle] Job ${jobId} complete — new URL: ${s3Url}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[adCreatives.regenerateSingle] Job ${jobId} failed:`, errorMessage);
          try {
            const { getDb: getDbBg2 } = await import("../db");
            const { eq: eqBg2 }       = await import("drizzle-orm");
            const { jobs: jobsTable2 } = await import("../../drizzle/schema");
            const bgDb2 = await getDbBg2();
            if (bgDb2) {
              await bgDb2
                .update(jobsTable2)
                .set({ status: "failed", error: errorMessage.slice(0, 1024) })
                .where(eqBg2(jobsTable2.id, jobId));
            }
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  /**
   * makeVertical — on-demand 9:16 (1080x1920) for the concept the user picks,
   * for TikTok / Reels / Stories / Shorts. Reuses THIS creative's persisted
   * scene (editorial) so the vertical is the same art-directed shoot as its feed
   * version — one flux call at 9:16, template reflowed (safe-zone aware). Tabloid
   * reconstructs its deterministic photo prompt (no scene needed). Stores the
   * result in verticalImageUrl; the feed imageUrl is left untouched.
   */
  makeVertical: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await enforceFreeTierAdImageGate(ctx.user.id, ctx.user.subscriptionTier, ctx.user.role);

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [existing] = await db
        .select()
        .from(adCreatives)
        .where(and(eq(adCreatives.id, input.id), eq(adCreatives.userId, ctx.user.id)))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Creative not found" });

      // Editorial verticals need the persisted scene to stay one-shoot with the
      // feed version. Legacy editorial rows (pre-sceneBrief) can't reproduce the
      // exact shoot — the UI hides the button for them; guard here too.
      const isEditorial = existing.styleType === "editorial";
      if (isEditorial && !existing.sceneBrief) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This creative predates vertical support — regenerate it first to enable Make Vertical.",
        });
      }

      // Comparison cards are the ONE template style with genuine 9:16 support:
      // they persist {palette, pairs}, so the vertical re-renders the SAME card
      // (pure-render, no Flux) restacked into the tall UI-safe layout. Handle
      // this here — synchronously, no image job — BEFORE the template-card guard
      // below (comparison cards also dual-write rawImageUrl === imageUrl).
      if (existing.comparisonPairs != null) {
        const { renderComparisonCard } = await import("../_core/renderComparisonCard");
        const cp = existing.comparisonPairs as { palette?: string; pairs?: { them: string; us: string }[] };
        if (!cp?.pairs?.length) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This comparison card can't be made vertical — regenerate it first." });
        }
        const vBuf = await renderComparisonCard({
          method: existing.uniqueMechanism || "our method",
          pairs: cp.pairs,
          palette: cp.palette,
          width: 1080,
          height: 1920,
        });
        const fileKey = `ad-creatives/${ctx.user.id}/vertical-${input.id}-${Date.now()}.png`;
        const { url: s3Url } = await storagePut(fileKey, vBuf, "image/png");
        await db
          .update(adCreatives)
          .set({ verticalImageUrl: s3Url })
          .where(and(eq(adCreatives.id, input.id), eq(adCreatives.userId, ctx.user.id)));
        return { jobId: null as string | null, verticalImageUrl: s3Url };
      }

      // Template cards (Quote / Notification / Testimonial) are pure-typography
      // renders with no separate Flux background — the generator dual-writes
      // rawImageUrl === imageUrl. There is no 9:16 template renderer yet, so a
      // vertical here would fall through to the deterministic Flux photo path and
      // return an image unrelated to the chosen card. Refuse (the UI also hides
      // the button). Bug A: correct-by-hiding until a true template vertical exists.
      const isTemplateCard = existing.rawImageUrl != null && existing.rawImageUrl === existing.imageUrl;
      if (isTemplateCard) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Vertical (9:16) isn't available for template card styles yet.",
        });
      }

      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(ctx.user.id), status: "pending" });

      const capturedUserId    = ctx.user.id;
      const capturedId        = input.id;
      // Retired styles remapped explicitly — see liveStyleFor().
      const capturedStyle     = liveStyleFor(existing.designStyle);
      const capturedNiche     = existing.niche;
      const capturedProblem   = existing.pressingProblem;
      const capturedHeadline  = existing.headline ?? "";
      const capturedServiceId = existing.serviceId;
      const capturedCampaignId = existing.campaignId;
      const capturedScene     = existing.sceneBrief as { zone?: "left" | "bottom" } | null;
      const capturedIsEditorial = isEditorial;

      setImmediate(async () => {
        try {
          const { getDb: getDbBg }       = await import("../db");
          const { eq: eqBg, and: andBg } = await import("drizzle-orm");
          const { adCreatives: adCreativesTable, jobs: jobsTable } = await import("../../drizzle/schema");
          const { generateImage: genImg, generateEditorialImage: genEditorial } = await import("../_core/imageGeneration");
          const { storagePut: s3Put }    = await import("../storage");
          const { renderAdCreative: doRender, resolveAdBodyText: resolveBody } = await import("../_core/compositeHeadline");
          const { resolveCampaignCta: resolveCta } = await import("../_core/campaignCta");
          const { buildEditorialPrompt } = await import("../_core/editorialPrompt");
          const bgDb = await getDbBg();
          if (!bgDb) throw new Error("Database not available in background job");

          console.log(`[adCreatives.makeVertical] Job ${jobId} — vertical for creative ${capturedId} (editorial=${capturedIsEditorial})`);

          // Same scene, taller canvas (editorial); deterministic prompt (tabloid).
          const imageResult = capturedIsEditorial
            ? await genEditorial({ prompt: buildEditorialPrompt(capturedScene as any, capturedNiche), aspectRatio: "9:16" })
            : await genImg({ prompt: generateAdImagePrompt(capturedStyle, capturedNiche, capturedProblem), aspectRatio: "9:16" });
          if (!imageResult.url) throw new Error("Failed to generate vertical image");

          const rawBuffer = Buffer.from(await (await fetch(imageResult.url)).arrayBuffer());
          const [vCta, vBody] = await Promise.all([
            resolveCta(bgDb, { campaignId: capturedCampaignId, serviceId: capturedServiceId }),
            resolveBody(bgDb, capturedUserId, capturedServiceId),
          ]);
          // renderAdCreative auto-detects the vertical canvas (H/W ≥ 1.5) and
          // reflows into the platform-UI-safe zone. zone = the stored editorial
          // column (tabloid → undefined = centered).
          const compositedBuffer = await doRender(rawBuffer, {
            headline: capturedHeadline, bodyText: vBody, ctaLabel: vCta, zone: capturedScene?.zone,
          });
          const fileKey = `ad-creatives/${capturedUserId}/vertical-${capturedId}-${Date.now()}.png`;
          const { url: s3Url } = await s3Put(fileKey, compositedBuffer, "image/png");

          await bgDb
            .update(adCreativesTable)
            .set({ verticalImageUrl: s3Url })
            .where(andBg(eqBg(adCreativesTable.id, capturedId), eqBg(adCreativesTable.userId, capturedUserId)));

          await bgDb
            .update(jobsTable)
            .set({ status: "complete", result: JSON.stringify({ id: capturedId, verticalImageUrl: s3Url }) })
            .where(eqBg(jobsTable.id, jobId));

          console.log(`[adCreatives.makeVertical] Job ${jobId} complete — vertical URL: ${s3Url}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[adCreatives.makeVertical] Job ${jobId} failed:`, errorMessage);
          try {
            const { getDb: getDbBg2 } = await import("../db");
            const { eq: eqBg2 }       = await import("drizzle-orm");
            const { jobs: jobsTable2 } = await import("../../drizzle/schema");
            const bgDb2 = await getDbBg2();
            if (bgDb2) {
              await bgDb2
                .update(jobsTable2)
                .set({ status: "failed", error: errorMessage.slice(0, 1024) })
                .where(eqBg2(jobsTable2.id, jobId));
            }
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  /**
   * recompositeText — cheap text-only refresh on an existing ad creative.
   *
   * Fetches the current Cloudinary image, composites the new headline onto it,
   * uploads the result as a new image, and updates the row. Does NOT call Flux,
   * does NOT create a background job, does NOT count toward the free-tier gate.
   *
   * Returns the new imageUrl synchronously — the operation is typically < 3 s
   * (fetch + opentype.js path emit + resvg raster + Cloudinary upload).
   */
  recompositeText: protectedProcedure
    .input(z.object({
      id: z.number(),
      headlineId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Ownership check — same pattern as regenerateSingle
      const [existing] = await db
        .select()
        .from(adCreatives)
        .where(and(eq(adCreatives.id, input.id), eq(adCreatives.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Creative not found" });
      }

      // Stage 3: ad images ALWAYS use the campaign's own short ad headline —
      // the long landing-page (Node-6) headline swap is retired. We ignore the
      // supplied headlineId and re-render with the creative's existing headline.
      // (assertHeadlineIsApproved retained as an import for the ownership shape;
      // the picker UI in V2AdImageCreator is now redundant — retire follow-up.)
      const newHeadline = existing.headline ?? "";

      console.log(`[adCreatives.recompositeText] Creative ${input.id} — new headline="${newHeadline.slice(0, 60)}"`);

      // Prefer the raw Flux output as the background so the new headline sits
      // on a clean image (no ghost pixels from the previous headline).
      // Legacy rows predating the rawImageUrl column fall back to the composited
      // imageUrl with a warning — still works, just with the ghost-pixel caveat
      // until the row is fully regenerated.
      let bgSource: string;
      if (existing.rawImageUrl) {
        bgSource = existing.rawImageUrl;
      } else {
        console.error(`[adCreatives.recompositeText][LEGACY] Creative ${input.id} has no rawImageUrl — falling back to composited imageUrl. Old headline pixels may bleed through.`);
        bgSource = existing.imageUrl;
      }

      const bgResponse = await fetch(bgSource);
      if (!bgResponse.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch existing image (${bgResponse.status})`,
        });
      }
      const bgBuffer = Buffer.from(await bgResponse.arrayBuffer());

      const [rcCta, rcBody] = await Promise.all([
        resolveCampaignCta(db, { campaignId: existing.campaignId, serviceId: existing.serviceId }),
        resolveAdBodyText(db, ctx.user.id, existing.serviceId),
      ]);
      const compositedBuffer = await renderAdCreative(bgBuffer, {
        headline: newHeadline,
        bodyText: rcBody,
        ctaLabel: rcCta,
      });

      const fileKey = `ad-creatives/${ctx.user.id}/recomp-${input.id}-${Date.now()}.png`;
      const { url: newImageUrl } = await storagePut(fileKey, compositedBuffer, "image/png");

      // Persist the new headline and composited URL only. rawImageUrl is
      // immutable per row — it's the original Flux background and should
      // never change unless the full image is regenerated.
      await db
        .update(adCreatives)
        .set({ headline: newHeadline, imageUrl: newImageUrl })
        .where(and(eq(adCreatives.id, input.id), eq(adCreatives.userId, ctx.user.id)));

      console.log(`[adCreatives.recompositeText] Creative ${input.id} — new URL: ${newImageUrl}`);

      return { id: input.id, imageUrl: newImageUrl, headline: newHeadline };
    }),

  // Rate creative
  rate: protectedProcedure
    .input(z.object({
      id: z.number(),
      rating: z.number().min(0).max(5),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      
      await db
        .update(adCreatives)
        .set({ rating: input.rating })
        .where(
          and(
            eq(adCreatives.id, input.id),
            eq(adCreatives.userId, ctx.user.id)
          )
        );
      
      return { success: true };
    }),

  /**
   * getLatestByServiceId — returns the most recent batch for a given serviceId.
   * Used by V2AdImageCreator to reload the last result on page revisit.
   */
  getLatestByServiceId: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [latest] = await db
        .select()
        .from(adCreatives)
        .where(
          and(
            eq(adCreatives.userId, ctx.user.id),
            eq(adCreatives.serviceId, input.serviceId)
          )
        )
        .orderBy(desc(adCreatives.createdAt))
        .limit(1);
      if (!latest || !latest.batchId) return null;
      const batch = await db
        .select()
        .from(adCreatives)
        .where(
          and(
            eq(adCreatives.userId, ctx.user.id),
            eq(adCreatives.batchId, latest.batchId)
          )
        )
        .orderBy(adCreatives.variationNumber);
      return { batchId: latest.batchId, creatives: batch };
    }),

  /**
   * generateAsync — wraps the synchronous generate in the standard V2 background
   * job pattern. Returns jobId immediately; image generation runs via setImmediate.
   * On completion stores { batchId } in jobs.result.
   */
  generateAsync: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      icpId: z.number().optional(),
      visualStyle: z.string().optional(),
      imageFormat: z.string().optional(),
      uglyMode: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Free-tier gate — block generate once the user has ≥ 2 ad creatives
      await enforceFreeTierAdImageGate(ctx.user.id, ctx.user.subscriptionTier, ctx.user.role);

      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Pre-fetch service data synchronously before setImmediate
      const serviceRows = await db
        .select()
        .from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id)))
        .limit(1);
      if (serviceRows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
      }
      const svc = serviceRows[0];
      const capturedUserId = ctx.user.id;
      const capturedInput = { ...input };
      const capturedSvc = { ...svc };
      // Create job record
      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(capturedUserId), status: "pending" });
      // Fire background generation
      setImmediate(async () => {
        try {
          const { getDb: getDbBg } = await import("../db");
          const { eq: eqBg, and: andBg } = await import("drizzle-orm");
          const bgDb = await getDbBg();
          if (!bgDb) throw new Error("Database not available in background job");
          const { adCreatives: adCreativesTable, jobs: jobsTable } = await import("../../drizzle/schema");
          const { generateImage: genImg } = await import("../_core/imageGeneration");
          const { storagePut: s3Put } = await import("../storage");
          const { randomBytes: rb } = await import("crypto");
          const mechanism = capturedSvc.uniqueMechanismSuggestion || capturedSvc.name || "System";
          const niche = capturedSvc.category || "coaching";
          const batchId = `batch-${Date.now()}-${rb(4).toString("hex")}`;
          const customerCount = capturedSvc.totalCustomers || 0;
          const { renderAdCreative: doRenderA, resolveAdBodyTexts: resolveBodiesA } = await import("../_core/compositeHeadline");
          const { resolveCampaignCta: resolveCtaA } = await import("../_core/campaignCta");
          const gaCta = await resolveCtaA(bgDb, { campaignType: (capturedInput as { campaignType?: string }).campaignType, campaignId: (capturedInput as { campaignId?: number }).campaignId, serviceId: capturedInput.serviceId });
          // One source of truth — see _core/adVariations.ts. Identical order.
          const variations = AD_VARIATIONS;

          // ─── PARITY WITH runAdCreativesGeneration (2026-07-30) ───────────────
          // This loop is the COACH-FACING one (V2AdImageCreator's "Generate Ad
          // Images" button) and it had drifted from its sibling in
          // adCreativesGenerator.ts on all three of P8, P6 and the zone contract.
          // STATE.md recorded those as fixed "at all batch sites"; they were not.
          // See docs/handovers/AD_IMAGE_SITE_SWEEP_2026-07-30.md for the full map.
          //
          // P8 — the body DECK, rotated per variation below. A single resolved
          // line here is what made all five creatives share one body.
          const gaBodies = await resolveBodiesA(bgDb, capturedUserId, capturedInput.serviceId, variations.length);
          // P6 cause 2 — one subject resolved per batch, then a per-slot clause.
          // Without this the prompt fell back to the neutral "Person (30-45 years
          // old)", which is precisely the Flux prior that produced all-male decks.
          const gaSubject = await resolveSubjectForService(bgDb, capturedInput.serviceId);
          console.log(describeResolution(gaSubject));
          const gaSubjectClauses = subjectClausesForBatch(gaSubject, variations.map(v => v.style));
          // Arity derived from the deck, never hardcoded — this site read
          // `i < 5` and would have crashed on `variations[4].formula` the
          // moment the object slot was retired (2026-08-01).
          for (let i = 0; i < variations.length; i++) {
            const variation = variations[i];
            const headline = HEADLINE_FORMULAS[variation.formula](mechanism, niche, customerCount);
            const complianceIssues = checkCompliance(
              headline,
              capturedSvc.mainBenefit || "",
              capturedSvc.painPoints || ""
            );
            const uglyMode = capturedInput.uglyMode ?? false;
            const imagePrompt = generateAdImagePrompt(
              variation.style,
              niche,
              capturedSvc.painPoints || "",
              uglyMode,
              gaSubjectClauses[i],
            );
            console.log(`[adCreatives.generateAsync] Job ${jobId} — variation ${i+1}/${variations.length} uglyMode=${uglyMode}`);
            // `style` drives renderer selection — still lifes on gpt-image-1.
            const imageResult = await genImg({ prompt: imagePrompt, style: variation.style });
            if (!imageResult.url) throw new Error(`Failed to generate image for variation ${i + 1}`);
            const imageResponse = await fetch(imageResult.url);
            const rawBuffer = Buffer.from(await imageResponse.arrayBuffer());

            // Dual upload: keep the raw Flux output so recompositeText can
            // rebuild cleanly later; also upload the composited headline PNG.
            const rawKey = `ad-creatives/${capturedUserId}/${batchId}/raw-variation-${i + 1}.png`;
            const { url: rawImageUrl } = await s3Put(rawKey, rawBuffer, "image/png");
            const compositedBuffer = await doRenderA(rawBuffer, {
              headline,
              bodyText: gaBodies.length ? gaBodies[i % gaBodies.length] : "",
              ctaLabel: gaCta,
              // Compositor half of the zone contract. The photo prompt above has
              // always carried the prompt half (it lives in the shared
              // generateAdImagePrompt); this site never carried the other half,
              // so the coach's own deck rendered headlines against the legacy
              // scrim that starts at opacity 0 exactly where the first line lands.
              zone: "lower",
            });
            const fileKey = `ad-creatives/${capturedUserId}/${batchId}/variation-${i + 1}.png`;
            const { url: s3Url } = await s3Put(fileKey, compositedBuffer, "image/png");

            await bgDb.insert(adCreativesTable).values({
              userId: capturedUserId,
              serviceId: capturedInput.serviceId,
              niche,
              productName: capturedSvc.name,
              uniqueMechanism: mechanism,
              targetAudience: capturedSvc.targetCustomer || "",
              mainBenefit: capturedSvc.mainBenefit || "",
              pressingProblem: capturedSvc.painPoints || "",
              adType: "lead_gen",
              styleType: uglyMode ? "lad_bible" : "tabloid",
              designStyle: variation.style as any,
              headlineFormula: variation.formula,
              headline,
              imageUrl: s3Url,
              rawImageUrl,
              imageFormat: capturedInput.imageFormat || "1080x1080",
              complianceChecked: true,
              complianceIssues: complianceIssues.length > 0 ? JSON.stringify(complianceIssues) : null,
              batchId,
              variationNumber: i + 1,
            } as any);
          }
          await bgDb
            .update(jobsTable)
            .set({ status: "complete", result: JSON.stringify({ batchId }) })
            .where(eqBg(jobsTable.id, jobId));
          console.log(`[adCreatives.generateAsync] Job ${jobId} complete — batchId: ${batchId}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[adCreatives.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const { getDb: getDbBg2 } = await import("../db");
            const { eq: eqBg2 } = await import("drizzle-orm");
            const { jobs: jobsTable2 } = await import("../../drizzle/schema");
            const bgDb2 = await getDbBg2();
            if (bgDb2) {
              await bgDb2
                .update(jobsTable2)
                .set({ status: "failed", error: errorMessage.slice(0, 1024) })
                .where(eqBg2(jobsTable2.id, jobId));
            }
          } catch { /* ignore */ }
        }
      });
      return { jobId };
    }),
});

// Export helper function for batch generation from campaigns
export async function generateAdCreativesBatch(params: {
  userId: number;
  serviceId: number;
  campaignId?: number;
  niche: string;
  productName: string;
  targetAudience: string;
  mainBenefit: string;
  pressingProblem: string;
  uniqueMechanism: string;
  adType: "lead_gen" | "ecommerce";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check rate limiting for images (FREE but limited)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthlyImageCount = await db
    .select()
    .from(adCreatives)
    .where(
      and(
        eq(adCreatives.userId, params.userId),
        // @ts-ignore - createdAt comparison
        gte(adCreatives.createdAt, startOfMonth)
      )
    );

  const currentCount = monthlyImageCount.length;

  // Hard cap: 500 images/month
  if (currentCount >= 500) {
    throw new Error(
      "Monthly image limit reached (500 images). Contact support for enterprise pricing."
    );
  }

  // Soft warning: 100 images/month
  if (currentCount >= 100 && currentCount < 500) {
    console.warn(
      `[generateAdCreativesBatch] User ${params.userId} has generated ${currentCount} images this month (soft limit warning)`
    );
  }

  const batchId = `batch-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const mechanism = params.uniqueMechanism || "System";

  // Get service details
  const service = await db
    .select()
    .from(services)
    .where(eq(services.id, params.serviceId))
    .limit(1);

  const customerCount = service[0]?.totalCustomers || 0;

  // The 5 variations — one source of truth, see _core/adVariations.ts.
  const variations = AD_VARIATIONS;

  const generatedCreatives = [];

  const batchCta = await resolveCampaignCta(db, { campaignId: params.campaignId, serviceId: params.serviceId });
  // P8: body DECK, rotated per variation — a single line here made all five
  // creatives in a wizard batch share one body, same as the Auto Mode path.
  const batchBodies = await resolveAdBodyTexts(db, params.userId, params.serviceId, variations.length);
  // P6 cause 2: one subject resolved per batch, same rule as the Auto Mode path.
  const batchSubject = await resolveSubjectForService(db, params.serviceId);
  console.log(describeResolution(batchSubject));
  const batchSubjectClauses = subjectClausesForBatch(batchSubject, variations.map(v => v.style));

  // Arity derived from the deck, never hardcoded — see the sibling site in
  // generateAsync. Both read `i < 5` before the object-slot retirement.
  for (let i = 0; i < variations.length; i++) {
    const variation = variations[i];
    const headline = HEADLINE_FORMULAS[variation.formula](mechanism, params.niche, customerCount);
    const complianceIssues = checkCompliance(headline, params.mainBenefit, params.pressingProblem);
    const imagePrompt = generateAdImagePrompt(variation.style, params.niche, params.pressingProblem, false, batchSubjectClauses[i]);

    console.log(`[generateAdCreativesBatch] Generating variation ${i + 1}/${variations.length}`);

    // Generate image
    const imageResult = await generateImage({ prompt: imagePrompt });
    if (!imageResult.url) throw new Error(`Failed to generate image ${i + 1}`);

    // Dual upload: raw Flux output + composited PNG.
    const imageResponse = await fetch(imageResult.url);
    const rawBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const rawKey = `ad-creatives/${params.userId}/${batchId}/raw-variation-${i + 1}.png`;
    const { url: rawImageUrl } = await storagePut(rawKey, rawBuffer, "image/png");
    const compositedBuffer = await renderAdCreative(rawBuffer, {
      headline,
      bodyText: batchBodies.length ? batchBodies[i % batchBodies.length] : "",
      ctaLabel: batchCta,
    });
    const fileKey = `ad-creatives/${params.userId}/${batchId}/variation-${i + 1}.png`;
    const { url: s3Url } = await storagePut(fileKey, compositedBuffer, "image/png");

    // Save to database with campaignId
    console.log("[generateAdCreativesBatch] About to insert creative", { variation: i + 1 });
    const result = await db.insert(adCreatives).values({
      userId: params.userId,
      serviceId: params.serviceId,
      campaignId: params.campaignId || null,
      niche: params.niche,
      productName: params.productName,
      uniqueMechanism: mechanism,
      targetAudience: params.targetAudience,
      mainBenefit: params.mainBenefit,
      pressingProblem: params.pressingProblem,
      adType: params.adType,
      designStyle: variation.style as any,
      headlineFormula: variation.formula,
      headline,
      imageUrl: s3Url,
      rawImageUrl,
      imageFormat: "1080x1080",
      complianceChecked: true,
      complianceIssues: complianceIssues.length > 0 ? JSON.stringify(complianceIssues) : null,
      batchId,
    } as any);

    const creativeId = Number(result[0].insertId);
    console.log("[generateAdCreativesBatch] Converted creativeId:", creativeId);
    const [creative] = await db.select().from(adCreatives).where(eq(adCreatives.id, creativeId)).limit(1);
    generatedCreatives.push(creative);
  }

  return { batchId, creatives: generatedCreatives };
}
