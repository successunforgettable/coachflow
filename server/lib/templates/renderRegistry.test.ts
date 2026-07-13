import { describe, it, expect } from "vitest";
import {
  TEMPLATE_REGISTRY,
  styleForPageType,
  coachAssetOptionsFrom,
  renderLandingPageHtml,
  type TemplateRenderInput,
} from "./renderRegistry";
import type { LandingPageContent } from "../../../drizzle/schema";

const CLD = (id: string) => `https://res.cloudinary.com/dunshei0y/image/upload/v1/${id}.png`;

function inputWith(assetRows: { assetType: string; url: string }[]): TemplateRenderInput {
  return {
    content: { mainHeadline: "Hi", subheadline: "", primaryCta: "Go" } as unknown as LandingPageContent,
    serviceName: "Svc",
    coachName: "Coach",
    coachBackground: null,
    assetRows,
    serviceId: null,
    userId: 1,
    pageType: "sales_page",
  };
}

describe("styleForPageType — the orchestration publish/draft decision", () => {
  it("returns the built per-reference templates", () => {
    expect(styleForPageType("lead_magnet_download")).toBe("lead_magnet_burchard");
    expect(styleForPageType("discovery_call_booking")).toBe("discovery_burchard_performance");
  });
  it("returns null for page types with no template yet → orchestration stages a review-draft", () => {
    expect(styleForPageType("webinar_registration")).toBeNull();
    expect(styleForPageType("event_registration")).toBeNull();
    expect(styleForPageType("sales_page")).toBeNull();
  });
  it("never returns the rejected energetic style for a fresh page", () => {
    for (const pt of ["sales_page", "webinar_registration", "event_registration", "discovery_call_booking"]) {
      expect(styleForPageType(pt)).not.toBe("energetic");
    }
  });
});

describe("coachAssetOptionsFrom — slotImageUrl wired for structural slots", () => {
  it("crops headshot (2:3 face), hero (16:9), press_logo (fit); leaves logo + social_proof raw", () => {
    const o = coachAssetOptionsFrom(inputWith([
      { assetType: "headshot", url: CLD("h") },
      { assetType: "hero_image", url: CLD("hero") },
      { assetType: "press_logo", url: CLD("p1") },
      { assetType: "logo", url: CLD("logo") },
      { assetType: "social_proof", url: CLD("s1") },
    ]));
    expect(o.headshotUrl).toContain("c_fill,ar_2:3,g_face,w_400");
    expect(o.heroImageUrl).toContain("c_fill,ar_16:9,g_auto,w_1280");
    expect(o.pressLogoUrls?.[0]).toContain("c_fit,w_300");
    expect(o.logoUrl).toBe(CLD("logo"));       // not an IMAGE_SLOT → raw
    expect(o.socialProofUrls?.[0]).toBe(CLD("s1")); // deferred slot → raw
  });
  it("returns nulls/empties when slots are absent", () => {
    const o = coachAssetOptionsFrom(inputWith([]));
    expect(o.headshotUrl).toBeNull();
    expect(o.heroImageUrl).toBeNull();
    expect(o.pressLogoUrls).toEqual([]);
  });
});

describe("registry shape + dispatch", () => {
  it("lead_magnet_burchard + discovery_burchard_performance are the per-reference (auto-selectable) templates today", () => {
    const withPageType = Object.entries(TEMPLATE_REGISTRY).filter(([, e]) => e.pageType !== null);
    expect(withPageType.map(([k]) => k).sort()).toEqual(
      ["discovery_burchard_performance", "lead_magnet_burchard"],
    );
  });
  it("renders the text style through the shared dispatch (no DB needed)", async () => {
    const html = await renderLandingPageHtml("text", inputWith([]));
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
  });
  it("falls back to text for an unknown style", async () => {
    const html = await renderLandingPageHtml("does_not_exist", inputWith([]));
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
  });
});
