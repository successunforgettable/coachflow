/**
 * V2 shared constants — kept separate from component files
 * so Vite Fast Refresh works correctly (components must only
 * export React components as their default export).
 */

export type WizardStep =
  | "service"
  | "icp"
  | "offer"
  | "uniqueMethod"
  | "freeOptIn"
  | "headlines"
  | "adCopy"
  | "landingPage"
  | "emailSequence"
  | "whatsappSequence"
  | "pushToMeta";

export const STEP_LABELS: Record<WizardStep, string> = {
  service:           "Your Service",
  icp:               "Ideal Customer Profile",
  offer:             "Sales Offer",
  uniqueMethod:      "Unique Method",
  freeOptIn:         "Free Opt-In",
  headlines:         "Headlines",
  adCopy:            "Ad Copy",
  landingPage:       "Landing Page",
  emailSequence:     "Email Sequence",
  whatsappSequence:  "WhatsApp Sequence",
  pushToMeta:        "Push to Meta / GoHighLevel",
};

// Ordered step sequence for "Continue to Next Step" navigation
export const ORDERED_STEPS: WizardStep[] = [
  "service",
  "icp",
  "offer",
  "uniqueMethod",
  "freeOptIn",
  "headlines",
  "adCopy",
  "landingPage",
  "emailSequence",
  "whatsappSequence",
  "pushToMeta",
];

/**
 * Returns the next step after the given one, or null if it's the last step.
 */
export function getNextStep(step: WizardStep): WizardStep | null {
  const idx = ORDERED_STEPS.indexOf(step);
  return idx >= 0 && idx < ORDERED_STEPS.length - 1 ? ORDERED_STEPS[idx + 1] : null;
}

// Map from path node id to wizard step key
export const NODE_STEP_MAP: Record<string, WizardStep> = {
  service:           "service",
  icp:               "icp",
  offer:             "offer",
  uniqueMethod:      "uniqueMethod",
  freeOptIn:         "freeOptIn",
  headlines:         "headlines",
  adCopy:            "adCopy",
  landingPage:       "landingPage",
  emailSequence:     "emailSequence",
  whatsappSequence:  "whatsappSequence",
  pushToMeta:        "pushToMeta",
};
