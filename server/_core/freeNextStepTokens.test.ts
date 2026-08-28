import { describe, it, expect } from "vitest";
import { resolveAutoFillTokens, substituteCopyToken, OPERATOR_TOKEN_REGISTRY, deriveOperatorQuestions } from "../lib/templates/operatorFields";
import { LP_FRAMING_FREE_NEXT_STEP, FREE_NEXT_STEP_REPLAY_TEXT } from "./campaignFraming";

// The publish gate's OWN scan, byte-identical to landingPagePublisher.ts step 6b. Copied
// deliberately rather than imported: the gate runs on rendered HTML behind Cloudflare + template
// machinery, and what these tests need to assert is the property the gate tests — that no
// [INSERT_*] survives into what gets rendered.
const scanTokens = (o: unknown): string[] =>
  Array.from(new Set(JSON.stringify(o).match(/\[INSERT_[A-Z_0-9]+\]/g) ?? []));

describe("auto-fill tokens — the registry's declared contract, now actually implemented", () => {
  it("FILLS the host and the event name from facts ZAP already holds", () => {
    const content = { mainHeadline: "Join [INSERT_HOST_NAME] for [INSERT_EVENT_NAME]", bullets: ["Hosted by [INSERT_HOST_NAME]"] };
    const { content: out, filled } = resolveAutoFillTokens(content, { coachName: "Arfeen Khan", serviceName: "Executive Presence" });
    expect(scanTokens(out)).toEqual([]);
    expect(out.mainHeadline).toBe("Join Arfeen Khan for Executive Presence");
    expect(out.bullets[0]).toBe("Hosted by Arfeen Khan");
    expect(filled).toEqual(expect.arrayContaining(["[INSERT_HOST_NAME]", "[INSERT_EVENT_NAME]"]));
  });

  it("SUBSTITUTES EVERY OCCURRENCE, at any depth", () => {
    const content = { a: { b: [{ c: "[INSERT_HOST_NAME] and [INSERT_HOST_NAME]" }] } };
    const { content: out } = resolveAutoFillTokens(content, { coachName: "Dana" });
    expect(scanTokens(out)).toEqual([]);
    expect(out.a.b[0].c).toBe("Dana and Dana");
  });

  it("🔑 AN ABSENT FACT LEAVES THE TOKEN — never an empty string", () => {
    // This is the whole safety property. Blanking the token would ship a page with a hole in it and
    // delete the publish gate's only signal that something is missing. A surviving token is a
    // CAUGHT failure; a silent hole is an uncaught one.
    const content = { h: "Join [INSERT_HOST_NAME] for [INSERT_EVENT_NAME]" };
    for (const facts of [{}, { coachName: "" }, { coachName: "   " }, { coachName: null }]) {
      const { content: out, filled } = resolveAutoFillTokens(content, facts as any);
      expect(out.h).toContain("[INSERT_HOST_NAME]");
      expect(filled).not.toContain("[INSERT_HOST_NAME]");
    }
  });

  it("touches ONLY auto-fill tokens — hard-holds and nudges are left for their own flows", () => {
    const content = { a: "[INSERT_EVENT_DATE] [INSERT_PRICE] [INSERT_BOOKING_URL] [INSERT_REPLAY_AVAILABILITY] [INSERT_HOST_NAME]" };
    const { content: out } = resolveAutoFillTokens(content, { coachName: "Dana", serviceName: "S" });
    expect(scanTokens(out).sort()).toEqual(
      ["[INSERT_BOOKING_URL]", "[INSERT_EVENT_DATE]", "[INSERT_PRICE]", "[INSERT_REPLAY_AVAILABILITY]"],
    );
  });

  it("EXECUTABLE DOCUMENTATION — every auto-fill token in the registry has a source, and none is ever asked", () => {
    const autoFill = Object.values(OPERATOR_TOKEN_REGISTRY).filter((s) => s.category === "auto-fill");
    expect(autoFill.length).toBeGreaterThan(0);
    for (const spec of autoFill) expect(spec.autoFillFrom).toBeTruthy();
    // The pairing that made this a silent failure: skipped by the question deriver AND unfilled.
    // Half of that is now false; this pins the other half stays true (they are never asked).
    const qs = deriveOperatorQuestions("webinar_registration", { mainHeadline: "[INSERT_HOST_NAME] [INSERT_EVENT_NAME]" } as any, null);
    expect(qs.map((q) => q.token)).not.toContain("[INSERT_HOST_NAME]");
    expect(qs.map((q) => q.token)).not.toContain("[INSERT_EVENT_NAME]");
  });
});

describe("the replay slot — answered from the framing, and NOT over-claimed", () => {
  it("restates the framing's live-and-once fact", () => {
    const content = { note: "Replay: [INSERT_REPLAY_AVAILABILITY]" };
    const out = substituteCopyToken(content, "[INSERT_REPLAY_AVAILABILITY]", FREE_NEXT_STEP_REPLAY_TEXT);
    expect(scanTokens(out)).toEqual([]);
    expect(out.note).toContain("runs live, once");
  });

  it("🔑 NEVER CLAIMS THE SESSION IS UNRECORDED — live-and-once does not entail no-replay", () => {
    // The framing asserts the session is live and happens once. It does NOT say whether it is
    // recorded, and ZAP never asked. Claiming "no replay" here would be a fabrication of exactly
    // the class the anti-fabrication work exists to stop.
    const t = FREE_NEXT_STEP_REPLAY_TEXT.toLowerCase();
    for (const claim of ["no replay", "not be recorded", "won't be recorded", "live only", "no recording", "never recorded"]) {
      expect(t).not.toContain(claim);
    }
  });

  it("the framing it is written from actually makes the live-and-once claim", () => {
    // If this framing is ever reworded away from live-and-once, the replay text stops being
    // grounded and this fails rather than drifting silently.
    expect(LP_FRAMING_FREE_NEXT_STEP).toContain("live and happens once");
  });
});

describe("the three Test-5 tokens, together — the failure that started this", () => {
  it("a page carrying all three publishes cleanly once resolved", () => {
    const page = {
      mainHeadline: "Join [INSERT_HOST_NAME] live for [INSERT_EVENT_NAME]",
      subheadline: "[INSERT_REPLAY_AVAILABILITY]",
      eventSchedule: { date: "14 March 2027", time: "2pm", timezone: "GMT" },
    };
    expect(scanTokens(page)).toHaveLength(3);
    const filled = resolveAutoFillTokens(page, { coachName: "Arfeen Khan", serviceName: "Executive Presence" }).content;
    const done = substituteCopyToken(filled, "[INSERT_REPLAY_AVAILABILITY]", FREE_NEXT_STEP_REPLAY_TEXT);
    expect(scanTokens(done)).toEqual([]); // the gate would now pass
  });
});
