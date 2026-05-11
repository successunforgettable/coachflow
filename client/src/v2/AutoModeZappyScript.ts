/**
 * Auto Mode Phase B3 — Zappy script display strings + step→wizard-route map.
 *
 * Single source of truth for the strings is server-side (B2's
 * ORCHESTRATION_STEP_LABELS in server/_core/orchestration.ts). The server
 * writes them to jobs.progress.label as the orchestrator advances; B3's
 * progress UI reads them straight from the polled progress payload and
 * renders verbatim.
 *
 * This file holds only the FAILURE-PATH deep-link map (step name → wizard
 * route) which is client-side display logic, not server-side state.
 */
export type OrchestrationStepName =
  | "init"
  | "offer"
  | "mechanism"
  | "hvco"
  | "headlines"
  | "adCopy"
  | "landingPage"
  | "emailSequence"
  | "whatsappSequence"
  | "adCreatives"
  | "finalize";

/**
 * Step name → wizard route path.
 *
 * Two route names diverge from the server's step names:
 *   - hvco            → /v2-dashboard/wizard/freeOptIn (wizard step name)
 *   - whatsappSequence → /v2-dashboard/wizard/whatsappSequence (verbose, kept)
 *
 * `init` and `finalize` are wrapper steps with no wizard equivalent — failure
 * during these surfaces a generic dashboard fallback rather than a deep link.
 */
export const STEP_TO_WIZARD_ROUTE: Record<OrchestrationStepName, string | null> = {
  init: null,
  offer: "/v2-dashboard/wizard/offer",
  mechanism: "/v2-dashboard/wizard/uniqueMethod",
  hvco: "/v2-dashboard/wizard/freeOptIn",
  headlines: "/v2-dashboard/wizard/headlines",
  adCopy: "/v2-dashboard/wizard/adCopy",
  landingPage: "/v2-dashboard/wizard/landingPage",
  emailSequence: "/v2-dashboard/wizard/emailSequence",
  whatsappSequence: "/v2-dashboard/wizard/whatsappSequence",
  adCreatives: "/ad-creatives",
  finalize: null,
};

/**
 * Friendly display name for the failure CTA — "Continue from <X> →".
 * Mirrors the wizard's STEP_LABELS for consistency.
 */
export const STEP_DISPLAY_NAME: Record<OrchestrationStepName, string> = {
  init: "Setup",
  offer: "Offer",
  mechanism: "Unique Method",
  hvco: "Free Opt-In",
  headlines: "Headlines",
  adCopy: "Ad Copy",
  landingPage: "Landing Page",
  emailSequence: "Email Sequence",
  whatsappSequence: "WhatsApp Sequence",
  adCreatives: "Ad Creatives",
  finalize: "Finalisation",
};

/**
 * Parse the server-side error payload to extract the failed step name.
 * Server convention (per orchestration.ts catch block): error message
 * contains the runX function's exception text. The orchestrator does NOT
 * embed the step name in a structured way in v1 (locked retry-from-top),
 * so we infer from the progress.label that was last written before the
 * crash. Caller passes the last known step name from progress.step.
 */
export function getFailedStepNameFromProgressStep(progressStep: number | undefined): OrchestrationStepName | null {
  // Step indices 1-9 map to the 9 generation steps in order.
  // 0 = init (pre-step crash), 10 = finalize (post-step crash).
  // Phase C C1: adCreatives added as step 9 at end of cascade.
  const STEP_BY_INDEX: Record<number, OrchestrationStepName> = {
    1: "offer",
    2: "mechanism",
    3: "hvco",
    4: "headlines",
    5: "adCopy",
    6: "landingPage",
    7: "emailSequence",
    8: "whatsappSequence",
    9: "adCreatives",
  };
  if (progressStep === undefined) return null;
  return STEP_BY_INDEX[progressStep] ?? null;
}
