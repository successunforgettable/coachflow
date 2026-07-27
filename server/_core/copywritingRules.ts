/**
 * Shared copywriting rules — imported by all prompt files.
 * Centralised here so a change in one place propagates everywhere.
 */

/**
 * Words and phrases banned across all AI-generated copy.
 * Merged from: landing.ts, adCopy.ts, services.ts, hvco.ts, headlines.ts
 */
export const BANNED_COPYWRITING_WORDS: string[] = [
  "transformation",
  "journey",
  "potential",
  "unlock",
  "empower",
  "breakthrough",
  "passion",
  "purpose",
  "impact",
  "fulfilment",
  "abundance",
  "mindset shift",
  "limiting beliefs",
  "step into your power",
  "show up",
  "do the work",
  "level up",
  "transform your life",
  "unlock your potential",
  "embrace your journey",
  "take your business to the next level",
  "achieve your dreams",
  "game-changer",
  "next level",
  "crushing it",
  "hustle",
  "grind",
  "manifest",
  "authentic self",
  "show up fully",
  "lean into",
  "unpack",
  "circle back",
  "bandwidth",
  "synergy",
  "scalable",
  "leverage",
  "pivot",
];

/**
 * Banned headline opener patterns.
 * Merged from: headlines.ts, adCopy.ts
 */
export const BANNED_HEADLINE_PATTERNS: string[] = [
  "Discover",
  "Unlock",
  "Transform",
  "Imagine",
  "Are you ready",
  "It's time to",
  "Say goodbye to",
  "Tired of",
  "Are you struggling with",
  "Finally",
  "The secret to",
  "How to finally",
];

/**
 * Banned generic mechanism names.
 * Used in heroMechanisms.ts, services.ts, hvco.ts
 */
export const BANNED_MECHANISM_NAMES: string[] = [
  "The Success Blueprint",
  "The Growth System",
  "The Transformation Framework",
  "The Mindset Method",
  "The Achievement Protocol",
  "The Breakthrough System",
  "The Empowerment Method",
  "The Results Framework",
];

/**
 * Meta advertising compliance note — appended to system prompts
 * in all ad-facing generators.
 */
export const META_COMPLIANCE_NOTES =
  "Never include: As seen on Meta, As seen on Facebook, As seen on Instagram. Never make income guarantees. Never use banned Meta language: banned, secret they don't want you to know, leaked, exposed, glitch.";

/**
 * REGISTER STANDARD — first-person default. Appended to the system prompt of
 * every generator that produces reader-facing copy.
 *
 * WHY THIS EXISTS. Meta's Personal Attributes policy prohibits copy that asserts
 * or implies the advertiser knows something about the person seeing the ad —
 * their health, financial status, age, ethnicity, criminal record, and the rest
 * of the enumerated list. Meta's own stated remedy is to focus on the benefits
 * of the product instead. The banned thing is the DIAGNOSTIC ADDRESS, not
 * emotional force: "You're sitting in the car park to delay going in" and
 * "I sat in the car park four minutes every Monday just to delay going in"
 * carry the identical payload, and only the first makes a claim about the reader.
 *
 * First person is the default for two reasons. It is STRUCTURALLY outside the
 * rule — a claim about the advertiser's own experience cannot assert knowledge
 * of the viewer — and it is the only register a beginner can use honestly: a
 * third-person case study needs a real client story, and a new coach has no
 * "Sarah", so third-person framing pushes them straight into inventing proof.
 *
 * Positive-framed by design (§14): it describes the register the copy IS, and
 * carries no banned-phrase list. Naming failure shapes primes the model to emit
 * them — the documented cause of the Sprint-B email regression.
 *
 * Authoritative source: docs/compliance/META_AD_COMPLIANCE_REFERENCE.md §1.1,
 * §1.2, §3.1. Compliance is validated on GENERATED OUTPUT (the compliance axis),
 * not precomputed from the service record — the violation is created in the
 * sentence, not in the offer.
 */
export const REGISTER_STANDARD = `REGISTER — write from the advertiser's side of the table.

The copy speaks from what the coach has lived, seen and built: what they did, what
they noticed, what changed, what the method does. It describes a moment precisely
enough that the right reader recognises it — the recognition comes from the
accuracy of the described moment, not from telling the reader what is true of them.

Concrete and specific is the goal. Intensity, stakes and emotional weight all
belong here in full — they are carried by the detail of the moment ("I sat in the
car park four minutes every Monday just to delay going in"), by the cost the coach
paid, and by what the method changes. Specificity is what makes copy land; keep it.

Where the copy addresses the reader directly, it speaks about the offer and what
it does — the benefit, the process, the outcome the method is built to produce.
That is the ground Meta's policy explicitly points to.

Attributes of a person — their health, body, mental state, financial standing,
age, background, or circumstances — are things the coach describes about their own
experience or their own work, never things the copy states or implies about the
person reading it.`;

