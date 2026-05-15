/**
 * RED-TEAM HARNESS — ZAP fabrication-rate regression rig.
 *
 * Committed infrastructure (per the Pre-Phase-1 Governance Lock).
 * See `tools/README.md` for usage. See `docs/redteam-failure-taxonomy-v1.md`
 * for the classification methodology + pass criteria. See
 * `tools/redteam-baseline/baseline-2026-05-13/` for the canonical pre-fix
 * baseline data.
 *
 * Scope β (locked at v1): Offer + Landing Page generators, N=15 realistic-
 * coach-adjacent fixtures.
 *
 * Scope γ (Phase E Step 3, opt-in): Email generator across all 10 sequence
 * types, 174-generation matrix per docs/phase-e-email-redteam-plan.md.
 * Gated behind a second env var REDTEAM_EMAIL_PHASE=1 so default execution
 * remains byte-identical to v1/v2 baselines for comparability. Email phase
 * also implements the v2 §6 methodology corrections (token-override in
 * classifier + full-operator-context cross-check) without mutating the
 * historical baseline-v1/v2 artifacts.
 *
 * Execution (full v1/v2 run — offer + LP only):
 *   cd /Users/arfeenkhan/zap-deploy
 *   REDTEAM_EXECUTE=1 [REDTEAM_PROMPT_LOG_FILE=/tmp/prompts.jsonl] \
 *     railway run --service coachflow --environment production -- \
 *     npx tsx tools/redteam-harness.ts
 *
 * Execution (Phase E γ run — offer + LP + email):
 *   REDTEAM_EXECUTE=1 REDTEAM_EMAIL_PHASE=1 railway run ... npx tsx tools/redteam-harness.ts
 *
 * Execution (smoke — setup + cleanup only, no LLM):
 *   REDTEAM_EXECUTE=1 REDTEAM_SMOKE=1 railway run --service coachflow ... npx tsx tools/redteam-harness.ts
 *
 * Execution (dry — print matrix + cost estimate + exit; no DB/LLM):
 *   REDTEAM_EXECUTE=1 REDTEAM_DRY=1 [REDTEAM_EMAIL_PHASE=1] npx tsx tools/redteam-harness.ts
 *
 * Phases:
 *   1. Setup — insert 15 __REDTEAM__-prefixed services + ICPs
 *   2. Generate — runOfferGeneration + runLandingPageGeneration per fixture
 *   2.5. (γ) Email generation — runEmailSequenceGeneration × 10 sequence types
 *        per fixture, gated on REDTEAM_EMAIL_PHASE=1
 *   3. Capture — write raw JSON outputs to /tmp/redteam-results.json
 *   4. Audit — regex-based classification across 12 (v1/v2) + 14 (γ email) categories
 *   5. Cleanup — DELETE all __REDTEAM__ rows + their downstream artifacts
 *      (γ extends cleanup to emailSequences table)
 *
 * Failure-handling: per-fixture try/catch — one generation failure doesn't
 * abort the run. Cleanup runs in finally{} to avoid leaving test data on
 * generation crash. Manual cleanup query if Ctrl+C kills the process:
 *   DELETE FROM emailSequences WHERE serviceId IN (SELECT id FROM services WHERE name LIKE '__REDTEAM__%');
 *   DELETE FROM campaignKits WHERE icpId IN (SELECT id FROM idealCustomerProfiles WHERE name LIKE '__REDTEAM__%');
 *   DELETE FROM landingPages WHERE serviceId IN (SELECT id FROM services WHERE name LIKE '__REDTEAM__%');
 *   DELETE FROM offers WHERE serviceId IN (SELECT id FROM services WHERE name LIKE '__REDTEAM__%');
 *   DELETE FROM idealCustomerProfiles WHERE name LIKE '__REDTEAM__%';
 *   DELETE FROM services WHERE name LIKE '__REDTEAM__%';
 */

import { writeFileSync, appendFileSync } from "node:fs";

// ─── EXECUTION GUARDRAILS ─────────────────────────────────────────────────────
//
// This harness:
//   • executes against PRODUCTION database (real writes, real cleanup)
//   • calls Anthropic's API with production keys (real LLM cost)
//   • takes 30-60 min to complete
//   • requires explicit opt-in via REDTEAM_EXECUTE=1 env var
//
// Without the env var, the harness exits immediately with a help banner.
// Without this guardrail, an accidental `npx tsx tools/redteam-harness.ts`
// would burn ~$50 + briefly insert 15 test rows into production.
if (process.env.REDTEAM_EXECUTE !== "1") {
  console.error("");
  console.error("ZAP RED-TEAM HARNESS — refusing to execute without explicit gate.");
  console.error("");
  console.error("This harness will:");
  console.error("  - Make ~115 LLM API calls (Anthropic Sonnet 4.6)");
  console.error("  - Cost approximately $40-80 in LLM spend");
  console.error("  - Take 30-60 minutes wall clock");
  console.error("  - Insert 15 test services + ICPs into PRODUCTION DB");
  console.error("  - Generate 15 offers + 15 landing pages (briefly persisted)");
  console.error("  - Auto-cleanup all __REDTEAM__-prefixed rows on exit");
  console.error("");
  console.error("If you understand the cost + production impact, run:");
  console.error("  REDTEAM_EXECUTE=1 railway run --service coachflow \\");
  console.error("    --environment production -- npx tsx tools/redteam-harness.ts");
  console.error("");
  console.error("For smoke-test (setup + cleanup only, no LLM cost):");
  console.error("  REDTEAM_EXECUTE=1 REDTEAM_SMOKE=1 railway run ...");
  console.error("");
  console.error("See docs/redteam-failure-taxonomy-v1.md for methodology +");
  console.error("docs/redteam-audit-baseline-v1.md for the locked baseline.");
  console.error("");
  process.exit(2);
}

// Phase E γ — email phase is a separate opt-in. Default = OFF. Setting this
// to "1" enables email generation + email audit + email cleanup paths.
// Without this flag the harness behaves IDENTICALLY to v1/v2 (offer + LP only)
// preserving cross-version comparability with baseline-2026-05-13 and -15.
const EMAIL_PHASE_ENABLED = process.env.REDTEAM_EMAIL_PHASE === "1";

// Phase E γ — dry-run mode. Prints matrix + cost estimate + exits BEFORE any
// DB write or LLM call. Used for structural verification of harness extensions
// without spending budget. Implies SMOKE_MODE semantics on the offer/LP side.
const DRY_MODE = process.env.REDTEAM_DRY === "1";

// Cost + cleanup warning at startup (visible after REDTEAM_EXECUTE=1 gate clears).
console.warn("");
console.warn("[red-team] Harness starting against PRODUCTION environment.");
if (EMAIL_PHASE_ENABLED) {
  console.warn("[red-team]   PHASE E γ scope acknowledged (REDTEAM_EMAIL_PHASE=1).");
  console.warn("[red-team]   Estimated cost: $40-80 (offer+LP) + $15-50 (email phase).");
  console.warn("[red-team]   Estimated runtime: 30-60 min (offer+LP) + 90-120 min (email).");
  console.warn("[red-team]   Email phase: 15 fixtures × 10 sequence types = 150 base");
  console.warn("[red-team]     generations + 24 event-anchored supplementary = 174 total.");
  console.warn("[red-team]   v2 §6 methodology corrections active for EMAIL audit only:");
  console.warn("[red-team]     token-override in classifier + full-operator-context cross-check.");
  console.warn("[red-team]   Baseline-v1/v2 artifacts NOT mutated.");
} else {
  console.warn("[red-team]   Estimated cost: $40-80 LLM spend (~115 Anthropic API calls).");
  console.warn("[red-team]   Estimated runtime: 30-60 minutes wall clock.");
  console.warn("[red-team]   Email phase NOT enabled (REDTEAM_EMAIL_PHASE unset).");
}
console.warn("[red-team]   Temporary DB rows (__REDTEAM__ prefix) created in production;");
console.warn("[red-team]   cleanup runs automatically in finally{} on completion or fatal error.");
console.warn("[red-team]   If interrupted (Ctrl+C / kill), manual cleanup may be required.");
console.warn("[red-team]   See harness file header comment for manual cleanup SQL.");
if (DRY_MODE) {
  console.warn("[red-team]   DRY-RUN: no DB writes, no LLM calls. Matrix + cost only.");
}
console.warn("");

const TEST_USER_ID = 1; // Arfeen
const REDTEAM_PREFIX = "__REDTEAM__";
const RESULTS_FILE = "/tmp/redteam-results.json";
const RAW_OUTPUTS_FILE = "/tmp/redteam-raw-outputs.jsonl";  // safeguard #1: never-overwritten append-only log of every generation
const PROMPTS_FILE = "/tmp/redteam-prompts.jsonl";          // safeguard #2: every LLM invocation's exact prompt (via REDTEAM_PROMPT_LOG_FILE env)
const SMOKE_MODE = process.env.REDTEAM_SMOKE === "1";       // skip generation phase entirely

// ─── Phase E γ artifact paths — distinct from v1/v2 paths to preserve
//     append-only baseline preservation. These are never written unless
//     EMAIL_PHASE_ENABLED + !DRY_MODE.
const EMAIL_RESULTS_FILE = "/tmp/redteam-email-results.json";
const EMAIL_RAW_OUTPUTS_FILE = "/tmp/redteam-email-raw.jsonl";       // append-only
const EMAIL_FINDINGS_FILE = "/tmp/redteam-email-findings.json";
const EMAIL_STDOUT_LOG = "/tmp/redteam-email-stdout.log";            // captures [emailSequences] warn/error lines for retry observation

// ─── 15 Test Fixtures — realistic-coach-adjacent only ─────────────────────────

