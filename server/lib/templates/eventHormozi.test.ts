import { describe, it, expect } from "vitest";
import { buildEventHormoziHtml } from "./eventHormozi";
import type { LandingPageContent } from "../../../drizzle/schema";

const base = {
  eyebrowHeadline: "",
  mainHeadline: "Are you the biggest risk to your own business?",
  subheadline: "Two days in the room with operators who have scaled past $100M.",
  primaryCta: "I'm ready to scale",
  asSeenIn: [], quizSection: { question: "", options: [], answer: "" },
  problemAgitation: "Most founders are the bottleneck and can't see it.",
  solutionIntro: "This workshop shows you exactly where you are the constraint.",
  whyOldFail: "Day one we diagnose the business; day two we build the plan in small groups.",
  uniqueMechanism: "",
  testimonials: [
    { headline: "", quote: "I rebuilt my ops after this workshop.", name: "Dana Ruiz", location: "Miami" },
    { headline: "", quote: "Best two days I've spent on my business.", name: "Sam Okoro", location: "Lagos" },
  ],
  insiderAdvantages: "You leave with 3–5 tactical next steps tailored to your business.",
  scarcityUrgency: "", shockingStat: "",
  timeSavingBenefit: "A concrete action plan you can execute the next morning.",
  consultationOutline: [
    { title: "Access to our directors", description: "Meet the operators who run the companies." },
    { title: "Learn how we scale past $100M", description: "The operating system behind the growth." },
    { title: "3–5 tactical next steps", description: "Personalised actions for your business." },
  ],
  faq: [], guarantee: "",
} as unknown as LandingPageContent;

const coach = {
  headshotUrl: "https://res.cloudinary.com/dunshei0y/image/upload/v1/host.png",
  coachName: "Alex Coach",
  coachBackground: "I've scaled multiple companies.",
  videoUrl: "https://youtu.be/dQw4w9WgXcQ",
  whoFor: ["You already run a business and want to remove yourself as the bottleneck.", "You're ready to work in small groups, not just watch slides."],
};

describe("buildEventHormoziHtml — paid workshop objection ladder on the Hormozi design bar", () => {
  it("embeds the coach's REAL video (YouTube → provider iframe), never a fabricated player", () => {
    const html = buildEventHormoziHtml(base, "Scaling Workshop", coach);
    expect(html).toContain("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(html).toContain("<iframe");
  });

  it("falls back to the real headshot poster (no fake play) when there's no video, omits with neither", () => {
    const poster = buildEventHormoziHtml(base, "Workshop", { ...coach, videoUrl: null });
    expect(poster).toContain("host.png");
    expect(poster).not.toContain("<iframe");
    const none = buildEventHormoziHtml(base, "Workshop", { ...coach, videoUrl: null, headshotUrl: null, heroImageUrl: null });
    expect(none).not.toContain("<iframe");
    expect(none).not.toContain("aspect-ratio:16/9");
  });

  it("binds the event strip to a REAL eventSchedule, emits [INSERT_EVENT_*] tokens when absent", () => {
    const dated = { ...base, eventSchedule: { date: "Nov 12", venue: "Las Vegas" } } as unknown as LandingPageContent;
    const html = buildEventHormoziHtml(dated, "Workshop", coach);
    expect(html).toContain("Las Vegas");
    expect(html).toContain("Nov 12");
    expect(html).not.toContain("[INSERT_EVENT_VENUE]");
    const noDate = buildEventHormoziHtml(base, "Workshop", coach);
    expect(noDate).toContain("[INSERT_EVENT_VENUE]");
    expect(noDate).toContain("[INSERT_EVENT_DATE]");
  });

  it("__ONLINE__ venue → 'Live online' (not 'in-person'), no [INSERT_EVENT_VENUE], no raw sentinel", () => {
    const online = { ...base, eventSchedule: { date: "Nov 12", venue: "__ONLINE__" } } as unknown as LandingPageContent;
    const html = buildEventHormoziHtml(online, "Workshop", coach);
    expect(html).toContain("Live online");
    expect(html).not.toContain("Live in-person workshop"); // the strip label drops "in-person" when online
    expect(html).not.toContain("[INSERT_EVENT_VENUE]"); // explicit answer → complete
    expect(html).not.toContain("__ONLINE__");
  });

  it("renders the Gate-1 proof as honest monogram quote cards from REAL testimonials (no fake screenshots)", () => {
    const html = buildEventHormoziHtml(base, "Workshop", coach);
    expect(html).toContain("What people are saying");
    expect(html).toContain("I rebuilt my ops after this workshop.");
    expect(html).toContain(">DR<"); // Dana Ruiz monogram — no fabricated face or screenshot
    const noProof = buildEventHormoziHtml({ ...base, testimonials: [] } as unknown as LandingPageContent, "Workshop", coach);
    expect(noProof).not.toContain("What people are saying");
  });

  it("renders the price section ONLY from a real operator price; omits the whole section otherwise", () => {
    const noPrice = buildEventHormoziHtml(base, "Workshop", coach);
    expect(noPrice).not.toContain("How much are tickets?"); // omitted — never fabricated
    const priced = { ...base, price: { amount: "2,000", currency: "$" } } as unknown as LandingPageContent;
    const html = buildEventHormoziHtml(priced, "Workshop", coach);
    expect(html).toContain("How much are tickets?");
    expect(html).toContain("$2,000");
  });

  it("NEVER reproduces Hormozi's own figures ($5k / 250k / $1m / $100m thresholds)", () => {
    const html = buildEventHormoziHtml(base, "Workshop", coach);
    expect(html).not.toContain("$5k");
    expect(html).not.toContain("250k");
    expect(html).not.toContain("$1m");
    // $100M appears only if the coach's own copy contains it — never injected by the template chrome.
  });

  it("binds the qualification section to ICP-derived whoFor lines, omits when empty", () => {
    const html = buildEventHormoziHtml(base, "Workshop", coach);
    expect(html).toContain("Is this right for my business?");
    expect(html).toContain("remove yourself as the bottleneck");
    const noWho = buildEventHormoziHtml(base, "Workshop", { ...coach, whoFor: [] });
    expect(noWho).not.toContain("Is this right for my business?");
  });

  it("renders three numbered workshop deliverables from consultationOutline (text-first)", () => {
    const html = buildEventHormoziHtml(base, "Workshop", coach);
    expect(html).toContain("What you get at the");
    expect(html).toContain("in-person");
    expect(html).toContain("Access to our directors");
    expect(html).toContain("3–5 tactical next steps"); // literal en-dash preserved (esc leaves it)
  });

  it("wires every purple CTA reveal-capture to /api/capture-lead in EVENT mode with a honeypot", () => {
    const html = buildEventHormoziHtml(base, "Workshop", coach);
    expect(html).toContain("/api/capture-lead");
    expect(html).toContain("mode:'event'");
    expect(html).toContain('name="ev_hp"'); // honeypot present
    expect(html).toContain("I&#39;m ready to scale"); // purple CTA label
    // multiple CTAs across the page (hero, mid, final)
    expect((html.match(/class="ev_cta"/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});