/**
 * PHYSICAL-SUBJECT GUIDANCE (§1.3). Meta stacks two rules on body/weight/appearance
 * copy: personal attributes AND the prohibition on generating negative self-perception.
 *
 * This is NOT a niche band and NOT a classifier over the service record — there is no
 * stored risk tier, and nothing here changes what is generated for any other subject.
 * It reads the generation context that is already being sent to the model, and when
 * the offer's OWN words put the body, weight or appearance in the subject position, it
 * adds the stricter guidance to that same prompt.
 *
 * WHY IT EXISTS (verified 2026-07-27): with the register standard alone, a service
 * record written in weight-loss language ("lose weight fast and get back to their
 * pre-pregnancy body") pulled the copy back into the reader's body — "The clothes still
 * don't fit… You avoid the camera… the mirror is a daily reminder". The model mirrors
 * the framing it is handed. The register standard is necessary and not sufficient here;
 * output-side enforcement is the compliance axis's job, and this is the prompt-side half.
 */
const PHYSICAL_SUBJECT_MARKERS = [
  "weight", "lose weight", "fat loss", "slim", "body", "physique", "figure",
  "pre-pregnancy", "postpartum", "post-natal", "postnatal", "before and after",
  "transformation photo", "appearance", "look better", "toned", "belly", "waistline",
  "dress size", "bikini", "shape",
];

export function physicalSubjectGuidance(generationContext: string): string {
  const haystack = (generationContext || "").toLowerCase();
  if (!PHYSICAL_SUBJECT_MARKERS.some((m) => haystack.includes(m))) return "";
  return `PHYSICAL SUBJECT — this offer concerns the body, so the copy holds to the strictest form of the register:

The subject is CAPABILITY and how something feels to do — lifting, climbing stairs, carrying a
child, energy through an afternoon, sleeping and recovering. Those are the outcomes named, and
they are named as what the method is built to produce.

Appearance, weight, size, clothing fit, mirrors, photographs and comparisons between how someone
looked then and looks now are outside what this copy describes — including as the coach's own
account. Where the coach's own experience is told, it is told through what they could and could
not DO.

The reader's body is never the subject of a sentence. Every physical detail in the copy belongs
to a moment the coach lived, or to what the programme does.`;
}

/**
 * Third-person unlock. A case study about a named client is honest copy only when
 * the coach has actually supplied that client's material; otherwise the model has
 * to invent the client. Callers pass the real-proof signal they already compute
 * (socialProof.hasTestimonials / a populated real-testimonial library).
 *
 * The no-proof branch is deliberately COMPLETE rather than restricted — it names
 * what launch-stage copy is built from, and never mentions client stories at all,
 * so there is nothing for the model to fill in.
 */
export function registerPersonGuidance(hasRealClientMaterial: boolean): string {
  return hasRealClientMaterial
    ? `PERSON — first person is the default voice. The coach's real client material is
supplied above, so a third-person account of a client's experience is also available:
draw it ONLY from the supplied material, using the words, roles and results that
appear there.`
    : `PERSON — first person throughout. This copy is built from the coach's own
experience, the method itself, and what the offer does: the moment they remember,
the shift the method creates, what makes the approach different, and what a working
week looks like once it lands. Every figure, result and named person in the copy is
one that appears in the supplied material above.`;
}

/**
 * Date-fabrication ban — appended to system prompts in all generators
 * with urgency/scarcity surfaces (Offer, Landing Page, Email, WhatsApp).
 * The model has no temporal awareness; any specific calendar date it
 * writes will be a guess and visibly stale to the reader. Production
 * evidence Apr 30 2026: "August 4 2025" in Offer urgency, "January
 * cohort" × 4 angles in Landing Page scarcityUrgency, "January cohort"
 * in welcome Email body. WhatsApp prompts already prove the model
 * complies with named placeholders when given them — this rule
 * generalizes that pattern.
 */
export const NO_DATE_FABRICATION_RULE = `NO DATE FABRICATION: You do not have access to today's date — any calendar reference you write will be a guess and will appear stale to the reader. For urgency, scarcity, deadlines, or scheduled events, use one of these instead, in order of preference:
1. Bracketed operator placeholders: [INSERT_START_DATE], [INSERT_DEADLINE], [INSERT_LAUNCH_DATE], [INSERT_CART_CLOSE]
2. Relative timing: "within 14 days", "before the next cohort opens", "in the coming weeks"
3. Bounded duration mechanisms: "30-day enrolment window", "limited to 8 places per cohort"
Banned in published copy: literal calendar dates (e.g., "August 4 2025"), named months or seasons ("January cohort", "spring launch", "Q3"), specific weekdays as deadlines ("by Monday").`;