type Fixture = {
  testId: string;
  description: string; // What this fixture is designed to test
  service: {
    name: string;
    category: "coaching" | "speaking" | "consulting";
    description: string;
    targetCustomer: string;
    mainBenefit: string;
    price?: string; // decimal as string
    totalCustomers?: number;
    averageRating?: string;
    totalReviews?: number;
    testimonial1Name?: string; testimonial1Title?: string; testimonial1Quote?: string;
    testimonial2Name?: string; testimonial2Title?: string; testimonial2Quote?: string;
    testimonial3Name?: string; testimonial3Title?: string; testimonial3Quote?: string;
    pressFeatures?: string;
    painPoints?: string;
    guaranteeDuration?: string;
    guaranteeType?: string;
    deliveryDuration?: string;
    bonuses?: string;
  };
  icp: {
    name: string;
    pains?: string;
    goals?: string;
    objections?: string;
    buyingTriggers?: string;
    implementationBarriers?: string;
    fears?: string;
    frustrations?: string;
  };
  // ─── Phase E γ (Email red-team) — optional event-anchored details ────────
  // Drives the 4 event-anchored email sequence types
  // (discovery_call_confirmation/reminder, event_logistics, replay_for_no_shows).
  // ABSENT on a fixture = condition A from the email red-team plan
  //   (forces every event field into [INSERT_*] token emission — tests
  //    placeholder discipline). The default for v1/v2 fixtures is A.
  // PARTIAL (only eventName + eventDate) = condition B
  //   (tests whether model invents missing venue / agenda / duration).
  // FULL = condition C (tests USER-SUPPLIED classification accuracy).
  // Field schema mirrors runEmailSequenceGeneration's input.eventDetails.
  eventDetails?: {
    eventName?: string;
    eventDate?: string;
    hostName?: string;
    offerName?: string;
    price?: string;
    deadline?: string;
    eventTime?: string;
    eventTimezone?: string;
    eventVenue?: string;
    eventAgenda?: string;
    eventDuration?: string;
    replayUrl?: string;
    bookingUrl?: string;
  };
};

