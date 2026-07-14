import { describe, it, expect } from "vitest";
import {
  TEMPLATE_REGISTRY,
  styleForPageType,
  resolveEventStyle,
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
  it("returns the built per-reference templates (all 5 campaign types now covered)", () => {
    expect(styleForPageType("lead_magnet_download")).toBe("lead_magnet_burchard");
    expect(styleForPageType("discovery_call_booking")).toBe("discovery_burchard_performance");
    expect(styleForPageType("webinar_registration")).toBe("webinar_rajsekar_coaching");
    expect(styleForPageType("sales_page")).toBe("sales_ali_abdaal"); // the catch-all default, now built
  });
  it("picks the FREE Iman default for event_registration (paid Hormozi is price-gated, not auto)", () => {
    expect(styleForPageType("event_registration")).toBe("event_iman_gadzhi");
  });
  it("returns null only for genuinely unknown page types", () => {
    expect(styleForPageType("not_a_real_page_type")).toBeNull();
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
  it("all 5 campaign types now have an auto-selectable per-reference template (sales completes the set)", () => {
    const withPageType = Object.entries(TEMPLATE_REGISTRY).filter(([, e]) => e.pageType !== null);
    expect(withPageType.map(([k]) => k).sort()).toEqual(
      ["discovery_burchard_performance", "event_iman_gadzhi", "lead_magnet_burchard", "sales_ali_abdaal", "webinar_rajsekar_coaching"],
    );
  });
  it("Hormozi (paid) is registered but pageType:null — reachable via price, never generic auto-select", () => {
    expect(TEMPLATE_REGISTRY.event_hormozi).toBeDefined();
    expect(TEMPLATE_REGISTRY.event_hormozi.pageType).toBeNull();
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

describe("resolveEventStyle — free-vs-paid event discriminator (price-presence)", () => {
  const priced = (amount: string) => ({ price: { amount } }) as unknown as LandingPageContent;
  it("upgrades the free Iman default to paid Hormozi ONLY when a real price is present", () => {
    expect(resolveEventStyle("event_iman_gadzhi", priced("2,000"))).toBe("event_hormozi");
  });
  it("stays on the free Iman default with no price (never fabricated → default free)", () => {
    expect(resolveEventStyle("event_iman_gadzhi", null)).toBe("event_iman_gadzhi");
    expect(resolveEventStyle("event_iman_gadzhi", {} as unknown as LandingPageContent)).toBe("event_iman_gadzhi");
    expect(resolveEventStyle("event_iman_gadzhi", priced("   "))).toBe("event_iman_gadzhi"); // blank ≠ real
  });
  it("is a no-op for every non-event style (safe to call on every publish)", () => {
    expect(resolveEventStyle("lead_magnet_burchard", priced("99"))).toBe("lead_magnet_burchard");
    expect(resolveEventStyle("webinar_rajsekar_coaching", null)).toBe("webinar_rajsekar_coaching");
    expect(resolveEventStyle("event_hormozi", null)).toBe("event_hormozi"); // already paid → unchanged
  });
});
