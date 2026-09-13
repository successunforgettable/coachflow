import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { parseDeclaredCounts, countDeliveredItems, declaredCountFaults } from "./declaredCount";
import { applyBodyBounds, generateBodyWithRetries } from "../leadMagnetContentGenerator";

/**
 * THE DECLARED-COUNT GATE — item 15, 2026-09-14. Built from the real bonus-35 case and calibrated against every
 * bonus description and body in production. Fixtures are verbatim captures, never reconstructions.
 */
const fx = (name: string) => JSON.parse(readFileSync(new URL(`../__fixtures__/${name}`, import.meta.url), "utf8"));
const DESCRIPTIONS: Record<string, string> = fx("bonus-descriptions-2026-09-14.json");
const LIVE_35 = fx("trimmed-bonus-35-2026-09-13.json");          // published 2026-09-13: promises 17, holds 13
const RAW_35_ATTEMPT2 = fx("raw-bonus-35-attempt2-2026-09-13.json"); // delivered all 17 before the trim
const RAW_35_ATTEMPT3 = fx("raw-bonus-35-attempt3-2026-09-13.json"); // delivered 17 as Script A1–C5, no trim
const LIVE_33 = fx("live-bonus-33-2026-09-14.json");
const LIVE_34 = fx("live-bonus-34-2026-09-14.json");
const LIVE_43 = fx("live-bonus-43-2026-09-14.json");

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("parseDeclaredCounts — reads the count the brief states, and nothing else", () => {
  it("bonus-35's description declares seventeen scripts", () => {
    expect(parseDeclaredCounts(DESCRIPTIONS["35"])).toEqual([
      { count: 17, family: "script", phrase: "seventeen … prompts" },
    ]);
  });

  it("calibration: every bonus description in production parses to what it actually declares", () => {
    const byId = Object.fromEntries(Object.entries(DESCRIPTIONS).map(([id, d]) => [id, parseDeclaredCounts(d).map((c) => `${c.count} ${c.family}`)]));
    expect(byId).toEqual({
      "33": ["7 task"],      // "seven discrete micro-tasks"
      "34": ["12 script"],   // "twelve targeted prompts"
      "35": ["17 script"],   // "seventeen pre-written self-coaching prompts and perspective-shift scripts"
      "42": [],              // "six months", "7-day", "ten minutes", "three viable directions" — none a deliverable
      "43": ["5 step"],      // "five sequential steps"
      "44": [],              // "three critical conversations" — not a deliverable noun
    });
  });

  it("durations, lengths and non-deliverable nouns declare nothing", () => {
    for (const s of [
      "Each script is one to three sentences long.",
      "within fifteen minutes",
      "a single 7-day diagnostic",
      "two weeks of avoidance",
      "three critical conversations",
      "the three-session briefing marathon",
    ]) expect({ s, counts: parseDeclaredCounts(s) }).toEqual({ s, counts: [] });
  });

  it("hyphenated and digit forms are read", () => {
    expect(parseDeclaredCounts("A 12-item checklist.").map((c) => `${c.count} ${c.family}`)).toEqual(["12 task"]);
    expect(parseDeclaredCounts("Four fill-in templates and 6 swipe emails.").map((c) => `${c.count} ${c.family}`)).toEqual(["4 template", "6 swipe"]);
  });
});

