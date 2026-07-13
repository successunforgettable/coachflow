import { describe, it, expect } from "vitest";
import {
  IMAGE_SLOTS,
  isSlotAssetType,
  isCloudinaryUrl,
  slotImageUrl,
  slotDimensions,
  setGrayscale,
  hasGrayscale,
  setFacingFlip,
  hasFacingFlip,
  pdfPageOneCoverUrl,
  resolveProductCoverUrl,
} from "./imageSlots";

const CLD = "https://res.cloudinary.com/dunshei0y/image/upload/v1783804556/coach-assets_x.png";
// Real prod magnetPdfUrl shape (double .pdf.pdf: relKey carried the extension,
// Cloudinary appended the delivery format). Verified live: page-1 transform → 200 image/jpeg.
const PDF = "https://res.cloudinary.com/dunshei0y/image/upload/v1783629307/lead-magnets_1_5686.pdf.pdf";

describe("imageSlots registry", () => {
  it("has the four active slots with correct ratios", () => {
    expect(IMAGE_SLOTS.hero_image.ratioW).toBe(16);
    expect(IMAGE_SLOTS.hero_image.ratioH).toBe(9);
    expect(IMAGE_SLOTS.headshot.ratioW).toBe(2);
    expect(IMAGE_SLOTS.headshot.ratioH).toBe(3);
    expect(IMAGE_SLOTS.headshot.gravity).toBe("face");
    expect(IMAGE_SLOTS.press_logo.grayscaleDefault).toBe(true);
    expect(IMAGE_SLOTS.press_logo.ratioW).toBeNull();
    expect(IMAGE_SLOTS.value_stack.transparent).toBe(true);
    expect(IMAGE_SLOTS.value_stack.ratioW).toBe(3);
  });

  it("recognises slot asset types", () => {
    expect(isSlotAssetType("hero_image")).toBe(true);
    expect(isSlotAssetType("value_stack")).toBe(true);
    expect(isSlotAssetType("social_proof")).toBe(false);
    expect(isSlotAssetType("nonsense")).toBe(false);
  });
});

describe("isCloudinaryUrl", () => {
  it("detects Cloudinary delivery URLs", () => {
    expect(isCloudinaryUrl(CLD)).toBe(true);
    expect(isCloudinaryUrl("https://example.com/a.png")).toBe(false);
    expect(isCloudinaryUrl(null)).toBe(false);
    expect(isCloudinaryUrl(undefined)).toBe(false);
    expect(isCloudinaryUrl("")).toBe(false);
  });
});

describe("slotImageUrl — structural transform", () => {
  it("composes a 16:9 fill for hero", () => {
    expect(slotImageUrl(CLD, "hero_image")).toBe(
      "https://res.cloudinary.com/dunshei0y/image/upload/c_fill,ar_16:9,g_auto,w_1280/v1783804556/coach-assets_x.png",
    );
  });
  it("composes a 2:3 face-gravity crop for presenter portrait", () => {
    expect(slotImageUrl(CLD, "headshot")).toBe(
      "https://res.cloudinary.com/dunshei0y/image/upload/c_fill,ar_2:3,g_face,w_400/v1783804556/coach-assets_x.png",
    );
  });
  it("composes a contain (fit) transform for wide trust logos (no ratio)", () => {
    expect(slotImageUrl(CLD, "press_logo")).toBe(
      "https://res.cloudinary.com/dunshei0y/image/upload/c_fit,w_300/v1783804556/coach-assets_x.png",
    );
  });
  it("composes a 3:2 fit for the value stack (preserves alpha)", () => {
    expect(slotImageUrl(CLD, "value_stack")).toBe(
      "https://res.cloudinary.com/dunshei0y/image/upload/c_fit,ar_3:2,w_1200/v1783804556/coach-assets_x.png",
    );
  });
  it("passes non-Cloudinary URLs through unchanged", () => {
    const ext = "https://cdn.example.com/logo.png";
    expect(slotImageUrl(ext, "hero_image")).toBe(ext);
  });
  it("returns empty string for null/undefined", () => {
    expect(slotImageUrl(null, "hero_image")).toBe("");
    expect(slotImageUrl(undefined, "hero_image")).toBe("");
  });
});

