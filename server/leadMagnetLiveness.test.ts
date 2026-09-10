import { describe, it, expect, vi } from "vitest";
import body7233 from "./_core/__fixtures__/lead-magnets/hvco-7233.json";
import { renderDeliverableHtml, renderOptInHtml, NEXT_STEP_LIVENESS_SCRIPT } from "./leadMagnetRenderer";

/**
 * The page-side liveness check on the magnet's next-step button (2026-09-10). If the target is not
 * live when the page is viewed, the button becomes the honest text card. It REMOVES ONLY.
 *
 * Covers only pages published after the change, and cannot fix a PDF — both stated in the renderer.
 */
const DEAD = "https://zapcampaigns.com/p/campaign-240";
const count = (h: string, s: string) => h.split(s).length - 1;

const optIn = (nextStepUrl: string | null) => renderOptInHtml({
  title: "T", format: "guide", promise: "P", slug: "magnet-magnet-7233", hvcoId: 7233,
  deliverableUrl: "https://zapcampaigns.com/p/magnet-magnet-7233", pdfUrl: "https://cdn.example/x.pdf",
  privacyPolicyUrl: "https://zapcampaigns.com/privacy", apiBase: "https://zapcampaigns.com",
  nextStep: (body7233 as any).nextStep, nextStepUrl,
});

describe("the renderers emit the check only where there is a button", () => {
  it("deliverable WITH a destination: the button is marked and the script ships once", () => {
    const h = renderDeliverableHtml(body7233 as any, { nextStepUrl: DEAD })!;
    expect(h).toMatch(/<a class="cta" href="https:\/\/zapcampaigns\.com\/p\/campaign-240"[^>]*data-next-step-check>/);
    expect(count(h, NEXT_STEP_LIVENESS_SCRIPT)).toBe(1);
  });

  it("deliverable WITHOUT a destination: no button, no marker, no script — it never adds", () => {
    const h = renderDeliverableHtml(body7233 as any, { nextStepUrl: null })!;
    expect(h).not.toContain("data-next-step-check");
    expect(h).not.toContain(NEXT_STEP_LIVENESS_SCRIPT);
    expect(h).toContain('class="cta-text"');
  });

  it("opt-in WITH a destination: next_cta is marked and the script ships once", () => {
    const h = optIn(DEAD);
    expect(h).toMatch(/<a class="dl primary" id="next_cta" href="https:\/\/zapcampaigns\.com\/p\/campaign-240"[^>]*data-next-step-check>/);
    expect(count(h, NEXT_STEP_LIVENESS_SCRIPT)).toBe(1);
  });

  it("opt-in WITHOUT a destination: no marker, no script", () => {
    const h = optIn(null);
    expect(h).not.toContain("data-next-step-check");
    expect(h).not.toContain(NEXT_STEP_LIVENESS_SCRIPT);
  });
});

// A minimal DOM, enough to run the exact script string the pages ship.
function page(href: string, id = "", text = "Join the session") {
  const created: string[] = [];
  const parent: any = { replaced: null, replaceChild(n: any, o: any) { this.replaced = n; o.parentNode = null; } };
  const a: any = { id, textContent: text, parentNode: parent, getAttribute: (k: string) => (k === "href" ? href : null) };
  const doc: any = {
    querySelectorAll: (sel: string) => (sel === "[data-next-step-check]" ? [a] : []),
    createElement: (tag: string) => { created.push(tag); return { tagName: tag.toUpperCase(), className: "", id: "", textContent: "" }; },
  };
  return { parent, doc, created };
}
async function run(doc: any, fetchImpl: any, origin = "https://zapcampaigns.com") {
  const location = { href: `${origin}/p/magnet-magnet-7233`, origin };
  new Function("document", "location", "fetch", NEXT_STEP_LIVENESS_SCRIPT)(doc, location, fetchImpl);
  await new Promise((r) => setTimeout(r, 0));
}

describe("the script — removes only, never adds", () => {
  it("target 404: the button becomes the text card, same label, no link", async () => {
    const p = page(DEAD);
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 404 }));
    await run(p.doc, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(DEAD, { method: "HEAD", cache: "no-store" });
    expect(p.parent.replaced).toMatchObject({ tagName: "P", className: "cta-text", textContent: "Join the session" });
    expect(p.parent.replaced.href).toBeUndefined();
  });

  it("keeps the anchor's id, so the opt-in submit handler still labels the demoted card", async () => {
    const p = page(DEAD, "next_cta", "");
    await run(p.doc, vi.fn(async () => ({ ok: false, status: 404 })));
    expect(p.parent.replaced).toMatchObject({ tagName: "P", id: "next_cta" });
  });

  it("target live (200): the button is left exactly as published", async () => {
    const p = page("https://zapcampaigns.com/p/campaign-999");
    await run(p.doc, vi.fn(async () => ({ ok: true, status: 200 })));
    expect(p.parent.replaced).toBeNull();
  });

  it("cross-origin target: nothing true to check, so no request and no change", async () => {
    const p = page("https://example.org/webinar");
    const fetchImpl = vi.fn();
    await run(p.doc, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(p.parent.replaced).toBeNull();
  });

  it("network error: left as published", async () => {
    const p = page(DEAD);
    await run(p.doc, vi.fn(async () => { throw new Error("offline"); }));
    expect(p.parent.replaced).toBeNull();
  });

  it("never creates an anchor, in any case", async () => {
    for (const [href, res] of [[DEAD, { ok: false, status: 404 }], [DEAD, { ok: true, status: 200 }]] as const) {
      const p = page(href);
      await run(p.doc, vi.fn(async () => res));
      expect(p.created).not.toContain("a");
    }
  });
});
