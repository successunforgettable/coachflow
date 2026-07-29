import { describe, it, expect } from "vitest";
import { buildBurchardProductivityHtml } from "./burchardProductivity";
import { esc, ok, imgOrOmit, stars, initials, highlightTerm } from "./templatePrimitives";
import type { LandingPageContent } from "../../../drizzle/schema";

const content = {
  eyebrowHeadline: "", mainHeadline: "How O'Brien's team ships faster",
  subheadline: "Get the simple system that keeps you on track — it's <free>.",
  primaryCta: 'Download Free "Guide"', asSeenIn: [],
  quizSection: { question: "", options: [], answer: "" },
  problemAgitation: "", solutionIntro: "", whyOldFail: "", uniqueMechanism: "",
  testimonials: [
    { headline: "", quote: "It's the best & fastest tool <ever>", name: "Ann O'Neil", location: "NYC" },
    { headline: "", quote: "Saved me hours", name: "Bob Lee", location: "LA" },
  ],
  insiderAdvantages: "", scarcityUrgency: "", shockingStat: "", timeSavingBenefit: "",
  consultationOutline: [
    { title: "Organize & Maximize", description: "Organize your day for scattered coaches." },
    { title: "Discipline & Focus", description: "Build focus without burnout." },
    { title: "Structure", description: "A repeatable structure & support." },
  ],
  faq: [], guarantee: "",
  featureHighlights: ["A one-page format", "Daily focus prompts", "Print-friendly layout"],
} as unknown as LandingPageContent;

const richCoach = {
  headshotUrl: "https://res.cloudinary.com/dunshei0y/image/upload/v1/coach-assets_h.png",
  productCoverUrl: "https://res.cloudinary.com/dunshei0y/image/upload/pg_1,f_jpg,c_fit,w_800/v1/lead-magnets_1_5.pdf.pdf",
  logoUrl: null, coachName: "O'Brien Co", leadMagnetName: "Focus Sheet", trustCount: null,
};

describe("templatePrimitives", () => {
  it("esc escapes apostrophes (attribute-safe — the canonical behavior)", () => {
    expect(esc("O'Brien & <b>\"x\"</b>")).toBe("O&#39;Brien &amp; &lt;b&gt;&quot;x&quot;&lt;/b&gt;");
  });
  it("ok rejects blanks and the incompleteness marker", () => {
    expect(ok("hi")).toBe(true);
    expect(ok("   ")).toBe(false);
    expect(ok(null)).toBe(false);
    expect(ok("[Generation incomplete — retry]")).toBe(false);
    expect(ok(["a"])).toBe(true);
    expect(ok([])).toBe(false);
  });
  it("imgOrOmit renders a real url and omits an empty one (no fabricated stand-in)", () => {
    expect(imgOrOmit("https://x/y.png", "Al", "width:10px")).toBe('<img src="https://x/y.png" alt="Al" style="width:10px">');
    expect(imgOrOmit(null, "Al", "width:10px")).toBe("");
    expect(imgOrOmit("  ", "Al", "width:10px")).toBe("");
  });
  it("stars/initials/highlightTerm are pure and themeable", () => {
    expect(stars("#F88028")).toContain("★★★★★");
    expect(stars("#F88028")).toContain("color:#F88028");
    expect(initials("Ann O'Neil")).toBe("AO");
    expect(highlightTerm("Get the Focus Sheet now", "Focus Sheet", "#F88028"))
      .toBe('Get the <span style="color:#F88028;">Focus Sheet</span> now');
    expect(highlightTerm("no term here", "Absent", "#F88028")).toBe("no term here");
  });
});

