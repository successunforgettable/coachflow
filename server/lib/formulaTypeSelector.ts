/**
 * Deterministic formula type selector for headlines.
 * Uses offer angle, ICP pain points, and coach background to infer the best headline formula.
 */

const EMOTIONAL_KEYWORDS = ["identity", "relationship", "self-worth", "confidence", "purpose", "meaning", "fulfillment", "self-esteem", "loneliness", "disconnected", "lost", "stuck", "empty"];
const PRACTICAL_KEYWORDS = ["revenue", "clients", "money", "systems", "time", "leads", "sales", "profit", "income", "scaling", "growth", "business"];
const CREDENTIAL_KEYWORDS = ["certified", "phd", "doctor", "professor", "award", "accredited", "licensed", "diploma", "degree", "qualification"];

export interface FormulaRecommendation {
  formulaType: string;
  userFacingLabel: string;
}

export function selectFormulaType(opts: {
  offerAngle?: string | null;
  icpPainPoints?: string | null;
  coachBackground?: string | null;
}): FormulaRecommendation {
  const { offerAngle, icpPainPoints, coachBackground } = opts;
  const painLower = (icpPainPoints || "").toLowerCase();
  const bgLower = (coachBackground || "").toLowerCase();

  // Rule 1: Emotional ICP → Story
  if (EMOTIONAL_KEYWORDS.some(kw => painLower.includes(kw))) {
    return { formulaType: "story", userFacingLabel: "Tell Your Story" };
  }

  // Rule 2: Godfather offer → Story
  if (offerAngle === "godfather") {
    return { formulaType: "story", userFacingLabel: "Tell Your Story" };
  }

  // Rule 3: Free offer → Question
  if (offerAngle === "free") {
    return { formulaType: "question", userFacingLabel: "Ask Their Question" };
  }

  // Rule 4: Dollar offer → Urgency
  if (offerAngle === "dollar") {
    return { formulaType: "urgency", userFacingLabel: "Create Urgency" };
  }

  // Rule 5: Coach has credentials → Authority
  if (CREDENTIAL_KEYWORDS.some(kw => bgLower.includes(kw))) {
    return { formulaType: "authority", userFacingLabel: "Lead with Credentials" };
  }

  // Rule 6: Practical ICP → Eyebrow
  if (PRACTICAL_KEYWORDS.some(kw => painLower.includes(kw))) {
    return { formulaType: "eyebrow", userFacingLabel: "Make a Bold Claim" };
  }

  // Default: Story
  return { formulaType: "story", userFacingLabel: "Tell Your Story" };
}
