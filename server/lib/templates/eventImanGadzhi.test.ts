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
  consultationOutline: [{ title: "Should not render", description: "no benefits on this poster" }],
  faq: [{ question: "Should not render?", answer: "no FAQ on this poster" }],
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

  it("renders ONE yellow pill CTA with the label and scarcity note, and no countdown", () => {
    const html = buildEventImanGadzhiHtml(base, "Challenge", coach);
    expect(html).toContain("GET MY FREE TICKET");
    expect(html).toContain("Tickets Are First Come, First Served");
    expect(html).toContain("#FFF62E"); // luminous yellow conversion accent
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
    expect(html).toContain('id="ev_hp"'); // honeypot present
  });

  it("does NOT invent proof, benefits, agenda, price, or FAQ sections (frozen reference has none)", () => {
    const html = buildEventImanGadzhiHtml(base, "Challenge", coach);
    expect(html).not.toContain("This changed everything for me."); // testimonial ignored
    expect(html).not.toContain("no benefits on this poster"); // consultationOutline ignored
    expect(html).not.toContain("no FAQ on this poster"); // faq ignored
  });

  it("closes on the legal endpoint (privacy/terms, non-affiliation disclaimer, copyright)", () => {
    const html = buildEventImanGadzhiHtml(base, "Challenge", coach);
    expect(html).toContain("Privacy Policy");
    expect(html).toContain("not part of, or endorsed by, Facebook");
    expect(html).toContain("All Rights Reserved");
    expect(html).toContain("Iman Coach");
  });
});
