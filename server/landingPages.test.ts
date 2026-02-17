import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { users, services, landingPages } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Landing Pages System", () => {
  let testUserId: number;
  let testServiceId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test user
    const userResult: any = await db.insert(users).values({
      openId: `test-landing-${Date.now()}`,
      name: "Test User",
      email: "test@example.com",
      subscriptionTier: "pro",
    });
    testUserId = userResult[0].insertId;

    // Create test service
    const serviceResult: any = await db.insert(services).values({
      userId: testUserId,
      name: "Crypto Coaching",
      category: "coaching",
      description: "Help UAE expats build crypto wealth safely",
      targetCustomer: "UAE Expats",
      mainBenefit: "Safe crypto income in 6 months",
    });
    testServiceId = serviceResult[0].insertId;
  });

  it("should create landing page with all 4 angles", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create landing page with all 4 angles
    const insertResult: any = await db.insert(landingPages).values({
      userId: testUserId,
      serviceId: testServiceId,
      productName: "Crypto Coaching",
      productDescription: "Help UAE expats build crypto wealth safely",
      avatarName: "Amir from Abu Dhabi",
      avatarDescription: "Expat Professional",
      originalAngle: {
        eyebrowHeadline: "FOR UAE & GCC CRYPTO BEGINNERS",
        mainHeadline: "Get Consistent, Halal Crypto Income in Just 6 Months",
        subheadline: "No blocked accounts, stress, or risking your family's trust",
        primaryCta: "Claim Your FREE Consultation!",
        asSeenIn: ["Forbes", "Inc.", "Insider", "Yahoo Finance", "Meta"],
        quizSection: {
          question: "Can You Guess Which One of These 'Safe' Crypto Moves… Actually Gets Your Bank Account Flagged?",
          options: ["P2P Trading", "Using Binance", "Cash Deposits", "All of the Above", "None of the Above"],
          answer: "All of the Above - without proper setup, any of these can trigger flags"
        },
        problemAgitation: "Still Worrying You'll Be The Next Account Freeze Or Crypto Horror Story?\n\nYou're not alone. Every day, UAE expats try to build crypto wealth...",
        solutionIntro: "If You've Tried P2P Groups, Chased Hot Signals, or Risked Your Bank Cards - and Still Aren't Seeing Real Crypto Profits...\n\nThere's a better way.",
        whyOldFail: "Why Playing It 'Safe' With Mainstream Crypto Advice Actually Keeps You Stuck (and Broke)\n\nMost crypto advice is generic...",
        uniqueMechanism: "Introducing the 'Steady Wealth Protocol': Your Step-by-Step Safe Haven in Middle East Crypto\n\nThis isn't another get-rich-quick scheme.",
        testimonials: [
          {
            headline: "No More Blocked Accounts",
            quote: "Before this, every time I tried cashing out, my bank flagged me. Now I follow their exact steps and my accounts are safe.",
            name: "Mohammed S.",
            location: "Abu Dhabi, UAE"
          },
          {
            headline: "Finally Making Real Progress",
            quote: "I was stuck for months. This system gave me clarity and a real path forward.",
            name: "Sarah K.",
            location: "Dubai, UAE"
          },
          {
            headline: "Peace of Mind",
            quote: "No more stress about compliance. Everything is mapped out clearly.",
            name: "Ahmed R.",
            location: "Sharjah, UAE"
          },
          {
            headline: "Results in 90 Days",
            quote: "I saw my first real crypto income within 3 months. This works.",
            name: "Fatima H.",
            location: "Abu Dhabi, UAE"
          }
        ],
        insiderAdvantages: "Unlock Insider Advantages: Built on Real Middle East Banking, Not Generic Advice\n\nOur system is specifically designed for the UAE and GCC market.",
        scarcityUrgency: "The Steady Wealth Protocol Doors Are Only Open For a Short Window (Secure Your Spot Now)\n\nWe only work with 10 new clients per month.",
        shockingStat: "92% of UAE Crypto Beginners Will Never Build Real Wealth Without a Proven System\n\nDon't be part of that statistic.",
        timeSavingBenefit: "Save Yourself Years of Painful Guesswork: Our Blueprint Gives You the Shortcut to Real Crypto Income\n\nWhy waste years when you can have a clear path?",
        consultationOutline: [
          { title: "Step-by-Step Roadmap", description: "Follow our Steady Wealth Protocol to take you from frustrated beginner to confident crypto earner" },
          { title: "Done-For-You Templates", description: "Plug-and-play scripts, checklists, and spreadsheets for every transaction" },
          { title: "Bank-Safe Setup", description: "Learn exactly how to structure your accounts to avoid flags" },
          { title: "Compliance Checklist", description: "Stay on the right side of UAE regulations" },
          { title: "Risk Management", description: "Protect your capital with proven strategies" },
          { title: "Income Streams", description: "Multiple ways to generate crypto income safely" },
          { title: "Tax Optimization", description: "Understand your tax obligations and optimize" },
          { title: "Community Access", description: "Join our private group of successful crypto earners" },
          { title: "Ongoing Support", description: "Get help whenever you need it" },
          { title: "Lifetime Updates", description: "Stay current with the latest strategies and regulations" }
        ]
      },
      godfatherAngle: {
        eyebrowHeadline: "RISK-FREE CRYPTO WEALTH BUILDING",
        mainHeadline: "Get Consistent Crypto Income in 6 Months - Or You Don't Pay a Dirham!",
        subheadline: "We're so confident in our system, we'll work with you for free until you see results",
        primaryCta: "Book My Free Consultation Call",
        asSeenIn: ["Forbes", "Inc.", "Insider", "Yahoo Finance", "Meta"],
        quizSection: {
          question: "What's the biggest risk in crypto investing?",
          options: ["Market volatility", "Bank account freezes", "Scams", "Lack of knowledge", "All of the above"],
          answer: "All of the above - but we eliminate them all"
        },
        problemAgitation: "Tired of Crypto Programs That Take Your Money But Don't Deliver Results?\n\nWe get it. You've been burned before.",
        solutionIntro: "That's Why We're Making You An Offer You Can't Refuse\n\nYou don't pay until you see results.",
        whyOldFail: "Why Most Crypto Coaches Charge Upfront (And Why We Don't)\n\nBecause they can't guarantee results.",
        uniqueMechanism: "The Godfather Guarantee: You Win, Or You Don't Pay\n\nSimple as that.",
        testimonials: [
          {
            headline: "They Actually Delivered",
            quote: "I was skeptical, but they put their money where their mouth is. Results in 90 days.",
            name: "Mohammed S.",
            location: "Abu Dhabi, UAE"
          },
          {
            headline: "Zero Risk",
            quote: "What did I have to lose? Nothing. And I gained everything.",
            name: "Sarah K.",
            location: "Dubai, UAE"
          },
          {
            headline: "Finally, Someone Honest",
            quote: "No upfront fees. No BS. Just results.",
            name: "Ahmed R.",
            location: "Sharjah, UAE"
          },
          {
            headline: "Life-Changing",
            quote: "This guarantee made all the difference. I could try risk-free.",
            name: "Fatima H.",
            location: "Abu Dhabi, UAE"
          }
        ],
        insiderAdvantages: "Why We Can Offer This Guarantee (And Others Can't)\n\nBecause our system actually works.",
        scarcityUrgency: "Limited Spots: We Can Only Extend This Guarantee to 10 People Per Month\n\nOnce they're gone, they're gone.",
        shockingStat: "97% of Our Clients See Results Within 6 Months - Or They Don't Pay\n\nThat's our track record.",
        timeSavingBenefit: "No More Wasted Time on Programs That Don't Work\n\nEither you win, or you don't pay.",
        consultationOutline: [
          { title: "Risk Assessment", description: "We'll evaluate if you're a good fit for our guarantee" },
          { title: "Custom Plan", description: "Your personalized roadmap to crypto income" },
          { title: "Zero Upfront Cost", description: "You don't pay until you see results" },
          { title: "Results Timeline", description: "Clear milestones and expectations" },
          { title: "Support System", description: "We're with you every step" },
          { title: "Compliance Guarantee", description: "Stay safe and legal" },
          { title: "Income Targets", description: "Set realistic, achievable goals" },
          { title: "Progress Tracking", description: "Measure your success" },
          { title: "Adjustment Protocol", description: "We adapt to your needs" },
          { title: "Success Celebration", description: "When you win, we all win" }
        ]
      },
      freeAngle: null,
      dollarAngle: null,
      activeAngle: "original",
    });

    const pageId = insertResult[0].insertId;

    // Fetch the created page
    const [page] = await db
      .select()
      .from(landingPages)
      .where(eq(landingPages.id, pageId))
      .limit(1);

    expect(page).toBeDefined();
    expect(page.productName).toBe("Crypto Coaching");
    expect(page.avatarName).toBe("Amir from Abu Dhabi");
    expect(page.activeAngle).toBe("original");
    expect(page.originalAngle).toBeDefined();
    expect(page.godfatherAngle).toBeDefined();
    expect(page.originalAngle?.eyebrowHeadline).toBe("FOR UAE & GCC CRYPTO BEGINNERS");
    expect(page.originalAngle?.asSeenIn).toHaveLength(5);
    expect(page.originalAngle?.testimonials).toHaveLength(4);
    expect(page.originalAngle?.consultationOutline).toHaveLength(10);
  });

  it("should switch active angle", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Find the test landing page
    const [page] = await db
      .select()
      .from(landingPages)
      .where(eq(landingPages.userId, testUserId))
      .limit(1);

    expect(page.activeAngle).toBe("original");

    // Switch to godfather angle
    await db
      .update(landingPages)
      .set({ activeAngle: "godfather" })
      .where(eq(landingPages.id, page.id));

    // Verify the switch
    const [updated] = await db
      .select()
      .from(landingPages)
      .where(eq(landingPages.id, page.id))
      .limit(1);

    expect(updated.activeAngle).toBe("godfather");
  });

  it("should validate all 16 sections in landing page content", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [page] = await db
      .select()
      .from(landingPages)
      .where(eq(landingPages.userId, testUserId))
      .limit(1);

    const content = page.originalAngle;
    expect(content).toBeDefined();

    // Validate all 16 required sections
    expect(content?.eyebrowHeadline).toBeDefined();
    expect(content?.mainHeadline).toBeDefined();
    expect(content?.subheadline).toBeDefined();
    expect(content?.primaryCta).toBeDefined();
    expect(content?.asSeenIn).toBeDefined();
    expect(content?.quizSection).toBeDefined();
    expect(content?.problemAgitation).toBeDefined();
    expect(content?.solutionIntro).toBeDefined();
    expect(content?.whyOldFail).toBeDefined();
    expect(content?.uniqueMechanism).toBeDefined();
    expect(content?.testimonials).toBeDefined();
    expect(content?.insiderAdvantages).toBeDefined();
    expect(content?.scarcityUrgency).toBeDefined();
    expect(content?.shockingStat).toBeDefined();
    expect(content?.timeSavingBenefit).toBeDefined();
    expect(content?.consultationOutline).toBeDefined();

    // Validate quiz section structure
    expect(content?.quizSection.question).toBeDefined();
    expect(content?.quizSection.options).toHaveLength(5);
    expect(content?.quizSection.answer).toBeDefined();

    // Validate testimonials structure
    expect(content?.testimonials).toHaveLength(4);
    content?.testimonials.forEach((t) => {
      expect(t.headline).toBeDefined();
      expect(t.quote).toBeDefined();
      expect(t.name).toBeDefined();
      expect(t.location).toBeDefined();
    });

    // Validate consultation outline structure
    expect(content?.consultationOutline).toHaveLength(10);
    content?.consultationOutline.forEach((item) => {
      expect(item.title).toBeDefined();
      expect(item.description).toBeDefined();
    });
  });
});
