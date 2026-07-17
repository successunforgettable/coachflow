import { describe, it, expect } from "vitest";
import { buildSalesAliAbdaalHtml } from "./salesAliAbdaal";
import type { LandingPageContent } from "../../../drizzle/schema";

const base = {
  eyebrowHeadline: "PART-TIME CREATOR ACADEMY",
  mainHeadline: "Learn the strategies I use to grow, without quitting your day job",
  subheadline: "A step-by-step system for building an audience around what you already know.",
  primaryCta: "Join the Academy",
  asSeenIn: [], quizSection: { question: "", options: [], answer: "" },
  problemAgitation: "You keep starting and stopping, never building momentum.",
  solutionIntro: "There's a simpler way that doesn't need luck.",
  whyOldFail: "Chasing virality burns you out.",
  uniqueMechanism: "Build repeatable systems so growth compounds instead of depending on any one post.",
  testimonials: [
    { headline: "", quote: "I finally built a system that works.", name: "Rina Patel", location: "London" },
    { headline: "", quote: "Went from stuck to consistent in weeks.", name: "Marcus Bell", location: "Toronto" },
  ],
  insiderAdvantages: "You get the exact playbook, not vague theory.",
  scarcityUrgency: "", shockingStat: "I built this the hard way so you don't have to.",
  timeSavingBenefit: "A plan you can act on this week.",
  consultationOutline: [
    { title: "Niche Discovery", description: "Find the audience only you can serve." },
    { title: "Content Engine", description: "A repeatable system for ideas and output." },
    { title: "Outsourcing Playbook", description: "Buy back your time as you grow." },
  ],
  faq: [{ question: "Do I need experience?", answer: "No — we start from zero." }],
  guarantee: "30-day money-back guarantee if you complete the core modules and it isn't for you.",
  bonuses: [{ title: "Private Community", description: "Learn alongside other creators." }],
  curriculum: [
    { title: "The Blueprint", emoji: "🗺️" },
    { title: "Your Perfect Niche", emoji: "🎯" },
    { title: "Endless Ideas", emoji: "💡" },
  ],
  systemTiles: ["A repeatable content system", "An outsourcing playbook", "A niche you own", "A publishing rhythm"],
} as unknown as LandingPageContent;

const coach = {
  headshotUrl: "https://res.cloudinary.com/dunshei0y/image/upload/v1/instructor.png",
  logoUrl: null, coachName: "Ali Coach", coachBackground: "I spent years figuring out what actually works.",
  videoUrl: "https://youtu.be/dQw4w9WgXcQ",
  checkoutUrl: null,
};

