import { describe, it, expect } from "vitest";
import { publicIdFromUrl } from "./adCreativeTeardown";

describe("publicIdFromUrl", () => {
  it("extracts the id from a real stored ad-creative URL, keeping the inner .png", () => {
    // Verbatim from prod, 2026-07-29. The `.png.png` is the known storage-key
    // double-suffix bug: the inner .png is part of the public_id, the outer is
    // Cloudinary's delivery extension.
    expect(publicIdFromUrl(
      "https://res.cloudinary.com/dunshei0y/image/upload/v1785333244/ad-creatives_117174_batch-1785333231628-37151b84_variation-1.png.png",
    )).toBe("ad-creatives_117174_batch-1785333231628-37151b84_variation-1.png");
  });

  it("handles the raw sibling", () => {
    expect(publicIdFromUrl(
      "https://res.cloudinary.com/dunshei0y/image/upload/v1785333244/ad-creatives_117174_batch-x_raw-variation-3.png.png",
    )).toBe("ad-creatives_117174_batch-x_raw-variation-3.png");
  });

  it("works without a version segment", () => {
    expect(publicIdFromUrl("https://res.cloudinary.com/c/image/upload/folder_file.png"))
      .toBe("folder_file");
  });

  it("returns null for anything that is not a Cloudinary upload URL", () => {
    expect(publicIdFromUrl(null)).toBeNull();
    expect(publicIdFromUrl("")).toBeNull();
    expect(publicIdFromUrl("https://example.com/a.png")).toBeNull();
  });

  it("does not strip a non-media suffix", () => {
    expect(publicIdFromUrl("https://res.cloudinary.com/c/image/upload/v1/a_b.tar.gz"))
      .toBe("a_b.tar.gz");
  });
});
