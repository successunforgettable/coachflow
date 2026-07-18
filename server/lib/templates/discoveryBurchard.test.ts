import { describe, it, expect } from "vitest";
import { buildDiscoveryBurchardHtml } from "./discoveryBurchard";
import { ctaLink } from "./templatePrimitives";
import type { LandingPageContent } from "../../../drizzle/schema";

const content = {
  eyebrowHeadline: "", mainHeadline: "Let's find out if I can help you scale",
  subheadline: "Book a free 1:1 — we'll map your next step.", primaryCta: "Book a Discovery Call",
  asSeenIn: [], quizSection: { question: "", options: [], answer: "" },
  problemAgitation: "", solutionIntro: "", whyOldFail: "", uniqueMechanism: "",
  testimonials: [
    { headline: "", quote: "The call alone gave me a plan.", name: "Ravi Menon", location: "BLR" },
  ],
  insiderAdvantages: "", scarcityUrgency: "", shockingStat: "", timeSavingBenefit: "",
  consultationOutline: [
    { title: "Clarify Your Offer", description: "Pin down what you sell and to whom." },
    { title: "Map Your Path", description: "See the shortest route to your goal." },
    { title: "Spot The Gap", description: "Find the one thing holding you back." },
  ],
  faq: [], guarantee: "",
} as unknown as LandingPageContent;

const coach = {
  headshotUrl: "https://res.cloudinary.com/dunshei0y/image/upload/v1/coach-assets_h.png",
  logoUrl: null, coachName: "Asha Rao", bookingUrl: "https://cal.com/asha/discovery", trustCount: null,
};

describe("ctaLink primitive", () => {
  it("renders a navigating anchor with escaped href + label", () => {
    expect(ctaLink("https://cal.com/x", 'Book "now"', "color:red")).toBe(
      '<a href="https://cal.com/x" style="color:red">Book &quot;now&quot;</a>',
    );
  });
});

describe("buildDiscoveryBurchardHtml — booking flow on the Burchard design language", () => {
  it("drives a REAL booking link, not an email form", () => {
    const html = buildDiscoveryBurchardHtml(content, "Coaching", coach);
    // hero + cream CTA both link to the coach's calendar
    expect(html).toContain('href="https://cal.com/asha/discovery"');
    // no dead email form (that's the lead-magnet pattern, not discovery)
    expect(html).not.toContain('onsubmit="return false;"');
    expect(html).not.toContain('type="email"');
  });

  it("shows the honest 'Free Discovery Call' composite card (no fabricated product)", () => {
    const html = buildDiscoveryBurchardHtml(content, "Coaching", coach);
    expect(html).toContain("Free Discovery Call");
    expect(html).toContain("1:1 STRATEGY CALL");
    expect(html).toContain("1:1 with Asha Rao");
    // real headshot cutout present; no magnet cover, no fabricated stand-in
    expect(html).toContain("coach-assets_h.png");
    expect(html).not.toContain("pg_1,f_jpg"); // no PDF-derived magnet cover (lead-magnet only)
    expect(html).not.toContain("repeating-linear-gradient");
  });

  it("binds bands to consultationOutline and renders real-or-nothing testimonials", () => {
    const html = buildDiscoveryBurchardHtml(content, "Coaching", coach);
    expect(html).toContain("What we'll cover on the call");
    expect(html).toContain("Pin down what you sell"); // band description
    expect(html).toContain("Clarify Your Offer"); // keyword lead-in
    expect(html).toContain("text-transform:uppercase"); // keyword emphasis (CSS-uppercased)
    expect(html).toContain(">RM<"); // Ravi Menon monogram, no fabricated face
  });

  it("omits the tile grid and FAQ (a call has no 'inside contents')", () => {
    const html = buildDiscoveryBurchardHtml(content, "Coaching", coach);
    expect(html).not.toContain("grid-template-columns:repeat(2,minmax(0,1fr))"); // Burchard tile grid
    expect(html).not.toContain("Frequently"); // no FAQ heading
  });

  it("stays a review-draft when no booking URL: CTA emits [INSERT_BOOKING_URL] (publish gate blocks)", () => {
    const html = buildDiscoveryBurchardHtml(content, "Coaching", { coachName: "Asha Rao" });
    expect(html).toContain('href="[INSERT_BOOKING_URL]"'); // never a fabricated URL
    expect(html).toMatch(/\[INSERT_BOOKING_URL\]/); // the publish hard-gate will catch this
  });

  it("__EMAIL_CAPTURE__ booking → a reveal-on-intent capture form (discovery mode), publishes, no token/leak", () => {
    const html = buildDiscoveryBurchardHtml(content, "Coaching", { coachName: "Asha Rao", bookingUrl: "__EMAIL_CAPTURE__" });
    expect(html).toContain('class="db_cta"'); // reveal button
    expect(html).toContain('class="db_optin"'); // capture form
    expect(html).toContain("mode:'discovery'"); // posts to the discovery capture mode
    expect(html).toContain('name="db_hp"'); // honeypot
    expect(html).not.toContain("[INSERT_BOOKING_URL]"); // an email-only coach is COMPLETE → publishes
    expect(html).not.toContain("__EMAIL_CAPTURE__"); // sentinel interpreted, never rendered raw
  });

  it("degrades honestly with no headshot: cutout omitted, call panel centres", () => {
    const html = buildDiscoveryBurchardHtml(content, "Coaching", { coachName: "Asha Rao", bookingUrl: "https://cal.com/a" });
    expect(html).toContain("translateX(-50%)"); // panel centres
    expect(html).not.toContain('alt="Asha Rao"'); // no headshot img
  });
});
