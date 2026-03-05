/**
 * V2 shared constants — kept separate from component files
 * so Vite Fast Refresh works correctly (components must only
 * export React components as their default export).
 */

export type WizardStep =
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

// Map from path node id to wizard step key
export const NODE_STEP_MAP: Record<string, WizardStep> = {
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