/**
 * Credential-fabrication ban — appended to system prompts in generators
 * with authority/expertise framing in their output (Headlines authority
 * formula, AdCopy body authority angle). The model has no ground truth
 * on the author's credentials, certifications, awards, tenure, or media
 * features. Production evidence 2026-04-30: Headlines authority formula
 * generated "Award-Winning Executive Coach", "Published Identity
 * Researcher", "Certified Identity Reclamation Specialist"; AdCopy body
 * authority angle generated "After 15 years working with high-achieving
 * women..." — none of which are verifiable from the service record.
 *
 * Same architectural pattern as NO_DATE_FABRICATION_RULE above:
 * system-prompt placement (mirrors META_COMPLIANCE_NOTES), single shared
 * constant, scoped to the confirmed offenders. The headlines authority
 * FORMULA_PROMPTS template explicitly asks for "credible authority figure
 * (award-winning, published, certified, etc.)" and gives the example
 * "Award-Winning Mind Coach" — this rule is written specifically to
 * override that example signal, naming the banned forms explicitly.
 */
export const NO_CREDENTIAL_FABRICATION_RULE = `NO CREDENTIAL FABRICATION: You do not have ground truth on the author's credentials, certifications, awards, tenure, academic background, or media features. Do not invent any of these in published copy. Specifically banned:
- Specific years of experience: "After 15 years...", "With over a decade...", "20+ years in the industry"
- Named professional titles: "Award-Winning Coach", "Certified [X] Specialist", "Published Researcher", "Bestselling Author", "World-Renowned Expert", "Top 1% in [Field]"
- Academic credentials: "PhD", "Harvard-trained", "Stanford-educated", "MBA-certified" (unless explicitly provided in input)
- Media features: "Forbes-featured", "TEDx Speaker", "Featured in WSJ", "As seen on [outlet]" (unless explicitly provided as a non-empty value in pressFeatures, featuredIn, or credibleAuthority input fields)

Use one of these instead, in order of preference:
1. Real credentials provided in input fields (credibleAuthority, pressFeatures, featuredIn) — only if the field is populated with a non-empty, non-"N/A" value
2. Bracketed operator placeholders: [INSERT_COACH_CREDENTIAL], [INSERT_AUTHORITY_TITLE], [INSERT_FEATURED_IN]
3. Generic role-based framing without specifics: "an experienced coach", "a practitioner of this method", "this approach", "the framework", "a structured process"

This rule overrides any in-prompt example or template that asks you to generate credibility markers like "award-winning" or "certified" — those are fabricated examples, not data to copy. If the input data does not provide a verifiable credential and a placeholder would feel awkward in the sentence, prefer rephrasing to remove the credential claim entirely rather than inventing one.`;

/**
 * Research-statistic-fabrication ban — appended to system prompts in
 * generators that produce body-length copy where the model is tempted to
 * invent population-level statistics framed as research findings. The
 * model has no ground truth on epidemiological / demographic / behavioural-
 * science findings; any specific stat it writes is a guess presented as
 * established research, which is a credibility hazard for the operator
 * and a Meta-compliance hazard if used in ad-policy-relevant copy.
 *
 * Production evidence 2026-05-10: Quiet Mornings landing page (kit 11,
 * landingPages.id=52) generated "first reactive decision within 90
 * seconds of waking", "fewer than 1 in 8", "above 80% failure rate",
 * "fewer than 11 uninterrupted personal minutes per day" — all framed
 * as established findings without operator-supplied source. None
 * verifiable from the service record.
 *
 * Same architectural pattern as NO_DATE_FABRICATION_RULE and
 * NO_CREDENTIAL_FABRICATION_RULE: single shared constant, system-prompt
 * placement, scoped to the confirmed offender (landing page generator)
 * this commit. Sprint B+2 budget: cross-generator audit for the same
 * leakage in email / whatsapp / headlines / adCopy / offers body copy.
 *
 * Sprint B+1 placement scope locked: landing-page-only this commit. The
 * rule's allow-list is deliberately permissive on first-person
 * experiential framing and explicit hypotheticals so it does not
 * over-scrub useful niche-grounded prose.
 */