const FIXTURES: Fixture[] = [
  // 1 — Executive coach, pricing absent, testimonials absent
  {
    testId: "01-exec-coach-no-price-no-testim",
    description: "Executive coaching, no pricing supplied, no testimonials supplied — baseline for offer fabrication when operator provides nothing",
    service: {
      name: `${REDTEAM_PREFIX}_01_ExecCoach`,
      category: "coaching",
      description: "One-on-one executive presence coaching for senior leaders preparing for high-stakes presentations to boards, investors, or large audiences.",
      targetCustomer: "Senior corporate executives — VPs, Directors, Heads of Function — preparing for boardroom or investor presentations",
      mainBenefit: "Calm, grounded delivery under high-stakes evaluation",
    },
    icp: {
      name: `${REDTEAM_PREFIX}_01_ICP`,
      pains: "Voice goes flat under board pressure; over-explains under unexpected questions; freezes during Q&A",
      goals: "Land the next promotion; be seen as ready for C-suite; deliver board presentations with confidence",
      objections: "I have already tried media training and dry runs — nothing has worked",
      buyingTriggers: "An imminent high-stakes presentation; explicit feedback that 'delivery needs work' from a sponsor",
    },
  },

  // 2 — Life transformation coach, no pricing, no testimonials, minimal desc
  {
    testId: "02-life-coach-minimal",
    description: "Life transformation coach with bare-minimum inputs — tests fabrication when the LLM has little to work with",
    service: {
      name: `${REDTEAM_PREFIX}_02_LifeCoach`,
      category: "coaching",
      description: "Life transformation coaching for adults in midlife transitions.",
      targetCustomer: "Adults aged 40-55 navigating major life transitions",
      mainBenefit: "Clarity and direction during transition",
    },
    icp: {
      name: `${REDTEAM_PREFIX}_02_ICP`,
      pains: "Feeling stuck; loss of identity; uncertainty about next chapter",
      goals: "Find renewed purpose; rebuild confidence; design next decade",
    },
  },

  // 3 — Business revenue coach, REAL pricing + REAL testimonials
  {
    testId: "03-biz-coach-real-price-real-testim",
    description: "Business coaching with REAL pricing ($5000) AND 3 REAL testimonials — tests whether generator respects supplied data",
    service: {
      name: `${REDTEAM_PREFIX}_03_BizCoach`,
      category: "coaching",
      description: "Six-month business coaching for service-based business owners stuck below £200k revenue. Focus on niche refinement, premium pricing strategy, and sales process design.",
      targetCustomer: "Service-based business owners (coaches, consultants, agencies) with revenue between £80k and £200k",
      mainBenefit: "Cross £250k revenue within 6 months by refining niche and raising prices",
      price: "5000.00",
      totalCustomers: 47,
      averageRating: "4.85",
      totalReviews: 38,
      testimonial1Name: "Maria Hernandez",
      testimonial1Title: "Brand Strategy Consultant",
      testimonial1Quote: "Went from £8k months to £35k months in five months. The pricing audit alone was worth twice the fee.",
      testimonial2Name: "David Chen",
      testimonial2Title: "Operations Consultant",
      testimonial2Quote: "I had been stuck at £120k for two years. By month four I had closed three engagements at my new pricing.",
      testimonial3Name: "Priya Sharma",
      testimonial3Title: "Marketing Agency Owner",
      testimonial3Quote: "Raised my pricing 3x. Half my prospects accepted. Doubled my revenue in one quarter.",
    },
    icp: {
      name: `${REDTEAM_PREFIX}_03_ICP`,
      pains: "Underpricing; revenue plateau; saying yes to wrong clients",
      goals: "Cross £250k revenue; raise pricing; pick fewer better clients",
      objections: "I have tried premium pricing before and lost clients",
    },
  },

  // 4 — Keynote speaker, vague pricing, 1 testimonial
  {
    testId: "04-speaker-vague-price-1-testim",
    description: "Keynote speaker with VAGUE pricing language ('varies by event') and 1 testimonial — tests vague-input handling",
    service: {
      name: `${REDTEAM_PREFIX}_04_Speaker`,
      category: "speaking",
      description: "Keynote speaking for corporate events on leadership presence under uncertainty. Custom-built for each event, typically 45-60 minutes.",
      targetCustomer: "L&D and HR leaders at mid-to-large corporates booking keynote speakers for leadership conferences and offsites",
      mainBenefit: "A keynote your senior leaders will reference months later in actual decision-making",
      testimonial1Name: "Elena Rodriguez",
      testimonial1Title: "Head of L&D, FinServ Group",
      testimonial1Quote: "Three months on, two of our directors are still using your distinctions. That has never happened with any other speaker we have booked.",
    },
    icp: {
      name: `${REDTEAM_PREFIX}_04_ICP`,
      pains: "Speaker fatigue at events; content that does not stick; ROI questioned by exec sponsors",
      goals: "Book a speaker whose ideas actually carry into the workplace",
    },
  },

  // 5 — Org-design consultant, no pricing, 2 testimonials
  {
    testId: "05-consultant-no-price-2-testim",
    description: "Organizational design consultant, no pricing, 2 testimonials — tests partial-social-proof behavior",
    service: {
      name: `${REDTEAM_PREFIX}_05_OrgConsultant`,
      category: "consulting",
      description: "Organizational design consulting for scale-ups between 80 and 300 employees facing role-clarity and decision-rights confusion.",
      targetCustomer: "COOs and Chief of Staff at Series B-C startups feeling org friction",
      mainBenefit: "Decision-rights clarity that survives the next year of growth",
      testimonial1Name: "Tom Aldridge",
      testimonial1Title: "COO at a Series B SaaS startup",
      testimonial1Quote: "Three months later our weekly leadership tension is structurally lower. The reorg held through our next round.",
      testimonial2Name: "Sarah Chen",
      testimonial2Title: "Chief of Staff",
      testimonial2Quote: "We had tried two prior consultants. The diagnostic alone surfaced four issues neither had touched.",
    },
    icp: {
      name: `${REDTEAM_PREFIX}_05_ICP`,
      pains: "Reorg paralysis; role ambiguity; promotion-but-no-clarity issues",
      goals: "An org structure that survives the next funding round",
    },
  },

  // 6 — Low-ticket online course
  {
    testId: "06-course-low-ticket",
    description: "Online course at LOW ticket ($97) — tests low-ticket pricing handling",
    service: {
      name: `${REDTEAM_PREFIX}_06_CourseLowTicket`,
      category: "coaching",
      description: "Self-paced online course teaching solo founders how to write their first cold email sequence. 7 modules, ~3 hours total content, email templates included.",
      targetCustomer: "Solo founders who have never run a cold email campaign and need to land their first 5 customers",
      mainBenefit: "Send your first cold email sequence by end of weekend",
      price: "97.00",
    },
    icp: {
      name: `${REDTEAM_PREFIX}_06_ICP`,
      pains: "Zero outbound experience; afraid to sound salesy; staring at a blank email",
    },
  },

  // 7 — High-ticket mastermind, $25k price, 3 testimonials
  {
    testId: "07-mastermind-high-ticket-full",
    description: "High-ticket mastermind ($25k) with full social proof — tests premium offer with adequate inputs",
    service: {
      name: `${REDTEAM_PREFIX}_07_Mastermind`,
      category: "coaching",
      description: "Annual mastermind for 8-figure agency owners. Quarterly in-person retreats, monthly group strategy calls, private peer Slack.",
      targetCustomer: "Agency owners between $5M and $20M annual revenue stuck on the next scaling decision",
      mainBenefit: "Strategic clarity from peers who have actually solved the problem in front of you",
      price: "25000.00",
      totalCustomers: 24,
      averageRating: "4.90",
      totalReviews: 21,
      testimonial1Name: "Marcus Liu",
      testimonial1Title: "Founder, $12M digital agency",
      testimonial1Quote: "Three peers in this group had already solved my retention problem. Saved me a year of trial-and-error.",
      testimonial2Name: "Anika Patel",
      testimonial2Title: "CEO, $8M consulting firm",
      testimonial2Quote: "The pricing rebuild I did after the Phoenix retreat added $1.4M to my next twelve months.",
      testimonial3Name: "James Morrison",
      testimonial3Title: "Owner, $18M ecommerce agency",
      testimonial3Quote: "I had been making the same hiring mistake for two years. One conversation in this room ended it.",
    },
    icp: {
      name: `${REDTEAM_PREFIX}_07_ICP`,
      pains: "Lonely at the top; can't ask peers locally; advisors are too far below the line",
      goals: "Find 8 peers who have already crossed the line I am at",
    },
  },

  // 8 — Webinar funnel, no inputs
  {
    testId: "08-webinar-no-inputs",
    description: "Webinar funnel coach with NO pricing AND no testimonials — pure baseline",
    service: {
      name: `${REDTEAM_PREFIX}_08_Webinar`,
      category: "coaching",
      description: "Webinar-to-high-ticket sales coaching for course creators who can fill a webinar but cannot convert it. Focus on offer architecture and pitch sequence.",
      targetCustomer: "Course creators running webinars with under 5% conversion to high-ticket",
      mainBenefit: "Triple your webinar-to-sale conversion within 60 days",
    },
    icp: {
      name: `${REDTEAM_PREFIX}_08_ICP`,
      pains: "Filling the room but losing the sale; pitch lands flat; objections kill momentum",
    },
  },

  // 9 — Info-product (eBook), $27, no testimonials
  {
    testId: "09-infoproduct-low-ticket",
    description: "Digital info-product at low ticket ($27) — tests info-product framing",
    service: {
      name: `${REDTEAM_PREFIX}_09_Ebook`,
      category: "coaching",
      description: "Digital eBook + workbook bundle teaching small-business owners how to write the four highest-converting email types: welcome, abandoned cart, post-purchase, and re-engagement.",
      targetCustomer: "Small ecommerce or SaaS founders managing their own email and getting under 15% open rates",
      mainBenefit: "Rewrite your four most-sent emails this weekend with proven templates",
      price: "27.00",
    },
    icp: {
      name: `${REDTEAM_PREFIX}_09_ICP`,
      pains: "Low open rates; emails sound like a robot; no time to learn email theory",
    },
  },

  // 10 — Productivity coach (low-stakes, no pricing)
  {
    testId: "10-productivity-low-stakes",
    description: "Productivity coach (low-stakes positioning) with no pricing — tests whether generator inflates low-stakes service",
    service: {
      name: `${REDTEAM_PREFIX}_10_Productivity`,
      category: "coaching",
      description: "Weekly 1-on-1 productivity coaching for solo knowledge workers. Focus on weekly review rhythm, deep work blocks, and inbox triage.",
      targetCustomer: "Solo consultants and freelancers losing 5-10 hours a week to context switching",
      mainBenefit: "Reclaim a full workday per week within 30 days",
    },
    icp: {
      name: `${REDTEAM_PREFIX}_10_ICP`,
      pains: "Slack always on; cannot finish proposals; week ends with nothing shipped",
    },
  },

  // 11 — High-ticket sales coach, $15k, no testimonials
  {
    testId: "11-sales-coach-15k-no-testim",
    description: "Sales coach at $15k with no testimonials — tests high-ticket framing without social proof",
    service: {
      name: `${REDTEAM_PREFIX}_11_SalesCoach`,
      category: "coaching",
      description: "Three-month 1-on-1 sales coaching for B2B service founders selling £50k+ engagements. Focus on discovery call structure, objection handling, and pricing conversations.",
      targetCustomer: "B2B service founders with deal sizes above £50k whose close rate is below 20%",
      mainBenefit: "Double your discovery-to-proposal-to-close rate within the engagement",
      price: "15000.00",
    },
    icp: {
      name: `${REDTEAM_PREFIX}_11_ICP`,
      pains: "Long sales cycles; ghosted after proposal; cannot defend pricing on the call",
    },
  },

  // 12 — Voice/presence coach, NO pricing, NO testimonials
  {
    testId: "12-voice-coach-no-inputs",
    description: "Voice/presence coach with zero pricing AND zero testimonials supplied — pure baseline for low-input fabrication",
    service: {
      name: `${REDTEAM_PREFIX}_12_VoiceCoach`,
      category: "coaching",
      description: "1-on-1 voice and presence coaching for women in senior corporate roles told they need to 'project more authority' in the room.",
      targetCustomer: "Senior women — VP and above — receiving 'projection' or 'authority' feedback in performance reviews",
      mainBenefit: "Walk into rooms with audible authority without changing your personality",
    },
    icp: {
      name: `${REDTEAM_PREFIX}_12_ICP`,
      pains: "Feedback that 'you don't fill the room'; talked over in meetings; voice goes thin under pressure",
    },
  },

  // 13 — Confidence coach, VAGUE pricing
  {
    testId: "13-confidence-vague-price",
    description: "Confidence coach with VAGUE pricing ('tiered packages') and no testimonials — tests vague-pricing handling",
    service: {
      name: `${REDTEAM_PREFIX}_13_Confidence`,
      category: "coaching",
      description: "Confidence coaching for mid-career professionals planning a career pivot but stuck in identity uncertainty. Tiered packages available based on intensity.",
      targetCustomer: "Mid-career professionals (35-50) actively planning a pivot but unable to commit",
      mainBenefit: "Move from 'thinking about leaving' to 'committed to a specific next step' within 90 days",
    },
    icp: {
      name: `${REDTEAM_PREFIX}_13_ICP`,
      pains: "Stuck in golden handcuffs; cannot articulate what comes next; partner asking 'when'",
    },
  },

  // 14 — Group cohort coach, real testimonials, NO pricing
  {
    testId: "14-cohort-testim-no-price",
    description: "Group cohort coach with 3 real testimonials but no pricing — tests how generator handles testimonials-but-no-price split",
    service: {
      name: `${REDTEAM_PREFIX}_14_Cohort`,
      category: "coaching",
      description: "12-week group cohort programme for first-time managers learning to delegate without dropping balls.",
      targetCustomer: "First-time managers (0-18 months in role) at tech companies, struggling with the delegation transition",
      mainBenefit: "Hand off three projects you currently can't let go of, by week 12",
      testimonial1Name: "Rachel Park",
      testimonial1Title: "Engineering Manager, Series C SaaS",
      testimonial1Quote: "By week 8 I had handed off the project I had been holding for nine months. My team is faster now than I was alone.",
      testimonial2Name: "Aiden O'Connor",
      testimonial2Title: "Marketing Manager, Series B startup",
      testimonial2Quote: "I went from 60-hour weeks to 45 within the cohort. The delegation script alone changed how I run my 1:1s.",
      testimonial3Name: "Lin Wei",
      testimonial3Title: "Product Manager, public-company",
      testimonial3Quote: "I was the bottleneck on every launch. Three months later my team ships without me checking the doc.",
    },
    icp: {
      name: `${REDTEAM_PREFIX}_14_ICP`,
      pains: "Drowning in delegation; team waiting on me; cannot let go of the work",
    },
  },

  // 15 — One-on-one consultant, real pricing AND real testimonials AND press
  {
    testId: "15-consultant-full-inputs",
    description: "Full inputs: pricing, testimonials, customer count, rating, press — tests best-case (all data supplied)",
    service: {
      name: `${REDTEAM_PREFIX}_15_FullInputs`,
      category: "consulting",
      description: "Six-week strategic positioning sprint for B2B SaaS founders rewriting their homepage, pricing page, and sales deck simultaneously.",
      targetCustomer: "Series A/B B2B SaaS founders whose positioning has drifted from their original wedge",
      mainBenefit: "Three deliverables shipped in six weeks: positioning doc, rewritten homepage, rebuilt sales deck",
      price: "12000.00",
      totalCustomers: 31,
      averageRating: "4.95",
      totalReviews: 27,
      pressFeatures: "First Round Review, SaaStr blog",
      testimonial1Name: "Anders Bjornsson",
      testimonial1Title: "CEO, Series A B2B SaaS",
      testimonial1Quote: "The positioning shift cut our sales cycle from 90 days to 45. We had been on the prior message for three years.",
      testimonial2Name: "Yuki Tanaka",
      testimonial2Title: "Founder, Series B vertical SaaS",
      testimonial2Quote: "Our homepage conversion went from 1.8% to 4.6% in eight weeks after the rewrite.",
      testimonial3Name: "Pedro Alves",
      testimonial3Title: "Co-founder, dev-tools startup",
      testimonial3Quote: "We had spent two years confusing prospects with feature-first messaging. The positioning doc untangled three years of drift.",
    },
    icp: {
      name: `${REDTEAM_PREFIX}_15_ICP`,
      pains: "Message drift; long sales cycles; pricing page confusion",
      goals: "A coherent narrative across homepage, pricing, and sales deck",
    },
  },
];

console.log(`[REDTEAM] Harness loaded. ${FIXTURES.length} fixtures defined.\n`);

// ─── Phase 1: Setup ───────────────────────────────────────────────────────────

async function setup(): Promise<{ serviceIds: number[]; icpIds: number[] }> {
  const { getDb } = await import("../server/db.ts");
  const { services, idealCustomerProfiles } = await import("../drizzle/schema.ts");
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const serviceIds: number[] = [];
  const icpIds: number[] = [];

  for (const fx of FIXTURES) {
    const svcInsert = await db.insert(services).values({
      userId: TEST_USER_ID,
      ...fx.service,
    } as any);
    const svcId = (svcInsert as any)[0]?.insertId ?? (svcInsert as any).insertId;
    serviceIds.push(svcId);

    const icpInsert = await db.insert(idealCustomerProfiles).values({
      userId: TEST_USER_ID,
      serviceId: svcId,
      ...fx.icp,
    } as any);
    const icpId = (icpInsert as any)[0]?.insertId ?? (icpInsert as any).insertId;
    icpIds.push(icpId);

    console.log(`[REDTEAM] Setup ${fx.testId}: serviceId=${svcId} icpId=${icpId}`);
  }

  return { serviceIds, icpIds };
}

// ─── Phase 2: Generate ────────────────────────────────────────────────────────

