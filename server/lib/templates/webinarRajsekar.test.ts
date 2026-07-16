import { describe, it, expect } from "vitest";
import { buildWebinarRajsekarHtml } from "./webinarRajsekar";
import type { LandingPageContent } from "../../../drizzle/schema";

const base = {
  eyebrowHeadline: "FREE 90-MIN WORKSHOP",
  mainHeadline: "Launch a coaching business using AI",
  subheadline: "No burnout, no funnels, no fame needed.",
  primaryCta: "Reserve My Free Seat",
  asSeenIn: [], quizSection: { question: "", options: [], answer: "" },
  problemAgitation: "", solutionIntro: "", whyOldFail: "", uniqueMechanism: "",
  testimonials: [
    { headline: "", quote: "This workshop changed how I sell.", name: "Riddhi Deorah", location: "Mumbai" },
  ],
  insiderAdvantages: "", scarcityUrgency: "", shockingStat: "", timeSavingBenefit: "",
  consultationOutline: [
    { title: "Find your niche", description: "Pin the audience you can serve best." },
    { title: "Build the offer", description: "Turn expertise into a sellable program." },
    { title: "Launch with AI", description: "Fill your calendar without ad spend." },
  ],
  faq: [{ question: "Will there be a replay?", answer: "Yes, if you register." }],
  guarantee: "",
  bonuses: [{ title: "AI Niche Tool", description: "Find your profitable niche in minutes." }],
} as unknown as LandingPageContent;

const coach = {
  headshotUrl: "https://res.cloudinary.com/dunshei0y/image/upload/v1/coach_h.png",
  logoUrl: null, coachName: "Siddharth Rajsekar", coachBackground: "I've spent a decade training coaches to scale.",
  videoUrl: "https://youtu.be/dQw4w9WgXcQ",
  isThisYou: [
    { label: "The daily struggle", body: "You trade time for money and can't scale past 1:1." },
    { label: "The frustration", body: "You've tried funnels and they burned you out." },
  ],
  trustCount: null,
};

describe("buildWebinarRajsekarHtml — webinar registration on the Rajsekar design bar", () => {
  it("embeds the coach's REAL video (YouTube → provider iframe), never a fabricated player", () => {
    const html = buildWebinarRajsekarHtml(base, "Coaching", coach);
    expect(html).toContain("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(html).toContain("<iframe");
  });

  it("falls back to the real headshot poster with NO fake play button when there's no video", () => {
    const html = buildWebinarRajsekarHtml(base, "Coaching", { ...coach, videoUrl: null });
    expect(html).toContain("coach_h.png");
    expect(html).not.toContain("<iframe");
    // no fabricated play affordance drawn over a static photo
    expect(html).not.toContain("▶");
  });

  it("omits the media frame honestly when there's neither video nor photo", () => {
    const html = buildWebinarRajsekarHtml(base, "Coaching", { ...coach, videoUrl: null, headshotUrl: null, heroImageUrl: null });
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("aspect-ratio:16/9");
  });

  it("binds the reservation card to a REAL event date with a countdown when eventSchedule is set", () => {
    const dated = { ...base, eventSchedule: { date: "2026-10-16", time: "11:00 AM", timezone: "IST" } } as unknown as LandingPageContent;
    const html = buildWebinarRajsekarHtml(dated, "Coaching", coach);
    expect(html).toContain("2026-10-16");
    expect(html).toContain("IST");
    expect(html).toContain('id="wb_cd"'); // countdown element present
    expect(html).toContain('data-target="2026-10-16 11:00 AM IST"');
    expect(html).not.toContain("[INSERT_EVENT_DATE]");
  });

  it("stays a review-draft with no date: card emits [INSERT_EVENT_*] tokens and NO countdown", () => {
    const html = buildWebinarRajsekarHtml(base, "Coaching", coach);
    expect(html).toContain("[INSERT_EVENT_DATE]");
    expect(html).toContain("[INSERT_EVENT_TIME]");
    expect(html).toContain("[INSERT_EVENT_TIMEZONE]");
    expect(html).not.toContain('id="wb_cd"'); // no fake ticking clock
  });

  it("wires the reserve-seat form to /api/capture-lead in webinar mode", () => {
    const html = buildWebinarRajsekarHtml(base, "Coaching", coach);
    expect(html).toContain("/api/capture-lead");
    expect(html).toContain("mode:'webinar'"); // JS object literal, serialised at runtime
    expect(html).toContain('type="email"');
    expect(html).toContain('id="wb_hp"'); // honeypot present
  });

  // CORRECTED 2026-07-17: the ICP qualification is now the reference's lavender "Who is this class
  // for?" closer (moved from a top "Is this you"); still binds coach.isThisYou (real-or-nothing).
  it("binds 'Who is this class for?' cards to ICP-derived content (real-or-nothing), omits when empty", () => {
    const html = buildWebinarRajsekarHtml(base, "Coaching", coach);
    expect(html).toContain("Who is this class for?");
    expect(html).toContain("can&#39;t scale past 1:1");
    const noIcp = buildWebinarRajsekarHtml(base, "Coaching", { ...coach, isThisYou: [] });
    expect(noIcp).not.toContain("Who is this class for?");
  });

  it("renders the 3-part framework from consultationOutline and real testimonials with monograms", () => {
    const html = buildWebinarRajsekarHtml(base, "Coaching", coach);
    expect(html).toContain("What you&#39;ll learn live");
    expect(html).toContain("Find your niche");
    expect(html).toContain("From people who attended");
    expect(html).toContain(">RD<"); // Riddhi Deorah monogram, no fabricated face
  });

  it("renders generated bonus copy but omits monetary value unless operator-supplied", () => {
    const html = buildWebinarRajsekarHtml(base, "Coaching", coach);
    expect(html).toContain("Free bonuses when you attend live");
    expect(html).toContain("AI Niche Tool");
    // no fabricated ₹/$ value in the default (operator hasn't supplied one)
    expect(html).not.toContain("₹5,999");
    const priced = { ...base, bonuses: [{ title: "AI Niche Tool", description: "x", value: "$99" }] } as unknown as LandingPageContent;
    expect(buildWebinarRajsekarHtml(priced, "Coaching", coach)).toContain("$99");
  });

  it("never invents the reference's stats — no fabricated 50,000+/₹1,500Cr figures", () => {
    const html = buildWebinarRajsekarHtml(base, "Coaching", coach);
    expect(html).not.toContain("50,000");
    expect(html).not.toContain("1,500");
    expect(html).not.toContain("9,076");
  });

  it("renders the host bio from coach name + background, closes on a navy footer", () => {
    const html = buildWebinarRajsekarHtml(base, "Coaching", coach);
    expect(html).toContain("Meet your host");
    expect(html).toContain("Siddharth Rajsekar");
    expect(html).toContain("decade training coaches");
    expect(html).toContain("#0F172A"); // navy footer (sampled NAVY, unified 2026-07-17)
  });
});
