import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { bodyCompleteness, generateBodyWithRetries } from "./leadMagnetContentGenerator";

/**
 * THE CONTENT FLOOR — item 15, 2026-09-14.
 *
 * `degenerate-bonus-35-2026-09-13.json` is the body that WAS PUBLISHED to bonus-35 on 2026-09-13, verbatim: 2 tools
 * where the format needs 3, the second tool "x" in name/instructions/content, the first cut off at 266 characters,
 * and a nextStep of "x" in every field. It passed the old shape check. It is the negative control and must fail.
 * `complete-bonus-44-2026-09-13.json` — published to bonus-44 the same run — is the positive control and must pass.
 */
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8"));
const DEGENERATE = fixture("degenerate-bonus-35-2026-09-13.json");
const COMPLETE = fixture("complete-bonus-44-2026-09-13.json");

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("the degenerate body published to bonus-35 on 2026-09-13 fails the content floor", () => {
  const faults = bodyCompleteness("toolkit", DEGENERATE);

  it("is the real captured body, not a reconstruction", () => {
    expect(DEGENERATE.tools).toHaveLength(2);
    expect(DEGENERATE.tools[1]).toMatchObject({ name: "x", instructions: "x", content: "x" });
    expect(DEGENERATE.nextStep).toEqual({ heading: "x", body: "x", ctaLabel: "x" });
  });

  it("names the missing tool count", () => {
    expect(faults).toContain(`"tools" has 2 entries; the format needs at least 3`);
  });

  it("names every placeholder field", () => {
    for (const path of ["tools.1.name", "tools.1.instructions", "tools.1.content", "nextStep.heading", "nextStep.body", "nextStep.ctaLabel"]) {
      expect(faults).toContain(`${path} is a one-character placeholder, not content`);
    }
  });

  it("names the truncated first tool", () => {
    // The stored content is 266 characters with a trailing newline; the floor measures the trimmed text.
    const n = DEGENERATE.tools[0].content.trim().length;
    expect(n).toBeLessThan(400);
    expect(faults).toContain(`tools.0.content is ${n} characters; a complete one runs to at least 400`);
  });

  it("the attempt loop never returns it: three attempts, null, and the retry names what was incomplete", async () => {
    const sent: string[] = [];
    const body = await generateBodyWithRetries({
      format: "toolkit", title: "The 'My Brain Doesn't Write' Reframe Script Bank", linked: false,
      call: async (inj) => { sent.push(inj); return JSON.stringify(DEGENERATE); },
    });
    expect(body).toBeNull();
    expect(sent).toHaveLength(3);
    expect(sent[1]).toContain(`"tools" has 2 entries; the format needs at least 3`);
    expect(sent[1]).toContain("one-character placeholder");
  });
});

describe("positive control: a complete published body passes", () => {
  it("bonus-44's published body has no completeness fault", () => {
    expect(bodyCompleteness("toolkit", COMPLETE)).toEqual([]);
  });

  it("and the attempt loop returns it on the first attempt", async () => {
    const sent: string[] = [];
    const body = await generateBodyWithRetries({
      format: "toolkit", title: "The 'Is My Niche Real' Script Bank", linked: false,
      call: async (inj) => { sent.push(inj); return JSON.stringify(COMPLETE); },
    });
    expect(body).not.toBeNull();
    expect(sent).toHaveLength(1);
  });
});

describe("the floor is scoped", () => {
  it("counts come from BOUNDS: a checklist with 6 complete items is short", () => {
    const item = { label: "Name the stuck moment", detail: "Write the exact sentence you were about to type when you stopped, word for word, before you judge it." };
    const body = { promise: "A checklist that walks you through the first draft one line at a time.", items: Array(6).fill(item),
      nextStep: { heading: "Open the next module", body: "Take the checklist into your next writing session inside the programme.", ctaLabel: "Start Step 1" } };
    expect(bodyCompleteness("checklist", body)).toEqual([`"items" has 6 entries; the format needs at least 7`]);
    expect(bodyCompleteness("checklist", { ...body, items: Array(7).fill(item) })).toEqual([]);
  });

  it("quiz is left to its own rubric validator", () => {
    expect(bodyCompleteness("quiz", { questions: [{ question: "x", options: [{ label: "A", weight: 0 }] }] })).toEqual([]);
  });
});
