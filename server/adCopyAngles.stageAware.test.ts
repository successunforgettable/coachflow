import { describe, it, expect } from "vitest";
import {
  ALL_BODY_ANGLES,
  PROOF_DEPENDENT_ANGLES,
  ANGLE_AWARENESS_MAP,
  STAGE_COPY_GUIDANCE,
  angleForStage,
  type BodyAngle,
} from "./adCopyAngles";
import { AWARENESS_STAGES, awarenessPlanForCount } from "./_core/conceptAxis";

const withProof = [...ALL_BODY_ANGLES];
const beginner = ALL_BODY_ANGLES.filter((a) => !PROOF_DEPENDENT_ANGLES.includes(a));

/** Mirrors the selection loop in adCopyGenerator, so the test exercises the real shape. */
function select(available: BodyAngle[], slotCount: number) {
  const plan = awarenessPlanForCount(slotCount);
  const used = new Set<BodyAngle>();
  const slots: Array<{ angle: BodyAngle; stage: string }> = [];
  for (const stage of plan) {
    const mapped = angleForStage(stage, available, used);
    const angle = mapped ?? available.find((a) => !used.has(a));
    if (!angle) break;
    used.add(angle);
    slots.push({ angle, stage });
  }
  return slots;
}

describe("ANGLE_AWARENESS_MAP — every stage maps to real angles", () => {
  it("covers all 5 stages with angles that exist in the 18", () => {
    for (const stage of AWARENESS_STAGES) {
      const m = ANGLE_AWARENESS_MAP[stage];
      expect(ALL_BODY_ANGLES).toContain(m.primary);
      for (const s of m.secondary) expect(ALL_BODY_ANGLES).toContain(s);
    }
  });

  it("gives every stage a copy-guidance block naming its stage", () => {
    for (const stage of AWARENESS_STAGES) {
      expect(STAGE_COPY_GUIDANCE[stage]).toBeTruthy();
      expect(STAGE_COPY_GUIDANCE[stage]).toContain("AWARENESS STAGE");
    }
  });

  it("keeps the guidance positive-framed (CLAUDE.md §14 — naming a failure primes it)", () => {
    // A negative directive in an LLM prompt primes the shape it forbids; this is the mechanism
    // behind the Sprint B email regression. Guidance must say what the copy IS.
    for (const stage of AWARENESS_STAGES) {
      expect(STAGE_COPY_GUIDANCE[stage]).not.toMatch(/\b(never|do not|don't|avoid)\b/i);
    }
  });
});

describe("angleForStage — proof-dependency fall-through", () => {
  it("gives a coach with proof the research primary for product_aware", () => {
    expect(angleForStage("product_aware", withProof)).toBe("social_proof");
  });

  it("falls a launch-stage coach through to a non-proof angle for product_aware", () => {
    // social_proof AND data_driven are both proof-dependent, so the mapped fall-through must
    // reach `guarantee` rather than dropping the slot.
    const a = angleForStage("product_aware", beginner);
    expect(a).toBe("guarantee");
    expect(PROOF_DEPENDENT_ANGLES).not.toContain(a!);
  });

  it("never returns a proof-dependent angle to a coach without proof, at any stage", () => {
    for (const stage of AWARENESS_STAGES) {
      const a = angleForStage(stage, beginner);
      if (a) expect(PROOF_DEPENDENT_ANGLES).not.toContain(a);
    }
  });

  it("avoids reusing an angle while a fresh mapped one remains", () => {
    const taken = new Set<BodyAngle>(["curiosity"]);
    expect(angleForStage("unaware", withProof, taken)).toBe("story");
  });
});

describe("stage-aware selection — the live deck shape", () => {
  it("gives the 3-slot cold deck Unaware + Problem-Aware + a warmer stage", () => {
    // The regression this fixes: the old slice(0,3) gave a coach WITH testimonials
    // pain_agitation + social_proof + authority — two of three aimed at Product-Aware readers
    // on cold traffic, and zero Unaware.
    for (const available of [withProof, beginner]) {
      const stages = select(available, 3).map((s) => s.stage);
      expect(stages).toContain("unaware");
      expect(stages).toContain("problem_aware");
      // The warmer tail is "a vital safeguard against Entity-ID pigeonholing"
      // (prospecting-research §3) — it must survive at the short deck size.
      expect(stages.some((s) => s === "solution_aware" || s === "product_aware")).toBe(true);
    }
  });

  it("never allocates most_aware to a cold deck", () => {
    for (const n of [3, 8, 16, 18]) {
      expect(select(withProof, n).map((s) => s.stage)).not.toContain("most_aware");
    }
  });

  it("preserves deck size exactly — no coach gets more or fewer ads than before", () => {
    expect(select(withProof, 3)).toHaveLength(3);
    expect(select(beginner, 3)).toHaveLength(3);
    expect(select(withProof, withProof.length)).toHaveLength(withProof.length);
    expect(select(beginner, beginner.length)).toHaveLength(beginner.length);
  });

  it("issues no duplicate angles within a deck", () => {
    for (const available of [withProof, beginner]) {
      const angles = select(available, available.length).map((s) => s.angle);
      expect(new Set(angles).size).toBe(angles.length);
    }
  });
});