describe("buildSalesAliAbdaalHtml — long-form course sales page on the Ali Abdaal design bar", () => {
  it("embeds the coach's REAL video (YouTube → iframe), never a fabricated player", () => {
    const html = buildSalesAliAbdaalHtml(base, "Creator Academy", coach);
    expect(html).toContain("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(html).toContain("<iframe");
  });

  it("falls back to the real headshot at natural aspect (no fake play), omits with no media", () => {
    const poster = buildSalesAliAbdaalHtml(base, "Academy", { ...coach, videoUrl: null });
    expect(poster).toContain("instructor.png");
    expect(poster).not.toContain("<iframe");
    const none = buildSalesAliAbdaalHtml(base, "Academy", { ...coach, videoUrl: null, headshotUrl: null, heroImageUrl: null });
    expect(none).not.toContain("<iframe");
  });

  it("switches the headline's trailing clause to the editorial serif (sans→serif)", () => {
    const html = buildSalesAliAbdaalHtml(base, "Academy", coach);
    expect(html).toContain("Fraunces");
    expect(html).toContain("without quitting your day job");
  });

  it("renders the price ONLY from a real operator price; emits [INSERT_PRICE] (review-draft) otherwise", () => {
    const noPrice = buildSalesAliAbdaalHtml(base, "Academy", coach);
    expect(noPrice).toContain("[INSERT_PRICE]"); // publish hard-gate → review-draft
    const priced = { ...base, price: { amount: "995", currency: "$" } } as unknown as LandingPageContent;
    const html = buildSalesAliAbdaalHtml(priced, "Academy", coach);
    expect(html).toContain("$995");
    expect(html).not.toContain("[INSERT_PRICE]");
  });

  it("points the CTA at a real checkout URL when set (no on-page capture form)", () => {
    const html = buildSalesAliAbdaalHtml(base, "Academy", { ...coach, checkoutUrl: "https://checkout.example.com/ptya" });
    expect(html).toContain('href="https://checkout.example.com/ptya"');
    expect(html).not.toContain('class="sl_optin"'); // no email capture when there's a real checkout
  });

  it("falls back to a reveal-on-intent email capture in SALES mode when there's no checkout URL", () => {
    const html = buildSalesAliAbdaalHtml(base, "Academy", coach);
    expect(html).toContain('class="sl_cta"'); // reveal button
    expect(html).toContain('class="sl_optin"'); // capture form present
    expect(html).toContain("mode:'sales'");
    expect(html).toContain('name="sl_hp"'); // honeypot
  });

  it("renders the curriculum accordion from real module titles + emoji", () => {
    const html = buildSalesAliAbdaalHtml(base, "Academy", coach);
    expect(html).toContain("The curriculum");
    expect(html).toContain("Your Perfect Niche");
    expect(html).toContain("🎯");
    expect(html).toContain("<details"); // native accordion, no fabricated content
  });

  it("renders the systems tile grid from systemTiles", () => {
    const html = buildSalesAliAbdaalHtml(base, "Academy", coach);
    expect(html).toContain("You&#39;ll build systems for");
    expect(html).toContain("A repeatable content system");
  });

  it("Gate-1 results default to honest testimonial monogram cards — no fabricated charts/metrics", () => {
    // The results section renders the allocator's REMAINDER (testimonials beyond the wall+strips), so
    // it needs enough testimonials to have a remainder (N>=7). Judge the honest-monogram form here.
    const many = Array.from({ length: 8 }, (_, i) => ({ headline: "", quote: `Real proof ${i} from a student.`, name: `Rina Patel ${i}`, location: "City" }));
    const html = buildSalesAliAbdaalHtml({ ...base, testimonials: many } as unknown as LandingPageContent, "Academy", coach);
    expect(html).toContain("Real results from real students");
    expect(html).toContain(">RP<"); // monogram avatar — no fabricated chart or subscriber count
    expect(html).not.toContain("<canvas");
  });

  it("Gate-1 renders structured caseStudies (real metric strings, no chart) ONLY when operator-supplied", () => {
    const withCases = {
      ...base,
      caseStudies: [{ name: "Sam Rivera", quote: "This changed my trajectory.", metrics: ["Consistent weekly uploads", "First paid sponsor"] }],
    } as unknown as LandingPageContent;
    const html = buildSalesAliAbdaalHtml(withCases, "Academy", coach);
    expect(html).toContain("Sam Rivera");
    expect(html).toContain("Consistent weekly uploads"); // real operator metric string, not a chart
    expect(html).not.toContain("<canvas");
  });

  it("NEVER fabricates Ali's real figures (subscriber counts, $995, $5.8m, '6,000 creators')", () => {
    const html = buildSalesAliAbdaalHtml(base, "Academy", coach);
    expect(html).not.toContain("6,000");
    expect(html).not.toContain("5.8");
    expect(html).not.toContain("$995"); // no price supplied → never invented
    expect(html).not.toContain("6m subscribers");
  });

  it("renders bonuses, guarantee, FAQ and founder story from real content, closes on a footer", () => {
    const html = buildSalesAliAbdaalHtml(base, "Academy", coach);
    expect(html).toContain("Free bonuses when you enrol");
    expect(html).toContain("Private Community");
    expect(html).toContain("Our guarantee");
    expect(html).toContain("30-day money-back guarantee");
    expect(html).toContain("Hi, I&#39;m Ali Coach");
    expect(html).toContain("Ali Coach&#39;s Academy"); // offer-card title, single-escaped
    expect(html).toContain("All rights reserved");
  });

  it("omits sections gracefully when their source is absent (no testimonials → no review wall)", () => {
    const bare = { ...base, testimonials: [], curriculum: [], systemTiles: [], bonuses: [] } as unknown as LandingPageContent;
    const html = buildSalesAliAbdaalHtml(bare, "Academy", coach);
    expect(html).not.toContain("Loved by the people who took it");
    expect(html).not.toContain("The curriculum");
    expect(html).not.toContain("You&#39;ll build systems for");
    expect(html).not.toContain("Real results from real students"); // no cases and no testimonials
  });

  const mkProof = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ headline: "", quote: `UNIQUEPROOF_${i}_marker quote text`, name: `Person ${i}`, location: "City" }));

  it("PROOF ALLOCATOR — composition scales with count: wall → threaded strips (max 3) → results", () => {
    const STRIP = /#ECE5E1;padding:44px/g; // the proofStrip beige-band signature — one per rendered strip
    const strips = (n: number) =>
      (buildSalesAliAbdaalHtml({ ...base, testimonials: mkProof(n) } as unknown as LandingPageContent, "Academy", coach).match(STRIP) || []).length;
    // N<=2 → wall only. N=3 → wall of 3, no strips. N=4 → +1 strip. N=5 → +2. N=6+ → 3 strips (capped),
    // remainder goes to the results grid. No empty strips ever (unfilled slots render nothing).
    expect(strips(1)).toBe(0);
    expect(strips(2)).toBe(0);
    expect(strips(3)).toBe(0);
    expect(strips(4)).toBe(1);
    expect(strips(5)).toBe(2);
    expect(strips(6)).toBe(3);
    expect(strips(8)).toBe(3);   // capped at 3 threaded strips; the rest go to results
    expect(strips(12)).toBe(3);
  });

  it("NO DUPLICATION — every real testimonial appears EXACTLY once at N=1,2,3,5,8,12", () => {
    for (const N of [1, 2, 3, 5, 8, 12]) {
      const html = buildSalesAliAbdaalHtml({ ...base, testimonials: mkProof(N) } as unknown as LandingPageContent, "Academy", coach);
      for (let i = 0; i < N; i++) {
        const marker = `UNIQUEPROOF_${i}_marker`;
        const occurrences = html.split(marker).length - 1;
        expect(occurrences, `N=${N}: testimonial ${i} should render exactly once, saw ${occurrences}`).toBe(1);
      }
    }
  });

  it("light spine at ZERO proof shows NO proof surfaces; the rich page never invents any", () => {
    // (the discriminator routes zero-proof to the light builder; the rich builder itself omits every
    // proof surface at N=0 — belt and braces, so a stray render never shows an empty/padded block)
    const zero = buildSalesAliAbdaalHtml({ ...base, testimonials: [] } as unknown as LandingPageContent, "Academy", coach);
    expect(zero).not.toContain("Loved by the people who took it"); // no wall
    expect(zero).not.toContain("Real results from real students");  // no results
    expect(zero).not.toContain("#ECE5E1;padding:44px");             // no strips
  });
});
