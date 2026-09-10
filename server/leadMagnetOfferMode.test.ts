import { describe, it, expect, vi, beforeEach } from "vitest";
import freeEventPin from "./_core/__fixtures__/prompt-pins/offer-free_event-godfather-no-facts.json";
import { stripLeftoverOperatorTokens } from "./_core/leftoverOperatorTokens";
import { META_COMPLIANCE_NOTES, NO_DATE_FABRICATION_RULE, REGISTER_STANDARD } from "./_core/copywritingRules";

/**
 * The lead-magnet offer mode and the close it hands to (2026-09-10) —
 * docs/handovers/BRIEF_2026-09-10_LEAD_MAGNET_OFFER_MODE.md, parts A-D (the offer mode). Part E is
 * leadMagnetClose.test.ts; part F is campaignTypeFraming.test.ts.
 *
 * Every check below that asserts an ABSENCE has a control that must find the thing on the pre-change
 * text, so a check that has gone blind fails instead of passing (§15c, §15k). The paid and free-event
 * prompts are proven unchanged separately, byte for byte, by promptPins.test.ts.
 */
const m = vi.hoisted(() => ({
  calls: [] as any[], getDb: vi.fn(),
  writeKvPage: vi.fn(async (_ns: string, _slug: string, _html: string) => {}),
  renderPdfFromUrl: vi.fn(async () => Buffer.from("PDF")),
  ensureKvNamespace: vi.fn(async () => "NS"),
  storagePut: vi.fn(async (k: string) => ({ url: `https://cdn.example/${k}` })),
}));
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async (req: any) => {
    m.calls.push(req);
    return { choices: [{ message: { content: JSON.stringify({
      offerName: "The Pin", valueProposition: "v", pricing: "p", bonuses: "b", guarantee: "g", urgency: "u", cta: "c",
    }) } }] };
  }),
}));
vi.mock("./db", () => ({ getDb: m.getDb }));
vi.mock("./lib/cloudflare", () => ({ writeKvPage: m.writeKvPage, renderPdfFromUrl: m.renderPdfFromUrl, ensureKvNamespace: m.ensureKvNamespace }));
vi.mock("./storage", () => ({ storagePut: m.storagePut }));
vi.mock("./lib/coachLogo", () => ({ getCoachLogoUrl: vi.fn(async () => null) }));

beforeEach(() => { vi.clearAllMocks(); m.calls.length = 0; });

function makeDb(queue: any[][]) {
  const q = () => {
    const c: any = {
      from: () => c, where: () => c, set: () => c,
      limit: () => Promise.resolve(queue.shift() ?? []),
      then: (res: any) => res(queue.shift() ?? []),
    };
    return c;
  };
  return { select: () => q(), update: () => q(), insert: () => q(), delete: () => q() };
}

// The vocabulary of a live event. Operator tokens are stripped first: [INSERT_COHORT_LIMIT] is an
// allow-list NAME the prompt must print, not copy.
const EVENT_WORDS = /\battend\w*|\bin the room\b|\bseats?\b|\blive session\b|\bmasterclass\b|\bregist\w*|\breplay\b|\bwebinar\b|\bcohort\w*|\benrol\w*/gi;
// ⚠️ SCOPE, STATED: the three cross-generator compliance blocks are removed before checking, from the
// prompt under test AND from the control alike. They are standards every generator imports and are
// outside this package — and NO_DATE_FABRICATION_RULE's own examples name cohorts and enrolment
// windows ("before the next cohort opens", "limited to 8 places per cohort"). Recorded, not changed.
const SHARED_BLOCKS = [META_COMPLIANCE_NOTES, NO_DATE_FABRICATION_RULE, REGISTER_STANDARD];
const withoutShared = (t: string) => SHARED_BLOCKS.reduce((acc, b) => acc.split(b).join(""), t);
const eventWordsIn = (t: string) => (stripLeftoverOperatorTokens(withoutShared(t)).match(EVENT_WORDS) ?? []).map((w) => w.toLowerCase());

