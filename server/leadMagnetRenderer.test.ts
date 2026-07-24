import { describe, it, expect } from "vitest";
import { renderDeliverableHtml } from "./leadMagnetRenderer";
import type { ToolkitBody, ChecklistBody } from "./leadMagnetContentGenerator";

// The bonuses render through renderDeliverableHtml. The live bug (kit 191): tool content is well-structured
// markdown (## headings, **bold**, | tables |, --- rules, [BRACKET] fill-ins) but was dumped raw into <pre>,
// so the markdown syntax showed as literal characters — "very confusing" per Arfeen. These tests lock the fix:
// tool content renders as real HTML, and fill-in brackets read as distinct fill-in fields.

function toolkit(content: string): ToolkitBody {
  return {
    format: "toolkit",
    title: "The Confidential Pivot Outreach SOP",
    promise: "Run your outreach without tipping off your employer.",
    tools: [{ name: "The Outreach SOP", type: "sop", instructions: "Follow each step in order.", content }],
    nextStep: { heading: "H", body: "B", ctaLabel: "C" },
  };
}

describe("renderDeliverableHtml — toolkit markdown rendering", () => {
  it("renders markdown headings as HTML, never as literal ## characters", () => {
    const html = renderDeliverableHtml(toolkit("## PRE-LAUNCH\n\nDo the thing."))!;
    expect(html).toContain("PRE-LAUNCH");
    expect(html).not.toContain("## PRE-LAUNCH"); // the literal markdown must not leak into the output
  });

  it("renders **bold** as <strong>, never as literal asterisks", () => {
    const html = renderDeliverableHtml(toolkit("**STEP 0.1** — set profile to private"))!;
    expect(html).toContain("<strong>STEP 0.1</strong>");
    expect(html).not.toContain("**STEP 0.1**");
  });

  it("renders a markdown table as a real <table>, never as literal pipe rows", () => {
    const html = renderDeliverableHtml(toolkit("| # | Name | Ask |\n|---|---|---|\n| 1 | Sam | Coffee |"))!;
    expect(html).toContain("<table");
    expect(html).toContain("<td>Sam</td>");
    expect(html).not.toMatch(/\|\s*#\s*\|/); // no raw pipe header row left in the output
  });

  it("renders numbered/dashed lists as list items", () => {
    const html = renderDeliverableHtml(toolkit("- first\n- second\n- third"))!;
    expect((html.match(/<li>/g) || []).length).toBe(3);
  });

  it("highlights [BRACKET] fill-in prompts as a distinct fill-in span", () => {
    const html = renderDeliverableHtml(toolkit('Hey [NAME] — I\'m exploring [TARGET AREA].'))!;
    expect(html).toContain('class="fillin"'); // the fill-in prompt is visually distinct, not plain text
    expect(html).toContain("NAME");
    expect(html).toContain("TARGET AREA");
  });

  it("does NOT dump tool content into a raw <pre> block anymore", () => {
    const html = renderDeliverableHtml(toolkit("## Heading\n\nBody text here."))!;
    expect(html).not.toContain("<pre>");
  });

  it("renders a heading even when content follows immediately (no blank line after it)", () => {
    // Real SOP/swipe content: "## The Core Principle\nAlways do X." — heading is line 1 of a multi-line block.
    const html = renderDeliverableHtml(toolkit("## The Core Principle\nAlways do X before Y."))!;
    expect(html).not.toContain("## The Core Principle");
    expect(html).toContain("The Core Principle");
    expect(html).toContain("Always do X before Y.");
  });

  it("renders a list that immediately follows a heading in the same block", () => {
    const html = renderDeliverableHtml(toolkit("### Steps\n- one\n- two"))!;
    expect(html).not.toContain("### Steps");
    expect((html.match(/<li>/g) || []).length).toBe(2);
  });
});

describe("renderDeliverableHtml — 'How to use this' intro + what-it-is", () => {
  it("renders a How-to-use block when howToUse is present", () => {
    const b = toolkit("body");
    (b as any).howToUse = "This is your outreach operating procedure. Work top to bottom; it takes about 30 days end to end.";
    const html = renderDeliverableHtml(b)!;
    expect(html.toLowerCase()).toContain("how to use");
    expect(html).toContain("operating procedure");
  });

  it("states what the document is on the cover (the format label)", () => {
    const html = renderDeliverableHtml(toolkit("body"))!;
    // The cover must name the artifact type so the reader immediately knows what it is.
    expect(html.toLowerCase()).toContain("toolkit");
  });
});

describe("renderDeliverableHtml — checklist still renders tickable rows (no regression)", () => {
  it("keeps the checkbox affordance", () => {
    const b: ChecklistBody = {
      format: "checklist", title: "T", promise: "P",
      items: [{ label: "Do X", detail: "in 20 min" }],
      nextStep: { heading: "H", body: "B", ctaLabel: "C" },
    };
    const html = renderDeliverableHtml(b)!;
    expect(html).toContain('class="box"');
    expect(html).toContain("Do X");
  });
});
