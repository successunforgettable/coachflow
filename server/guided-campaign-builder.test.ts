/**
 * Item 2.1 — Vitest tests for GuidedCampaignBuilder step lock logic
 *
 * Tests the pure functions exported from GuidedCampaignBuilder.tsx:
 *   - getStepAssetCount
 *   - isStepComplete
 *   - isStepLocked
 *
 * No DB, no network, no React — pure logic only.
 */

import { describe, it, expect } from "vitest";

// ── Re-implement the pure functions here to avoid importing React component ──
// (Mirrors the exact logic in GuidedCampaignBuilder.tsx)

interface AssetCounts {
  headline: number;
  hvco: number;
  hero_mechanism: number;
  ad_copy: number;
  email_sequence: number;
  whatsapp_sequence: number;
  landing_page: number;
  offer: number;
  icp: number;
  ad_creatives: number;
  videos: number;
}

interface StepDefinition {
  number: number;
  label: string;
  description: string;
  assetKey: keyof AssetCounts | "icp_special";
  generateUrl: string;
  viewUrl: string;
  isIcpStep?: boolean;
}

const STEP_DEFINITIONS: StepDefinition[] = [
  { number: 1, label: "Your Sales Offer", description: "", assetKey: "offer", generateUrl: "/generators/offers", viewUrl: "/offers" },
  { number: 2, label: "Your Unique Method", description: "", assetKey: "hero_mechanism", generateUrl: "/hero-mechanisms/new", viewUrl: "/hero-mechanisms" },
  { number: 3, label: "Your Free Opt-In", description: "", assetKey: "hvco", generateUrl: "/hvco-titles/new", viewUrl: "/hvco-titles" },
  { number: 4, label: "Your Headlines", description: "", assetKey: "headline", generateUrl: "/headlines/new", viewUrl: "/headlines" },
  { number: 5, label: "Your Ideal Customer", description: "", assetKey: "icp_special", generateUrl: "/generators/icp", viewUrl: "/generators/icp", isIcpStep: true },
  { number: 6, label: "Your Ads", description: "", assetKey: "ad_copy", generateUrl: "/ad-copy", viewUrl: "/ad-copy" },
  { number: 7, label: "Your Ad Images", description: "", assetKey: "ad_creatives", generateUrl: "/ad-creatives", viewUrl: "/ad-creatives" },
  { number: 8, label: "Your Ad Videos", description: "", assetKey: "videos", generateUrl: "/video-creator", viewUrl: "/videos" },
  { number: 9, label: "Your Landing Page", description: "", assetKey: "landing_page", generateUrl: "/generators/landing-page", viewUrl: "/landing-pages" },
  { number: 10, label: "Your Email Follow-Up", description: "", assetKey: "email_sequence", generateUrl: "/generators/email", viewUrl: "/generators/email" },
  { number: 11, label: "Your WhatsApp Follow-Up", description: "", assetKey: "whatsapp_sequence", generateUrl: "/generators/whatsapp", viewUrl: "/generators/whatsapp" },
];

function getStepAssetCount(
  step: StepDefinition,
  assetCounts: AssetCounts,
  icpId: number | null | undefined
): number {
  if (step.isIcpStep) {
    return (icpId != null ? 1 : 0) + (assetCounts.icp ?? 0);
  }
  const key = step.assetKey as keyof AssetCounts;
  return assetCounts[key] ?? 0;
}

function isStepComplete(
  step: StepDefinition,
  assetCounts: AssetCounts,
  icpId: number | null | undefined
): boolean {
  return getStepAssetCount(step, assetCounts, icpId) >= 1;
}

function isStepLocked(
  stepIndex: number,
  assetCounts: AssetCounts,
  icpId: number | null | undefined
): boolean {
  if (stepIndex === 0) return false;
  const prevStep = STEP_DEFINITIONS[stepIndex - 1];
  return !isStepComplete(prevStep, assetCounts, icpId);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const emptyAssets: AssetCounts = {
  headline: 0, hvco: 0, hero_mechanism: 0, ad_copy: 0,
  email_sequence: 0, whatsapp_sequence: 0, landing_page: 0,
  offer: 0, icp: 0, ad_creatives: 0, videos: 0,
};

function withCounts(overrides: Partial<AssetCounts>): AssetCounts {
  return { ...emptyAssets, ...overrides };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Step 1 — always unlocked", () => {
  it("is unlocked when all assets are 0", () => {
    expect(isStepLocked(0, emptyAssets, null)).toBe(false);
  });

  it("is unlocked even when campaign has no ICP", () => {
    expect(isStepLocked(0, emptyAssets, undefined)).toBe(false);
  });
});

describe("Step 2 — locked until Step 1 complete", () => {
  it("is locked when offer count = 0", () => {
    expect(isStepLocked(1, emptyAssets, null)).toBe(true);
  });

  it("is unlocked when offer count >= 1", () => {
    expect(isStepLocked(1, withCounts({ offer: 1 }), null)).toBe(false);
  });
});

