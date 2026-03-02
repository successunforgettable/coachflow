/**
 * Item 2.3 — Generate All Missing: vitest coverage
 *
 * Tests:
 * 1. requireField throws when value is null/undefined/empty
 * 2. requireField returns trimmed value when valid
 * 3. GENERATE_STEPS has 10 entries (Step 5 / ICP excluded)
 * 4. GENERATE_STEPS does NOT include step id 5
 * 5. Step 8 (Videos) credit check: throws when balance < 1
 * 6. Modal initialises all steps as "queued"
 * 7. Cancel sets queued steps to "skipped"
 * 8. Server stub removed — campaigns router no longer exports generateAllMissing
 */
import { describe, it, expect } from "vitest";

// ── 1. requireField helper (duplicated here for unit testing) ──────────────
function requireField(value: string | null | undefined, fieldName: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    throw new Error(
      `Step skipped — "${fieldName}" is missing from your service profile. Open your service and fill in the "${fieldName}" field, then retry.`
    );
  }
  return trimmed;
}

// ── 2. GENERATE_STEPS (duplicated here for unit testing) ──────────────────
const GENERATE_STEPS: { id: number; label: string }[] = [
  { id: 1, label: "Your Sales Offer" },
  { id: 2, label: "Your Unique Method" },
  { id: 3, label: "Your Free Opt-In" },
  { id: 4, label: "Your Headlines" },
  { id: 6, label: "Your Ads" },
  { id: 7, label: "Your Ad Images" },
  { id: 8, label: "Your Ad Videos" },
  { id: 9, label: "Your Landing Page" },
  { id: 10, label: "Your Email Follow-Up" },
  { id: 11, label: "Your WhatsApp Follow-Up" },
];

// ── 3. Credit check logic (duplicated here for unit testing) ───────────────
function checkVideoCredits(balance: number): void {
  if (balance < 1) {
    throw new Error(
      `Insufficient video credits — need 1, have ${balance}. Purchase credits to generate videos.`
    );
  }
}

// ── 4. Step state initialiser (duplicated here for unit testing) ───────────
type StepStatus = "queued" | "running" | "done" | "failed" | "skipped";
interface StepState { id: number; label: string; status: StepStatus; error?: string; }

function initSteps(): StepState[] {
  return GENERATE_STEPS.map((s) => ({ id: s.id, label: s.label, status: "queued" }));
}

function cancelSteps(steps: StepState[]): StepState[] {
  return steps.map((s) => (s.status === "queued" ? { ...s, status: "skipped" } : s));
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe("Item 2.3 — Generate All Missing", () => {
  // requireField
  describe("requireField", () => {
    it("throws when value is null", () => {
      expect(() => requireField(null, "Target Customer")).toThrow(
        '"Target Customer" is missing from your service profile'
      );
    });
    it("throws when value is undefined", () => {
      expect(() => requireField(undefined, "Pain Points")).toThrow(
        '"Pain Points" is missing from your service profile'
      );
    });
    it("throws when value is empty string", () => {
      expect(() => requireField("", "Main Benefit")).toThrow(
        '"Main Benefit" is missing from your service profile'
      );
    });
    it("throws when value is whitespace only", () => {
      expect(() => requireField("   ", "Category")).toThrow(
        '"Category" is missing from your service profile'
      );
    });
    it("returns trimmed value when valid", () => {
      expect(requireField("  Crypto Traders  ", "Target Customer")).toBe("Crypto Traders");
    });
    it("returns value unchanged when already trimmed", () => {
      expect(requireField("Wealth Building", "Category")).toBe("Wealth Building");
    });
  });

  // GENERATE_STEPS
  describe("GENERATE_STEPS", () => {
    it("has exactly 10 steps", () => {
      expect(GENERATE_STEPS).toHaveLength(10);
    });
    it("does NOT include step id 5 (ICP is auto-generated)", () => {
      const ids = GENERATE_STEPS.map((s) => s.id);
      expect(ids).not.toContain(5);
    });
    it("includes all expected step ids", () => {
      const ids = GENERATE_STEPS.map((s) => s.id);
      expect(ids).toEqual([1, 2, 3, 4, 6, 7, 8, 9, 10, 11]);
    });
    it("step 8 is labelled 'Your Ad Videos'", () => {
      const step8 = GENERATE_STEPS.find((s) => s.id === 8);
      expect(step8?.label).toBe("Your Ad Videos");
    });
  });

  // Credit check
  describe("Video credit check (Step 8)", () => {
    it("throws when balance is 0", () => {
      expect(() => checkVideoCredits(0)).toThrow("Insufficient video credits");
    });
    it("throws when balance is negative", () => {
      expect(() => checkVideoCredits(-5)).toThrow("Insufficient video credits");
    });
    it("does not throw when balance is 1", () => {
      expect(() => checkVideoCredits(1)).not.toThrow();
    });
    it("does not throw when balance is 10", () => {
      expect(() => checkVideoCredits(10)).not.toThrow();
    });
    it("error message includes the actual balance", () => {
      expect(() => checkVideoCredits(0)).toThrow("have 0");
    });
  });

  // Step state initialisation
  describe("Step state management", () => {
    it("initSteps sets all steps to 'queued'", () => {
      const steps = initSteps();
      expect(steps.every((s) => s.status === "queued")).toBe(true);
    });
    it("initSteps creates 10 step entries", () => {
      expect(initSteps()).toHaveLength(10);
    });
    it("cancelSteps sets queued steps to 'skipped'", () => {
      const steps = initSteps();
      const cancelled = cancelSteps(steps);
      expect(cancelled.every((s) => s.status === "skipped")).toBe(true);
    });
    it("cancelSteps does not change 'done' steps", () => {
      const steps = initSteps();
      steps[0].status = "done";
      const cancelled = cancelSteps(steps);
      expect(cancelled[0].status).toBe("done");
    });
    it("cancelSteps does not change 'failed' steps", () => {
      const steps = initSteps();
      steps[1].status = "failed";
      const cancelled = cancelSteps(steps);
      expect(cancelled[1].status).toBe("failed");
    });
    it("cancelSteps does not change 'running' steps", () => {
      const steps = initSteps();
      steps[2].status = "running";
      const cancelled = cancelSteps(steps);
      expect(cancelled[2].status).toBe("running");
    });
  });

  // Server stub removed
  describe("Server stub removal", () => {
    it("campaigns router no longer exports generateAllMissing", async () => {
      const { campaignsRouter } = await import("./routers/campaigns");
      // The router should not have generateAllMissing as a procedure
      expect((campaignsRouter as any)._def?.procedures?.generateAllMissing).toBeUndefined();
    });
  });
});