describe("countDeliveredItems — counts headed items with content; a stub or a mention never counts", () => {
  it("live bonus-35: 13 scripts — the empty 'Script 1' stub and the worksheet's '(Script 15 or 16)' mention do not count", () => {
    const r = countDeliveredItems("toolkit", LIVE_35, "script");
    expect(r.delivered).toBe(13);
    expect(r.labels).not.toContain("script 15");
    // the mention is really there — so its exclusion is a finding, not an absence (§15k)
    expect(JSON.stringify(LIVE_35)).toContain("Script 15 or 16");
  });

  it("the raw bodies that DID deliver 17 count as 17 — both label styles", () => {
    expect(countDeliveredItems("toolkit", RAW_35_ATTEMPT2, "script").delivered).toBe(17);
    expect(countDeliveredItems("toolkit", RAW_35_ATTEMPT3, "script").delivered).toBe(17); // Script A1 … C5
  });

  it("a worksheet's PROMPT headings in another tool do not inflate a script bank (attempt 3: 17 scripts + 5 prompts ≠ 22)", () => {
    // The prompts are really there — the exclusion is a finding, not an absence (§15k).
    expect(RAW_35_ATTEMPT3.tools[1].content).toContain("**PROMPT 1");
    const r = countDeliveredItems("toolkit", RAW_35_ATTEMPT3, "script");
    expect(r.delivered).toBe(17);
    expect(r.labels.every((l) => l.startsWith("script "))).toBe(true);
  });

  it("checklists count their items", () => {
    expect(countDeliveredItems("checklist", LIVE_33, "task").delivered).toBe(11);
  });
});

describe("declaredCountFaults — the bonus-35 case, and the trim it could not see", () => {
  it("🔴 the body live on bonus-35 fails: declares 17, delivers 13", () => {
    const faults = declaredCountFaults("toolkit", LIVE_35, parseDeclaredCounts(DESCRIPTIONS["35"]));
    expect(faults).toHaveLength(1);
    expect(faults[0]).toContain("the brief declares 17 scripts and the body delivers 13 with content");
  });

  it("🔴 the trim ALONE breaks a matching body: attempt 2 passes before applyBodyBounds and fails after", () => {
    const declared = parseDeclaredCounts(DESCRIPTIONS["35"]);
    expect(declaredCountFaults("toolkit", RAW_35_ATTEMPT2, declared)).toEqual([]);
    const { body: trimmed } = applyBodyBounds(JSON.parse(JSON.stringify({ format: "toolkit", ...RAW_35_ATTEMPT2 })), "toolkit");
    expect(countDeliveredItems("toolkit", trimmed, "script").delivered).toBe(15);
    expect(declaredCountFaults("toolkit", trimmed, declared)[0]).toContain("delivers 15");
  });

  it("positive control: a body that delivers all 17 within the cap passes", () => {
    expect(declaredCountFaults("toolkit", RAW_35_ATTEMPT3, parseDeclaredCounts(DESCRIPTIONS["35"]))).toEqual([]);
  });

  it("the gate would have caught the two mismatches already live before it existed", () => {
    expect(declaredCountFaults("toolkit", LIVE_34, parseDeclaredCounts(DESCRIPTIONS["34"]))[0]).toContain("declares 12 scripts and the body delivers 9");
    expect(declaredCountFaults("toolkit", LIVE_43, parseDeclaredCounts(DESCRIPTIONS["43"]))[0]).toContain("declares 5 steps and the body delivers 3");
  });

  it("control: a checklist that exceeds its declared count passes; no declared count means no gate", () => {
    expect(declaredCountFaults("checklist", LIVE_33, parseDeclaredCounts(DESCRIPTIONS["33"]))).toEqual([]);
    expect(declaredCountFaults("toolkit", LIVE_35, [])).toEqual([]);
  });
});

describe("the attempt loop — a body contradicting its own declared count is never returned", () => {
  it("the live bonus-35 body, returned three times: null after exactly three attempts, and the retry says what fell short", async () => {
    const sent: string[] = [];
    const body = await generateBodyWithRetries({
      format: "toolkit", title: "The 'My Brain Doesn't Write' Reframe Script Bank", linked: false,
      declaredCounts: parseDeclaredCounts(DESCRIPTIONS["35"]),
      call: async (inj) => { sent.push(inj); return JSON.stringify(LIVE_35); },
    });
    expect(body).toBeNull();
    expect(sent).toHaveLength(3);
    expect(sent[1]).toContain("the brief declares 17 scripts and the body delivers 13");
  });

  it("control: the same body with no declared count is returned — the count gate is what refuses it", async () => {
    const body = await generateBodyWithRetries({
      format: "toolkit", title: "The 'My Brain Doesn't Write' Reframe Script Bank", linked: false,
      call: async () => JSON.stringify(LIVE_35),
    });
    expect(body).not.toBeNull();
  });
});
