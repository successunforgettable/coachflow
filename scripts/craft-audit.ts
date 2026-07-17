/**
 * Craft AUDIT harness (throwaway). Renders each template's PURE builder with an HONEST
 * per-reference fixture — aspect-correct neutral placeholder images (silhouette portrait,
 * labelled landscape scene, product cover; NO stock/flower noise) and copy lengths that mirror
 * the frozen reference — so a section-by-section / height comparison against the PNG is fair.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import type { LandingPageContent } from "../drizzle/schema";
import { buildBurchardProductivityHtml } from "../server/lib/templates/burchardProductivity";
import { buildDiscoveryBurchardHtml } from "../server/lib/templates/discoveryBurchard";
import { buildWebinarRajsekarHtml } from "../server/lib/templates/webinarRajsekar";
import { buildEventImanGadzhiHtml } from "../server/lib/templates/eventImanGadzhi";
import { buildEventHormoziHtml } from "../server/lib/templates/eventHormozi";
import { buildSalesAliAbdaalHtml } from "../server/lib/templates/salesAliAbdaal";
import { buildSalesLightHtml } from "../server/lib/templates/salesLight";
import { buildWebinarLightHtml } from "../server/lib/templates/webinarLight";

const OUT = "/tmp/craft"; mkdirSync(OUT, { recursive: true });

// ── HONEST fixtures: REAL royalty-free imagery of the correct kind + shape (no grey boxes, no
// stock flowers, no joke content). Verified 200 image/jpeg. Production swaps in the coach's own
// assets; these stand in at the right aspect so visual fidelity is actually judgeable. ──
const PORTRAIT = "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=800&h=1200&fit=crop&crop=faces&q=80"; // professional headshot (2:3)
const LANDSCAPE = "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&h=900&fit=crop&q=80";        // workshop/stage (16:9) — video poster
const AUDIENCE = "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1600&h=1200&fit=crop&q=80";        // live audience — Iman audience wall
const VIDEO = "https://www.youtube.com/watch?v=aqz-KE-bpKQ"; // neutral open-source film (Big Buck Bunny) — a real, non-joke embed
// REAL background-removed presenter cutout (prod account dunshei0y, verified live 200 image/png) —
// exactly what production emits from resolvePresenterCutoutUrl. Renders the webinar/Iman heroes as
// free-standing figures (transparent bg), not framed rectangles.
const CUTOUT = "https://res.cloudinary.com/dunshei0y/image/upload/e_background_removal,c_fit,w_800,f_png/v1774218984/coach-assets_1_1774218983297-arfeen_pic_3.JPG.jpg";
// Product/magnet cover — a real DESIGNED cover (navy + orange accent + title), exactly the kind of
// asset ZAP composes from the coach's PDF/branding; not a grey box.
const COVER = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="900" viewBox="0 0 680 900">`
  + `<rect width="680" height="900" fill="#161E2A"/><rect width="680" height="14" fill="#F97316"/>`
  + `<text x="340" y="120" font-family="Georgia,serif" font-size="26" fill="#F97316" text-anchor="middle" letter-spacing="4">BRENDON BURCHARD</text>`
  + `<text x="340" y="360" font-family="Arial" font-weight="bold" font-size="86" fill="#FFFFFF" text-anchor="middle">1-PAGE</text>`
  + `<text x="340" y="450" font-family="Arial" font-weight="bold" font-size="72" fill="#FFFFFF" text-anchor="middle">PRODUCTIVITY</text>`
  + `<text x="340" y="530" font-family="Arial" font-weight="bold" font-size="72" fill="#FFFFFF" text-anchor="middle">SHEET</text>`
  + `<rect x="230" y="600" width="220" height="6" fill="#F97316"/>`
  + `<text x="340" y="680" font-family="Arial" font-size="30" fill="#93A0B4" text-anchor="middle">Stop Procrastination</text>`
  + `<text x="340" y="720" font-family="Arial" font-size="30" fill="#93A0B4" text-anchor="middle">&amp; Win the Day</text></svg>`);

const TS6 = [
  { headline: "Doubled revenue in 6 months", quote: "I finally took a two-week holiday without the business skipping a beat. The framework paid for itself in the first month and I never looked back.", name: "Ravi Menon", location: "Bengaluru" },
  { headline: "From chaos to calm", quote: "For the first time in years I have a real team and real systems. I'm not the bottleneck anymore, and revenue kept climbing while I stepped back.", name: "Sarah Whitfield", location: "London" },
  { headline: "Best decision I made", quote: "The clarity alone was worth it. I know exactly what to build next and why, and my team finally runs without me approving everything.", name: "Diego Alvarez", location: "Madrid" },
  { headline: "Scaled past 7 figures", quote: "We crossed seven figures the same year. The delegation system is the piece I'd been missing for a decade of hustle.", name: "Amara Okafor", location: "Lagos" },
  { headline: "Got my evenings back", quote: "I used to work every night. Now the machine runs and I coach my kids' football team. Genuinely life-changing.", name: "Tom Brady", location: "Austin" },
  { headline: "Predictable growth at last", quote: "No more feast-or-famine. The weekly cadence keeps the whole team honest and the pipeline full.", name: "Mei Lin", location: "Singapore" },
];

const base = {
  eyebrowHeadline: "FREE 3-DAY LIVE WORKSHOP",
  mainHeadline: "Build a Business That Runs Without You in Just 90 Days Using the Self-Running System",
  subheadline: "Join this free live class and learn the exact four systems I used to scale past 7 figures while working 20 hours a week — mapped out step by step, with nothing held back.",
  primaryCta: "Reserve My Free Seat",
  asSeenIn: ["Forbes", "Entrepreneur", "Inc.", "TEDx"],
  quizSection: { question: "", options: [], answer: "" },
  problemAgitation: "You're the bottleneck. Every decision runs through you, and growth just means more hours and more stress until something breaks.",
  solutionIntro: "There's a repeatable system for building a business that runs itself — and it works whether you're at $30k or $3m a month.",
  whyOldFail: "Hustle harder doesn't scale — systems do. The founders who break free are the ones who install the machine instead of being the machine.",
  uniqueMechanism: "The Self-Running Business Framework: install the four systems — offer, delegation, automation and cadence — that let the machine run without you.",
  testimonials: TS6,
  insiderAdvantages: "", scarcityUrgency: "Doors close Friday — only 200 seats.", shockingStat: "", timeSavingBenefit: "",
  consultationOutline: [
    { title: "The New Market Opportunity", description: "Why the landscape has shifted and where the biggest openings are for founders right now." },
    { title: "Map Your Systems", description: "Pin down the four systems every self-running business needs and find exactly where yours are leaking time and money right now." },
    { title: "Install The Machine", description: "Build the delegation and automation layer so decisions stop routing through you and your team can move without waiting." },
    { title: "Scale With Calm", description: "Grow revenue without growing your hours — the compounding part most founders never reach because they never escape the day-to-day." },
    { title: "The Untold Strategy", description: "The counter-intuitive move behind the fastest self-running businesses — saved for the final day." },
  ],
  faq: [
    { question: "Is this really free?", answer: "Yes — the 3-day workshop is completely free to attend live. There's an optional paid upgrade at the end, but the core training costs nothing." },
    { question: "What if I can't make it live?", answer: "Attend live for the full experience and the live Q&A; replays are available for 48 hours after each session." },
    { question: "Who is this for?", answer: "Coaches, consultants and founders doing 6-7 figures who are stuck being the bottleneck in their own business." },
    { question: "How long is each session?", answer: "About 90 minutes a day across three days, including live Q&A." },
    { question: "Do I need a team already?", answer: "No. The framework works whether you're solo or already have a small team — it tells you what to build first." },
  ],
  guarantee: "Show up for all three days and if you don't leave with a clear systems roadmap, email us and I'll personally send you my full paid course, free.",
  featureHighlights: ["The 4-system map that lets a business run without you", "My exact delegation scorecard", "The weekly cadence that keeps the machine honest", "A 90-day install sequence you can start Monday"],
  eventSchedule: { date: "March 18–20, 2026", time: "11:00 AM", timezone: "EST", durationMins: 90, venue: "Live on Zoom", language: "English" },
  proofMetrics: [{ label: "Founders trained", value: "12,000+" }, { label: "Avg. revenue lift", value: "2.3×" }, { label: "Countries", value: "40+" }],
  caseStudies: [
    { name: "Ravi Menon", quote: "Doubled revenue and took my first real holiday in years.", metrics: ["2× revenue", "20 hrs/wk"] },
    { name: "Sarah Whitfield", quote: "Built a real team and stepped out of daily ops entirely.", metrics: ["7-figure year", "0 daily approvals"] },
  ],
  curriculum: [
    { title: "The Self-Running Foundations", emoji: "🧭" }, { title: "Installing Your Delegation Layer", emoji: "🔧" },
    { title: "Automation That Actually Sticks", emoji: "⚙️" }, { title: "The Weekly Cadence System", emoji: "📅" },
    { title: "Scaling With Calm", emoji: "📈" },
  ],
  systemTiles: ["Clarify the offer that scales", "Build the delegation engine", "Install honest weekly cadence", "Automate the repeatable", "Hire to your gaps", "Protect your calm"],
  bonuses: [
    { title: "The Delegation Scorecard", description: "Score every task and know instantly what to hand off first.", value: "$297" },
    { title: "90-Day Install Calendar", description: "A day-by-day plan to install all four systems.", value: "$197" },
    { title: "The Cadence Playbook", description: "The exact weekly meeting rhythm that keeps the machine honest.", value: "$149" },
  ],
  price: { amount: "997", currency: "$", installments: "3 payments of $349" },
} as unknown as LandingPageContent;

const freeBase = { ...base, price: undefined } as unknown as LandingPageContent;

// Per-template coach fixtures — correct slots + shapes per reference.
const coachBurchard = { headshotUrl: PORTRAIT, productCoverUrl: COVER, logoUrl: null, coachName: "Alex Rivera", leadMagnetName: "1-Page Productivity Sheet", trustCount: null } as any;
const coachDiscovery = { headshotUrl: PORTRAIT, logoUrl: null, coachName: "Alex Rivera", bookingUrl: "https://cal.com/alexrivera/discovery", trustCount: null } as any;
const coachWebinar = { headshotUrl: PORTRAIT, presenterCutoutUrl: CUTOUT, heroImageUrl: LANDSCAPE, logoUrl: null, coachName: "Alex Rivera", coachBackground: "Alex Rivera scaled three companies past seven figures before turning 35, then spent a decade teaching founders to escape the bottleneck.", videoUrl: VIDEO, isThisYou: [ { label: "You're the bottleneck", body: "Every decision waits on you, and growth just means more hours." }, { label: "No real systems", body: "You've tried tools but nothing sticks, and the team still asks you everything." }, { label: "Stuck at a ceiling", body: "Revenue plateaued because you personally can't do any more hours." } ], trustCount: null } as any;
const coachIman = { headshotUrl: CUTOUT, heroImageUrl: AUDIENCE, coachName: "Alex Rivera" } as any;
const coachHormozi = { headshotUrl: PORTRAIT, heroImageUrl: LANDSCAPE, coachName: "Alex Rivera", coachBackground: "Alex Rivera scaled three companies past seven figures.", videoUrl: VIDEO, whoFor: ["Founders doing 6–7 figures stuck as the bottleneck", "Coaches and consultants ready to build a real team", "Operators who want systems, not more hustle"] } as any;
const coachSales = { headshotUrl: PORTRAIT, videoUrl: VIDEO, logoUrl: null, coachName: "Alex Rivera", checkoutUrl: "https://alexrivera.com/enrol", coachBackground: "Alex Rivera scaled three companies past seven figures before turning 35, then spent a decade teaching founders to escape the bottleneck. Featured in Forbes and on TEDx stages worldwide." } as any;

const SVC = "The Self-Running Business Workshop";
const renders: Array<[string, string]> = [
  ["burchard", buildBurchardProductivityHtml(base, "1-Page Productivity Sheet", coachBurchard)],
  ["discovery", buildDiscoveryBurchardHtml(base, "Free Discovery Call", coachDiscovery)],
  ["webinar", buildWebinarRajsekarHtml(base, SVC, coachWebinar)],
  ["event-iman", buildEventImanGadzhiHtml(freeBase, SVC, coachIman)],
  ["event-hormozi", buildEventHormoziHtml(base, SVC, coachHormozi)],
  ["sales", buildSalesAliAbdaalHtml(base, SVC, coachSales)],
  // Proof-LIGHT variants — judged as designs in their own right (NO reference: they are new
  // compositions for a coach with little/no proof). Rendered at ZERO testimonials (the real coach
  // reality) to prove they look deliberate, not thinned.
  ["sales-light", buildSalesLightHtml({ ...base, testimonials: [] } as typeof base, SVC, coachSales)],
  ["webinar-light", buildWebinarLightHtml({ ...base, testimonials: [] } as typeof base, SVC, coachWebinar)],
];
for (const [name, html] of renders) { writeFileSync(`${OUT}/audit-${name}.html`, html); console.log(`wrote audit-${name}.html (${html.length} bytes)`); }
console.log("DONE");
