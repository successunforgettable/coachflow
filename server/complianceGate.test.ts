import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  recordComplianceGate,
  complianceGateStats,
  __resetComplianceGateStats,
} from "./_core/complianceTelemetry";
import { checkOutput, COMPLIANCE_RETRY_MAX_ATTEMPTS } from "./_core/complianceAxis";
import { buildCoachCorpus, buildProofSupplied } from "./_core/groundingCorpus";

const service: any = { name: "Career pivot coaching", category: "coaching" };
const grounding = {
  corpus: buildCoachCorpus({ service, groundingMeta: null }),
  supplied: buildProofSupplied(service),
};
const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

describe("TWO SEPARATE GATES — an ad must pass compliance AND fabrication", () => {
  it("compliance runs FIRST and unconditionally, before fabrication", () => {
    const src = read("./_core/complianceAxis.ts");
    const cmpAt = src.indexOf("const cmp = checkComplianceAxis(fields)");
    const fabAt = src.indexOf("checkFabrication({");
    expect(cmpAt).toBeGreaterThan(-1);
    expect(fabAt).toBeGreaterThan(-1);
    expect(cmpAt).toBeLessThan(fabAt); // order is load-bearing, not incidental
  });

  it("compliance still runs when the coach's corpus is unavailable", () => {
    // Fabrication needs a corpus; compliance needs only the text and the field role. So compliance
    // has strictly broader coverage — it must not be skipped just because grounding is missing.
    const res = checkOutput(
      [{ location: "body", text: "Tired of your anxiety holding you back?", role: "body" as const }],
      undefined,
    );
    expect(res.blocking.length).toBeGreaterThan(0);
  });

  it("a policy violation blocks even when nothing is fabricated", () => {
    const res = checkOutput(
      [{ location: "body", text: "Tired of your anxiety holding you back?", role: "body" as const }],
      grounding,
    );
    expect(res.ok).toBe(false);
  });

  it("a fabrication blocks even when the copy is policy-clean", () => {
    const res = checkOutput(
      [{ location: "body", text: "94% of my clients land a role within 90 days.", role: "body" as const }],
      grounding,
    );
    expect(res.ok).toBe(false);
    expect(res.blocking.some((h) => String(h.classId).startsWith("invented"))).toBe(true);
  });

  it("clean copy passes both gates", () => {
    const res = checkOutput(
      [{ location: "body", text: "Most mid-career professionals put their own plans last.", role: "body" as const }],
      grounding,
    );
    expect(res.ok).toBe(true);
  });
});

describe("HARD-BLOCK + AUTO-REGENERATE, capped", () => {
  it("a failing variant is excluded from what the coach receives — the hard block", () => {
    const src = read("./adCopyGenerator.ts");
    // Only gate-passing rows reach keptInserts; a failing row is never pushed.
    expect(src).toMatch(/if \(res\.ok\) \{ keptInserts\.push\(row\); continue; \}/);
  });

  it("regeneration is capped by the SHARED constant, not a hardcoded round", () => {
    const src = read("./adCopyGenerator.ts");
    expect(src).toMatch(/COMPLIANCE_RETRY_MAX_ATTEMPTS: MAX_REGEN/);
    expect(src).toMatch(/attempt <= MAX_REGEN/);
    expect(COMPLIANCE_RETRY_MAX_ATTEMPTS).toBe(3);
  });

  it("every regenerated variant is RE-GATED — a redraft that still violates is discarded", () => {
    const src = read("./adCopyGenerator.ts");
    expect(src).toMatch(/const res = gateOne\(candidate\)/);
    expect(src).toMatch(/if \(res\.ok\) return \{ ok: true as const, candidate \}/);
  });

  it("a variant still failing at the cap is dropped, never kept", () => {
    const src = read("./adCopyGenerator.ts");
    // Only r.ok pushes into keptInserts inside the regeneration loop.
    expect(src).toMatch(/if \(r\.ok\) \{ keptInserts\.push\(r\.candidate\); recoveredCount\+\+; \}/);
  });

  it("graceful fallback: a wholly non-compliant deck surfaces a clear state, never an empty save", () => {
    const src = read("./adCopyGenerator.ts");
    expect(src).toMatch(/if \(keptInserts\.length === 0\)/);
    expect(src).toMatch(/Nothing was saved — regenerate/);
  });

  it("concepts use the same cap, and never persist a concept that failed the gate", () => {
    // SUPERSEDED 2026-08-04: this previously asserted an all-or-nothing throw. Behaviour changed
    // to partial delivery (clean concepts ship, failures are skipped and counted) — see the
    // PARTIAL DELIVERY block. The invariant that survives is the one that matters: the cap is
    // shared, and nothing that failed the gate is ever written.
    const src = read("./conceptGenerator.ts");
    expect(src).toMatch(/attempt <= COMPLIANCE_RETRY_MAX_ATTEMPTS/);
    expect(src).toMatch(/const survivors = concepts\.filter\(\(c, i\) => conceptPassesAlone\(c, i\)\)/);
    expect(src).toMatch(/concepts = survivors/);
  });
});

