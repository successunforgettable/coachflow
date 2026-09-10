import { describe, it, expect, vi } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

/**
 * PROMPT PINS — recorded on the code BEFORE the lead-magnet offer-mode build (2026-09-10), so a test,
 * not a diff, proves what that build did not touch:
 *   - the offer prompt the model receives in `paid` and `free_event` mode, every angle, with and
 *     without the operator's own facts — system, user and response schema, byte for byte;
 *   - the offer text the cascade hands downstream in `paid` and `free_event` mode;
 *   - the magnet generator's BONUS-mode prompts and schemas, every format;
 *   - the email and WhatsApp campaign-type framing maps, as source.
 *
 * Record only on the pre-change code: `PIN_RECORD=1 npx vitest run server/promptPins.test.ts`.
 * A missing pin FAILS — it is never written silently on an ordinary run.
 */
const m = vi.hoisted(() => ({ calls: [] as any[], getDb: vi.fn() }));
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async (req: any) => {
    m.calls.push(req);
    return { choices: [{ message: { content: JSON.stringify({
      offerName: "The Pin", valueProposition: "v", pricing: "p", bonuses: "b", guarantee: "g", urgency: "u", cta: "c",
    }) } }] };
  }),
}));
vi.mock("./db", () => ({ getDb: m.getDb }));

const FIX = new URL("./_core/__fixtures__/prompt-pins/", import.meta.url);
function pin(name: string, value: unknown) {
  const file = new URL(`${name}.json`, FIX);
  const text = JSON.stringify(value, null, 2) + "\n";
  if (process.env.PIN_RECORD === "1") {
    mkdirSync(FIX, { recursive: true });
    writeFileSync(file, text);
    return;
  }
  if (!existsSync(file)) throw new Error(`prompt pin "${name}" is missing — record it on the pre-change code with PIN_RECORD=1`);
  expect(text).toBe(readFileSync(file, "utf8"));
}

const SOCIAL = {
  hasCustomers: false, hasTestimonials: false, hasRating: false, hasReviews: false, hasPress: false,
  customerCount: 0, rating: "", reviewCount: 0, testimonials: [], press: "",
};
const FULL_FACTS = { price: "497", guaranteeType: "Full refund", guaranteeDuration: "30 days", deliveryDuration: "8 weeks", bonuses: "[{\"name\":\"Pin bonus\"}]" };

describe("offer prompt — paid and free_event are byte-identical to the pre-build recording", () => {
  for (const mode of ["paid", "free_event"] as const) {
    for (const [factsLabel, supplied] of [["no-facts", {}], ["facts", FULL_FACTS]] as const) {
      for (const angle of ["godfather", "free", "dollar"] as const) {
        it(`${mode} · ${angle} · ${factsLabel}`, async () => {
          m.calls.length = 0;
          const { generateOfferAngle } = await import("./offersGenerator");
          await generateOfferAngle(
            "The Pin Programme", "A programme description for the pin.", "Target customer text for the pin.",
            "Main benefit for the pin.", angle, "premium", SOCIAL, "UPSTREAM CONTEXT — PIN\n\n",
            supplied as any, mode, mode === "free_event" ? "live training" : "session",
          );
          const first = m.calls[0];
          pin(`offer-${mode}-${angle}-${factsLabel}`, {
            system: first.messages[0].content,
            user: first.messages[1].content,
            response_format: first.response_format,
          });
        });
      }
    }
  }
});

// drizzle-ish chain: each select() dequeues the next queued result on .limit() or await.
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
const OFFER_ANGLE = {
  offerName: "The Pin Blueprint", valueProposition: "The value proposition for the pin.",
  pricing: "Pricing prose for the pin.", bonuses: "BONUS #1: Pin workbook", guarantee: "Guarantee prose for the pin.",
  urgency: "Urgency prose for the pin.", cta: "Join the pin now.",
};

describe("cascade offer text — paid and free_event are byte-identical to the pre-build recording", () => {
  it("paid (course_launch, operator facts present)", async () => {
    m.getDb.mockResolvedValue(makeDb([
      [{ id: 9, userId: 1, icpId: 5, campaignType: "course_launch", campaignFacts: null, selectedOfferId: 70 }],
      [{ id: 70, serviceId: 3, productName: "The Pin Programme", activeAngle: "godfather", godfatherAngle: OFFER_ANGLE }],
      [{ price: "3000", guaranteeType: "Full refund", guaranteeDuration: "90 days", deliveryDuration: "12 weeks" }],
    ]));
    const { getCascadeContext } = await import("./_core/cascadeContext");
    pin("cascade-offer-paid", await getCascadeContext(1, 5, "mechanism"));
  });

  it("free_event (webinar)", async () => {
    m.getDb.mockResolvedValue(makeDb([
      [{ id: 9, userId: 1, icpId: 5, campaignType: "webinar", campaignFacts: null, selectedOfferId: 70 }],
      [{ id: 70, serviceId: 3, productName: "The Pin Programme", activeAngle: "godfather", godfatherAngle: OFFER_ANGLE }],
    ]));
    const { getCascadeContext } = await import("./_core/cascadeContext");
    pin("cascade-offer-free_event", await getCascadeContext(1, 5, "mechanism"));
  });
});

describe("magnet generator — BONUS mode is byte-identical to the pre-build recording", () => {
  const C = {
    niche: "Pin niche", title: "The Pin Toolkit", programme: "The Pin Programme", mainBenefit: "Pin benefit",
    upstream: "UPSTREAM CONTEXT — PIN", hasMethod: true, methodDetail: "How the method runs, in order: 1) Pin — step.",
    offerDescription: "Pin offer description.", icpPains: "Pin pains.", icpGoals: "Pin goals.", icpBarriers: "Pin barriers.",
    sot: "Pin brand context.", contentBrief: "Pin brief.",
  };
  for (const fmt of ["guide", "checklist", "toolkit", "quiz"] as const) {
    it(`bonus · ${fmt}`, async () => {
      const g = await import("./leadMagnetContentGenerator");
      pin(`magnet-bonus-${fmt}`, { system: g.systemPromptFor("bonus"), user: g.userPromptFor(fmt, C as any, "bonus"), schema: g.schemaFor(fmt, "bonus") });
    });
  }
  it("bonus · guide · no method", async () => {
    const g = await import("./leadMagnetContentGenerator");
    pin("magnet-bonus-guide-nomethod", { user: g.userPromptFor("guide", { ...C, hasMethod: false, methodDetail: "" } as any, "bonus") });
  });
});

describe("email and WhatsApp campaign-type maps — the four existing entries are byte-identical", () => {
  const block = (p: string) => {
    const s = readFileSync(new URL(p, import.meta.url), "utf8");
    const a = s.indexOf("const campaignTypeContextMap: Record<string, string> = {");
    const b = s.indexOf("};", a);
    if (a < 0 || b < 0) throw new Error(`campaignTypeContextMap not found in ${p}`);
    return s.slice(a, b + 2);
  };
  it("email", () => pin("email-campaign-type-map", block("./emailSequenceGenerator.ts")));
  it("whatsapp", () => pin("whatsapp-campaign-type-map", block("./whatsappSequenceGenerator.ts")));
});