describe("buildBurchardProductivityHtml — full page", () => {
  it("renders the Burchard structure with a real cover + real headshot", () => {
    const html = buildBurchardProductivityHtml(content, "Focus Service", richCoach);
    // Real auto-derived cover in the composite (not the empty-state panel).
    expect(html).toContain("pg_1,f_jpg,c_fit,w_800/v1/lead-magnets_1_5.pdf.pdf");
    expect(html).toContain('alt="Focus Sheet cover"');
    expect(html).not.toContain("FREE DOWNLOAD"); // branded empty panel absent when a real cover exists
    // Real headshot cutout present.
    expect(html).toContain("coach-assets_h.png");
    // Benefit bands + tiles + testimonials (initials monogram, no fabricated face).
    // P9-2: this fixture has trustCount null, so the five stars and the
    // "Trusted by…" claim must BOTH be absent. The old assertion here expected
    // ★★★★★ unconditionally — it encoded the defect, asserting fabricated social
    // proof on a coach with no supplied proof.
    expect(html).not.toContain("★★★★★");
    expect(html).not.toContain("Trusted by");
    expect(html).toContain(">AO<"); // Ann O'Neil monogram
    expect(html).toContain("A one-page format");
    // Apostrophe safety in the rendered headline.
    expect(html).toContain("O&#39;Brien");
    expect(html).not.toContain("How O'Brien"); // raw apostrophe must be escaped
    // No fabricated stand-ins anywhere.
    expect(html).not.toContain("repeating-linear-gradient");
    expect(html).not.toContain("#F1C0C8");
  });

  it("P9-2: renders stars and the trust line ONLY when the coach supplied a real count", () => {
    const withProof = { ...richCoach, trustCount: "1,200" };
    const html = buildBurchardProductivityHtml(content, "Focus Service", withProof);
    expect(html).toContain("★★★★★");
    expect(html).toContain("Trusted by over 1,200 high achievers");
  });

  it("P9-1: never ships a plausible-looking brand placeholder", () => {
    const nameless = { ...richCoach, coachName: null, logoUrl: null };
    const html = buildBurchardProductivityHtml(content, "Focus Service", nameless);
    expect(html).not.toContain("yourbrand");
    expect(html).not.toContain("YOUR BRAND");
  });

  it("P9-4: does not prepend an article-led title to \"Get Your Free\"", () => {
    const articled = { ...richCoach, leadMagnetName: "The 3-Night Settling Sequence Reset" };
    const html = buildBurchardProductivityHtml(content, "Focus Service", articled);
    expect(html).not.toContain("Get Your Free The ");
    expect(html).toContain("Get Your Free 3-Night Settling Sequence Reset Now!");
  });

  it("P9-5b: a fitted title never collides with the slot's own punctuation", () => {
    // Found on the published screenshot, not by any text assertion: the fitted
    // title's ellipsis met the template's own mark and rendered "Is… Now!" and
    // "Your….", and the bottom CTA button (a SECOND cta computation the hero fix
    // had missed) rendered the full 200-char title as a six-line orange slab.
    const long = { ...richCoach, leadMagnetName:
      "The 5 Roles You're Already Qualified For (But Your CV Is Written in the Wrong Sector's Language): How Mid-Career Professionals Are Getting Screened Out" };
    const html = buildBurchardProductivityHtml(content, "Focus Service", long);
    const visible = html.replace(/alt="[^"]*"/g, "");
    expect(visible).not.toContain("… Now!");
    expect(visible).not.toContain("….");
    expect(visible).not.toContain("Getting Screened Out");   // no slot carries the full title
    expect(visible).not.toMatch(/\([^)<]*<\/span>/);        // no orphaned opening bracket
  });

  it("P9-3/5: fits an over-long magnet title into every slot", () => {
    const long = { ...richCoach, leadMagnetName:
      "The 3-Night Settling Sequence Reset: How Exhausted First-Time Parents Get Their Baby Sleeping Through Without Cry-It-Out" };
    const html = buildBurchardProductivityHtml(content, "Focus Service", long);
    // Every VISIBLE slot is fitted. The composite's alt attribute deliberately
    // keeps the full title for screen readers, so assert on the slots, not on
    // the whole document.
    const visible = html.replace(/alt="[^"]*"/g, "");
    expect(visible).not.toContain("Without Cry-It-Out");
    expect(visible).toContain("…");
    expect(visible).not.toContain("Get Your Free The ");
  });

  it("degrades honestly when the coach has no headshot and no cover", () => {
    const html = buildBurchardProductivityHtml(content, "Focus Service", { coachName: "O'Brien Co", leadMagnetName: "Focus Sheet" });
    expect(html).toContain("FREE DOWNLOAD");          // branded, obviously-designed panel
    expect(html).toContain("translateX(-50%)");        // product centres with no cutout
    expect(html).not.toContain("<svg aria-hidden=\"true\" viewBox=\"0 0 150 160\""); // no fabricated silhouette
    expect(html).not.toContain("repeating-linear-gradient");
  });
});