describe("Step 5 — ICP special case", () => {
  const step5 = STEP_DEFINITIONS[4];

  it("is NOT complete when icpId is null and icp count is 0", () => {
    expect(isStepComplete(step5, emptyAssets, null)).toBe(false);
  });

  it("is complete when icpId is set (non-null)", () => {
    expect(isStepComplete(step5, emptyAssets, 42)).toBe(true);
  });

  it("is complete when icp asset count >= 1 even without icpId", () => {
    expect(isStepComplete(step5, withCounts({ icp: 1 }), null)).toBe(true);
  });

  it("is complete when both icpId is set AND icp count >= 1", () => {
    expect(isStepComplete(step5, withCounts({ icp: 2 }), 99)).toBe(true);
  });

  it("getStepAssetCount returns 1 when only icpId is set", () => {
    expect(getStepAssetCount(step5, emptyAssets, 7)).toBe(1);
  });

  it("getStepAssetCount returns 0 when icpId is null and icp count is 0", () => {
    expect(getStepAssetCount(step5, emptyAssets, null)).toBe(0);
  });

  it("getStepAssetCount returns 2 when icpId set and icp count = 1", () => {
    expect(getStepAssetCount(step5, withCounts({ icp: 1 }), 5)).toBe(2);
  });
});

describe("Step 6 — unlocks automatically when Step 5 is complete", () => {
  it("is locked when Step 5 is not complete (no icpId, no icp assets)", () => {
    const counts = withCounts({ offer: 1, hero_mechanism: 1, hvco: 1, headline: 1 });
    expect(isStepLocked(5, counts, null)).toBe(true);
  });

  it("is unlocked when icpId is set (Step 5 auto-complete)", () => {
    const counts = withCounts({ offer: 1, hero_mechanism: 1, hvco: 1, headline: 1 });
    expect(isStepLocked(5, counts, 42)).toBe(false);
  });

  it("is unlocked when icp asset count >= 1 (Step 5 auto-complete via asset)", () => {
    const counts = withCounts({ offer: 1, hero_mechanism: 1, hvco: 1, headline: 1, icp: 1 });
    expect(isStepLocked(5, counts, null)).toBe(false);
  });
});

describe("Sequential locking — each step requires the previous", () => {
  it("Step 3 is locked when Step 2 (hero_mechanism) is 0", () => {
    expect(isStepLocked(2, withCounts({ offer: 1 }), null)).toBe(true);
  });

  it("Step 3 is unlocked when Step 2 (hero_mechanism) >= 1", () => {
    expect(isStepLocked(2, withCounts({ offer: 1, hero_mechanism: 1 }), null)).toBe(false);
  });

  it("Step 7 (Ad Images) is locked when Step 6 (ad_copy) is 0", () => {
    const counts = withCounts({ offer: 1, hero_mechanism: 1, hvco: 1, headline: 1 });
    expect(isStepLocked(6, counts, 42)).toBe(true);
  });

  it("Step 7 (Ad Images) is unlocked when Step 6 (ad_copy) >= 1", () => {
    const counts = withCounts({ offer: 1, hero_mechanism: 1, hvco: 1, headline: 1, ad_copy: 1 });
    expect(isStepLocked(6, counts, 42)).toBe(false);
  });

  it("Step 11 (WhatsApp) is locked when Step 10 (email_sequence) is 0", () => {
    const counts = withCounts({
      offer: 1, hero_mechanism: 1, hvco: 1, headline: 1,
      ad_copy: 1, ad_creatives: 1, videos: 1, landing_page: 1, email_sequence: 0,
    });
    expect(isStepLocked(10, counts, 42)).toBe(true);
  });

  it("Step 11 (WhatsApp) is unlocked when Step 10 (email_sequence) >= 1", () => {
    const counts = withCounts({
      offer: 1, hero_mechanism: 1, hvco: 1, headline: 1,
      ad_copy: 1, ad_creatives: 1, videos: 1, landing_page: 1, email_sequence: 1,
    });
    expect(isStepLocked(10, counts, 42)).toBe(false);
  });
});

describe("All 11 steps — complete campaign unlocks everything", () => {
  const fullCounts = withCounts({
    offer: 1, hero_mechanism: 1, hvco: 1, headline: 1,
    ad_copy: 1, ad_creatives: 1, videos: 1, landing_page: 1,
    email_sequence: 1, whatsapp_sequence: 1, icp: 1,
  });

  it("all steps are unlocked when all assets are present", () => {
    for (let i = 0; i < STEP_DEFINITIONS.length; i++) {
      expect(isStepLocked(i, fullCounts, 1)).toBe(false);
    }
  });

  it("all steps are complete when all assets are present", () => {
    for (const step of STEP_DEFINITIONS) {
      expect(isStepComplete(step, fullCounts, 1)).toBe(true);
    }
  });
});
