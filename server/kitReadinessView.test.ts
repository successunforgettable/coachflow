import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readinessPill, completionBeat } from "../client/src/v2/kitReadinessView";
import { computeKitReadiness } from "./_core/kitReadiness";

/** HONEST COMPLETION — what the coach is told, on the kit page and at the end of the Trail. */

const FULL = {
  selectedOfferId: 1, selectedMechanismId: 2, selectedHvcoId: 3, selectedHeadlineId: 4, selectedAdCopyId: 5,
  selectedLandingPageId: 6, selectedEmailSequenceId: 7, selectedWhatsAppSequenceId: 8, selectedAdCreativeBatchId: "b",
};
const ready = computeKitReadiness({ kit: FULL, hasService: true, landingPage: { publicUrl: "https://x/p/y", leftoverTokens: 0, needsPublish: false }, adImageCount: 5, skippedNodes: [] });
const unpublished = computeKitReadiness({ kit: FULL, hasService: true, landingPage: { publicUrl: null, leftoverTokens: 2, needsPublish: true }, adImageCount: 5, skippedNodes: [] });
const partial = computeKitReadiness({ kit: { ...FULL, selectedAdCopyId: null }, hasService: true, landingPage: { publicUrl: "https://x/p/y", leftoverTokens: 0, needsPublish: false }, adImageCount: 5, skippedNodes: [] });

describe("the kit page's status pill", () => {
  it("ready ⇒ 'Ready to push'", () => expect(readinessPill(ready).text).toBe("Ready to push"));
  it("built with one blocker ⇒ 'Built — 1 thing to fix'", () => expect(readinessPill(unpublished).text).toBe("Built — 1 thing to fix"));
  it("not built ⇒ 'In progress'", () => expect(readinessPill(partial).text).toBe("In progress"));
  it("only 'ready' is the green tone", () => {
    expect(readinessPill(ready).tone).toBe("good");
    expect(readinessPill(unpublished).tone).not.toBe("good");
    expect(readinessPill(partial).tone).not.toBe("good");
  });
});

describe("the Trail's end beat", () => {
  it("ready ⇒ the celebration, and it says ready to push", () => {
    const b = completionBeat(ready);
    expect(b.celebrate).toBe(true);
    expect(b.lines.join(" ")).toMatch(/ready to push/i);
  });

  it("an unpublished page ⇒ NOT the celebration, names the page and the missing details", () => {
    const b = completionBeat(unpublished);
    expect(b.celebrate).toBe(false);
    const text = b.lines.join(" ");
    expect(text).not.toMatch(/ready to push|11 of 11|every piece built/i);
    expect(text).toMatch(/landing page/i);
    expect(text).toMatch(/2 details/);
  });

  it("a missing node ⇒ NOT the celebration, names the node", () => {
    const b = completionBeat(partial);
    expect(b.celebrate).toBe(false);
    expect(b.lines.join(" ")).toMatch(/ad copy/i);
  });
});

