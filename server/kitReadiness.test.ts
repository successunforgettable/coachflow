import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  KIT_COMPLETION_FIELDS,
  isKitBuilt,
  computeKitReadiness,
  type KitReadinessInput,
} from "./_core/kitReadiness";

/**
 * HONEST COMPLETION (COMPLETION_AND_FIRST_DEPLOY_PROPOSAL_2026-09-24 Part 1; Arfeen decision 5, 2026-09-27).
 * One readiness answer, used by the server's two completion writers, the Trail's end beat and the kit page.
 */

const FULL_KIT = {
  selectedOfferId: 1,
  selectedMechanismId: 2,
  selectedHvcoId: 3,
  selectedHeadlineId: 4,
  selectedAdCopyId: 5,
  selectedLandingPageId: 6,
  selectedEmailSequenceId: 7,
  selectedWhatsAppSequenceId: 8,
  selectedAdCreativeBatchId: "batch-abc",
};

function input(over: Partial<KitReadinessInput> = {}): KitReadinessInput {
  return {
    kit: { ...FULL_KIT },
    hasService: true,
    landingPage: { publicUrl: "https://example.com/p/x", leftoverTokens: 0, needsPublish: false },
    adImageCount: 5,
    skippedNodes: [],
    ...over,
  };
}

describe("the one completeness rule — the 9 fields, ad images included", () => {
  it("names exactly the nine kit fields", () => {
    expect([...KIT_COMPLETION_FIELDS].sort()).toEqual(Object.keys(FULL_KIT).sort());
  });

  it("a kit with every field is built", () => {
    expect(isKitBuilt(FULL_KIT)).toBe(true);
  });

  for (const f of Object.keys(FULL_KIT)) {
    it(`a kit missing ${f} is NOT built`, () => {
      expect(isKitBuilt({ ...FULL_KIT, [f]: null })).toBe(false);
    });
  }

  it("an empty-string ad-image batch pointer is not an ad image", () => {
    expect(isKitBuilt({ ...FULL_KIT, selectedAdCreativeBatchId: "" })).toBe(false);
  });
});

describe("readiness — the negative control: a genuinely complete, published kit", () => {
  it("has no blockers and is ready to push", () => {
    const r = computeKitReadiness(input());
    expect(r.blockers).toEqual([]);
    expect(r.state).toBe("ready");
    expect(r.metaReady).toBe(true);
    expect(r.builtCount).toBe(9);
  });
});

describe("readiness — every blocker case is named, with a reason and an action", () => {
  const expectBlocker = (r: ReturnType<typeof computeKitReadiness>, node: string) => {
    const b = r.blockers.find((x) => x.node === node);
    expect(b, `expected a blocker for ${node}`).toBeTruthy();
    expect(b!.reason.length).toBeGreaterThan(10);
    expect(b!.action.length).toBeGreaterThan(5);
    return b!;
  };

  it("landing page built but not published ⇒ blocker, state built-with-blockers, Meta not ready", () => {
    const r = computeKitReadiness(input({ landingPage: { publicUrl: null, leftoverTokens: 0, needsPublish: true } }));
    const b = expectBlocker(r, "landingPage");
    expect(b.reason).toMatch(/hasn't been published/i);
    expect(r.state).toBe("built_with_blockers");
    expect(r.metaReady).toBe(false);
  });

  it("an unpublished page with leftover details says how many are missing", () => {
    const r = computeKitReadiness(input({ landingPage: { publicUrl: null, leftoverTokens: 2, needsPublish: true } }));
    const b = expectBlocker(r, "landingPage");
    expect(b.reason).toMatch(/2 details/);
  });

  it("needs_publish flagged even with a stale public URL still counts as not published", () => {
    const r = computeKitReadiness(input({ landingPage: { publicUrl: "https://x/p/old", leftoverTokens: 0, needsPublish: true } }));
    expectBlocker(r, "landingPage");
  });

  it("no ad images (pointer missing) ⇒ blocker naming Meta", () => {
    const r = computeKitReadiness(input({ kit: { ...FULL_KIT, selectedAdCreativeBatchId: null }, adImageCount: null }));
    const b = expectBlocker(r, "adCreatives");
    expect(b.reason).toMatch(/Meta/);
    expect(r.state).toBe("in_progress");
    expect(r.metaReady).toBe(false);
  });

  it("ad-image pointer set but the batch has no images ⇒ blocker", () => {
    const r = computeKitReadiness(input({ adImageCount: 0 }));
    expectBlocker(r, "adCreatives");
    expect(r.state).toBe("built_with_blockers");
  });

  it("no service behind the kit ⇒ blocker (the push window cannot open)", () => {
    const r = computeKitReadiness(input({ hasService: false }));
    expectBlocker(r, "service");
    expect(r.metaReady).toBe(false);
  });

  const NODE_OF: Record<string, string> = {
    selectedOfferId: "offer", selectedMechanismId: "uniqueMethod", selectedHvcoId: "freeOptIn",
    selectedHeadlineId: "headlines", selectedAdCopyId: "adCopy", selectedLandingPageId: "landingPage",
    selectedEmailSequenceId: "emailSequence", selectedWhatsAppSequenceId: "whatsappSequence",
  };
  for (const [field, node] of Object.entries(NODE_OF)) {
    it(`${node} not built ⇒ blocker, state in progress`, () => {
      const r = computeKitReadiness(input({ kit: { ...FULL_KIT, [field]: null },
        ...(field === "selectedLandingPageId" ? { landingPage: null } : {}) }));
      expectBlocker(r, node);
      expect(r.state).toBe("in_progress");
      expect(r.builtCount).toBe(8);
    });
  }

  it("a node the coach skipped says so, and says what it costs", () => {
    const r = computeKitReadiness(input({ kit: { ...FULL_KIT, selectedAdCopyId: null }, skippedNodes: ["adCopy"] }));
    const b = expectBlocker(r, "adCopy");
    expect(b.reason).toMatch(/skipped/i);
  });

  it("several blockers are all listed, in Trail order", () => {
    const r = computeKitReadiness(input({
      kit: { ...FULL_KIT, selectedOfferId: null, selectedAdCreativeBatchId: null },
      adImageCount: null,
      landingPage: { publicUrl: null, leftoverTokens: 0, needsPublish: true },
    }));
    expect(r.blockers.map((b) => b.node)).toEqual(["offer", "landingPage", "adCreatives"]);
  });

  it("no blocker text quotes a raw field name or placeholder token at the coach", () => {
    const r = computeKitReadiness(input({
      kit: Object.fromEntries(Object.keys(FULL_KIT).map((k) => [k, null])),
      hasService: false, landingPage: null, adImageCount: null,
    }));
    expect(r.blockers.length).toBe(10);
    for (const b of r.blockers) {
      expect(`${b.label} ${b.reason} ${b.action}`).not.toMatch(/selected[A-Z]|\[INSERT_|nodeType|needs_publish/);
    }
  });
});

describe("the two server writers share the rule (S1 autoSelectBest, S2 updateSelection)", () => {
  const src = readFileSync(join(__dirname, "routers", "campaignKits.ts"), "utf8");
  it("both call isKitBuilt, and neither carries its own field list any more", () => {
    expect((src.match(/isKitBuilt\(/g) ?? []).length).toBe(2);
    expect(src).not.toMatch(/updated\.selectedWhatsAppSequenceId != null/);
  });
});