describe("baked user-choice tokens (no DB column)", () => {
  it("bakes and reads grayscale, chaining structural on top", () => {
    const gray = setGrayscale(CLD, true);
    expect(gray).toContain("/upload/e_grayscale/v1783804556/");
    expect(hasGrayscale(gray)).toBe(true);
    // structural prepends, baked token preserved:
    expect(slotImageUrl(gray, "press_logo")).toBe(
      "https://res.cloudinary.com/dunshei0y/image/upload/c_fit,w_300/e_grayscale/v1783804556/coach-assets_x.png",
    );
  });
  it("keep-original-colour override removes grayscale", () => {
    const gray = setGrayscale(CLD, true);
    const colour = setGrayscale(gray, false);
    expect(hasGrayscale(colour)).toBe(false);
    expect(colour).toBe(CLD);
  });
  it("bakes and reads the facing flip, idempotently", () => {
    const flipped = setFacingFlip(CLD, true);
    expect(hasFacingFlip(flipped)).toBe(true);
    expect(setFacingFlip(flipped, true)).toBe(flipped); // idempotent
    const back = setFacingFlip(flipped, false);
    expect(hasFacingFlip(back)).toBe(false);
    expect(back).toBe(CLD);
  });
  it("carries both tokens together and preserves them under render", () => {
    let u = setGrayscale(CLD, true);
    u = setFacingFlip(u, true);
    expect(hasGrayscale(u)).toBe(true);
    expect(hasFacingFlip(u)).toBe(true);
    expect(slotImageUrl(u, "headshot")).toBe(
      "https://res.cloudinary.com/dunshei0y/image/upload/c_fill,ar_2:3,g_face,w_400/e_grayscale,a_hflip/v1783804556/coach-assets_x.png",
    );
  });
  it("leaves non-Cloudinary urls untouched", () => {
    const ext = "https://cdn.example.com/logo.png";
    expect(setGrayscale(ext, true)).toBe(ext);
    expect(setFacingFlip(ext, true)).toBe(ext);
  });
});

describe("pdfPageOneCoverUrl — real magnet cover from the PDF", () => {
  it("injects the page-1 JPEG transform after /image/upload/, preserving the tail", () => {
    expect(pdfPageOneCoverUrl(PDF)).toBe(
      "https://res.cloudinary.com/dunshei0y/image/upload/pg_1,f_jpg,c_fit,w_800/v1783629307/lead-magnets_1_5686.pdf.pdf",
    );
  });
  it("preserves any baked user-choice tokens", () => {
    const withBaked =
      "https://res.cloudinary.com/dunshei0y/image/upload/e_grayscale/v1/lead-magnets_1_9.pdf.pdf";
    expect(pdfPageOneCoverUrl(withBaked)).toBe(
      "https://res.cloudinary.com/dunshei0y/image/upload/pg_1,f_jpg,c_fit,w_800/e_grayscale/v1/lead-magnets_1_9.pdf.pdf",
    );
  });
  it("returns empty string for non-Cloudinary / null / empty urls", () => {
    expect(pdfPageOneCoverUrl(null)).toBe("");
    expect(pdfPageOneCoverUrl(undefined)).toBe("");
    expect(pdfPageOneCoverUrl("")).toBe("");
    expect(pdfPageOneCoverUrl("https://cdn.example.com/x.pdf")).toBe("");
  });
});

describe("resolveProductCoverUrl — locked fallback order", () => {
  const uploaded = "https://res.cloudinary.com/dunshei0y/image/upload/v9/coach-assets_cover.png";
  it("prefers the coach-uploaded value_stack when present", () => {
    expect(resolveProductCoverUrl(uploaded, PDF)).toBe(uploaded);
  });
  it("falls back to the PDF-derived cover when nothing was uploaded", () => {
    expect(resolveProductCoverUrl(null, PDF)).toBe(
      "https://res.cloudinary.com/dunshei0y/image/upload/pg_1,f_jpg,c_fit,w_800/v1783629307/lead-magnets_1_5686.pdf.pdf",
    );
  });
  it("returns null (graceful empty-state) when neither source exists", () => {
    expect(resolveProductCoverUrl(null, null)).toBeNull();
    expect(resolveProductCoverUrl("", "")).toBeNull();
    expect(resolveProductCoverUrl("   ", undefined)).toBeNull();
  });
  it("treats a quiz (no PDF) as empty → null, not a broken url", () => {
    expect(resolveProductCoverUrl(null, null)).toBeNull();
  });
});

describe("slotDimensions — CLS attrs", () => {
  it("computes height from ratio for photos", () => {
    expect(slotDimensions("hero_image")).toEqual({ width: 1280, height: 720 });
    expect(slotDimensions("headshot")).toEqual({ width: 400, height: 600 });
    expect(slotDimensions("value_stack")).toEqual({ width: 1200, height: 800 });
  });
  it("returns null height for the ratio-less logo bar", () => {
    expect(slotDimensions("press_logo")).toEqual({ width: 300, height: null });
  });
});