describe("the Trail and the kit page read readiness (§15d — a server value with no caller is the bug)", () => {
  const trail = readFileSync(join(__dirname, "..", "client", "src", "v2", "V2Trail.tsx"), "utf8");
  const kitPage = readFileSync(join(__dirname, "..", "client", "src", "v2", "V2CampaignKit.tsx"), "utf8");
  it("V2Trail calls getReadiness and no longer hard-codes '11 of 11'", () => {
    expect(trail).toMatch(/campaignKits\.getReadiness/);
    expect(trail).not.toMatch(/11 of 11 — every piece built/);
  });
  it("V2CampaignKit calls getReadiness and renders the pill from it", () => {
    expect(kitPage).toMatch(/campaignKits\.getReadiness/);
    expect(kitPage).toMatch(/readinessPill\(/);
  });
  it("the kit page enables Push only from readiness (the stored status is a fallback until it loads)", () => {
    expect(kitPage).toMatch(/const isComplete = readiness \? readiness\.state === "ready" : kit\.status === "complete";/);
    expect(kitPage).toMatch(/data-testid="kit-readiness-blockers"/);
  });
  it("the Trail celebrates only a ready kit, and never persists a not-ready beat", () => {
    const beat = trail.slice(trail.indexOf("const runCompletionBeat"), trail.indexOf("const runAutoLoop"));
    expect(beat).toMatch(/if \(!readiness \|\| readiness\.state !== "ready"\) \{/);
    const notReady = beat.slice(beat.indexOf('readiness.state !== "ready"'), beat.indexOf("return;"));
    expect(notReady).not.toMatch(/persistMsgs|milestone-badge/);
    expect((trail.match(/await runCompletionBeat\(\);/g) ?? []).length).toBe(2);
  });
});

// ─── The Trail's welcome-back line (2026-09-27): same readiness answer, no stronger claim than it makes ───
import { welcomeBackLine } from "../client/src/v2/kitReadinessView";

describe("the Trail's welcome-back line", () => {
  const STOPS = ["service", "icp", "offer", "uniqueMethod", "freeOptIn", "headlines", "adCopy", "landingPage", "emailSequence", "whatsappSequence", "adCreatives"];
  const stops = (pending: string[] = []) =>
    STOPS.map((key) => ({ key, label: key === "landingPage" ? "Landing Page" : key === "adCreatives" ? "Ad Images" : key === "adCopy" ? "Ad Copy" : key, state: pending.includes(key) ? "pending" : "done" }));

  it("a built-but-unpublished page is NOT 'up next' — it says what's actually wrong and what to do", () => {
    const line = welcomeBackLine(stops(["landingPage"]), unpublished);
    expect(line).not.toMatch(/up next/);
    expect(line).toMatch(/10 of 11/);
    expect(line).toMatch(/landing page is built but hasn't been published/i);
    expect(line).toMatch(/2 missing details/);
  });

  it("a genuinely unbuilt next node still reads 'up next' (today's behaviour)", () => {
    expect(welcomeBackLine(stops(["adCopy"]), partial)).toBe("Welcome back. We're 10 of 11 — Ad Copy is up next.");
  });

  it("before readiness loads, an unbuilt next node reads exactly as today", () => {
    expect(welcomeBackLine(stops(["adCopy"]), null)).toBe("Welcome back. We're 10 of 11 — Ad Copy is up next.");
  });

  it("everything done and ready ⇒ says ready to push", () => {
    expect(welcomeBackLine(stops(), ready)).toMatch(/ready to push/i);
  });

  it("every stop done but something blocks a push ⇒ never 'This campaign is complete'", () => {
    const noImages = computeKitReadiness({ kit: FULL, hasService: true, landingPage: { publicUrl: "https://x/p/y", leftoverTokens: 0, needsPublish: false }, adImageCount: 0, skippedNodes: [] });
    const line = welcomeBackLine(stops(), noImages);
    expect(line).not.toMatch(/complete/i);
    expect(line).toMatch(/ad images didn't come through/i);
  });

  it("every stop done, readiness not loaded yet ⇒ no completion claim", () => {
    const line = welcomeBackLine(stops(), null);
    expect(line).not.toMatch(/complete|ready to push/i);
  });

  it("the Trail builds its welcome line from readiness", () => {
    const trail = readFileSync(join(__dirname, "..", "client", "src", "v2", "V2Trail.tsx"), "utf8");
    expect(trail).toMatch(/welcomeBackBubble\(stops, trailReadiness\.data/);
    expect(trail).toMatch(/text: welcomeBackLine\(stops, readiness\)/);
    expect(trail).not.toMatch(/This campaign is complete\./);
  });
});

describe("blocker kinds", () => {
  it("each blocker carries the kind the welcome line reads", () => {
    expect(unpublished.blockers[0].kind).toBe("not_published");
    expect(partial.blockers[0].kind).toBe("not_built");
  });
});