const SOCIAL = {
  hasCustomers: false, hasTestimonials: false, hasRating: false, hasReviews: false, hasPress: false,
  customerCount: 0, rating: "", reviewCount: 0, testimonials: [], press: "",
};
async function offerPrompt(mode: "free_asset" | "free_event" | "paid", angle: "godfather" | "free" | "dollar") {
  m.calls.length = 0;
  const { generateOfferAngle } = await import("./offersGenerator");
  await generateOfferAngle("The Pin Programme", "A description.", "Target customer.", "Main benefit.", angle, "premium", SOCIAL, "", {}, mode, "guide");
  return { system: m.calls[0].messages[0].content as string, user: m.calls[0].messages[1].content as string };
}

describe("A · the resolver", () => {
  it("a lead magnet is a free asset; every other type is unchanged (pinned in pipeline-fixes)", async () => {
    const { resolveOfferMode } = await import("./_core/campaignFraming");
    expect(resolveOfferMode({ campaignType: "lead_magnet" })).toBe("free_asset");
  });
});

describe("B · the lead-magnet offer prompt", () => {
  it("negative control: the event check finds event vocabulary in the recorded free-event prompt", () => {
    expect(eventWordsIn(freeEventPin.system + "\n" + freeEventPin.user).length).toBeGreaterThan(5);
  });

  for (const angle of ["godfather", "free", "dollar"] as const) {
    it(`carries none of that vocabulary — ${angle} angle, system and user`, async () => {
      const p = await offerPrompt("free_asset", angle);
      expect(eventWordsIn(p.system + "\n" + p.user)).toEqual([]);
    });
  }

  it("is written about the free asset, at counts a free download can fill truthfully", async () => {
    const p = await offerPrompt("free_asset", "godfather");
    expect(p.user).toContain("GIVES AWAY A FREE GUIDE — the lead magnet itself");
    for (const line of [
      "**pricing** — ACCESS (15-30 words)",
      "**guarantee** — WHAT THEY KEEP (20-35 words)",
      "**urgency** (15-30 words)",
      "**cta** (10-20 words)",
    ]) expect(p.user).toContain(line);
    expect(p.user).not.toContain("Offer Type:");
    expect(p.system).not.toContain("anchoring to make the price");
  });

  it("control: the same markers are present in the free-event prompt, so their absence above is a finding", async () => {
    const p = await offerPrompt("free_event", "godfather");
    expect(p.user).toContain("Offer Type:");
    expect(p.system).toContain("anchoring to make the price");
  });
});

describe("C · the cascade names the free asset — and nothing it cannot use", () => {
  const OFFER_218_SHAPE = {
    offerName: "The First Client Script [INSERT_HOST_NAME]",
    valueProposition: "Your first client conversation, scripted at the sentence level.",
    cta: "Reserve your free place now at [INSERT_OFFER_LINK]",
    bonuses: "BONUS #1: X", urgency: "u", pricing: "p", guarantee: "g",
  };
  it("a lead-magnet kit: name and promise only — no CTA, no token, no 'worth attending'", async () => {
    m.getDb.mockResolvedValue(makeDb([
      [{ id: 9, userId: 1, icpId: 5, campaignType: "lead_magnet", campaignFacts: null, selectedOfferId: 70 }],
      [{ id: 70, serviceId: 3, productName: "", activeAngle: "godfather", godfatherAngle: OFFER_218_SHAPE }],
    ]));
    const { getCascadeContext } = await import("./_core/cascadeContext");
    const out = await getCascadeContext(1, 5, "hvco");
    expect(out).toContain('the free lead magnet this campaign gives away: "The First Client Script"');
    expect(out).toContain("scripted at the sentence level");
    for (const absent of ["Offer CTA", "worth attending", "[INSERT_", "Reserve your free place", "Bonuses:", "Urgency:"]) {
      expect(out).not.toContain(absent);
    }
  });

  it("control: the same offer on a webinar kit still carries its CTA — the fence is mode-specific", async () => {
    m.getDb.mockResolvedValue(makeDb([
      [{ id: 9, userId: 1, icpId: 5, campaignType: "webinar", campaignFacts: null, selectedOfferId: 70 }],
      [{ id: 70, serviceId: 3, productName: "", activeAngle: "godfather", godfatherAngle: OFFER_218_SHAPE }],
    ]));
    const { getCascadeContext } = await import("./_core/cascadeContext");
    expect(await getCascadeContext(1, 5, "hvco")).toContain("Offer CTA");
  });
});
