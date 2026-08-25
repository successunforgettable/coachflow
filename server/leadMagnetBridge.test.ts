/**
 * THE BRIDGE — tier 3 of the destination chain: NO DESTINATION.
 *
 * Step 4's trace found the free next step is a concept with no field. Nothing on the campaign,
 * the kit, the offer, the service or the coach names it; `campaign_links` carries `leads_to`
 * semantics and zero rows; and `operatorFields` gives `lead_magnet_download` an empty required-
 * token list while `discovery_call_booking` gets `[INSERT_BOOKING_URL]`.
 *
 * So all three surfaces were coping with the same absence in three different ways: the
 * downloadable rendered a dead `href="#"`, the delivery page pointed the CTA back at the magnet
 * the reader had just been given, and the quiz result pointed at its own page.
 *
 * Tier 3 is what is correct under every version of the product decision still open: where no
 * destination resolves, the next-step card renders as TEXT WITH NO BUTTON, and no URL is ever
 * invented. A dead end that looks like a dead end is honest; one wearing a button is not.
 */
import { describe, it, expect } from "vitest";
import { renderDeliverableHtml, renderOptInHtml, renderQuizPage } from "./leadMagnetRenderer";

const NEXT = { heading: "Where this goes next", body: "The gap this leaves open.", ctaLabel: "Book My Free Call" };

const guide: any = {
  format: "guide", title: "T", promise: "P",
  sections: [{ heading: "H", body: "B" }],
  nextStep: NEXT,
};
const quizBody: any = {
  format: "quiz", title: "T", promise: "P",
  questions: [{ question: "q", options: [{ label: "a", weight: 0 }, { label: "b", weight: 3 }] }],
  scoring: { bands: [{ name: "n", minPercent: 0, maxPercent: 100, teaser: "t", meaning: "m", cta: NEXT }] },
  nextStep: NEXT,
};
const optInOpts: any = {
  title: "T", slug: "s", hvcoId: 1, apiBase: "https://x", privacyPolicyUrl: "https://x/privacy",
  deliverableUrl: "https://x/d/s", pdfUrl: "https://x/d/s.pdf", nextStep: NEXT,
};
const quizOpts: any = {
  body: quizBody, slug: "s", hvcoId: 1, apiBase: "https://x",
  privacyPolicyUrl: "https://x/privacy", pageUrl: "https://x/p/s",
};

describe("tier 3 — the downloadable", () => {
  const html = () => renderDeliverableHtml(guide) ?? "";

  it("renders NO dead anchor", () => {
    expect(html()).not.toContain('href="#"');
  });

  it("still carries the next-step heading and body as text", () => {
    const h = html();
    expect(h).toContain(NEXT.heading);
    expect(h).toContain(NEXT.body);
  });

  it("carries the CTA label as text, not as a link", () => {
    const h = html();
    expect(h).toContain(NEXT.ctaLabel);
    // the label survives; the anchor around it does not
    expect(h).not.toMatch(/<a[^>]*class="cta"/);
  });

  it("renders a BUTTON when — and only when — a destination resolves", () => {
    const withUrl = renderDeliverableHtml(guide, { nextStepUrl: "https://coach.example/free-training" }) ?? "";
    expect(withUrl).toContain('href="https://coach.example/free-training"');
    expect(withUrl).toMatch(/<a[^>]*class="cta"/);
  });

  it("treats a blank or whitespace destination as no destination", () => {
    for (const u of ["", "   ", null, undefined]) {
      const h = renderDeliverableHtml(guide, { nextStepUrl: u as any } ?? {}) ?? "";
      expect(h).not.toMatch(/<a[^>]*class="cta"/);
    }
  });
});

describe("tier 3 — the delivery page", () => {
  const html = () => renderOptInHtml(optInOpts);

  it("does not loop the CTA back to the magnet just delivered", () => {
    // the defect: `c.href = view`, where view is the magnet's own URL
    expect(html()).not.toMatch(/next_cta'\)\s*;?\s*[\s\S]{0,80}\.href\s*=\s*view/);
  });

  it("ships no next_cta anchor at all when no destination resolves", () => {
    expect(html()).not.toContain('id="next_cta"');
  });

  it("still shows the next-step card as text", () => {
    const h = html();
    expect(h).toContain('id="next_heading"');
    expect(h).toContain('id="next_body"');
    expect(h).toContain("Your next step");
  });

  it("carries the CTA label into a non-interactive element so the copy is not lost", () => {
    expect(html()).toContain('id="next_cta_text"');
  });

  it("renders the anchor when a destination resolves", () => {
    const h = renderOptInHtml({ ...optInOpts, nextStepUrl: "https://coach.example/webinar" });
    expect(h).toContain('id="next_cta"');
    expect(h).toContain("https://coach.example/webinar");
  });
});

describe("tier 3 — the quiz result", () => {
  const html = () => renderQuizPage(quizOpts);

  it("does not point the result CTA at the quiz's own page", () => {
    expect(html()).not.toMatch(/qz_cta_a'\)[\s\S]{0,80}CFG\.pageUrl/);
  });

  it("ships no result anchor when no destination resolves", () => {
    expect(html()).not.toContain('id="qz_cta_a"');
  });

  it("still shows the band's own next-step copy", () => {
    const h = html();
    expect(h).toContain('id="qz_cta_h"');
    expect(h).toContain('id="qz_cta_b"');
  });

  it("renders the anchor when a destination resolves", () => {
    const h = renderQuizPage({ ...quizOpts, nextStepUrl: "https://coach.example/report" });
    expect(h).toContain('id="qz_cta_a"');
    expect(h).toContain("https://coach.example/report");
  });
});

describe("nothing is ever invented", () => {
  it("no NEXT-STEP cta is a placeholder or self-referential destination", () => {
    // Scoped to the bridge deliberately. The opt-in page's "Read online" / "Download PDF" links
    // also ship as href="#" and are filled by script from the capture response — those are the
    // magnet's own delivery links, they are not the bridge, and they are out of scope here.
    const all = [renderDeliverableHtml(guide) ?? "", renderOptInHtml(optInOpts), renderQuizPage(quizOpts)];
    for (const h of all) {
      expect(h).not.toMatch(/<a[^>]*id="next_cta"/);
      expect(h).not.toMatch(/<a[^>]*id="qz_cta_a"/);
      expect(h).not.toMatch(/<a[^>]*class="cta"/);
      expect(h).not.toMatch(/href="javascript:/i);
    }
  });

  it("the downloadable emits no dead anchor of any kind", () => {
    // Unlike the opt-in page it runs no script, so a placeholder href can never be filled in.
    expect(renderDeliverableHtml(guide) ?? "").not.toContain('href="#"');
  });

  it("the magnet's own URL never becomes the next step's destination", () => {
    const h = renderOptInHtml(optInOpts);
    // deliverableUrl may legitimately appear on the Read online / Download buttons —
    // what must not exist is a next-step anchor at all.
    expect(h).not.toContain('id="next_cta"');
  });
});
