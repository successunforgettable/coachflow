import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks for the publish core's side-effect deps (hoisted so the vi.mock factories can reference them).
const m = vi.hoisted(() => ({
  writeKvPage: vi.fn(async () => {}),
  renderPdfFromUrl: vi.fn(async () => Buffer.from("PDF-BYTES")),
  ensureKvNamespace: vi.fn(async () => "NS_ID"),
  storagePut: vi.fn(async (key: string) => ({ url: `https://cdn.example/${key}` })),
  getDb: vi.fn(),
}));
const { writeKvPage, renderPdfFromUrl, ensureKvNamespace, storagePut, getDb } = m;
vi.mock("./lib/cloudflare", () => ({ writeKvPage: m.writeKvPage, renderPdfFromUrl: m.renderPdfFromUrl, ensureKvNamespace: m.ensureKvNamespace }));
vi.mock("./storage", () => ({ storagePut: m.storagePut }));
vi.mock("./db", () => ({ getDb: m.getDb }));
vi.mock("./leadMagnetRenderer", () => ({
  renderDeliverableHtml: vi.fn(() => "<html>DELIVERABLE</html>"),
  renderOptInHtml: vi.fn(() => "<html>OPTIN</html>"),
  renderQuizPage: vi.fn(() => "<html>QUIZ</html>"),
}));
vi.mock("./lib/coachLogo", () => ({ getCoachLogoUrl: vi.fn(async () => null) }));

// drizzle-ish db mock. The db object itself is NOT thenable (so `await getDb()` returns it); each query chain
// IS thenable + has .limit(), and both dequeue the next queued result.
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

const CHECKLIST_BODY = { format: "checklist", title: "T", promise: "P", items: [{ text: "x" }], nextStep: {} } as any;

beforeEach(() => vi.clearAllMocks());

describe("publishDeliverableBody (extracted core)", () => {
  it("writes the KV page, renders the PDF from that URL, stores it, and returns the URLs", async () => {
    const { publishDeliverableBody } = await import("./leadMagnetPublisher");
    const out = await publishDeliverableBody(CHECKLIST_BODY, {
      userId: 42, slug: "acme-bonus-7", storageKey: "bonuses/42/7.pdf", coachLogoUrl: null,
    });
    expect(ensureKvNamespace).toHaveBeenCalledTimes(1); // no namespaceId passed → resolved here
    expect(writeKvPage).toHaveBeenCalledWith("NS_ID", "acme-bonus-7", "<html>DELIVERABLE</html>");
    expect(renderPdfFromUrl).toHaveBeenCalledWith("https://zapcampaigns.com/p/acme-bonus-7");
    expect(storagePut).toHaveBeenCalledWith("bonuses/42/7.pdf", Buffer.from("PDF-BYTES"), "application/pdf");
    expect(out).toEqual({ deliverableUrl: "https://zapcampaigns.com/p/acme-bonus-7", pdfUrl: "https://cdn.example/bonuses/42/7.pdf" });
  });

  it("reuses a provided namespaceId (no extra ensureKvNamespace call)", async () => {
    const { publishDeliverableBody } = await import("./leadMagnetPublisher");
    await publishDeliverableBody(CHECKLIST_BODY, { userId: 1, slug: "s", storageKey: "k.pdf", coachLogoUrl: null, namespaceId: "GIVEN" });
    expect(ensureKvNamespace).not.toHaveBeenCalled();
    expect(writeKvPage).toHaveBeenCalledWith("GIVEN", "s", "<html>DELIVERABLE</html>");
  });
});

describe("publishLeadMagnet — UNCHANGED behaviour after extraction (regression)", () => {
  it("still uses the identical deliverable slug + storage path, opt-in page, and persists both URLs", async () => {
    // hvco row (id 7, user 42, serviceId 9) + service row (name 'Acme Co') → base slug 'acme-co'.
    getDb.mockResolvedValue(makeDb([[{ id: 7, userId: 42, serviceId: 9, title: "LM", assetBody: CHECKLIST_BODY }], [{ name: "Acme Co" }]]));
    const { publishLeadMagnet } = await import("./leadMagnetPublisher");
    const res = await publishLeadMagnet({ hvcoId: 7 });

    // Deliverable slug + storage path are byte-identical to the pre-extraction hardcoded values.
    expect(writeKvPage).toHaveBeenCalledWith("NS_ID", "acme-co-magnet-7", "<html>DELIVERABLE</html>");
    expect(storagePut).toHaveBeenCalledWith("lead-magnets/42/7.pdf", Buffer.from("PDF-BYTES"), "application/pdf");
    // Opt-in page still published under the -get- slug.
    expect(writeKvPage).toHaveBeenCalledWith("NS_ID", "acme-co-get-7", "<html>OPTIN</html>");
    // ensureKvNamespace called exactly ONCE (the extraction reuses the existing namespaceId — no extra call).
    expect(ensureKvNamespace).toHaveBeenCalledTimes(1);
    // Returned URL shape unchanged. The two bridge fields are ADDITIVE — this fixture's row carries
    // no `nextStepLandingPageId`, which is the state of every production row today, so the bridge
    // reports "no-pointer" and no destination is baked. Asserted rather than omitted: it pins that
    // adding the bridge did not change what an unpaired magnet publishes.
    expect(res).toEqual({
      optInUrl: "https://zapcampaigns.com/p/acme-co-get-7",
      deliverableUrl: "https://zapcampaigns.com/p/acme-co-magnet-7",
      pdfUrl: "https://cdn.example/lead-magnets/42/7.pdf",
      bridge: "no-pointer",
      nextStepUrl: null,
    });
  });
});
