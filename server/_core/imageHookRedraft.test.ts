import { describe, it, expect } from "vitest";
import {
  HOOK_MAX_CHARS,
  clampHookText,
  redraftSurfaceFor,
  buildHookRedraftInstruction,
} from "../adCopyGenerator";

/**
 * Regression cover for the defect the 2026-08-08 live proof exposed.
 *
 * The distinctness gate's regeneration callback branched on `isBody`, so an
 * `image_hook` row fell into the HEADLINE branch: prompted "You are rewriting ONE
 * ad HEADLINE", and — because the 60-character ceiling was applied only on first
 * generation — returned uncapped. All four hooks that reached the picture on that
 * run were gate-recovered, and every one of them was over the ceiling.
 *
 * These are the four strings that actually persisted. They are pinned here so the
 * regression cannot come back silently.
 */
const LIVE_OVERSIZED_HOOKS = [
  "The client went quiet the moment scope started moving — not because the number was wrong, but because I never anchored it first", // 127
  "The Scope-First Sequence: Built to Get a Retainer Conversation on the Calendar Before the Proposal Stage Stalls It", // 114
  "The Scope-First Sequence books the retainer conversation before the proposal is ever written", // 92
  "The proposal sits finished. The client goes quiet. The scope shifts again.", // 74
];

describe("redraftSurfaceFor — the branch the defect lived in", () => {
  it("routes an image_hook to its OWN surface, never the headline branch", () => {
    expect(redraftSurfaceFor("image_hook")).toBe("image_hook");
  });

  it("leaves the body branch exactly where it was", () => {
    expect(redraftSurfaceFor("body")).toBe("body");
  });

  it("leaves the headline branch exactly where it was", () => {
    expect(redraftSurfaceFor("headline")).toBe("headline");
  });

  it("keeps every other contentType on the headline path, as before", () => {
    // `link` rows are excluded from the distinctness population, so they never reach
    // regeneration — but if one ever did, its behaviour must be the pre-fix behaviour.
    expect(redraftSurfaceFor("link")).toBe("headline");
    expect(redraftSurfaceFor(null)).toBe("headline");
    expect(redraftSurfaceFor(undefined)).toBe("headline");
  });
});

describe("clampHookText — the ceiling, enforced in code and not only in the prompt", () => {
  it("passes a hook already within the ceiling through unchanged", () => {
    const short = "The scope moved again and nobody said no";
    expect(short.length).toBeLessThanOrEqual(HOOK_MAX_CHARS);
    expect(clampHookText(short)).toBe(short);
  });

  it("clamps EVERY hook the live run persisted to within the ceiling", () => {
    for (const hook of LIVE_OVERSIZED_HOOKS) {
      const clamped = clampHookText(hook);
      expect(clamped.length).toBeLessThanOrEqual(HOOK_MAX_CHARS);
      expect(clamped.length).toBeGreaterThan(0);
    }
  });

  it("proves the live hooks really were over the ceiling (the test would be vacuous otherwise)", () => {
    for (const hook of LIVE_OVERSIZED_HOOKS) {
      expect(hook.length).toBeGreaterThan(HOOK_MAX_CHARS);
    }
  });

  it("cuts at a word boundary, never mid-word", () => {
    const clamped = clampHookText(LIVE_OVERSIZED_HOOKS[0]);
    // The clamped text must be a whole-word prefix of the normalised original.
    const original = LIVE_OVERSIZED_HOOKS[0].replace(/\s+/g, " ").trim();
    expect(original.startsWith(clamped)).toBe(true);
    const nextChar = original.slice(clamped.length, clamped.length + 1);
    expect(nextChar === "" || nextChar === " ").toBe(true);
  });

  it("normalises whitespace and strips wrapping quotes", () => {
    expect(clampHookText('  "The   scope moved again"  ')).toBe("The scope moved again");
  });

  it("handles empty and nullish input without throwing", () => {
    expect(clampHookText("")).toBe("");
    expect(clampHookText(null)).toBe("");
    expect(clampHookText(undefined)).toBe("");
  });
});

describe("buildHookRedraftInstruction — a recovered hook is prompted AS A HOOK", () => {
  const instruction = buildHookRedraftInstruction({
    cascadeContext: "",
    facts: "FACTS BLOCK",
    axisLine: "AXIS LINE",
    register: "REGISTER GUIDANCE",
  });

  it("tells the model it is rewriting an image hook", () => {
    expect(instruction).toContain("You are rewriting ONE IMAGE HOOK");
  });

  it("never tells the model it is rewriting a headline — the exact defect", () => {
    expect(instruction).not.toContain("rewriting ONE ad HEADLINE");
    expect(instruction).toContain("This is NOT a headline");
  });

  it("carries the build-spec §3 division of labour", () => {
    expect(instruction).toContain("emotional hook");
    expect(instruction).toContain("The HEADLINE carries the proof or the mechanism");
  });

  it("restates the character ceiling in the prompt as well as enforcing it in code", () => {
    expect(instruction).toContain(`${HOOK_MAX_CHARS} characters maximum`);
  });

  it("still carries the axis move, the facts and the register guidance", () => {
    expect(instruction).toContain("AXIS LINE");
    expect(instruction).toContain("FACTS BLOCK");
    expect(instruction).toContain("REGISTER GUIDANCE");
  });
});

describe("end-to-end shape: a gate-recovered hook stays within the ceiling", () => {
  it("clamps a model redraft that runs long, exactly as the regenerate path now does", () => {
    // Simulates the callback: surface resolves to image_hook, so the redraft is clamped.
    const surface = redraftSurfaceFor("image_hook");
    const modelReturned = LIVE_OVERSIZED_HOOKS[1];
    const persisted = surface === "image_hook" ? clampHookText(modelReturned) : modelReturned;
    expect(persisted.length).toBeLessThanOrEqual(HOOK_MAX_CHARS);
  });

  it("does NOT clamp a body redraft — bodies are 125-150 words by design", () => {
    const surface = redraftSurfaceFor("body");
    const longBody = "word ".repeat(140).trim();
    const persisted = surface === "image_hook" ? clampHookText(longBody) : longBody;
    expect(persisted).toBe(longBody);
    expect(persisted.length).toBeGreaterThan(HOOK_MAX_CHARS);
  });

  it("does NOT clamp a headline redraft — headline length is governed elsewhere", () => {
    const surface = redraftSurfaceFor("headline");
    const headline = "The Scope-First Sequence books the retainer call before the proposal";
    const persisted = surface === "image_hook" ? clampHookText(headline) : headline;
    expect(persisted).toBe(headline);
  });
});