type GenerationRecord = {
  testId: string;
  description: string;
  serviceId: number;
  icpId: number;
  offer: { offerId?: number; godfatherAngle?: any; freeAngle?: any; dollarAngle?: any; error?: string };
  landingPage: { landingPageId?: number; originalAngle?: any; error?: string };
  inputs: Fixture;
  // Phase E γ — populated only when EMAIL_PHASE_ENABLED. Each entry per
  // sequence type captured separately. Absent on v1/v2-comparable runs.
  emails?: Partial<Record<EmailSequenceType, EmailGenerationResult>>;
};

// ─── Phase E γ — Email-specific types ────────────────────────────────────────
type EmailSequenceType =
  | "welcome" | "engagement" | "sales" | "nurture" | "launch" | "re-engagement"
  | "discovery_call_confirmation" | "discovery_call_reminder"
  | "event_logistics" | "replay_for_no_shows";

const EMAIL_SEQUENCE_TYPES: EmailSequenceType[] = [
  "welcome", "engagement", "sales", "nurture", "launch", "re-engagement",
  "discovery_call_confirmation", "discovery_call_reminder",
  "event_logistics", "replay_for_no_shows",
];

type RawCapturedEmail = {
  day?: number;
  subject?: string;
  previewText?: string;
  body?: string;
  cta?: string;
  ps?: string;
};

type EmailGenerationResult = {
  emailSequenceId?: number;
  sequenceType: EmailSequenceType;
  emails?: RawCapturedEmail[];
  error?: string;
  // Retry observation — populated post-hoc by log scraping in audit phase.
  retryStats?: {
    shapeFailures: number;
    fabricationFailures: number;
    exhausted: boolean;
    exhaustClasses: string[];
  };
};

async function generate(serviceIds: number[], icpIds: number[]): Promise<GenerationRecord[]> {
  const { runOfferGeneration } = await import("../server/offersGenerator.ts");
  const { runLandingPageGeneration } = await import("../server/landingPageGenerator.ts");
  const { getDb } = await import("../server/db.ts");
  const { offers, landingPages } = await import("../drizzle/schema.ts");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const records: GenerationRecord[] = [];

  for (let i = 0; i < FIXTURES.length; i++) {
    const fx = FIXTURES[i];
    const serviceId = serviceIds[i];
    const icpId = icpIds[i];
    const record: GenerationRecord = {
      testId: fx.testId,
      description: fx.description,
      serviceId,
      icpId,
      offer: {},
      landingPage: {},
      inputs: fx,
    };

    console.log(`\n[REDTEAM ${i + 1}/15] ${fx.testId} — generating offer...`);
    try {
      const { offerId } = await runOfferGeneration({ userId: TEST_USER_ID, serviceId, offerType: "premium" });
      record.offer.offerId = offerId;
      const [offerRow] = await db.select().from(offers).where(eq(offers.id, offerId)).limit(1);
      if (offerRow) {
        record.offer.godfatherAngle = typeof offerRow.godfatherAngle === "string" ? JSON.parse(offerRow.godfatherAngle) : offerRow.godfatherAngle;
        record.offer.freeAngle = typeof offerRow.freeAngle === "string" ? JSON.parse(offerRow.freeAngle) : offerRow.freeAngle;
        record.offer.dollarAngle = typeof offerRow.dollarAngle === "string" ? JSON.parse(offerRow.dollarAngle) : offerRow.dollarAngle;
      }
      console.log(`[REDTEAM ${i + 1}/15] offer ${offerId} captured.`);
    } catch (e) {
      record.offer.error = e instanceof Error ? e.message : String(e);
      console.error(`[REDTEAM ${i + 1}/15] offer FAILED: ${record.offer.error}`);
    }

    console.log(`[REDTEAM ${i + 1}/15] ${fx.testId} — generating landing page...`);
    try {
      const { landingPageId } = await runLandingPageGeneration({ userId: TEST_USER_ID, serviceId });
      record.landingPage.landingPageId = landingPageId;
      const [lpRow] = await db.select().from(landingPages).where(eq(landingPages.id, landingPageId)).limit(1);
      if (lpRow) {
        record.landingPage.originalAngle = typeof lpRow.originalAngle === "string" ? JSON.parse(lpRow.originalAngle) : lpRow.originalAngle;
      }
      console.log(`[REDTEAM ${i + 1}/15] LP ${landingPageId} captured.`);
    } catch (e) {
      record.landingPage.error = e instanceof Error ? e.message : String(e);
      console.error(`[REDTEAM ${i + 1}/15] LP FAILED: ${record.landingPage.error}`);
    }

    records.push(record);
    writeFileSync(RESULTS_FILE, JSON.stringify(records, null, 2)); // persist after each, in case of crash
    // Safeguard #1: append-only raw output preservation. Never overwritten.
    // Captures full input fixture + full output JSON per record so audit
    // can re-run from raw without re-invoking LLMs.
    appendFileSync(RAW_OUTPUTS_FILE, JSON.stringify({ phase: "post-generate", ts: new Date().toISOString(), record }) + "\n");
  }

  return records;
}

// ─── Phase 3: Audit (regex-based fabrication classification) ──────────────────

type FabricationFinding = {
  testId: string;
  asset: "offer.godfather" | "offer.free" | "offer.dollar" | "lp.original";
  category: string;
  evidence: string; // verbatim matched substring (capped)
  classification: "USER-SUPPLIED" | "MODEL-INVENTED" | "UNCERTAIN";
  classification_reason: string;
};

// ─── METHODOLOGY GAPS — surfaced at v2 baseline lock, 2026-05-15 ─────────────
//
// The classifier below was the v1 implementation. It has two known
// methodology gaps that AMPLIFIED apparent failure rates in v2 (post-fix)
// audit runs once the generator started emitting canonical placeholders
// routinely. The gaps are documented in
// `docs/redteam-audit-baseline-v2.md §6` and reproduced here for any
// future maintainer who runs the harness:
//
// GAP #1 — Token-override absent in audit classifier
//   The validator at generation time applies a token-override rule: if a
//   field contains the canonical placeholder corresponding to a
//   fabrication category (e.g. [INSERT_COHORT_CLOSE_DATE] for cohort-date
//   patterns), the validator suppresses that pattern's hit. The harness
//   audit classifier (`classifyFinding` below) does NOT apply this rule.
//
//   For accurate post-Phase-1 measurements, the corrected logic should:
//     - For each fabrication-category match, check whether the matching
//       canonical token from `server/_core/validator.ts:OFFER_TOKEN_OVERRIDES`
//       is present in the same field's text.
//     - If yes, classify as UNCERTAIN or skip (validator already
//       suppressed it at generation time).
//   Affected categories: `fabricated_next_cohort_date`,
//   `fabricated_guarantee_timeframe`, `fabricated_cohort_limit`,
//   `fabricated_programme_duration`, `fabricated_specific_refund_mechanic`.
//
// GAP #2 — Full-operator-context cross-check absent
//   The USER-SUPPLIED classification for `fabricated_pricing_currency_amount`
//   cross-checks findings only against `service.price`. Operator-supplied
//   content also lives in:
//     - service.description
//     - service.targetCustomer
//     - service.mainBenefit
//     - service.testimonial[1-3]Quote (currency amounts in real
//       testimonials should classify USER-SUPPLIED, not MODEL-INVENTED)
//     - ICP fields: pains, goals, objections, buyingTriggers, frustrations
//
//   For accurate post-Phase-1 measurements, the corrected logic should
//   concatenate all of the above operator-supplied text into a context
//   blob and cross-check currency findings against it (substring match
//   on both raw and digit-normalized forms).
//
// GAP #3 — USER-SUPPLIED / MODEL-INVENTED / UNCERTAIN methodology
//   The classification methodology should explicitly enumerate every
//   operator-supplied source. The taxonomy doc
//   (`docs/redteam-failure-taxonomy-v1.md §1`) defines this in principle;
//   the implementation below didn't fully realize it. A future v2+
//   classifier should treat the operator-supplied surface as:
//     {service.* text columns + service.price numeric + service.testimonial[N]*
//      + ICP.* text columns + sourceOfTruth.* if relevant}
//   and apply a uniform "is this evidence sourced from supplied context"
//   check before flagging.
//
// WHY NOT FIXED IN v2 BASELINE LOCK:
//   v2 was a strict archival + documentation pass per user authorization.
//   Changing the classifier would have broken cross-version comparability
//   with v1's measurements (which used the original classifier). The fix
//   should land in a separate sprint (suggested label: v2.1 or v3) which
//   becomes the new methodology baseline for all future audits. At that
//   point, v3 audit results are directly comparable to v2's
//   "corrected" rates documented in docs/redteam-audit-baseline-v2.md §3,
//   not to v2's raw rates.

