import { describe, it, expect } from "vitest";
import { buildConceptScriptPrompt, type ScriptConceptInput } from "./conceptScriptGenerator";

const concept: ScriptConceptInput = {
  personaLabel: "Mid-career professionals stuck in a misaligned job",
  desire: "stop dreading Sunday evenings",
  awareness: "problem_aware",
  hookPattern: "problem_first",
};

const cascade = "UPSTREAM CONTEXT — SELECTED ASSETS:\nOffer: The Career Pivot Intensive\nMechanism: Map-Bridge-Move\n\n";

describe("buildConceptScriptPrompt — per-concept, cascade-fed, length-capped", () => {
  it("writes to the concept's persona + desire (persona fixed to the concept)", () => {
    const p = buildConceptScriptPrompt(concept, cascade, 30);
    expect(p).toContain("Mid-career professionals stuck in a misaligned job");
    expect(p).toContain("stop dreading Sunday evenings");
  });

  it("drives the opening hook from the concept's hookPattern", () => {
    expect(buildConceptScriptPrompt(concept, cascade, 30)).toContain("problem_first");
  });

  it("feeds the cascade context (ad↔script↔page coherence by construction)", () => {
    expect(buildConceptScriptPrompt(concept, cascade, 30)).toContain("UPSTREAM CONTEXT — SELECTED ASSETS");
  });

  it("states the capped target length + a spoken word budget", () => {
    const p = buildConceptScriptPrompt(concept, cascade, 30);
    expect(p).toContain("30");
    expect(p.toLowerCase()).toContain("second");
  });

  it("specifies the human-presenter scene output fields", () => {
    const p = buildConceptScriptPrompt(concept, cascade, 30);
    expect(p).toContain("spokenLine");
    expect(p).toContain("onScreenText");
    expect(p).toContain("deliveryNote");
  });

  it("reuses the Meta-compliance craft block (real-urgency, no fabricated scarcity)", () => {
    const p = buildConceptScriptPrompt({ ...concept, hookPattern: "direct_offer_urgency", awareness: "most_aware" }, cascade, 15).toLowerCase();
    expect(p).toContain("compliance");
    expect(p).toMatch(/real|genuine/); // real/genuine deadline only
  });

  it("instructs SPOKEN register across the whole script (read-aloud, contractions, one idea per breath)", () => {
    const p = buildConceptScriptPrompt(concept, cascade, 30).toLowerCase();
    expect(p).toMatch(/read.*(aloud|out loud)|out loud/); // the read-aloud test
    expect(p).toContain("contraction"); // everyday contractions
    expect(p).toContain("breath"); // breath-length sentences / one idea per breath
    expect(p).toMatch(/every scene|whole script|not just the hook/); // applies beyond the hook
  });

  it("reframes the field label to spoken words written the way people talk", () => {
    expect(buildConceptScriptPrompt(concept, cascade, 30)).toContain("written the way people talk");
  });

  it("adds the TURN beat (Hook → Problem → Turn → Solution → CTA), framed as a new/different way", () => {
    const p = buildConceptScriptPrompt(concept, cascade, 30).toLowerCase();
    expect(p).toContain("turn");
    expect(p).toMatch(/new (way|opportunity)|different (way|approach)/);
  });

  it("carries the governing safety rule — no invented contact details (real or [INSERT_*] placeholder)", () => {
    const p = buildConceptScriptPrompt(concept, cascade, 30).toLowerCase();
    expect(p).toMatch(/invent.*(link|url|phone|email)|placeholder/);
  });

  it("adapts TONE by warmth — Hot (Most-Aware) leans urgent/FOMO, Cold (Problem-Aware) leans introduce/curiosity", () => {
    const hot = buildConceptScriptPrompt({ ...concept, awareness: "most_aware", hookPattern: "direct_offer_urgency" }, cascade, 15).toLowerCase();
    expect(hot).toMatch(/urgen|fomo|ready to (act|buy)/);
    const cold = buildConceptScriptPrompt({ ...concept, awareness: "problem_aware", hookPattern: "problem_first" }, cascade, 30).toLowerCase();
    expect(cold).toMatch(/introduc|curiosity|handshake/);
  });
});
