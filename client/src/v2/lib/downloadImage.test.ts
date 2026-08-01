/**
 * Filename and URL logic for ad-creative downloads.
 *
 * The download itself needs a browser (Blob, URL.createObjectURL, anchor click)
 * and is proven by clicking the button. What IS unit-testable — and what would
 * silently produce junk in a coach's Downloads folder — is the filename
 * derivation and the Cloudinary attachment-URL rewrite. Those are pinned here.
 */
import { describe, it, expect } from "vitest";
import { slugify, adCreativeFilename, withCloudinaryAttachment } from "./downloadImage";

describe("slugify", () => {
  it("lowercases and dashes a headline", () => {
    expect(slugify("Money in your name. Not his.")).toBe("money-in-your-name-not-his");
  });

  it("drops apostrophes rather than turning them into dashes", () => {
    // "It's not ambition" must not become "it-s-not-ambition".
    expect(slugify("It's not ambition. It's the account.")).toBe("its-not-ambition-its-the-account");
    expect(slugify("It’s fine")).toBe("its-fine");
  });

  it("strips currency and punctuation without leaving dash runs", () => {
    expect(slugify("£0 saved alone to a full audit done.")).toBe("0-saved-alone-to-a-full-audit-done");
  });

  it("never leaves a leading or trailing dash", () => {
    const s = slugify("  --- Hello --- ");
    expect(s.startsWith("-")).toBe(false);
    expect(s.endsWith("-")).toBe(false);
  });

  it("truncates at a word boundary, not mid-token", () => {
    const s = slugify("stop asking his face for a budget increase immediately", 20);
    expect(s.length).toBeLessThanOrEqual(20);
    expect(s.endsWith("-")).toBe(false);
    // Cut on a dash, so the last token is whole.
    expect("stop asking his face for a budget increase immediately".includes(s.split("-").pop()!)).toBe(true);
  });

  it("handles empty and junk input", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
    expect(slugify(undefined as unknown as string)).toBe("");
  });
});

describe("adCreativeFilename", () => {
  const real = {
    id: 398,
    variationNumber: 1,
    designStyle: "person_shocked",
    headlineFormula: "benefit",
    headline: "Money in your name. Not his.",
  };

  it("builds a name a human can recognise", () => {
    expect(adCreativeFilename(real)).toBe("zap-ad-1-benefit-money-in-your-name-not-his.png");
  });

  it("leads with the variation number so a batch sorts in deck order", () => {
    const names = [1, 2, 3, 4].map((n) =>
      adCreativeFilename({ ...real, variationNumber: n, headline: `Headline ${n}` }),
    );
    expect(names).toEqual([...names].sort());
  });

  it("distinguishes the four creatives of a real batch", () => {
    const batch = [
      { variationNumber: 1, headlineFormula: "benefit", headline: "Money in your name. Not his." },
      { variationNumber: 2, headlineFormula: "social_proof", headline: "£0 saved alone to a full audit done." },
      { variationNumber: 3, headlineFormula: "curiosity", headline: "It's not ambition. It's the account." },
      { variationNumber: 4, headlineFormula: "challenge", headline: "Stop asking his face for a budget." },
    ].map(adCreativeFilename);
    expect(new Set(batch).size).toBe(4);
    for (const n of batch) expect(n).toMatch(/^zap-ad-[1-4]-[a-z0-9-]+\.png$/);
  });

  it("falls back to designStyle when the formula is missing", () => {
    expect(adCreativeFilename({ variationNumber: 2, designStyle: "screenshot", headline: "Hi there" }))
      .toBe("zap-ad-2-screenshot-hi-there.png");
  });

  it("still produces something usable when the headline is empty", () => {
    expect(adCreativeFilename({ variationNumber: 3, headlineFormula: "curiosity", headline: "" }))
      .toBe("zap-ad-3-curiosity.png");
  });

  it("falls back to the row id when nothing else is present", () => {
    expect(adCreativeFilename({ id: 77 })).toBe("zap-ad-77.png");
  });

  it("always ends in .png and contains no path separators or spaces", () => {
    const n = adCreativeFilename({ variationNumber: 1, headline: "a/b\\c d" });
    expect(n).toMatch(/\.png$/);
    expect(n).not.toMatch(/[\\/\s]/);
  });
});

describe("withCloudinaryAttachment", () => {
  // The real URL shape, taken from a production row on 2026-08-01.
  const url =
    "https://res.cloudinary.com/dunshei0y/image/upload/v1785563405/ad-creatives_1_batch-1785563397522-51bbfcf5_variation-1.png.png";

  it("inserts the attachment flag directly after /image/upload/", () => {
    const out = withCloudinaryAttachment(url, "zap-ad-1-benefit.png");
    expect(out).toContain("/image/upload/fl_attachment:zap-ad-1-benefit/v1785563405/");
  });

  it("strips the extension from the flag — Cloudinary appends the real format", () => {
    expect(withCloudinaryAttachment(url, "name.png")).not.toContain("fl_attachment:name.png");
  });

  it("leaves a non-Cloudinary URL untouched so the caller can detect it", () => {
    const other = "https://example.com/foo.png";
    expect(withCloudinaryAttachment(other, "x.png")).toBe(other);
  });

  it("handles video and raw delivery types too", () => {
    const raw = "https://res.cloudinary.com/d/raw/upload/v1/x.png";
    expect(withCloudinaryAttachment(raw, "n.png")).toContain("/raw/upload/fl_attachment:n/");
  });
});