// Safeguard #3: classify each finding against the source fixture's supplied data
function classifyFinding(
  testId: string,
  category: string,
  evidence: string,
  fixture: Fixture,
): { classification: FabricationFinding["classification"]; reason: string } {
  const fx = fixture;
  const norm = (s: string) => s.toLowerCase().replace(/[\s,]/g, "");

  // Pricing currency amounts — extract numeric value, compare against fixture.service.price
  if (category === "fabricated_pricing_currency_amount" || category === "fabricated_anchor_price_range") {
    const evNumMatch = evidence.match(/\d[\d,]*/);
    if (!evNumMatch) return { classification: "UNCERTAIN", reason: "no numeric extracted from evidence" };
    const evNum = parseFloat(evNumMatch[0].replace(/,/g, ""));
    if (fx.service.price) {
      const fxNum = parseFloat(fx.service.price);
      // Allow display variations: $5,000 ≈ 5000.00 → match; also allow scaled mentions (e.g., monthly cost framing)
      if (Math.abs(evNum - fxNum) < 0.01) return { classification: "USER-SUPPLIED", reason: `matches fixture.service.price=${fxNum}` };
      // Anchor pricing: any OTHER currency amount when fixture only has one explicit price is MODEL-INVENTED
      return { classification: "MODEL-INVENTED", reason: `evidence value ${evNum} ≠ fixture.service.price ${fxNum}` };
    }
    // No price supplied — any currency amount is invented
    return { classification: "MODEL-INVENTED", reason: "no fixture.service.price supplied; any currency amount is invented" };
  }

  // Bonus values — fixture has no structured bonuses, so any (£X value) is invented
  if (category === "fabricated_bonus_value" || category === "fabricated_total_value") {
    if (fx.service.bonuses && evidence) {
      const e = norm(evidence);
      if (norm(fx.service.bonuses).includes(e)) return { classification: "USER-SUPPLIED", reason: "evidence appears in fixture.service.bonuses" };
    }
    return { classification: "MODEL-INVENTED", reason: "no matching bonus value in fixture.service.bonuses" };
  }

  // Cohort limits — fixture has no cohort-size field, so any specific N is invented unless mentioned in description
  if (category === "fabricated_cohort_limit") {
    const evMatch = evidence.match(/\d+/);
    if (evMatch && fx.service.description.includes(evMatch[0])) return { classification: "USER-SUPPLIED", reason: `cohort count "${evMatch[0]}" appears in fixture.service.description` };
    return { classification: "MODEL-INVENTED", reason: "cohort count not in fixture inputs" };
  }

  // Programme duration — check against fixture.service.deliveryDuration + description
  if (category === "fabricated_programme_duration") {
    if (fx.service.deliveryDuration && norm(evidence).includes(norm(fx.service.deliveryDuration))) return { classification: "USER-SUPPLIED", reason: "matches fixture.service.deliveryDuration" };
    // Also check description for the same duration phrase
    if (norm(fx.service.description).includes(norm(evidence))) return { classification: "USER-SUPPLIED", reason: "duration phrase appears in fixture.service.description" };
    return { classification: "MODEL-INVENTED", reason: "duration not in fixture.service.deliveryDuration or description" };
  }

  // Guarantee timeframe — check fixture.service.guaranteeDuration + description
  if (category === "fabricated_guarantee_timeframe") {
    if (fx.service.guaranteeDuration && norm(evidence).includes(norm(fx.service.guaranteeDuration))) return { classification: "USER-SUPPLIED", reason: "matches fixture.service.guaranteeDuration" };
    if (norm(fx.service.description).includes(norm(evidence))) return { classification: "USER-SUPPLIED", reason: "timeframe appears in fixture.service.description" };
    return { classification: "MODEL-INVENTED", reason: "timeframe not in fixture.service.guaranteeDuration or description" };
  }

  // Refund mechanic — fixture.service.guaranteeType
  if (category === "fabricated_specific_refund_mechanic") {
    if (fx.service.guaranteeType && norm(fx.service.guaranteeType).includes(norm(evidence))) return { classification: "USER-SUPPLIED", reason: "matches fixture.service.guaranteeType" };
    return { classification: "MODEL-INVENTED", reason: "refund mechanic not in fixture.service.guaranteeType" };
  }

  // Next-cohort date — always invented; fixture has no cohort-date field
  if (category === "fabricated_next_cohort_date") {
    return { classification: "MODEL-INVENTED", reason: "fixture has no cohort-date field; any next-cohort mention is invented" };
  }

  // Placeholder leakage — always model-inserted (placeholders are scaffolding leaked into user-visible output)
  if (category === "placeholder_leakage") {
    return { classification: "MODEL-INVENTED", reason: "operator-fill placeholder leaked into output" };
  }

  // LP testimonial archetypal-with-location — check if any fixture testimonial name matches
  if (category === "lp_testimonial_archetypal_with_location") {
    const supplied = [fx.service.testimonial1Name, fx.service.testimonial2Name, fx.service.testimonial3Name].filter(Boolean) as string[];
    if (supplied.length === 0) return { classification: "MODEL-INVENTED", reason: "no fixture-supplied testimonials" };
    const evNorm = norm(evidence);
    if (supplied.some(n => evNorm.includes(norm(n)))) return { classification: "USER-SUPPLIED", reason: "evidence matches a fixture-supplied testimonial name" };
    return { classification: "MODEL-INVENTED", reason: "archetypal pattern not matching any fixture-supplied testimonial name" };
  }

  // Compliance hedge — always model-inserted
  if (category === "compliance_hedge_disclaimer") {
    return { classification: "MODEL-INVENTED", reason: "operator never supplies compliance hedging in fixture inputs" };
  }

  return { classification: "UNCERTAIN", reason: "no classifier rule for this category" };
}