export const NO_RESEARCH_STATISTIC_FABRICATION_RULE = `NO RESEARCH STATISTIC FABRICATION: You do not have ground truth on epidemiological, demographic, behavioural-science, or industry-survey findings. Do not invent any population-level statistic in published copy. Specifically banned:
- Invented percentages framed as research findings: "above 80% failure rate", "92% of [group] experience X", "less than 12% of people..."
- Invented X-of-Y ratios: "fewer than 1 in 8", "1 in 5 [group] report", "3 out of 4 [target] struggle with..."
- Invented time-to-X claims: "first reactive decision within 90 seconds of waking", "make 35,000 decisions a day", "lose 47 minutes per interruption"
- Invented bounded-quantity claims: "fewer than 11 uninterrupted personal minutes per day", "the average person checks their phone 144 times daily"
- Research-shaped phrasings presented as established findings: "studies show", "research finds", "data indicates", "neuroscience tells us", "the science is clear" — when no operator-supplied source backs the claim
- Named-source attribution without operator-supplied source: "Stanford research shows", "a Harvard study found", "Gallup data indicates"

Use one of these instead, in order of preference:
1. Real statistics supplied in input fields (when populated with non-empty, non-"N/A" values) — quoted verbatim, attributed if attribution was supplied
2. First-person experiential framing without research shape: "many of the people I work with", "in my work with [niche]", "the pattern I see most often is", "what I've noticed across [n] cohorts"
3. Explicit hypothetical framing: "imagine you're someone who", "what often happens when [situation]", "consider the [niche]-specific case where"
4. Generic situational framing without quantifier: "when [situation], it's common to feel", "people in [role] often find that"

This rule overrides any in-prompt example or template that asks you to "make the problem feel urgent with a number" — research-shaped numbers are fabricated examples, not data to copy. The model's job is to make the problem feel personal through specific situational framing, not to invent population-level statistics. If a sentence reads better with a specific number, prefer rephrasing toward situational specificity ("the moment between alarm and first decision") over fabricated quantification ("the 90 seconds between alarm and first decision").`;

/**
 * PROOF specificity compositional-ceiling modifier — DEFINED BUT NOT
 * CURRENTLY PASTED INTO PROMPTS. Retained as a pattern-catalog entry for
 * the post-generation validator (Sprint 2 architectural shift, in flight
 * 2026-05-11). Originally pasted into 5 email + WhatsApp paste sites by
 * Sprint B+1; rolled back the same day after Sprint B+1 surfaced an
 * intermittent JSON-shape regression class (commit 6225ca0 Option A
 * handled the Python-dict sub-case; sub-case 3 — likely truncation at
 * max_tokens — emerged ~30 min later and is not durably recoverable via
 * defensive parser). The validator approach replaces in-prompt rule
 * pasting with post-generation regex / LLM-as-judge pattern matching +
 * retry-with-fail-context — slim prompts eliminate the size-pressure
 * regression class while preserving fabrication coverage.
 *
 * The existing PROOF SPECIFICITY rule (welcome 3 / engagement 2 / sales 2
 * / WA engagement / WA sales) requires "role-first composite" and bans
 * named individuals, but treats the role as the FLOOR rather than the
 * CEILING — biographical scaffolding (family composition, partner
 * profession, employer specifics) and direct quoted speech were both
 * slipping through.
 *
 * Production evidence 2026-05-10: Quiet Mornings welcome email 3
 * (emailSequences.id=66) and WA engagement message 2 (whatsappSequences
 * .id=43) both fabricated "a primary school teacher with a 10-month-old
 * and a partner on shift work" + invented direct quoted speech, despite
 * complying with the role-first composite requirement.
 *
 * Validator pattern targets (extracted from this rule's content):
 *   - Family composition strings: /\bwith a \d+-?(month|year)-old\b/i,
 *     /\bnewly (single|divorced|married)\b/i
 *   - Partner profession strings: /\b(a partner|a spouse) (on|in|at)\b/i
 *   - Employer specifics: /\bat (a )?(Big-?4|Y Combinator|FAANG|MAANG)\b/i
 *   - Direct quoted speech in proof context: detect quoted dialogue
 *     attributed to anonymised composites (harder regex; LLM-as-judge
 *     candidate)
 *
 * Positive-only framing was preserved per b4f2fb4 lesson when the rule
 * was pasted in-prompt; same positive-only framing transfers to the
 * validator's retry-fail-context message ("the previous output included
 * biographical scaffolding; rewrite the composite at role + situation
 * level only").
 */