describe("BLOCK-RATE INSTRUMENTATION", () => {
  beforeEach(() => __resetComplianceGateStats());

  it("records the first-pass block rate", () => {
    recordComplianceGate({
      asset: "adCopy", generated: 10, blockedFirstPass: 4, recovered: 3, kept: 9, classes: ["negative_self_perception"],
    });
    const s = complianceGateStats("adCopy").adCopy;
    expect(s.generated).toBe(10);
    expect(s.blockedFirstPass).toBe(4);
    expect(s.blockRate).toBeCloseTo(0.4);
  });

  it("recoveries do NOT reduce the block rate — it measures PREVENTION, not the net result", () => {
    // A recovered variant still represents a draft the prompt should not have produced. If
    // recoveries reduced this number, a prompt that fails constantly would look healthy.
    recordComplianceGate({ asset: "adCopy", generated: 4, blockedFirstPass: 4, recovered: 4, kept: 4, classes: [] });
    expect(complianceGateStats("adCopy").adCopy.blockRate).toBe(1);
  });

  it("accumulates across batches so a trend is visible", () => {
    recordComplianceGate({ asset: "adCopy", generated: 10, blockedFirstPass: 0, recovered: 0, kept: 10, classes: [] });
    recordComplianceGate({ asset: "adCopy", generated: 10, blockedFirstPass: 6, recovered: 6, kept: 10, classes: [] });
    const s = complianceGateStats("adCopy").adCopy;
    expect(s.generated).toBe(20);
    expect(s.blockRate).toBeCloseTo(0.3);
    expect(s.batches).toBe(2);
  });

  it("breaks down by class and by label, so prevention can be targeted", () => {
    recordComplianceGate({
      asset: "adCopy", generated: 2, blockedFirstPass: 2, recovered: 0, kept: 0,
      classes: ["negative_self_perception", "promised_result"], labels: ["pain_agitation"],
    });
    const s = complianceGateStats("adCopy").adCopy;
    expect(s.byClass["negative_self_perception"]).toBe(1);
    expect(s.byLabel["pain_agitation"]).toBe(1);
  });

  it("emits ONE greppable line with a fixed prefix", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    recordComplianceGate({ asset: "adCopy", generated: 8, blockedFirstPass: 2, recovered: 2, kept: 8, classes: ["promised_result"] });
    const line = spy.mock.calls.map((c) => String(c[0])).find((l) => l.includes("[COMPLIANCE_GATE]"));
    spy.mockRestore();
    expect(line).toBeTruthy();
    expect(line).toContain("asset=adCopy");
    expect(line).toContain("blocked_first_pass=2");
    expect(line).toContain("block_rate=25.0%");
    expect(line).toContain("cumulative_block_rate=");
  });

  it("never throws — telemetry must not be able to break a generation", () => {
    expect(() => recordComplianceGate({} as any)).not.toThrow();
    expect(() => recordComplianceGate({ asset: "x", generated: 0, blockedFirstPass: 0, recovered: 0, kept: 0, classes: null as any })).not.toThrow();
  });

  it("is wired into all three live generators", () => {
    for (const f of ["./adCopyGenerator.ts", "./conceptGenerator.ts", "./conceptScriptGenerator.ts"]) {
      expect(read(f)).toMatch(/recordComplianceGate\(/);
    }
  });

  it("every generator records the FIRST-pass verdict, not the post-retry one", () => {
    // If a generator recorded the final verdict instead, a prompt that fails every time but always
    // recovers would report a 0% block rate — the opposite of the truth.
    for (const f of ["./conceptGenerator.ts", "./conceptScriptGenerator.ts"]) {
      expect(read(f)).toMatch(/const firstPassOk = result\.ok/);
      expect(read(f)).toMatch(/blockedFirstPass: firstPassOk \? 0 : /);
    }
    expect(read("./adCopyGenerator.ts")).toMatch(/const blockedFirstPass = allInserts\.length - keptInserts\.length/);
  });
});

describe("PARTIAL DELIVERY — clean concepts ship, failures are skipped and counted", () => {
  const read2 = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

  it("no longer throws away the whole set when one concept fails", () => {
    const src = read2("./conceptGenerator.ts");
    expect(src).toMatch(/PARTIAL DELIVERY/);
    expect(src).toMatch(/const survivors = concepts\.filter/);
  });

  it("re-checks each survivor through BOTH gates, not just compliance", () => {
    const src = read2("./conceptGenerator.ts");
    expect(src).toMatch(/screenConceptCompliance\(\[c\]\)/);      // compliance
    expect(src).toMatch(/requireGrounding: true/);                 // fabrication, fail-closed
  });

  it("still refuses to persist when NOTHING survives — no silent empty set", () => {
    const src = read2("./conceptGenerator.ts");
    expect(src).toMatch(/if \(survivors\.length === 0\)/);
    expect(src).toMatch(/throw new Error\(/);
  });

  it("returns the skipped count so a coach can be told plainly", () => {
    const src = read2("./conceptGenerator.ts");
    expect(src).toMatch(/skipped: skippedCount/);
    expect(src).toMatch(/export type ConceptGenerationResult/);
  });

  it("telemetry records the PARTIAL outcome, not the pre-skip count", () => {
    const src = read2("./conceptGenerator.ts");
    // kept must reflect survivors, otherwise the block rate would look clean on a partial set.
    expect(src).toMatch(/kept: concepts\.length/);
  });
});
