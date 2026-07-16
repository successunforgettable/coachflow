import { describe, it, expect } from "vitest";
import { buildEventImanGadzhiHtml } from "./eventImanGadzhi";
import type { LandingPageContent } from "../../../drizzle/schema";

const base = {
  eyebrowHeadline: "LIVE VIRTUAL EVENT",
  mainHeadline: "3 Days to copy my system, and launch your first profitable product",
  subheadline: "No experience needed. No face required. Just follow the system and launch.",
  primaryCta: "GET MY FREE TICKET",
  asSeenIn: [], quizSection: { question: "", options: [], answer: "" },
  problemAgitation: "", solutionIntro: "", whyOldFail: "", uniqueMechanism: "",
  // Present but MUST be ignored — the frozen Iman poster has no proof section.
  testimonials: [{ headline: "", quote: "This changed everything for me.", name: "Jordan Lee", location: "Austin" }],
  insiderAdvantages: "", scarcityUrgency: "Tickets Are First Come, First Served",
  shockingStat: "", timeSavingBenefit: "",
  // The agenda ("What You're Going To Learn") binds to consultationOutline (corrected 2026-07-17).
  consultationOutline: [{ title: "The Market Opportunity", description: "How the landscape shifts in your favour." }],
  faq: [{ question: "Should not render?", answer: "no FAQ on this poster" }], // Iman has NO FAQ section
  guarantee: "",
} as unknown as LandingPageContent;

const coach = {
  headshotUrl: "https://res.cloudinary.com/dunshei0y/image/upload/v1/presenter.png",
  heroImageUrl: "https://res.cloudinary.com/dunshei0y/image/upload/v1/audience.jpg",
  coachName: "Iman Coach",
};

describe("buildEventImanGadzhiHtml — free-ticket event poster on the Iman design bar", () => {
  it("renders the presenter photo (the page's authority anchor) when a headshot exists", () => {
    const html = buildEventImanGadzhiHtml(base, "Make Money Online Challenge", coach);
    expect(html).toContain("presenter.png");
    expect(html).not.toContain("[INSERT_PRESENTER_PHOTO]");
  });

  it("stays a review-draft with NO presenter photo: emits [INSERT_PRESENTER_PHOTO] (publish hard-gate)", () => {
    const html = buildEventImanGadzhiHtml(base, "Challenge", { ...coach, headshotUrl: null, heroImageUrl: null });
    expect(html).toContain("[INSERT_PRESENTER_PHOTO]"); // never a faceless dark poster
  });

  it("binds the date capsule to a REAL eventSchedule, no [INSERT_EVENT_*] when set", () => {
    const dated = { ...base, eventSchedule: { date: "SEPT 28th", endDate: "SEPT 30th" } } as unknown as LandingPageContent;
    const html = buildEventImanGadzhiHtml(dated, "Challenge", coach);
    expect(html).toContain("SEPT 28th");
    expect(html).toContain("SEPT 30th");
    expect(html).not.toContain("[INSERT_EVENT_DATE]");
  });

  it("stays a review-draft with no date: emits [INSERT_EVENT_DATE]", () => {
    const html = buildEventImanGadzhiHtml(base, "Challenge", coach);
    expect(html).toContain("[INSERT_EVENT_DATE]");
  });

  it("renders ONE pill CTA with the label and scarcity note, and no countdown", () => {
    const html = buildEventImanGadzhiHtml(base, "Challenge", coach);
    expect(html).toContain("GET MY FREE TICKET");
    expect(html).toContain("Tickets Are First Come, First Served");
    expect(html).toContain("#FF6242"); // brand orange conversion accent (per the brand design system)
    expect(html).not.toContain('id="ev_cd"'); // the frozen reference shows no countdown — never fake one
  });

  it("greens the trailing emphasis phrase of the headline (styling, not fabricated words)", () => {
    const html = buildEventImanGadzhiHtml(base, "Challenge", coach);
    expect(html).toContain("#00D33A"); // electric-green emphasis present
    // no words invented — the plain headline text is intact
    expect(html).toContain("launch your first profitable product");
  });

  it("wires the reveal-on-intent reserve form to /api/capture-lead in EVENT mode with a honeypot", () => {
    const html = buildEventImanGadzhiHtml(base, "Challenge", coach);
    expect(html).toContain("/api/capture-lead");
    expect(html).toContain("mode:'event'");
    expect(html).toContain('type="email"');
    expect(html).toContain('class="ev_hp_in"'); // honeypot present (class-based, multi-instance reveal)
  });

  // CORRECTED 2026-07-17: the frozen reference is a FULL page, not a poster. The agenda ("What
  // You're Going To Learn") DOES render from consultationOutline; but Iman's reference has no
  // testimonials block and no FAQ, and ZAP never fabricates its $250K/McLaren/Rolex prize pool.
  it("builds the agenda from consultationOutline, omits testimonials/FAQ, never fabricates prizes", () => {
    const html = buildEventImanGadzhiHtml(base, "Challenge", coach);
    expect(html).toContain("What You&rsquo;re Going To Learn"); // agenda section header
    expect(html).toContain("The Market Opportunity"); // real consultationOutline day renders
    expect(html).not.toContain("This changed everything for me."); // no testimonials block (ref has none)
    expect(html).not.toContain("no FAQ on this poster"); // no FAQ section (ref has none)
    expect(html).not.toContain("$250"); // never Iman's prize pool
    expect(html).not.toContain("McLaren");
    expect(html).not.toContain("Rolex");
  });

  it("closes on the legal endpoint (privacy/terms, non-affiliation disclaimer, copyright)", () => {
    const html = buildEventImanGadzhiHtml(base, "Challenge", coach);
    expect(html).toContain("Privacy Policy");
    expect(html).toContain("not part of, or endorsed by, Facebook");
    expect(html).toContain("All Rights Reserved");
    expect(html).toContain("Iman Coach");
  });
});
