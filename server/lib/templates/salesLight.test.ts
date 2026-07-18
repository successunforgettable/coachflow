import { describe, it, expect } from "vitest";
import { buildSalesLightHtml } from "./salesLight";
import type { LandingPageContent } from "../../../drizzle/schema";

const base = {
  eyebrowHeadline: "NEW COHORT",
  mainHeadline: "Build a business that runs without you",
  subheadline: "The exact system, step by step.",
  problemAgitation: "You're the bottleneck.",
  solutionIntro: "There's a repeatable system that runs itself.",
  whyOldFail: "Hustle doesn't scale.",
  uniqueMechanism: "Install the four systems that let the machine run without you.",
  testimonials: [],
  consultationOutline: [],
  faq: [{ question: "Is it self-paced?", answer: "Yes." }],
  guarantee: "Full refund within 30 days.",
  curriculum: [{ title: "Module 1: Foundations", emoji: "📘" }, { title: "Module 2: Delegation", emoji: "🔧" }],
  systemTiles: ["Clarify the offer", "Build the delegation engine", "Automate the repeatable"],
  bonuses: [{ title: "The Delegation Scorecard", description: "Score every task." }],
  price: { amount: "997", currency: "$", installments: "3 payments of $349" },
} as unknown as LandingPageContent;

const coach = { coachName: "Alex Rivera", coachBackground: "Scaled three companies past seven figures.", checkoutUrl: "https://alexrivera.com/enrol" };

describe("buildSalesLightHtml — proof-light sales (offer/method-forward)", () => {
  it("renders the offer/method spine WITHOUT any proof sections (no testimonial wall / results / stats)", () => {
    const html = buildSalesLightHtml(base, "Academy", coach);
    // offer/method spine present
    expect(html).toContain("It&#39;s simpler than you think"); // unique mechanism
    expect(html).toContain("What&#39;s inside");                // curriculum
    expect(html).toContain("You&#39;ll build systems for");     // systemTiles
    expect(html).toContain("Our guarantee");
    expect(html).toContain("997");                              // price
    // NO proof sections (those belong to the rich variant)
    expect(html).not.toContain("Loved by the people who took it"); // rich review wall
    expect(html).not.toContain("Real results from real students"); // rich results grid
    expect(html).not.toContain("#ECE5E1;padding:44px");            // rich proof-strip signature
  });

  it("leads with the transformation/outcome (the promise carries a low-proof page)", () => {
    const html = buildSalesLightHtml(base, "Academy", coach);
    expect(html).toContain("By the end");
    expect(html).toContain("runs itself"); // solutionIntro as the promise
  });

  it("renders fully at ZERO proof — the Auto-Mode / blank-slate default (no empty sections, no fabrication)", () => {
    const blank = { ...base } as unknown as LandingPageContent; // testimonials already []
    const html = buildSalesLightHtml(blank, "Academy", { coachName: "Alex Rivera", checkoutUrl: "https://x.com/e" });
    expect(html).toContain("What&#39;s inside");
    expect(html).toContain("You&#39;ll build systems for");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("[INSERT_"); // price present → no tokens
  });

  it("omits the coach story only when BOTH name and background are absent (never a fabricated founder)", () => {
    // name present → story renders (a real name is honest signal)
    expect(buildSalesLightHtml(base, "Academy", { coachName: "Alex", checkoutUrl: "https://x.com/e" })).toContain("Who&#39;s teaching this");
    // neither name nor background → the whole section omits
    expect(buildSalesLightHtml(base, "Academy", { checkoutUrl: "https://x.com/e" })).not.toContain("Who&#39;s teaching this");
  });

  it("stays a review-draft ([INSERT_PRICE]) when the operator has set no price", () => {
    const noPrice = { ...base, price: undefined } as unknown as LandingPageContent;
    const html = buildSalesLightHtml(noPrice, "Academy", coach);
    expect(html).toContain("[INSERT_PRICE]");
  });

  it("__BY_APPLICATION__ price → 'By application' + Apply CTA, publishes (no [INSERT_PRICE], no raw sentinel)", () => {
    const byApp = { ...base, price: { amount: "__BY_APPLICATION__" } } as unknown as LandingPageContent;
    const html = buildSalesLightHtml(byApp, "Academy", coach);
    expect(html).toContain("By application");
    expect(html).toContain("Apply now");
    expect(html).not.toContain("[INSERT_PRICE]");
    expect(html).not.toContain("__BY_APPLICATION__");
  });

  it("uses the coach's real checkout link; reveals email capture when there is none", () => {
    const linked = buildSalesLightHtml(base, "Academy", coach);
    expect(linked).toContain("https://alexrivera.com/enrol");
    const captured = buildSalesLightHtml(base, "Academy", { coachName: "Alex", checkoutUrl: null });
    expect(captured).toContain("/api/capture-lead");
    expect(captured).toContain("mode:'sales'");
  });
});
