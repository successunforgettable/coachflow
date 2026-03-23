import { checkCompliance } from "./complianceChecker";

export type NodeType = "headlines" | "offers" | "heroMechanisms" | "hvco" | "adCopy" | "landingPages" | "emailSequences" | "whatsappSequences";

// Formula/angle priority weights per node (higher = better for high-ticket coaching)
const FORMULA_PRIORITIES: Record<string, Record<string, number>> = {
  headlines: { story: 1.0, direct_outcome: 0.9, eyebrow: 0.8, curiosity: 0.7, social_proof: 0.6 },
  offers: { godfather: 1.0, free: 0.7, dollar: 0.5 },
  landingPages: { original: 1.0, godfather: 0.9, free: 0.7, dollar: 0.5 },
  heroMechanisms: {},
  hvco: {},
  adCopy: {},
  emailSequences: {},
  whatsappSequences: {},
};

export async function scoreItem(opts: {
  content: string;
  nodeType: NodeType;
  formulaType?: string;
  charCount?: number;
  wordCount?: number;
}): Promise<number> {
  const { content, nodeType, formulaType, charCount, wordCount } = opts;

  // 1. Compliance score (40% weight)
  let complianceScore = 100;
  try {
    const result = await checkCompliance(content);
    complianceScore = result.score;
  } catch {
    complianceScore = 50; // fallback if checker fails
  }

  // 2. Formula priority (30% weight)
  let formulaPriority = 0.5; // neutral default
  if (formulaType && FORMULA_PRIORITIES[nodeType]) {
    const priorities = FORMULA_PRIORITIES[nodeType];
    formulaPriority = priorities[formulaType] ?? 0.5;
  }

  // 3. Format fit (30% weight)
  let formatFit = 0.5; // neutral default
  const chars = charCount ?? content.length;
  const words = wordCount ?? content.split(/\s+/).length;

  switch (nodeType) {
    case "headlines":
      // Under 40 chars = perfect, 40-60 = ok, over 60 = poor
      formatFit = chars <= 40 ? 1.0 : chars <= 60 ? 0.6 : 0.2;
      break;
    case "adCopy":
      // Under 125 words = perfect for Meta, 125-200 = ok, over 200 = poor
      formatFit = words <= 125 ? 1.0 : words <= 200 ? 0.6 : 0.3;
      break;
    case "offers":
    case "landingPages":
    case "heroMechanisms":
    case "hvco":
    case "emailSequences":
    case "whatsappSequences":
      // Content length — prefer substantial but not excessive
      formatFit = words >= 20 && words <= 500 ? 0.8 : 0.5;
      break;
  }

  // Weighted composite
  const score = (complianceScore / 100) * 0.4 + formulaPriority * 0.3 + formatFit * 0.3;

  // Return as 0-100
  return Math.round(score * 100);
}
