/**
 * Character limits for all generator text inputs
 * Based on Kong's exact character limits per field
 * 
 * 0 = No limit
 */

export const CHARACTER_LIMITS = {
  headlines: {
    targetMarket: 52,
    productService: 72,
    desiredOutcome: 25,
    pressingProblem: 48,
    uniqueMechanism: 0, // No limit - uses textarea
  },
  hvco: {
    title: 60,
    subtitle: 80,
    targetMarket: 52,
    productService: 72,
    desiredOutcome: 25,
  },
  heroMechanisms: {
    targetMarket: 52,
    productCategory: 79,
    specificProductName: 72,
    pressingProblem: 48,
    desiredOutcome: 25,
    uniqueMechanism: 0, // No limit
    listBenefits: 0, // No limit
    specificTechnology: 23,
    scientificStudies: 31,
    credibleAuthority: 70,
    featuredIn: 65,
  },
  adCopy: {
    targetMarket: 52,
    productCategory: 79,
    specificProductName: 72,
    pressingProblem: 48,
    desiredOutcome: 25,
    uniqueMechanism: 0, // No limit
    listBenefits: 0, // No limit
    specificTechnology: 23,
    scientificStudies: 31,
    credibleAuthority: 70,
    featuredIn: 65,
    testimonials: 511,
    specificPrice: 20,
    specificGuarantee: 67,
    specificBonus: 71,
    specificScarcity: 68,
    specificCTA: 50,
  },
  icp: {
    // ICP uses 17 sections, each with varying limits
    demographics: 0, // No limit
    psychographics: 0,
    painPoints: 0,
    goals: 0,
    challenges: 0,
    values: 0,
    behaviors: 0,
    mediaConsumption: 0,
    purchaseMotivations: 0,
    objections: 0,
    preferredChannels: 0,
    decisionMakingProcess: 0,
    influencers: 0,
    successMetrics: 0,
    customerJourney: 0,
    competitiveAlternatives: 0,
    uniqueValueProposition: 0,
  },
  emailSequences: {
    targetMarket: 52,
    productService: 72,
    desiredOutcome: 25,
    sequenceType: 0, // Dropdown
    tone: 0, // Dropdown
  },
  whatsappSequences: {
    targetMarket: 52,
    productService: 72,
    desiredOutcome: 25,
    sequenceType: 0, // Dropdown
    tone: 0, // Dropdown
  },
  landingPages: {
    targetMarket: 52,
    productService: 72,
    desiredOutcome: 25,
    uniqueMechanism: 0, // No limit
    price: 20,
    guarantee: 67,
  },
  offers: {
    targetMarket: 52,
    productService: 72,
    desiredOutcome: 25,
    price: 20,
    guarantee: 67,
    bonus: 71,
    scarcity: 68,
  },
};
