/**
 * Item 2.4 — Campaign Export: vitest tests
 *
 * Covers:
 *  - All 10 markdown formatters produce non-empty output with expected content
 *  - generateReadme produces correct structure
 *  - tRPC stub removal: campaigns.exportCampaign no longer exists
 *  - Express endpoint /api/campaigns/:campaignId/export-zip is registered in source
 */
import { describe, it, expect } from "vitest";
import {
  formatSalesOffer,
  formatUniqueMethod,
  formatFreeOptIn,
  formatHeadlines,
  formatIdealCustomerProfile,
  formatAdCopy,
  formatVideoScripts,
  formatLandingPage,
  formatEmailSequence,
  formatWhatsappSequence,
  generateReadme,
} from "./campaignExportFormatters";

// ── Fixture rows — shaped to match the real DB schema ───────────────────────

// Step 1: offers — uses JSON angle fields (godfatherAngle, freeAngle, dollarAngle)
const offerRow = {
  id: 1,
  campaignId: 1,
  productName: "Zap Coaching",
  offerType: "standard",
  activeAngle: "godfather",
  godfatherAngle: {
    offerName: "The Godfather Coaching Package",
    valueProposition: "Transform your coaching business in 90 days",
    pricing: "$997 one-time",
    bonuses: "Free strategy session",
    guarantee: "30-day money-back guarantee",
    urgency: "Only 10 spots available",
    cta: "Sign Up Now",
  },
  freeAngle: null,
  dollarAngle: null,
  rating: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Step 2: heroMechanisms — mechanismName, mechanismDescription, mechanismSetId
const heroRow = {
  id: 1,
  campaignId: 1,
  mechanismSetId: "set-001",
  tabType: "hero_mechanisms",
  mechanismName: "The Zap Neural Method",
  mechanismDescription: "A proven 3-step system to scale your coaching business.",
  targetMarket: "Entrepreneurs",
  pressingProblem: "Can't scale",
  whyProblem: "No system",
  whatTried: "Ads",
  whyExistingNotWork: "Too generic",
  desiredOutcome: "10x revenue",
  credibility: "10 years",
  socialProof: "500 clients",
  descriptor: "Method",
  application: "Online",
  rating: 0,
  isFavorite: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Step 3: hvcoTitles — title, tabType, hvcoSetId
const hvcoRow = {
  id: 1,
  campaignId: 1,
  hvcoSetId: "hvco-001",
  tabType: "long",
  title: "Free Guide: 5 Steps to Get More Coaching Clients",
  targetMarket: "Coaches",
  hvcoTopic: "Lead Generation",
  rating: 0,
  isFavorite: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Step 4: headlines — headline, formulaType, headlineSetId
const headlineRow = {
  id: 1,
  campaignId: 1,
  headlineSetId: "hl-001",
  formulaType: "question",
  headline: "The Secret to 10x Growth Without Spending More on Ads",
  subheadline: "Discover the method top coaches use",
  eyebrow: null,
  targetMarket: "Coaches",
  rating: 0,
  isFavorite: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Step 5: idealCustomerProfiles — name, introduction, fears, demographics (JSON)
const icpRow = {
  id: 1,
  campaignId: 1,
  name: "Amir from Abu Dhabi",
  angleName: null,
  introduction: "A driven expat professional seeking financial freedom.",
  fears: "Losing their job, not having enough savings",
  hopesDreams: "Build a passive income stream",
  demographics: { ageRange: "35-55", occupation: "Manager", incomeLevel: "$100k+", location: "UAE" },
  psychographics: "Ambitious, analytical, risk-aware",
  pains: "Long hours, no time for family",
  frustrations: "Too many options, not sure where to start",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Step 6: adCopy — content, contentType, adStyle, adSetId
const adCopyRow = {
  id: 1,
  campaignId: 1,
  adSetId: "ad-001",
  adType: "lead_gen",
  adStyle: "story",
  adCallToAction: "Learn More",
  contentType: "body",
  bodyAngle: "story",
  content: "Are you tired of working 80-hour weeks with nothing to show for it?",
  targetMarket: "Coaches",
  productCategory: "Coaching",
  specificProductName: "Zap Coaching",
  rating: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Step 8: videoScripts — voiceoverText, scenes (JSON), videoType, duration
const videoScriptRow = {
  id: 1,
  campaignId: 1,
  videoType: "explainer",
  duration: "30",
  visualStyle: "kinetic_typography",
  scenes: [
    { sceneNumber: 1, duration: 10, voiceoverText: "Watch this...", visualDirection: "Zoom in", onScreenText: "Watch this" },
    { sceneNumber: 2, duration: 20, voiceoverText: "The solution is here.", visualDirection: "Fade out", onScreenText: "Solution" },
  ],
  voiceoverText: "Watch this... The solution is here.",
  status: "draft",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Step 9: landingPages — originalAngle (JSON with LandingPageContent fields)
const landingPageRow = {
  id: 1,
  campaignId: 1,
  productName: "Zap Coaching",
  productDescription: "The #1 coaching platform",
  avatarName: "Amir",
  avatarDescription: "Expat Professional",
  activeAngle: "original",
  originalAngle: {
    mainHeadline: "Transform Your Coaching Business in 90 Days",
    eyebrowHeadline: "Attention Coaches",
    subheadline: "Without spending more on ads",
    primaryCta: "Book Your Free Call",
    problemAgitation: "Most coaches struggle to scale because they lack a proven system.",
    solutionIntro: "Introducing the Zap Method — the only AI-powered coaching platform.",
  },
  godfatherAngle: null,
  freeAngle: null,
  dollarAngle: null,
  rating: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Step 10: emailSequences — name, emails (JSON array)
const emailRow = {
  id: 1,
  campaignId: 1,
  sequenceType: "welcome",
  name: "Welcome Sequence",
  emails: [
    { day: 1, subject: "Welcome to the program", body: "Hi {{first_name}}, welcome...", timing: "Immediately" },
    { day: 3, subject: "Your next step", body: "Here's what to do next...", timing: "3 days after signup" },
  ],
  automationEnabled: false,
  rating: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Step 11: whatsappSequences — name, messages (JSON array)
const whatsappRow = {
  id: 1,
  campaignId: 1,
  sequenceType: "engagement",
  name: "Onboarding Sequence",
  messages: [
    { day: 1, message: "Hey {{first_name}}! Welcome 🎉", timing: "Immediately", emojis: ["🎉"] },
    { day: 2, message: "Quick check-in — how are you getting on?", timing: "Next day", emojis: [] },
  ],
  rating: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Formatter tests ──────────────────────────────────────────────────────────

describe("Item 2.4 — campaignExportFormatters", () => {
  it("formatSalesOffer returns non-empty markdown with headline from angle", () => {
    const md = formatSalesOffer([offerRow] as any);
    expect(md).toContain("# Sales Offer");
    expect(md).toContain("The Godfather Coaching Package");
    expect(md.length).toBeGreaterThan(50);
  });

  it("formatUniqueMethod returns non-empty markdown with mechanism name", () => {
    const md = formatUniqueMethod([heroRow] as any);
    expect(md).toContain("# Unique Method");
    expect(md).toContain("The Zap Neural Method");
    expect(md.length).toBeGreaterThan(50);
  });

  it("formatFreeOptIn returns non-empty markdown with title", () => {
    const md = formatFreeOptIn([hvcoRow] as any);
    expect(md).toContain("# Free Opt-In");
    expect(md).toContain("Free Guide: 5 Steps to Get More Coaching Clients");
    expect(md.length).toBeGreaterThan(50);
  });

  it("formatHeadlines returns non-empty markdown with headline text", () => {
    const md = formatHeadlines([headlineRow] as any);
    expect(md).toContain("# Direct Response Headlines");
    expect(md).toContain("The Secret to 10x Growth Without Spending More on Ads");
    expect(md.length).toBeGreaterThan(50);
  });

  it("formatIdealCustomerProfile returns non-empty markdown with profile name", () => {
    const md = formatIdealCustomerProfile([icpRow] as any);
    expect(md).toContain("# Ideal Customer Profile");
    expect(md).toContain("Amir from Abu Dhabi");
    expect(md.length).toBeGreaterThan(50);
  });

  it("formatAdCopy returns non-empty markdown with ad content", () => {
    const md = formatAdCopy([adCopyRow] as any);
    expect(md).toContain("# Ad Copy");
    expect(md).toContain("Are you tired of working 80-hour weeks");
    expect(md.length).toBeGreaterThan(50);
  });

  it("formatVideoScripts returns non-empty markdown with voiceover text", () => {
    const md = formatVideoScripts([videoScriptRow] as any);
    expect(md).toContain("# Video Scripts");
    expect(md).toContain("Watch this");
    expect(md.length).toBeGreaterThan(50);
  });

  it("formatLandingPage returns non-empty markdown with main headline", () => {
    const md = formatLandingPage([landingPageRow] as any);
    expect(md).toContain("# Landing Page");
    expect(md).toContain("Transform Your Coaching Business in 90 Days");
    expect(md).toContain("Original Angle");
    expect(md.length).toBeGreaterThan(50);
  });

  it("formatEmailSequence returns non-empty markdown with sequence name and subject", () => {
    const md = formatEmailSequence([emailRow] as any);
    expect(md).toContain("# Email Follow-Up Sequence");
    expect(md).toContain("Welcome Sequence");
    expect(md).toContain("Welcome to the program");
    expect(md.length).toBeGreaterThan(50);
  });

  it("formatWhatsappSequence returns non-empty markdown with sequence name and message", () => {
    const md = formatWhatsappSequence([whatsappRow] as any);
    expect(md).toContain("# WhatsApp Follow-Up Sequence");
    expect(md).toContain("Onboarding Sequence");
    expect(md).toContain("Hey {{first_name}}");
    expect(md.length).toBeGreaterThan(50);
  });
});

// ── generateReadme tests ─────────────────────────────────────────────────────

describe("Item 2.4 — generateReadme", () => {
  it("includes campaign name and export date", () => {
    const readme = generateReadme("Test Campaign", new Date("2026-03-02"), []);
    expect(readme).toContain("Test Campaign");
    expect(readme).toContain("2026");
  });

  it("marks included steps in INCLUDED STEPS section", () => {
    const readme = generateReadme("Test", new Date(), [
      { number: 1, name: "Sales Offer", included: true },
    ]);
    expect(readme).toContain("INCLUDED STEPS");
    expect(readme).toContain("Sales Offer");
  });

  it("marks missing steps in SKIPPED STEPS section with reason", () => {
    const readme = generateReadme("Test", new Date(), [
      { number: 1, name: "Sales Offer", included: false, reason: "No assets generated" },
    ]);
    expect(readme).toContain("SKIPPED STEPS");
    expect(readme).toContain("No assets generated");
  });

  it("includes warnings when provided", () => {
    const readme = generateReadme("Test", new Date(), [
      { number: 7, name: "Ad Images", included: true, warnings: ["image-1.png — fetch failed"] },
    ]);
    expect(readme).toContain("WARNINGS");
    expect(readme).toContain("image-1.png");
    expect(readme).toContain("fetch failed");
  });

  it("shows correct step count", () => {
    const readme = generateReadme("Test", new Date(), [
      { number: 1, name: "Sales Offer", included: true },
      { number: 2, name: "Unique Method", included: false, reason: "No assets generated" },
    ]);
    expect(readme).toContain("Steps included: 1 of 2");
  });
});

// ── tRPC stub removal test ───────────────────────────────────────────────────

describe("Item 2.4 — tRPC stub removal", () => {
  it("campaigns router no longer exports exportCampaign procedure", async () => {
    const { campaignsRouter } = await import("./routers/campaigns");
    // The router should not have an exportCampaign key in its procedures
    const procedures = (campaignsRouter as any)._def?.procedures ?? {};
    expect(Object.keys(procedures)).not.toContain("exportCampaign");
  });
});

// ── Express endpoint registration test ──────────────────────────────────────

describe("Item 2.4 — Express endpoint", () => {
  it("export-zip route is defined in server/_core/index.ts source", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "_core/index.ts"),
      "utf-8"
    );
    expect(src).toContain("/api/campaigns/:campaignId/export-zip");
    expect(src).toContain("campaignExportFormatters");
    expect(src).toContain("archive.finalize");
  });

  it("export-zip route uses archiver streaming (not tRPC)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "_core/index.ts"),
      "utf-8"
    );
    // Should use archiver, not tRPC
    expect(src).toContain("archiver");
    expect(src).toContain("Content-Disposition");
    expect(src).toContain("application/zip");
  });
});
