/**
 * Craft-polish render harness (throwaway — not shipped, not imported by the app).
 * Renders each per-reference template's PURE builder with a rich fixture and writes
 * standalone HTML files to /tmp/craft/ so they can be screenshotted headless and
 * judged token-by-token against the frozen references. No DB, no network beyond the
 * font/image CDNs the real published pages already use.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import type { LandingPageContent } from "../drizzle/schema";
import { buildBurchardProductivityHtml } from "../server/lib/templates/burchardProductivity";
import { buildDiscoveryBurchardHtml } from "../server/lib/templates/discoveryBurchard";
import { buildWebinarRajsekarHtml } from "../server/lib/templates/webinarRajsekar";
import { buildEventImanGadzhiHtml } from "../server/lib/templates/eventImanGadzhi";
import { buildEventHormoziHtml } from "../server/lib/templates/eventHormozi";
import { buildSalesAliAbdaalHtml } from "../server/lib/templates/salesAliAbdaal";

const OUT = "/tmp/craft";
mkdirSync(OUT, { recursive: true });

// Reliable, always-up Cloudinary demo assets so composites/heroes actually render.
const HEADSHOT = "https://res.cloudinary.com/demo/image/upload/w_800,h_1200,c_fill,g_face/woman.jpg";
const HERO = "https://res.cloudinary.com/demo/image/upload/w_1600,h_900,c_fill/sample.jpg";
const LOGO = "https://res.cloudinary.com/demo/image/upload/w_240,c_fit/cloudinary_icon.png";
// REAL background-removed presenter cutout (prod account dunshei0y, verified live 200 image/png).
// This is exactly what production emits from resolvePresenterCutoutUrl — a free-standing figure with
// a transparent background — so the webinar/Iman heroes render as cutouts, not framed rectangles.
const CUTOUT = "https://res.cloudinary.com/dunshei0y/image/upload/e_background_removal,c_fit,w_800,f_png/v1774218984/coach-assets_1_1774218983297-arfeen_pic_3.JPG.jpg";

const content = {
  eyebrowHeadline: "FREE 3-DAY LIVE WORKSHOP",
  mainHeadline: "Build a Business That Runs Without You in 90 Days",
  subheadline: "The exact systems I used to scale to 7 figures while working 20 hours a week — mapped out step by step.",
  primaryCta: "Reserve My Free Seat",
  asSeenIn: ["Forbes", "Entrepreneur", "Inc.", "TEDx"],
  quizSection: { question: "", options: [], answer: "" },
  problemAgitation: "You're the bottleneck. Every decision runs through you, and growth just means more hours.",
  solutionIntro: "There's a repeatable system for building a business that runs itself.",
  whyOldFail: "Hustle harder doesn't scale — systems do.",
  uniqueMechanism: "The Self-Running Business Framework: install the four systems that let the machine run without you.",
  testimonials: [
    { headline: "Doubled revenue in 6 months", quote: "I finally took a two-week holiday without the business skipping a beat. The framework paid for itself in the first month.", name: "Ravi Menon", location: "Bengaluru" },
    { headline: "From chaos to calm", quote: "For the first time in years I have a real team and real systems. I'm not the bottleneck anymore.", name: "Sarah Whitfield", location: "London" },
    { headline: "Best decision I made", quote: "The clarity alone was worth it. I know exactly what to build next and why.", name: "Diego Alvarez", location: "Madrid" },
  ],
  insiderAdvantages: "",
  scarcityUrgency: "Doors close Friday — only 200 seats.",
  shockingStat: "",
  timeSavingBenefit: "",
  consultationOutline: [
    { title: "Map Your Systems", description: "Pin down the four systems every self-running business needs and where yours are leaking." },
    { title: "Install The Machine", description: "Build the delegation and automation layer so decisions stop routing through you." },
    { title: "Scale With Calm", description: "Grow revenue without growing your hours — the compounding part most founders never reach." },
  ],
  faq: [
    { question: "Is this really free?", answer: "Yes — the 3-day workshop is completely free to attend live." },
    { question: "What if I can't make it live?", answer: "Attend live for the full experience; replays are available for 48 hours." },
    { question: "Who is this for?", answer: "Coaches, consultants and founders doing 6-7 figures who are stuck being the bottleneck." },
  ],
  guarantee: "Show up for all three days and if you don't leave with a clear systems roadmap, I'll personally send you my full course free.",
  featureHighlights: [
    "The 4-system map that lets a business run without you",
    "My exact delegation scorecard",
    "The weekly cadence that keeps the machine honest",
    "A 90-day install sequence you can start Monday",
  ],
  eventSchedule: { date: "March 18–20, 2026", time: "11:00 AM", timezone: "EST", durationMins: 90, venue: "Live on Zoom", language: "English" },
  proofMetrics: [
    { label: "Founders trained", value: "12,000+" },
    { label: "Avg. revenue lift", value: "2.3×" },
    { label: "Countries", value: "40+" },
  ],
  caseStudies: [
    { name: "Ravi Menon", quote: "Doubled revenue and took my first real holiday in years.", metrics: ["2× revenue", "20 hrs/wk"] },
  ],
  curriculum: [
    { title: "The Self-Running Foundations", emoji: "🧭" },
    { title: "Installing Your Delegation Layer", emoji: "🔧" },
    { title: "Automation That Actually Sticks", emoji: "⚙️" },
    { title: "Scaling With Calm", emoji: "📈" },
  ],
  systemTiles: [
    "Clarify the offer that scales", "Build the delegation engine", "Install honest weekly cadence",
    "Automate the repeatable", "Hire to your gaps", "Protect your calm",
  ],
  bonuses: [
    { title: "The Delegation Scorecard", description: "Score every task and know instantly what to hand off first.", value: "$297" },
    { title: "90-Day Install Calendar", description: "A day-by-day plan to install all four systems.", value: "$197" },
  ],
  price: { amount: "997", currency: "$", installments: "3 payments of $349" },
} as unknown as LandingPageContent;

// Content WITHOUT price (Iman free-event path stays free; Hormozi rendered separately with price)
const freeContent = { ...content, price: undefined } as unknown as LandingPageContent;

const coach = {
  headshotUrl: HEADSHOT, heroImageUrl: HERO, logoUrl: LOGO, coachName: "Alex Rivera",
  presenterCutoutUrl: CUTOUT, // webinar hero cutout (host-bio still uses the framed headshot)
  bookingUrl: "https://cal.com/alexrivera/discovery",
  videoUrl: null, // → headshot poster path (no fabricated video)
  checkoutUrl: "https://alexrivera.com/enrol",
  trustCount: null,
  coachBackground: "Alex Rivera scaled three companies past seven figures before turning 35, then spent a decade teaching founders to escape the bottleneck. Featured in Forbes and on TEDx stages worldwide.",
} as any;

// Iman's presenter IS the page: its builder uses headshotUrl as the free-standing figure, so it
// receives the cutout directly (matches production, where eventPublish passes the resolved cutout).
const coachIman = { ...coach, headshotUrl: CUTOUT } as any;

const SVC = "The Self-Running Business Workshop";

const renders: Array<[string, string]> = [
  ["burchard", buildBurchardProductivityHtml(content, "The Productivity Cheat-Sheet", coach)],
  ["discovery", buildDiscoveryBurchardHtml(content, "Free Discovery Call", coach)],
  ["webinar", buildWebinarRajsekarHtml(content, SVC, coach)],
  ["event-iman", buildEventImanGadzhiHtml(freeContent, SVC, coachIman)],
  ["event-hormozi", buildEventHormoziHtml(content, SVC, coach)],
  ["sales", buildSalesAliAbdaalHtml(content, SVC, coach)],
];

for (const [name, html] of renders) {
  writeFileSync(`${OUT}/${name}.html`, html);
  console.log(`wrote ${OUT}/${name}.html (${html.length} bytes)`);
}
console.log("DONE");
