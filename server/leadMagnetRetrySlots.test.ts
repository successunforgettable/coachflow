import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateBodyWithRetries, bodyShapeNote, repairArrayField } from "./leadMagnetContentGenerator";

/**
 * ITEM 15 — THE TWO CORRECTION SLOTS (authorised 2026-09-13).
 *
 * The sequence below is the one reproduced on bonus-34, 35 and 44 against production:
 * timed → thin → timed. Under the old single `failContext`, the thin body cleared the timed-claim
 * correction, so attempt 3 ran with NO feedback and the run ended null. These tests assert what
 * attempt 3 is actually SENT — a positive artefact (§15k), not merely a non-null return.
 */

const tool = (content: string) => ({ name: "Tool", type: "script", instructions: "Read it aloud.", content });
const toolkit = (contents: string[]) => JSON.stringify({
  promise: "A four-part script bank.",
  tools: contents.map(tool),
  nextStep: { heading: "Next", body: "Open the first script.", ctaLabel: "Open" },
});
const CLEAN = toolkit(["Say the first line.", "Say the second line.", "Say the third line."]);
const TIMED = toolkit(["You will have your first reply by day 7.", "Say the second line.", "Say the third line."]);
const THIN = JSON.stringify({ promise: "A script bank.", tools: "Tool one; tool two", nextStep: { heading: "Next", body: "Go.", ctaLabel: "Go" } });

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

function scripted(responses: string[]) {
  const sent: string[] = [];
  const call = async (inj: string) => { sent.push(inj); return responses[sent.length - 1]; };
  return { sent, call };
}

describe("timed → thin → timed: the timed-claim correction survives a thin body", () => {
  it("attempt 3 is still told about the clock from attempt 1, AND about the shape fault from attempt 2", async () => {
    const { sent, call } = scripted([TIMED, THIN, CLEAN]);
    const body = await generateBodyWithRetries({ format: "toolkit", title: "Script Bank", linked: false, call });

    expect(sent).toHaveLength(3);
    expect(sent[0]).toBe("");
    // attempt 2: the timed correction
    expect(sent[1]).toContain("by day 7");
    // attempt 3: BOTH families — this is the line the old `failContext = ""` erased
    expect(sent[2]).toContain("by day 7");
    expect(sent[2]).toContain(`the "tools" field came back as a string rather than an array`);
    expect(body).not.toBeNull();
  });

  it("a clock reintroduced later is still named alongside a new one — the timed slot accumulates", async () => {
    const TIMED_B = toolkit(["You will be booked within 90 days.", "Say the second line.", "Say the third line."]);
    const { sent, call } = scripted([TIMED, TIMED_B, CLEAN]);
    await generateBodyWithRetries({ format: "toolkit", title: "Script Bank", linked: false, call });
    expect(sent[2]).toContain("by day 7");
    expect(sent[2]).toContain("within 90 days");
  });

  it("thin → thin: the shape note is specific to what came back, and not duplicated", async () => {
    const { sent, call } = scripted([THIN, THIN, CLEAN]);
    await generateBodyWithRetries({ format: "toolkit", title: "Script Bank", linked: false, call });
    expect(sent[1]).toContain("came back as a string");
    expect(sent[2].split("came back as a string").length - 1).toBe(1);
  });
});

describe("the attempt budget is unchanged at 3", () => {
  it("makes exactly three calls and returns null when no attempt passes", async () => {
    const { sent, call } = scripted([TIMED, THIN, TIMED, CLEAN]);
    const body = await generateBodyWithRetries({ format: "toolkit", title: "Script Bank", linked: false, call });
    expect(sent).toHaveLength(3);
    expect(body).toBeNull();
  });
});

describe("a list delivered as text is REPAIRED, not rejected — it costs no attempt", () => {
  const tools = [
    { name: "A", type: "script", instructions: "Read it.", content: "Say the first line." },
    { name: "B", type: "script", instructions: "Read it.", content: "Say the second line." },
    { name: "C", type: "script", instructions: "Read it.", content: "Say the third line." },
  ];
  const nextStep = { heading: "Next", body: "Open the first script.", ctaLabel: "Open" };

  it("tools as a JSON-encoded string: accepted on attempt 1, one call, a real array of the same tools", async () => {
    const { sent, call } = scripted([JSON.stringify({ promise: "A script bank.", tools: JSON.stringify(tools), nextStep })]);
    const body = await generateBodyWithRetries({ format: "toolkit", title: "Script Bank", linked: false, call });
    expect(sent).toHaveLength(1);
    expect(Array.isArray((body as any).tools)).toBe(true);
    expect((body as any).tools.map((t: any) => t.content)).toEqual(tools.map((t) => t.content));
  });

  it("tools as an object with numeric keys is rebuilt in key order", () => {
    const { body, repaired } = repairArrayField({ tools: { 1: tools[1], 0: tools[0], 2: tools[2] } }, "toolkit");
    expect(repaired).toContain("numeric-keyed");
    expect(body.tools.map((t: any) => t.name)).toEqual(["A", "B", "C"]);
  });

  it("a stringified wrapper object carrying the list is unwrapped", () => {
    const { body } = repairArrayField({ tools: JSON.stringify({ tools }) }, "toolkit");
    expect(body.tools).toHaveLength(3);
  });

  it("control: text that is not a JSON list of objects is NOT repaired, stays thin, and says what it was", async () => {
    const r = repairArrayField({ tools: "Tool one; tool two" }, "toolkit");
    expect(r.repaired).toBeNull();
    expect(r.unrecoverable).toContain("Tool one; tool two");
    expect(repairArrayField({ tools: JSON.stringify(["a", "b", "c"]) }, "toolkit").repaired).toBeNull();
    const { sent, call } = scripted([THIN, CLEAN]);
    await generateBodyWithRetries({ format: "toolkit", title: "Script Bank", linked: false, call });
    expect(sent).toHaveLength(2);
    expect(sent[1]).toContain("came back as a string");
  });

  it("the same repair covers checklist items; quiz is never touched", () => {
    expect(repairArrayField({ items: JSON.stringify([{ label: "x", detail: "y" }]) }, "checklist").body.items).toHaveLength(1);
    const q = { questions: "[]" };
    expect(repairArrayField(q, "quiz").body).toBe(q);
  });
});

describe("bodyShapeNote names what came back", () => {
  it("distinguishes missing, string, empty array and object", () => {
    expect(bodyShapeNote("toolkit", {})).toContain(`"tools" field was missing`);
    expect(bodyShapeNote("toolkit", { tools: "x" })).toContain("came back as a string");
    expect(bodyShapeNote("checklist", { items: [] })).toContain(`"items" field came back as an empty array`);
    expect(bodyShapeNote("guide", { sections: {} })).toContain("came back as an object");
    expect(bodyShapeNote("toolkit", {})).toContain("3 to 4 objects");
  });
});
