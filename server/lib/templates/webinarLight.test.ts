import { describe, it, expect } from "vitest";
import { buildWebinarLightHtml } from "./webinarLight";
import type { LandingPageContent } from "../../../drizzle/schema";

const base = {
  eyebrowHeadline: "FREE LIVE CLASS",
  mainHeadline: "Launch a coaching business using AI",
  subheadline: "No burnout, no funnels.",
  problemAgitation: "You trade time for money and can't scale past 1:1.",
  solutionIntro: "There's a repeatable system that runs itself.",
  whyOldFail: "Funnels burn you out; systems don't.",
  uniqueMechanism: "Install the four systems that let the class fill itself.",
  testimonials: [],
  consultationOutline: [
    { title: "Find your niche", description: "Pin the audience you serve best." },
    { title: "Build the offer", description: "Turn expertise into a program." },
    { title: "Launch with AI", description: "Fill your calendar without ad spend." },
  ],
  faq: [{ question: "Will there be a replay?", answer: "Yes, if you register." }],
  scarcityUrgency: "Doors close Friday.",
  bonuses: [{ title: "AI Niche Tool", description: "Find your niche in minutes." }],
} as unknown as LandingPageContent;

const coach = {
  presenterCutoutUrl: "https://res.cloudinary.com/dunshei0y/image/upload/e_background_removal,c_fit,w_800,f_png/v1/coach_h.png",
  coachName: "Siddharth Rajsekar",
  coachBackground: "A decade training coaches to scale.",
  trustCount: null,
};

describe("buildWebinarLightHtml — proof-light webinar (teacher/value-forward)", () => {
  it("renders the teacher/value spine WITHOUT the success grid or stats bar", () => {
    const html = buildWebinarLightHtml(base, "Coaching", coach);
    expect(html).toContain("What you&#39;ll learn live");   // framework
    expect(html).toContain("There&#39;s a better way");     // method band
    expect(html).toContain("Meet your host");
    expect(html).toContain("What changes if you don"); // cost-of-inaction
    // NO proof sections
    expect(html).not.toContain("From people who attended"); // rich success grid
    expect(html).not.toContain("50,000");                   // never a fabricated stats bar
    expect(html).not.toContain("1,500");
  });

  it("renders the presenter as a background-removed CUTOUT (contain + drop-shadow, no framed rectangle)", () => {
    const html = buildWebinarLightHtml(base, "Coaching", coach);
    expect(html).toContain("e_background_removal,c_fit,w_800,f_png/v1/coach_h.png");
    expect(html).toContain("object-fit:contain");
    expect(html).toContain("drop-shadow(");
    expect(html).not.toContain("[INSERT_PRESENTER_PHOTO]");
  });

  it("stages a review-draft ([INSERT_PRESENTER_PHOTO]) when there's no usable cutout (parity with rich/Iman)", () => {
    const html = buildWebinarLightHtml(base, "Coaching", { ...coach, presenterCutoutUrl: null });
    expect(html).toContain("[INSERT_PRESENTER_PHOTO]");
  });

  it("renders fully at ZERO proof — a composed page, no empty sections, no fabrication", () => {
    const html = buildWebinarLightHtml(base, "Coaching", coach); // testimonials []
    expect(html).toContain("What you&#39;ll learn live");
    expect(html).not.toContain("undefined");
  });

  it("wires the reserve-seat form to /api/capture-lead in webinar mode", () => {
    const html = buildWebinarLightHtml(base, "Coaching", coach);
    expect(html).toContain("/api/capture-lead");
    expect(html).toContain("mode:'webinar'");
    expect(html).toContain('id="wb_hp"'); // honeypot
  });

  it("omits the host bio when there's no name/background (never fabricated)", () => {
    const html = buildWebinarLightHtml(base, "Coaching", { presenterCutoutUrl: coach.presenterCutoutUrl });
    expect(html).not.toContain("Meet your host");
  });
});
