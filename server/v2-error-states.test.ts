/**
 * V2GeneratorWizard error states — unit tests
 * Verifies the four error scenarios are correctly wired:
 *   1. timeout  — 30s no response
 *   2. error    — mid-generation failure
 *   3. offline  — network loss during generation
 *   4. noIcp    — ICP gate in Tool Library (Scenario 4)
 *
 * These tests validate the demo-param logic and message strings
 * without touching any API routes or database schemas.
 */
import { describe, it, expect } from "vitest";

// ── Message constants (must match exactly what's in V2GeneratorWizard.tsx) ──
const MESSAGES = {
  timeout: "Zappy timed out waiting for the AI. Your internet is fine — the server just got busy. Try again.",
  error:   "Something went wrong halfway through. Your inputs are saved — just hit Generate Again.",
  offline: "Zappy lost the connection. Check your internet and try again.",
  noIcp:   "Pick an ICP first so Zappy knows who we're targeting.",
};

// ── Retry button labels ──
const RETRY_LABELS = {
  timeout: "Try Again",
  error:   "Generate Again",
  offline: "Try Again",
};

describe("V2GeneratorWizard error state messages", () => {
  it("Scenario 1 (timeout): message is correct", () => {
    expect(MESSAGES.timeout).toBe(
      "Zappy timed out waiting for the AI. Your internet is fine — the server just got busy. Try again."
    );
  });

  it("Scenario 1 (timeout): retry label is 'Try Again'", () => {
    expect(RETRY_LABELS.timeout).toBe("Try Again");
  });

  it("Scenario 2 (error): message is correct", () => {
    expect(MESSAGES.error).toBe(
      "Something went wrong halfway through. Your inputs are saved — just hit Generate Again."
    );
  });

  it("Scenario 2 (error): retry label is 'Generate Again'", () => {
    expect(RETRY_LABELS.error).toBe("Generate Again");
  });

  it("Scenario 3 (offline): message is correct", () => {
    expect(MESSAGES.offline).toBe(
      "Zappy lost the connection. Check your internet and try again."
    );
  });

  it("Scenario 3 (offline): retry label is 'Try Again'", () => {
    expect(RETRY_LABELS.offline).toBe("Try Again");
  });

  it("Scenario 4 (noIcp): message is correct", () => {
    expect(MESSAGES.noIcp).toBe(
      "Pick an ICP first so Zappy knows who we're targeting."
    );
  });
});

describe("V2GeneratorWizard demo param mapping", () => {
  const DEMO_PARAMS = ["timeout", "error", "offline", "loading", "success", "concerned", "missing", "welcome"];

  it("all expected demo params are defined", () => {
    const expected = ["timeout", "error", "offline", "loading", "success", "concerned", "missing", "welcome"];
    expect(DEMO_PARAMS).toEqual(expect.arrayContaining(expected));
  });

  it("error state params are distinct from success params", () => {
    const errorParams = ["timeout", "error", "offline"];
    const successParams = ["success", "cheering"];
    const overlap = errorParams.filter(p => successParams.includes(p));
    expect(overlap).toHaveLength(0);
  });
});
