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
    expect(html).toContain("★★★★★");
    expect(html).toContain(">AO<"); // Ann O'Neil monogram
    expect(html).toContain("A one-page format");
    // Apostrophe safety in the rendered headline.
    expect(html).toContain("O&#39;Brien");
    expect(html).not.toContain("How O'Brien"); // raw apostrophe must be escaped
    // No fabricated stand-ins anywhere.
    expect(html).not.toContain("repeating-linear-gradient");
    expect(html).not.toContain("#F1C0C8");
  });

  it("degrades honestly when the coach has no headshot and no cover", () => {
    const html = buildBurchardProductivityHtml(content, "Focus Service", { coachName: "O'Brien Co", leadMagnetName: "Focus Sheet" });
    expect(html).toContain("FREE DOWNLOAD");          // branded, obviously-designed panel
    expect(html).toContain("translateX(-50%)");        // product centres with no cutout
    expect(html).not.toContain("<svg aria-hidden=\"true\" viewBox=\"0 0 150 160\""); // no fabricated silhouette
    expect(html).not.toContain("repeating-linear-gradient");
  });
});
