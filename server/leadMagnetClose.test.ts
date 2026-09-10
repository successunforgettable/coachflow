import { describe, it, expect, vi, beforeEach } from "vitest";
import control from "./_core/__fixtures__/prompt-pins/control-magnet-leadmagnet-before.json";
import body7233 from "./_core/__fixtures__/lead-magnets/hvco-7233.json";

/**
 * The lead magnet's close (2026-09-10) —
 * docs/handovers/BRIEF_2026-09-10_LEAD_MAGNET_OFFER_MODE.md, part E — the magnet's close, and the publisher that renders it.
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

const clone = (x: unknown): any => JSON.parse(JSON.stringify(x));
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


describe("E · the magnet's close", () => {
  const PAID_BRIDGE = /Book My Free Call|paid outcome|bridges to "/;
  const C: any = {
    niche: "Pin niche", title: "The Pin Toolkit", programme: "The Pin Programme", mainBenefit: "Pin benefit",
    upstream: "UPSTREAM CONTEXT — PIN", hasMethod: true, methodDetail: "How the method runs, in order: 1) Pin — step.",
    offerDescription: "Pin offer description.", icpPains: "Pin pains.", icpGoals: "Pin goals.", icpBarriers: "Pin barriers.",
    sot: "Pin brand context.", contentBrief: "",
  };
  const FACTS = { date: "October 14, 2026", time: "7:30 pm", timezone: "IST" };
  const FORMATS = ["guide", "checklist", "toolkit", "quiz"] as const;

  it("negative control: every recorded pre-change lead-magnet prompt bridges to a paid call", () => {
    for (const f of FORMATS) expect(PAID_BRIDGE.test((control as any).user[f])).toBe(true);
  });

  it("no lead-magnet prompt bridges to a paid call any more, and each asks for the loop-splice close", async () => {
    const g = await import("./leadMagnetContentGenerator");
    expect(g.systemPromptFor("lead_magnet")).not.toMatch(/bridges to the paid programme/);
    expect(g.systemPromptFor("lead_magnet")).toContain("diagnostic question");
    for (const f of FORMATS) {
      const u = g.userPromptFor(f, C, "lead_magnet");
      expect(PAID_BRIDGE.test(u)).toBe(false);
      expect(u).toContain("written as a diagnostic question");
      expect(u).toContain("The nextStep ends on something the reader does alone.");
    }
  });

  it("without all three event facts, no session close is asked for — in the prompt or the schema", async () => {
    const g = await import("./leadMagnetContentGenerator");
    for (const f of FORMATS) {
      expect(g.userPromptFor(f, C, "lead_magnet")).not.toContain("nextStepLinked");
      expect(JSON.stringify(g.schemaFor(f, "lead_magnet"))).not.toContain("nextStepLinked");
    }
  });

  it("with all three, the session close is asked for, dated from the coach's own facts", async () => {
    const g = await import("./leadMagnetContentGenerator");
    for (const f of FORMATS) {
      const u = g.userPromptFor(f, { ...C, eventFacts: FACTS }, "lead_magnet");
      expect(u).toContain('"nextStepLinked"');
      expect(u).toContain("the free live session on October 14, 2026 at 7:30 pm IST");
      const sch: any = g.schemaFor(f, "lead_magnet", { linked: true }).json_schema.schema;
      expect(sch.required).toContain("nextStepLinked");
    }
  });

  it("bonus mode never asks for a session close, even with facts", async () => {
    const g = await import("./leadMagnetContentGenerator");
    for (const f of FORMATS) expect(g.userPromptFor(f, { ...C, eventFacts: FACTS }, "bonus")).not.toContain("nextStepLinked");
  });
});

describe("E · the publisher renders the close that matches the destination", () => {
  const LINKED = {
    heading: "Why does the same argument keep coming back?",
    body: "LINKED-BODY — the free live session on October 14, 2026 at 7:30 pm IST.",
    ctaLabel: "Save my free seat",
  };
  const withLinked = () => ({ ...clone(body7233), nextStepLinked: LINKED });
  const queue = (body: any, pointer: number | null, publicUrl: string | null) => [
    [{ id: 7233, userId: 1, serviceId: 316, title: body.title, assetBody: body, nextStepLandingPageId: pointer }],
    [{ name: "" }],
    ...(pointer ? [[{ publicUrl }]] : []),
  ];
  const pages = () => Object.fromEntries(m.writeKvPage.mock.calls.map((c) => [c[1], c[2] as string]));

  it("linked: the session close renders, and the no-destination close travels for the page-side swap", async () => {
    m.getDb.mockResolvedValue(makeDb(queue(withLinked(), 240, "https://zapcampaigns.com/p/campaign-240")));
    const { publishLeadMagnet } = await import("./leadMagnetPublisher");
    const res: any = await publishLeadMagnet({ hvcoId: 7233 });
    expect(res.bridge).toBe("linked");
    const p = pages();
    expect(p["magnet-magnet-7233"]).toContain("LINKED-BODY");
    expect(p["magnet-magnet-7233"]).toContain('data-next-fallback="');
    expect(p["magnet-magnet-7233"]).toContain("data-next-heading");
    expect(p["magnet-get-7233"]).toContain("LINKED-BODY");
    expect(p["magnet-get-7233"]).toMatch(/var NEXT_FALLBACK = \{"heading"/);
  });

  for (const [label, pointer, url] of [["target unpublished", 240, null], ["no pointer", null, null]] as const) {
    it(`${label}: the session is promised NOWHERE on either page`, async () => {
      m.getDb.mockResolvedValue(makeDb(queue(withLinked(), pointer, url)));
      const { publishLeadMagnet } = await import("./leadMagnetPublisher");
      await publishLeadMagnet({ hvcoId: 7233 });
      const p = pages();
      expect(Object.keys(p)).toEqual(["magnet-magnet-7233", "magnet-get-7233"]); // both pages really written
      for (const html of Object.values(p)) {
        expect(html).not.toContain("LINKED-BODY");
        expect(html).not.toContain("Save my free seat");
        expect(html).not.toContain('data-next-fallback="');
      }
      expect(p["magnet-magnet-7233"]).toContain((body7233 as any).nextStep.ctaLabel);
      expect(p["magnet-get-7233"]).toContain("var NEXT_FALLBACK = null");
    });
  }

  it("a body from before this change (no nextStepLinked) publishes linked exactly as it did", async () => {
    m.getDb.mockResolvedValue(makeDb(queue(clone(body7233), 240, "https://zapcampaigns.com/p/campaign-240")));
    const { publishLeadMagnet } = await import("./leadMagnetPublisher");
    await publishLeadMagnet({ hvcoId: 7233 });
    const deliv = pages()["magnet-magnet-7233"];
    expect(deliv).toMatch(/<a class="cta" href="https:\/\/zapcampaigns\.com\/p\/campaign-240"[^>]*data-next-step-check>/);
    expect(deliv).not.toContain('data-next-fallback="');
  });
});

describe("E · the page-side swap carries the no-destination close", () => {
  const DEAD = "https://zapcampaigns.com/p/campaign-240";
  const FB = { heading: "What keeps restarting the loop?", body: "The no-destination body.", ctaLabel: "Notice it this week" };
  function page() {
    const h: any = { textContent: "Linked heading" }, b: any = { textContent: "Linked body" };
    const parent: any = { replaced: null, replaceChild(n: any, o: any) { this.replaced = n; o.parentNode = null; } };
    const a: any = {
      id: "", textContent: "Save my free seat", parentNode: parent,
      getAttribute: (k: string) => (k === "href" ? DEAD : k === "data-next-fallback" ? JSON.stringify(FB) : null),
    };
    const doc: any = {
      querySelectorAll: () => [a],
      querySelector: (sel: string) => (sel === "[data-next-heading]" ? h : sel === "[data-next-body]" ? b : null),
      createElement: (t: string) => ({ tagName: t.toUpperCase(), className: "", id: "", textContent: "" }),
    };
    return { h, b, parent, doc };
  }
  async function run(doc: any, res: any) {
    const { NEXT_STEP_LIVENESS_SCRIPT } = await import("./leadMagnetRenderer");
    new Function("document", "location", "fetch", NEXT_STEP_LIVENESS_SCRIPT)(
      doc, { href: "https://zapcampaigns.com/p/magnet-magnet-7233", origin: "https://zapcampaigns.com" }, vi.fn(async () => res),
    );
    await new Promise((r) => setTimeout(r, 0));
  }

  it("target gone: heading, body and label all become the no-destination close", async () => {
    const p = page();
    await run(p.doc, { ok: false, status: 404 });
    expect(p.h.textContent).toBe(FB.heading);
    expect(p.b.textContent).toBe(FB.body);
    expect(p.parent.replaced).toMatchObject({ tagName: "P", className: "cta-text", textContent: FB.ctaLabel });
  });

  it("target live: the session close is left exactly as published", async () => {
    const p = page();
    await run(p.doc, { ok: true, status: 200 });
    expect(p.h.textContent).toBe("Linked heading");
    expect(p.parent.replaced).toBeNull();
  });

  it("the opt-in's submit handler uses the no-destination close once the button is demoted", async () => {
    const { renderOptInHtml } = await import("./leadMagnetRenderer");
    const html = renderOptInHtml({
      title: "T", format: "guide", promise: "P", slug: "s", hvcoId: 1, deliverableUrl: "https://zapcampaigns.com/p/s",
      pdfUrl: "", privacyPolicyUrl: "https://zapcampaigns.com/privacy", apiBase: "https://zapcampaigns.com",
      nextStep: { heading: "L", body: "L", ctaLabel: "L" }, nextStepUrl: DEAD, nextStepFallback: FB,
    });
    expect(html).toContain("var N = (cEl && cEl.tagName !== 'A' && NEXT_FALLBACK) ? NEXT_FALLBACK : NEXT;");
    expect(html).toContain('id="next_heading" data-next-heading');
  });
});