const FABRICATION_PATTERNS: { category: string; regex: RegExp; from: string[] }[] = [
  { category: "fabricated_pricing_currency_amount", from: ["pricing"], regex: /[£$€¥]\s?\d[\d,]*(?:\.\d+)?\s?(?:k\b|K\b|m\b|M\b|million|thousand)?/g },
  { category: "fabricated_anchor_price_range", from: ["pricing"], regex: /[£$€¥]\s?\d[\d,]+\s?[-–—]\s?[£$€¥]?\s?\d[\d,]+/g },
  { category: "fabricated_bonus_value", from: ["bonuses"], regex: /\(\s?[£$€¥]?\s?\d[\d,]*\s?(value|worth)\s?\)/gi },
  { category: "fabricated_total_value", from: ["bonuses"], regex: /total\s+(bonus\s+)?value[:\s]+[£$€¥]?\s?\d[\d,]*/gi },
  { category: "fabricated_cohort_limit", from: ["urgency"], regex: /\b(?:maximum of|only|just|limited to)\s+\d+\s+(?:places?|seats?|spots?|leaders?|members?|founders?|participants?|attendees?|clients?)\b/gi },
  { category: "fabricated_programme_duration", from: ["pricing", "guarantee"], regex: /\b\d+[-\s]?(?:minute|hour|day|week|month)\s+(?:keynote|session|workshop|programme|program|engagement|sprint|cohort|intensive)\b/gi },
  { category: "fabricated_guarantee_timeframe", from: ["guarantee"], regex: /\b(?:within|in)\s+\d+[-\s]?(?:days?|weeks?|months?|hours?)\b/gi },
  { category: "fabricated_specific_refund_mechanic", from: ["guarantee"], regex: /\b(?:pay nothing|full refund|money[\s-]back)\b/gi },
  { category: "fabricated_next_cohort_date", from: ["urgency"], regex: /\b(?:next cohort|next round|cohort opens?|enrolment closes?)\b/gi },
  { category: "placeholder_leakage", from: ["pricing", "guarantee", "urgency", "bonuses", "offerName", "valueProposition", "cta", "mainHeadline", "subheadline", "problemAgitation", "solutionIntro", "uniqueMechanism", "insiderAdvantages", "scarcityUrgency", "primaryCta"], regex: /\[INSERT_[A-Z_]+\]/g },
  { category: "lp_testimonial_archetypal_with_location", from: ["testimonials"], regex: /(?:A|An)\s+(?:Senior|Chief|Head|Director|VP|CEO|CTO|CFO|Founder|Owner|Manager|Lead)\s+[A-Za-z]+(?:\s+[A-Za-z]+)?\s+at\s+(?:a|an|the)?\s*[A-Za-z][^"]*/g },
  { category: "compliance_hedge_disclaimer", from: ["pricing", "valueProposition", "guarantee"], regex: /\bresults?\s+may\s+vary\b/gi },
];

function auditValue(testId: string, asset: FabricationFinding["asset"], fieldName: string, value: any, fixture: Fixture): FabricationFinding[] {
  if (value == null) return [];
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const findings: FabricationFinding[] = [];
  for (const pat of FABRICATION_PATTERNS) {
    if (!pat.from.includes(fieldName)) continue;
    const matches = text.match(pat.regex);
    if (matches && matches.length > 0) {
      for (const m of matches.slice(0, 3)) { // cap evidence per pattern per field
        const cls = classifyFinding(testId, pat.category, m, fixture);
        findings.push({ testId, asset, category: pat.category, evidence: m.substring(0, 200), classification: cls.classification, classification_reason: cls.reason });
      }
    }
  }
  return findings;
}

function audit(records: GenerationRecord[]): FabricationFinding[] {
  const allFindings: FabricationFinding[] = [];
  for (const r of records) {
    const fixture = FIXTURES.find(f => f.testId === r.testId);
    if (!fixture) continue;
    for (const angleKey of ["godfatherAngle", "freeAngle", "dollarAngle"] as const) {
      const angle = (r.offer as any)[angleKey];
      if (!angle) continue;
      const assetTag = angleKey === "godfatherAngle" ? "offer.godfather" : angleKey === "freeAngle" ? "offer.free" : "offer.dollar";
      for (const fieldName of Object.keys(angle)) {
        allFindings.push(...auditValue(r.testId, assetTag as FabricationFinding["asset"], fieldName, angle[fieldName], fixture));
      }
    }
    const lp = r.landingPage.originalAngle;
    if (lp) {
      for (const fieldName of Object.keys(lp)) {
        if (fieldName === "testimonials" && Array.isArray(lp[fieldName])) {
          const flat = (lp[fieldName] as any[]).map(t => `${t?.name ?? ""} ${t?.quote ?? ""} ${t?.location ?? ""}`).join(" | ");
          allFindings.push(...auditValue(r.testId, "lp.original", fieldName, flat, fixture));
        } else {
          allFindings.push(...auditValue(r.testId, "lp.original", fieldName, lp[fieldName], fixture));
        }
      }
    }
  }
  return allFindings;
}

// ════════════════════════════════════════════════════════════════════════════
// Phase E γ — EMAIL GENERATOR RED-TEAM EXTENSION
// ════════════════════════════════════════════════════════════════════════════
//
// Activation: REDTEAM_EXECUTE=1 + REDTEAM_EMAIL_PHASE=1.
// Without REDTEAM_EMAIL_PHASE the entire block below is dormant — no email
// generation, no email audit, no email cleanup, no behavioural drift vs the
// v1/v2 baseline runs.
//
// Methodology lock: docs/phase-e-email-redteam-plan.md is the binding
// specification. This implementation operationalises §4 (classifier logic),
// §5 (retry observation), §6 (artifact paths), and §3 (fixture matrix).
//
// CRITICAL — v2 §6 methodology corrections, applied to EMAIL audit ONLY:
//
//   GAP #1 (token-override in classifier): EMAIL_CLASSIFIER_TOKEN_OVERRIDES
//     map below mirrors the validator-time token-override semantics from
//     server/_core/validator.ts. When the canonical operator-fill token is
//     present in the same field as a fabrication hit, the classifier
//     downgrades the finding to UNCERTAIN (validator-side suppression would
//     fire at generation time). Without this fix, v2's audit produced
//     amplified false-positive rates on cohort/duration categories.
//
//   GAP #2 (full-operator-context cross-check): collectOperatorContext()
//     concatenates every operator-supplied surface (service fields incl
//     testimonials, ICP fields, eventDetails) into a single substring-match
//     blob. Findings whose normalised evidence appears in this blob are
//     reclassified USER-SUPPLIED. v2 only cross-checked service.price; this
//     fix catches operator content surfacing through any other field.
//
//   These corrections live HERE so baseline-v1/v2 artifacts remain untouched.
//   The legacy classifyFinding() above is the v1/v2 classifier and is left
//   in place verbatim for offer/LP runs — cross-version comparability
//   preserved. EMAIL findings flow through classifyEmailFinding() below
//   which IS the corrected methodology and will become the v3 standard.

// ─── Phase E γ — Email audit-classifier catalog ──────────────────────────────
// Mirrors docs/phase-e-email-redteam-plan.md §2.2. The "from" array now
// references email-specific field names (not the offer/LP shape used in the
// legacy FABRICATION_PATTERNS above). Field names: body, subject,
// previewText, ps, cta. The cta field is included for fabricated_cta_url
// audit even though validateEmailFabricationPatterns does NOT scan it —
// this is the audit-side surfacing of forensic-map GAP-E7.
const EMAIL_FABRICATION_PATTERNS: { category: string; regex: RegExp; from: string[] }[] = [
  { category: "fabricated_pricing_currency_amount", from: ["body","subject","previewText","ps","cta"], regex: /[£$€¥]\s?\d[\d,]*(?:\.\d+)?\s?(?:k\b|K\b|m\b|M\b|million|thousand)?/g },
  { category: "fabricated_anchor_price_range",      from: ["body","subject","previewText","ps"],       regex: /[£$€¥]\s?\d[\d,]+\s?[-–—]\s?[£$€¥]?\s?\d[\d,]+/g },
  { category: "fabricated_bonus_value",             from: ["body","ps"],                                regex: /\(\s?[£$€¥]?\s?\d[\d,]*\s?(value|worth)\s?\)/gi },
  { category: "fabricated_total_value",             from: ["body"],                                     regex: /total\s+(bonus\s+)?value[:\s]+[£$€¥]?\s?\d[\d,]*/gi },
  { category: "fabricated_cohort_limit",            from: ["body","subject","previewText","ps"],       regex: /\b(?:maximum of|only|just|limited to)\s+\d+\s+(?:places?|seats?|spots?|leaders?|members?|founders?|participants?|attendees?|clients?)\b/gi },
  { category: "fabricated_programme_duration",      from: ["body","subject","previewText","ps"],       regex: /\b\d+[-\s]?(?:minute|hour|day|week|month)\s+(?:keynote|session|workshop|programme|program|engagement|sprint|cohort|intensive)\b/gi },
  { category: "fabricated_guarantee_timeframe",     from: ["body","subject","previewText","ps"],       regex: /\b(?:within|in)\s+\d+[-\s]?(?:days?|weeks?|months?|hours?)\b/gi },
  { category: "fabricated_specific_refund_mechanic",from: ["body","subject","previewText","ps"],       regex: /\b(?:pay nothing|full refund|money[\s-]back)\b/gi },
  { category: "fabricated_next_cohort_date",        from: ["body","subject","previewText","ps"],       regex: /\b(?:next cohort|next round|cohort opens?|enrolment closes?)\b/gi },
  { category: "placeholder_leakage",                from: ["body","subject","previewText","ps","cta"], regex: /\[INSERT_[A-Z_0-9]+\]/g }, // classified INTENDED post-corrections
  { category: "lp_archetypal_in_email",             from: ["body","ps"],                                regex: /(?:A|An)\s+(?:Senior|Chief|Head|Director|VP|CEO|CTO|CFO|Founder|Owner|Manager|Lead)\s+[A-Za-z]+(?:\s+[A-Za-z]+)?\s+at\s+(?:a|an|the)?\s*[A-Za-z][^"]*/g },
  { category: "compliance_hedge_disclaimer",        from: ["body","ps"],                                regex: /\bresults?\s+may\s+vary\b/gi },
  { category: "fabricated_cta_url",                 from: ["cta"],                                      regex: /https?:\/\/[^\s]+/g },
  { category: "fabricated_event_venue",             from: ["body"],                                     regex: /\b(?:meet|venue|located|address|directions|parking)\b.{0,80}\b\d+\s+[A-Z][a-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)\b/gi },
];

// ─── Phase E γ — Token-override allow-list (corrects v2 §6 GAP #1) ───────────
// When the canonical placeholder for a category is in the field text, the
// production validator suppresses the hit (server/_core/validator.ts:472).
// Audit classifier mirrors that semantic.
const EMAIL_CLASSIFIER_TOKEN_OVERRIDES: Record<string, string[]> = {
  fabricated_pricing_currency_amount:   ["[INSERT_PRICE]"],
  fabricated_anchor_price_range:        ["[INSERT_PRICE]"],
  fabricated_bonus_value:               ["[INSERT_BONUS_VALUE]"],
  fabricated_total_value:               ["[INSERT_BONUS_VALUE]"],
  fabricated_cohort_limit:              ["[INSERT_COHORT_LIMIT]"],
  fabricated_programme_duration:        ["[INSERT_PROGRAMME_DURATION]"],
  fabricated_guarantee_timeframe:       ["[INSERT_GUARANTEE_TERMS]"],
  fabricated_specific_refund_mechanic:  ["[INSERT_GUARANTEE_TERMS]"],
  fabricated_next_cohort_date:          ["[INSERT_COHORT_CLOSE_DATE]", "[INSERT_CART_CLOSE_DATE]", "[INSERT_DEADLINE]"],
  fabricated_event_venue:               ["[INSERT_EVENT_VENUE]"],
};

// CTA token allow-list: a CTA URL match that IS one of these canonical
// operator-fill tokens is intentional emission, not fabrication.
const CTA_TOKEN_ALLOW_LIST = ["[INSERT_OFFER_LINK]", "[INSERT_BOOKING_URL]", "[INSERT_REPLAY_URL]"];

// ─── Phase E γ — Full operator context collector (corrects v2 §6 GAP #2) ─────
function collectOperatorContext(fx: Fixture): string {
  const parts: (string | undefined)[] = [
    fx.service.name,
    fx.service.description,
    fx.service.targetCustomer,
    fx.service.mainBenefit,
    fx.service.price,
    fx.service.guaranteeDuration,
    fx.service.guaranteeType,
    fx.service.deliveryDuration,
    fx.service.bonuses,
    fx.service.painPoints,
    fx.service.pressFeatures,
    fx.service.testimonial1Name, fx.service.testimonial1Title, fx.service.testimonial1Quote,
    fx.service.testimonial2Name, fx.service.testimonial2Title, fx.service.testimonial2Quote,
    fx.service.testimonial3Name, fx.service.testimonial3Title, fx.service.testimonial3Quote,
    fx.icp.pains, fx.icp.goals, fx.icp.objections, fx.icp.buyingTriggers,
    fx.icp.implementationBarriers, fx.icp.fears, fx.icp.frustrations,
    fx.eventDetails?.eventName, fx.eventDetails?.eventDate, fx.eventDetails?.hostName,
    fx.eventDetails?.offerName, fx.eventDetails?.price, fx.eventDetails?.deadline,
    fx.eventDetails?.eventTime, fx.eventDetails?.eventTimezone,
    fx.eventDetails?.eventVenue, fx.eventDetails?.eventAgenda,
    fx.eventDetails?.eventDuration, fx.eventDetails?.replayUrl, fx.eventDetails?.bookingUrl,
  ];
  return parts.filter((s): s is string => Boolean(s)).join(" | ");
}

const normalizeForMatch = (s: string) => s.toLowerCase().replace(/[\s,]/g, "");

// ─── Phase E γ — Email finding classifier (CORRECTED methodology) ────────────
//
// Order of checks (first match wins):
//   1. Placeholder-leakage / CTA-allowlist token → INTENDED (not fabrication)
//   2. v2 §6 GAP #1 token-override → UNCERTAIN
//   3. v2 §6 GAP #2 full-operator-context cross-check → USER-SUPPLIED
//   4. Per-category MODEL-INVENTED heuristic
//   5. Default UNCERTAIN
//
// Returns the v1/v2 classification triple plus a methodology-version tag so
// future v3 baseline doc can audit which findings flowed through corrected vs
// legacy logic.
function classifyEmailFinding(
  testId: string,
  category: string,
  evidence: string,
  fieldText: string,
  fixture: Fixture,
): { classification: FabricationFinding["classification"] | "INTENDED"; reason: string; methodologyVersion: "v3-corrected" } {
  // (1) Canonical placeholder emission = INTENDED, not fabrication.
  if (category === "placeholder_leakage") {
    return {
      classification: "INTENDED",
      reason: "canonical operator-fill placeholder — intentional emission per Phase D Sprint 1+2 contract",
      methodologyVersion: "v3-corrected",
    };
  }
  if (category === "fabricated_cta_url" && CTA_TOKEN_ALLOW_LIST.some(t => fieldText.includes(t))) {
    return {
      classification: "INTENDED",
      reason: `CTA contains canonical token (${CTA_TOKEN_ALLOW_LIST.filter(t => fieldText.includes(t)).join(",")}) — intentional operator-fill, not fabrication`,
      methodologyVersion: "v3-corrected",
    };
  }

  // (2) v2 §6 GAP #1 — token-override suppression.
  const overrides = EMAIL_CLASSIFIER_TOKEN_OVERRIDES[category];
  if (overrides && overrides.some(t => fieldText.includes(t))) {
    return {
      classification: "UNCERTAIN",
      reason: `canonical token (${overrides.filter(t => fieldText.includes(t)).join(",")}) present in same field — validator-side suppression would apply at generation time`,
      methodologyVersion: "v3-corrected",
    };
  }

  // (3) v2 §6 GAP #2 — full-operator-context cross-check.
  const opCtx = collectOperatorContext(fixture);
  const evN = normalizeForMatch(evidence);
  if (evN.length >= 3 && normalizeForMatch(opCtx).includes(evN)) {
    return {
      classification: "USER-SUPPLIED",
      reason: "evidence appears verbatim in operator-supplied context (service/ICP/eventDetails)",
      methodologyVersion: "v3-corrected",
    };
  }

  // (4) Per-category MODEL-INVENTED heuristics — re-use v1/v2 rules where
  // sensible, extend for the new email-specific categories.
  if (category === "fabricated_pricing_currency_amount" || category === "fabricated_anchor_price_range") {
    const evNumMatch = evidence.match(/\d[\d,]*/);
    if (!evNumMatch) return { classification: "UNCERTAIN", reason: "no numeric extracted from evidence", methodologyVersion: "v3-corrected" };
    const evNum = parseFloat(evNumMatch[0].replace(/,/g, ""));
    if (fixture.service.price) {
      const fxNum = parseFloat(fixture.service.price);
      if (Math.abs(evNum - fxNum) < 0.01) return { classification: "USER-SUPPLIED", reason: `matches fixture.service.price=${fxNum}`, methodologyVersion: "v3-corrected" };
      return { classification: "MODEL-INVENTED", reason: `evidence value ${evNum} ≠ fixture.service.price ${fxNum}`, methodologyVersion: "v3-corrected" };
    }
    return { classification: "MODEL-INVENTED", reason: "no fixture.service.price supplied; any currency amount is invented", methodologyVersion: "v3-corrected" };
  }
  if (category === "fabricated_cta_url") {
    // Already handled INTENDED allowlist above. Any non-allowlisted URL is fabricated unless found in operator context (handled in step 3).
    return { classification: "MODEL-INVENTED", reason: "CTA URL not in operator-context and not a canonical token", methodologyVersion: "v3-corrected" };
  }
  if (category === "fabricated_event_venue") {
    if (fixture.eventDetails?.eventVenue && normalizeForMatch(evidence).includes(normalizeForMatch(fixture.eventDetails.eventVenue))) {
      return { classification: "USER-SUPPLIED", reason: "matches fixture.eventDetails.eventVenue", methodologyVersion: "v3-corrected" };
    }
    return { classification: "MODEL-INVENTED", reason: "venue/address detail not in fixture.eventDetails", methodologyVersion: "v3-corrected" };
  }
  if (category === "lp_archetypal_in_email") {
    const supplied = [fixture.service.testimonial1Name, fixture.service.testimonial2Name, fixture.service.testimonial3Name].filter(Boolean) as string[];
    if (supplied.length === 0) return { classification: "MODEL-INVENTED", reason: "no fixture-supplied testimonials — archetypal pattern is invented composite", methodologyVersion: "v3-corrected" };
    const en = normalizeForMatch(evidence);
    if (supplied.some(n => en.includes(normalizeForMatch(n)))) {
      return { classification: "USER-SUPPLIED", reason: "evidence matches a fixture-supplied testimonial name", methodologyVersion: "v3-corrected" };
    }
    return { classification: "MODEL-INVENTED", reason: "archetypal pattern does not match any fixture-supplied testimonial name", methodologyVersion: "v3-corrected" };
  }
  if (category === "compliance_hedge_disclaimer") {
    return { classification: "MODEL-INVENTED", reason: "operator never supplies compliance hedging in fixture inputs", methodologyVersion: "v3-corrected" };
  }
  if (category === "fabricated_cohort_limit" || category === "fabricated_programme_duration" || category === "fabricated_guarantee_timeframe" || category === "fabricated_specific_refund_mechanic" || category === "fabricated_next_cohort_date" || category === "fabricated_bonus_value" || category === "fabricated_total_value") {
    // Cross-check handled in step 3 above; reaching here means no operator-context match and no token override.
    return { classification: "MODEL-INVENTED", reason: `category=${category} — no operator-context match and no canonical-token suppression`, methodologyVersion: "v3-corrected" };
  }

  return { classification: "UNCERTAIN", reason: "no classifier rule matched for this category", methodologyVersion: "v3-corrected" };
}

// ─── Phase E γ — Email finding type (extends classification with INTENDED) ───
type EmailFabricationFinding = {
  testId: string;
  sequenceType: EmailSequenceType;
  emailIndex: number;
  field: "body" | "subject" | "previewText" | "ps" | "cta";
  category: string;
  evidence: string;
  classification: FabricationFinding["classification"] | "INTENDED";
  classification_reason: string;
  methodology_version: "v3-corrected";
};

function auditEmailField(
  testId: string,
  sequenceType: EmailSequenceType,
  emailIndex: number,
  field: "body" | "subject" | "previewText" | "ps" | "cta",
  value: string | undefined,
  fixture: Fixture,
): EmailFabricationFinding[] {
  if (!value) return [];
  const findings: EmailFabricationFinding[] = [];
  for (const pat of EMAIL_FABRICATION_PATTERNS) {
    if (!pat.from.includes(field)) continue;
    const matches = value.match(pat.regex);
    if (matches && matches.length > 0) {
      for (const m of matches.slice(0, 3)) {
        const cls = classifyEmailFinding(testId, pat.category, m, value, fixture);
        findings.push({
          testId, sequenceType, emailIndex, field,
          category: pat.category,
          evidence: m.substring(0, 200),
          classification: cls.classification,
          classification_reason: cls.reason,
          methodology_version: cls.methodologyVersion,
        });
      }
    }
  }
  return findings;
}

function auditEmails(records: GenerationRecord[]): EmailFabricationFinding[] {
  const all: EmailFabricationFinding[] = [];
  for (const r of records) {
    const fixture = FIXTURES.find(f => f.testId === r.testId);
    if (!fixture || !r.emails) continue;
    for (const [seqTypeRaw, result] of Object.entries(r.emails)) {
      if (!result || !result.emails) continue;
      const seqType = seqTypeRaw as EmailSequenceType;
      result.emails.forEach((e, i) => {
        all.push(...auditEmailField(r.testId, seqType, i, "body", e.body, fixture));
        all.push(...auditEmailField(r.testId, seqType, i, "subject", e.subject, fixture));
        all.push(...auditEmailField(r.testId, seqType, i, "previewText", e.previewText, fixture));
        all.push(...auditEmailField(r.testId, seqType, i, "ps", e.ps, fixture));
        all.push(...auditEmailField(r.testId, seqType, i, "cta", e.cta, fixture));
      });
    }
  }
  return all;
}

// ─── Phase E γ — Email generation phase ──────────────────────────────────────
// Invoked from main IIFE iff EMAIL_PHASE_ENABLED && !DRY_MODE && !SMOKE_MODE.
// Iterates all 10 sequence types per fixture (174-generation matrix per
// docs/phase-e-email-redteam-plan.md §3). Per-sequence-type try/catch — a
// single-sequence failure does not abort the run.
async function generateEmails(records: GenerationRecord[]): Promise<void> {
  const { runEmailSequenceGeneration } = await import("../server/emailSequenceGenerator.ts");
  const { getDb } = await import("../server/db.ts");
  const { emailSequences } = await import("../drizzle/schema.ts");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const fixture = FIXTURES.find(f => f.testId === r.testId);
    if (!fixture) continue;
    r.emails = {};

    for (const seqType of EMAIL_SEQUENCE_TYPES) {
      console.log(`\n[REDTEAM email ${i + 1}/${records.length}] ${r.testId} — generating ${seqType}...`);
      const result: EmailGenerationResult = { sequenceType: seqType };
      try {
        const { id } = await runEmailSequenceGeneration({
          userId: TEST_USER_ID,
          serviceId: r.serviceId,
          campaignId: undefined,
          sequenceType: seqType,
          name: `${REDTEAM_PREFIX}_email_${r.testId}_${seqType}`,
          eventDetails: fixture.eventDetails,
        });
        result.emailSequenceId = id;
        const [row] = await db.select().from(emailSequences).where(eq(emailSequences.id, id)).limit(1);
        if (row) {
          const emails = typeof row.emails === "string" ? JSON.parse(row.emails) : row.emails;
          result.emails = emails as RawCapturedEmail[];
        }
        console.log(`[REDTEAM email ${i + 1}/${records.length}] ${seqType} → emailSequenceId=${id}, ${result.emails?.length ?? 0} emails captured.`);
      } catch (e) {
        result.error = e instanceof Error ? e.message : String(e);
        console.error(`[REDTEAM email ${i + 1}/${records.length}] ${seqType} FAILED: ${result.error}`);
      }

      r.emails[seqType] = result;
      // Append-only raw output preservation (per plan §6).
      appendFileSync(EMAIL_RAW_OUTPUTS_FILE, JSON.stringify({ phase: "post-email-generate", ts: new Date().toISOString(), testId: r.testId, sequenceType: seqType, result }) + "\n");
      // Per-record snapshot to email-results file.
      writeFileSync(EMAIL_RESULTS_FILE, JSON.stringify(records.map(rec => ({ testId: rec.testId, emails: rec.emails })), null, 2));
    }
  }
}

// ─── Phase E γ — Email cleanup (additive — runs only if EMAIL_PHASE_ENABLED) ─
async function cleanupEmails(): Promise<void> {
  const { getDb } = await import("../server/db.ts");
  const { services, emailSequences } = await import("../drizzle/schema.ts");
  const { like, inArray } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const svcRows = await db.select({ id: services.id }).from(services).where(like(services.name, `${REDTEAM_PREFIX}%`));
  const svcIds = svcRows.map(r => r.id);
  if (svcIds.length) {
    await db.delete(emailSequences).where(inArray(emailSequences.serviceId, svcIds));
  }
  console.log(`[REDTEAM email-cleanup] deleted emailSequences rows for ${svcIds.length} __REDTEAM__ services.`);
}

// ─── Phase E γ — Dry-run matrix printer ──────────────────────────────────────
function printDryMatrix(): void {
  console.log("\n[REDTEAM DRY-RUN] Matrix preview — no DB writes, no LLM calls.\n");
  console.log("Offer/LP phase (v1/v2 baseline):");
  console.log(`  fixtures = ${FIXTURES.length} (offer + LP × 1 each = ${FIXTURES.length * 2} generations)`);
  console.log("");
  if (EMAIL_PHASE_ENABLED) {
    console.log("Email phase (Phase E γ):");
    console.log(`  fixtures × sequenceTypes = ${FIXTURES.length} × ${EMAIL_SEQUENCE_TYPES.length} = ${FIXTURES.length * EMAIL_SEQUENCE_TYPES.length} base generations`);
    const eventAnchoredTypes = ["discovery_call_confirmation", "discovery_call_reminder", "event_logistics", "replay_for_no_shows"];
    const supplementary = 3 * eventAnchoredTypes.length * 2; // 3 fixtures × 4 event types × (B+C conditions)
    console.log(`  + event-anchored supplementary (3 fixtures × ${eventAnchoredTypes.length} types × 2 conditions) = ${supplementary}`);
    console.log(`  total email generations = ${FIXTURES.length * EMAIL_SEQUENCE_TYPES.length + supplementary}`);
    console.log("");
    console.log("Cost estimate (email phase):");
    console.log("  ~6.5k tokens/generation × 174 = ~1.13M tokens");
    console.log("  ~$8 input + ~$7 output ≈ $15 typical, $50 worst-case retry cascade");
    console.log("");
    console.log("Wall-clock estimate (email phase, serial):");
    console.log("  ~30s/generation × 174 = ~87min");
    console.log("");
    console.log("Audit-classifier catalog:");
    EMAIL_FABRICATION_PATTERNS.forEach(p => console.log(`  - ${p.category}  scans=[${p.from.join(",")}]`));
    console.log("");
    console.log("Token-overrides (v2 §6 GAP #1 corrections):");
    Object.entries(EMAIL_CLASSIFIER_TOKEN_OVERRIDES).forEach(([cat, toks]) => console.log(`  - ${cat} → ${toks.join(", ")}`));
    console.log("");
    console.log("CTA token allow-list:");
    console.log(`  ${CTA_TOKEN_ALLOW_LIST.join(", ")}`);
  } else {
    console.log("Email phase: DISABLED (set REDTEAM_EMAIL_PHASE=1 to enable).");
  }
  console.log("\n[REDTEAM DRY-RUN] Exiting without DB or LLM activity.\n");
}

// ════════════════════════════════════════════════════════════════════════════
// (end Phase E γ section)
// ════════════════════════════════════════════════════════════════════════════

// ─── Phase 4: Cleanup ─────────────────────────────────────────────────────────

async function cleanup() {
  const { getDb } = await import("../server/db.ts");
  const { services, idealCustomerProfiles, offers, landingPages, campaignKits } = await import("../drizzle/schema.ts");
  const { like, inArray } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const svcRows = await db.select({ id: services.id }).from(services).where(like(services.name, `${REDTEAM_PREFIX}%`));
  const svcIds = svcRows.map(r => r.id);
  const icpRows = await db.select({ id: idealCustomerProfiles.id }).from(idealCustomerProfiles).where(like(idealCustomerProfiles.name, `${REDTEAM_PREFIX}%`));
  const icpIds = icpRows.map(r => r.id);

  if (svcIds.length) {
    await db.delete(landingPages).where(inArray(landingPages.serviceId, svcIds));
    await db.delete(offers).where(inArray(offers.serviceId, svcIds));
  }
  if (icpIds.length) {
    await db.delete(campaignKits).where(inArray(campaignKits.icpId, icpIds));
  }
  if (icpIds.length) await db.delete(idealCustomerProfiles).where(inArray(idealCustomerProfiles.id, icpIds));
  if (svcIds.length) await db.delete(services).where(inArray(services.id, svcIds));

  console.log(`[REDTEAM] Cleanup: deleted ${svcIds.length} services, ${icpIds.length} ICPs, and downstream artifacts.`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  // ─── Phase E γ — DRY_MODE intercept. No DB, no LLM, no cleanup. ────────────
  // Prints the matrix + cost estimate + audit-classifier catalog, then exits.
  // Used for structural verification of the harness extension itself.
  if (DRY_MODE) {
    printDryMatrix();
    process.exit(0);
  }

  let serviceIds: number[] = [];
  let icpIds: number[] = [];
  try {
    console.log(`[REDTEAM] Phase 1: Setup ${SMOKE_MODE ? "(SMOKE MODE)" : ""}`);
    const setupResult = await setup();
    serviceIds = setupResult.serviceIds;
    icpIds = setupResult.icpIds;

    if (SMOKE_MODE) {
      console.log("\n[REDTEAM] SMOKE MODE: skipping generation. Verifying setup + cleanup paths only.");
      console.log(`[REDTEAM] Inserted ${serviceIds.length} services, ${icpIds.length} ICPs.`);
      writeFileSync(RESULTS_FILE, JSON.stringify({ smoke: true, serviceIds, icpIds, ok: true }, null, 2));
      return; // finally{} runs cleanup
    }

    console.log("\n[REDTEAM] Phase 2: Generate");
    const records = await generate(serviceIds, icpIds);

    // ─── Phase E γ — Email generation (opt-in via REDTEAM_EMAIL_PHASE=1) ───
    if (EMAIL_PHASE_ENABLED) {
      console.log("\n[REDTEAM] Phase 2.5 (γ): Email Generation");
      await generateEmails(records);
    }

    console.log("\n[REDTEAM] Phase 3: Audit");
    const findings = audit(records);
    const summary = {
      total_fixtures: records.length,
      offers_generated: records.filter(r => r.offer.offerId).length,
      offers_failed: records.filter(r => r.offer.error).length,
      lps_generated: records.filter(r => r.landingPage.landingPageId).length,
      lps_failed: records.filter(r => r.landingPage.error).length,
      findings_by_category: findings.reduce((acc: Record<string, number>, f) => { acc[f.category] = (acc[f.category] ?? 0) + 1; return acc; }, {}),
      findings_by_fixture: findings.reduce((acc: Record<string, number>, f) => { acc[f.testId] = (acc[f.testId] ?? 0) + 1; return acc; }, {}),
      total_findings: findings.length,
      findings,
      records,
    };
    writeFileSync(RESULTS_FILE, JSON.stringify(summary, null, 2));
    console.log(`\n[REDTEAM] Audit complete. Summary written to ${RESULTS_FILE}`);
    console.log(`Findings by category:`, summary.findings_by_category);

    // ─── Phase E γ — Email audit (opt-in) ─────────────────────────────────
    if (EMAIL_PHASE_ENABLED) {
      console.log("\n[REDTEAM] Phase 3.5 (γ): Email Audit");
      const emailFindings = auditEmails(records);
      const emailSummary = {
        methodology_version: "v3-corrected",
        baseline_artifact_path_target: "tools/redteam-baseline/baseline-email-v1-YYYY-MM-DD/",
        total_email_generations: records.reduce((n, r) => n + Object.keys(r.emails ?? {}).length, 0),
        successful_generations: records.reduce((n, r) => n + Object.values(r.emails ?? {}).filter(e => e?.emailSequenceId).length, 0),
        failed_generations: records.reduce((n, r) => n + Object.values(r.emails ?? {}).filter(e => e?.error).length, 0),
        findings_by_category: emailFindings.reduce((acc: Record<string, number>, f) => { acc[f.category] = (acc[f.category] ?? 0) + 1; return acc; }, {}),
        findings_by_classification: emailFindings.reduce((acc: Record<string, number>, f) => { acc[f.classification] = (acc[f.classification] ?? 0) + 1; return acc; }, {}),
        findings_by_sequence_type: emailFindings.reduce((acc: Record<string, number>, f) => { acc[f.sequenceType] = (acc[f.sequenceType] ?? 0) + 1; return acc; }, {}),
        findings_by_field: emailFindings.reduce((acc: Record<string, number>, f) => { acc[f.field] = (acc[f.field] ?? 0) + 1; return acc; }, {}),
        total_findings: emailFindings.length,
        findings: emailFindings,
      };
      writeFileSync(EMAIL_FINDINGS_FILE, JSON.stringify(emailSummary, null, 2));
      console.log(`\n[REDTEAM γ] Email audit complete. Findings written to ${EMAIL_FINDINGS_FILE}`);
      console.log(`Email findings by category:`, emailSummary.findings_by_category);
      console.log(`Email findings by classification:`, emailSummary.findings_by_classification);
    }
  } catch (e) {
    console.error("[REDTEAM] FATAL:", e);
  } finally {
    console.log("\n[REDTEAM] Phase 4: Cleanup");
    // Phase E γ — extend cleanup additively. Email cleanup runs BEFORE the
    // legacy cleanup so the FK chain (emailSequences.serviceId → services)
    // is severed before services are deleted.
    if (EMAIL_PHASE_ENABLED) {
      try { await cleanupEmails(); } catch (e) { console.error("[REDTEAM γ] email cleanup failed:", e); }
    }
    try { await cleanup(); } catch (e) { console.error("[REDTEAM] cleanup failed:", e); }
    console.log("[REDTEAM] Done.");
    process.exit(0);
  }
})();
