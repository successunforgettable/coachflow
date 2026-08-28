import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * THE APPROVED COPY IS PINNED CHARACTER-FOR-CHARACTER.
 *
 * Arfeen approved this wording twice and it shipped nowhere — the server computed the questions and
 * no caller rendered them. Now that it IS rendered, this guard exists so it cannot drift back out or
 * be "improved" in passing. Changing either string is a product decision; this test failing is the
 * intended alarm, not an obstacle.
 *
 * Read from source rather than imported: V2Trail pulls in the whole React/tRPC client tree, which a
 * node-environment unit test cannot load. The strings are what matter, and they are what is checked.
 * (Lives under server/ only because vitest's include is `server/**` — it is a client-source guard.)
 */
const SRC = readFileSync(new URL("../client/src/v2/V2Trail.tsx", import.meta.url), "utf8");

const APPROVED_ASK =
  "Planning to run a live session for the people who download this? Give me the date, time and timezone and I'll build the registration page — your guide will send readers straight to it.";
const APPROVED_SKIP =
  "No date yet? Skip this. Your guide still ends with an invitation, it just won't have a link.";

const askBlock = () => SRC.slice(SRC.indexOf('stepDef.step === "hvco"'), SRC.indexOf("FREE_STEP_ACK_SKIPPED,"));

describe("free-next-step intake copy — approved wording, shipped exactly", () => {
  it("the ASK is present verbatim", () => expect(SRC).toContain(APPROVED_ASK));
  it("the SKIP hint is present verbatim", () => expect(SRC).toContain(APPROVED_SKIP));
  it("both are exported named constants, not inlined at the call site", () => {
    expect(SRC).toMatch(/export const FREE_STEP_ASK\s*=/);
    expect(SRC).toMatch(/export const FREE_STEP_SKIP_HINT\s*=/);
  });
  it("🔑 rendered ONLY from what the server returned — never inferred from campaignType", () => {
    // The defect this exists to fix was a server value with no renderer. The opposite failure would
    // be a renderer that guesses. Pin that the gate is the server's own array.
    expect(SRC).toMatch(/Array\.isArray\(fr\.freeStepQuestions\)\s*&&\s*fr\.freeStepQuestions\.length\s*>\s*0/);
    expect(askBlock()).not.toMatch(/campaignType\s*===\s*["']lead_magnet["']/);
  });
  it("🔑 a skippable ask, never a gate — Skip offered on every question", () => {
    expect(askBlock()).toContain('"Skip"');
    expect(askBlock()).toContain("__SKIP__");
  });
  it("🔑 a skip records NOTHING — it breaks out before answerCampaignFact", () => {
    // Nothing is generated to fill an unanswered question: missing stays missing, and the magnet
    // keeps the honest text card.
    expect(askBlock()).toMatch(/__SKIP__[\s\S]{0,60}skipped = true;\s*break;/);
  });
  it("🔑 non-fatal by construction — the ask can never block the campaign", () => {
    expect(askBlock()).toMatch(/catch \(e\)[\s\S]{0,200}non-fatal/);
  });
});