export const PROOF_COMPOSITIONAL_CEILING_RULE = `COMPOSITIONAL CEILING (Sprint B+1 — extends PROOF SPECIFICITY beyond the role-first floor): the role-based composite is the WHOLE composite, not a foundation to layer biographical scaffolding on. Permitted: 1 niche-specific situational anchor (the role itself or its proximate context — e.g. "a primary school teacher", "a senior manager in healthcare", "a freelance designer between contracts") + the problem → mechanism/change → outcome structure. Forbidden in addition to the existing rule: invented family composition ("with a 10-month-old", "with three kids under 5", "newly single"), invented partner specifics ("a partner on shift work", "a stay-at-home spouse"), invented employer detail ("at a Big-4 firm", "at a Y Combinator startup"), invented dependent ages or relationship status, invented direct quoted speech ("she told me X", "he said Y"), invented dialogue or paraphrase attributed to the composite individual. The composite is a structural placeholder for the reader to project themselves into — not a third-party narrative to flesh out. If the proof needs more weight than role + situation supports, prefer mechanism-only framing (the structural shift the method produces) over biographical scaffolding.`;

/**
 * Truncate a testimonial quote to a maximum length (default 100 chars).
 * Prevents the model spending token budget on quote reproduction rather than copy.
 * Used in: offersGenerator.ts, emailSequences.ts, whatsappSequences.ts
 */
export const truncateQuote = (q: string, max = 100): string =>
  q.length > max ? q.slice(0, max - 3) + '...' : q;

/**
 * W3 — Hook Rate Scoring.
 * Returns a 0-100 score for generated ad content based on copywriting signal strength.
 * No LLM calls — pure heuristic, runs at insert time.
 *
 * Scoring bands (approximate):
 *   90-100  → elite hook (multiple strong signals)
 *   70-89   → solid copy
 *   50-69   → baseline (no bonus signals triggered)
 *   <50     → not possible with current logic (base is 50)
 */
export function scoreAdContent(
  contentType: 'headline' | 'body' | 'link',
  content: string,
  angle?: string,
): number {
  let score = 50;

  if (contentType === 'headline') {
    const words = content.trim().split(/\s+/);
    const wordCount = words.length;

    // +10 if contains a number (specificity signals)
    if (/\d/.test(content)) score += 10;

    // +10 if NOT starting with a banned opener
    const bannedStart = BANNED_HEADLINE_PATTERNS.some(p =>
      content.toLowerCase().startsWith(p.toLowerCase()),
    );
    if (!bannedStart) score += 10;

    // +10 if 5-12 words (optimal headline length)
    if (wordCount >= 5 && wordCount <= 12) score += 10;

    // +10 if contains "you" or "your" (direct address)
    if (/\byou(r)?\b/i.test(content)) score += 10;

    // +10 if ends with "?" or "…" (open loop / curiosity gap)
    if (/[?…]$/.test(content.trim())) score += 10;
  }

  if (contentType === 'body') {
    const words = content.trim().split(/\s+/);
    const wordCount = words.length;

    // +10 if PDC angle — ICP-specific, highest-specificity frameworks
    if (angle && ['pain_pdc', 'desire_pdc', 'circumstance_pdc'].includes(angle)) score += 10;

    // +10 if 100-170 words (optimal body copy length)
    if (wordCount >= 100 && wordCount <= 170) score += 10;

    // +10 if no banned copywriting words present
    const hasBanned = BANNED_COPYWRITING_WORDS.some(w =>
      content.toLowerCase().includes(w.toLowerCase()),
    );
    if (!hasBanned) score += 10;

    // +10 if first sentence ≤ 15 words (punchy opener)
    const firstSentence = content.split(/[.!?]/)[0] ?? '';
    if (firstSentence.trim().split(/\s+/).length <= 15) score += 10;

    // +10 if ends with an approved Meta CTA phrase
    const lc = content.toLowerCase().trim();
    const ctaPatterns = ['learn more', 'book a call', 'get started', 'sign up', 'download free guide'];
    if (ctaPatterns.some(p => lc.endsWith(p) || lc.endsWith(p + '.'))) score += 10;
  }

  if (contentType === 'link') {
    // +10 if ≤ 60 characters (concise link text)
    if (content.trim().length <= 60) score += 10;

    // +10 if starts with uppercase
    if (/^[A-Z]/.test(content.trim())) score += 10;

    // +15 if contains a common action verb
    const actionVerbs = ['get', 'start', 'join', 'learn', 'try', 'claim', 'book', 'grab', 'access', 'watch', 'discover'];
    if (actionVerbs.some(v => new RegExp(`\\b${v}\\b`, 'i').test(content))) score += 15;
  }

  return Math.min(score, 100);
}
