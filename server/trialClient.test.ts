import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { isPaidOrStaff } from "./lib/tierAccess";
import { isTrialUser, usageLimitOf } from "../client/src/v2/lib/usageLimit";

// Trial paywall, option (b) — sprint 2 (client). The browser proof is in docs/screenshots/sprint2-trial-paywall/;
// these pin the behaviour so it cannot quietly regress, and the parity test keeps the client's display rule from
// drifting away from the server gate it mirrors.

const read = (p: string) => readFileSync(join(__dirname, p), "utf8");
const trail = read("../client/src/v2/V2Trail.tsx");
const intake = read("../client/src/v2/V2TrailIntake.tsx");
const kitPage = read("../client/src/v2/V2CampaignKit.tsx");

describe("client trial rule == server rule", () => {
  it("isTrialUser is exactly !isPaidOrStaff for every role × tier (incl. missing)", () => {
    for (const role of ["user", "admin", "superuser", null]) {
      for (const tier of ["trial", "pro", "agency", null, undefined]) {
        const u = { role, subscriptionTier: tier };
        expect(isTrialUser(u), `${role}/${tier}`).toBe(!isPaidOrStaff(u as any));
      }
    }
    expect(isTrialUser(null)).toBe(true);
  });

  it("usageLimitOf reads data.usageLimit and ignores every other error (negative control)", () => {
    const limited = Object.assign(new Error("You've used all 2 free offers included in the free trial."), {
      data: { usageLimit: { kind: "quota_exceeded", generator: "offers" } },
    });
    expect(usageLimitOf(limited)).toEqual({ kind: "quota_exceeded", generator: "offers", message: limited.message });
    expect(usageLimitOf(Object.assign(new Error("boom"), { data: { code: "FORBIDDEN" } }))).toBeNull();
    expect(usageLimitOf(new Error("plain"))).toBeNull();
    expect(usageLimitOf(null)).toBeNull();
  });
});

describe("D4 — a trial import fills its gaps node by node; a Pro import auto-fills as before", () => {
  it("the unified loop sends a trial has_assets kit to the manual loop, and everything else where it went before", () => {
    expect(trail).toContain('if (path === "manual" || (path === "has_assets" && trialUserRef.current)) {');
    const branch = trail.slice(trail.indexOf('if (path === "manual" || (path === "has_assets" && trialUserRef.current)) {'));
    expect(branch.indexOf("await runManualLoop();")).toBeLessThan(branch.indexOf("} else {"));
    expect(branch.slice(branch.indexOf("} else {"), branch.indexOf("} else {") + 200)).toContain("await runAutoLoop();");
  });

  it("the driver never starts before the user's tier is known (a Pro import must not be read as trial while loading)", () => {
    expect(trail).toContain("if (authLoading) return;");
    expect(trail).toContain("}, [trailState.data, persisted, authLoading]);");
  });
});

describe("limit messages on every Trail step that can hit a limit", () => {
  it("Trail: every orchestrateStep catch that records lastError halts on a usage limit first (10 sites)", () => {
    const recordsLastError = trail.match(/\} catch \((\w+)\) \{\n(?:\s+if \(await haltOnUsageLimit[^\n]*\n)?\s+lastError = \1 instanceof Error/g) ?? [];
    const halted = trail.match(/\} catch \((\w+)\) \{\n\s+if \(await haltOnUsageLimit\(\1[,)]/g) ?? [];
    expect(recordsLastError.length).toBe(10);
    expect(halted.length).toBe(10);
  });

  it("Trail: a final limit ends the drive instead of re-offering the node; show-me-new-options keeps its deck", () => {
    expect(trail).toContain("if (final) usageLimitHalted.current = true;");
    expect(trail).toContain("if (cancelled.current || usageLimitHalted.current) return;");
    expect(trail).toMatch(/priorSelectedId \} as any\), false\)\) \{/);
  });

  it("intake: the first step (reading the coach's description) says a limit instead of 'send it again'", () => {
    expect(intake).toMatch(/const ex = await extractMutation\.mutateAsync\(\{ rawText \}\);[\s\S]{0,160}\} catch \(err\) \{\n\s+if \(sayUsageLimit\(err\)\) return;/);
  });

  it("intake: all three campaign-setup exits say the limit instead of 'fizzled — one more go?'", () => {
    const exits = intake.match(/\} catch \(err\) \{\n\s+if \(sayUsageLimit\(err\)\) return;\n\s+const msg = err instanceof Error \? err\.message : "Could not set up your campaign\.";/g) ?? [];
    expect(exits.length).toBe(3);
    // NEGATIVE CONTROL: no setup exit is left without it.
    expect((intake.match(/const msg = err instanceof Error \? err\.message : "Could not set up your campaign\.";/g) ?? []).length).toBe(3);
  });
});

describe("D6 — a trial user sees why Push is Pro-only, never a dead button", () => {
  it("handlePush never opens the modal for a trial user", () => {
    expect(kitPage).toContain("const handlePush = () => { if (!trialUser) setShowPushModal(true); };");
  });
  it("overlay and bottom bar swap the push buttons for the Pro-only note; Pro keeps both buttons", () => {
    expect(kitPage).toContain('data-testid="push-pro-only-note"');
    expect(kitPage).toContain('data-testid="push-pro-only-pill"');
    expect(kitPage).toContain('data-testid="push-pro-only-bar-note"');
    expect(kitPage).toContain("Push Live to Meta + GHL →");
    expect(kitPage).toMatch(/\) : \(\n\s+<button\n\s+disabled=\{!isComplete\}\n\s+onClick=\{handlePush\}/);
  });
});
