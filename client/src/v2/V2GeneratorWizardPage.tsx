/**
 * V2GeneratorWizardPage — Sprint 3
 *
 * Route wrapper for /v2-dashboard/wizard/:step
 * Reads the :step param from wouter and renders V2GeneratorWizard.
 * Zero backend changes. Isolated to /v2 routes.
 */
import { useParams, useLocation } from "wouter";
import V2GeneratorWizard, { WizardStep, STEP_LABELS } from "./V2GeneratorWizard";

// Re-export STEP_LABELS so App.tsx doesn't need to import from V2GeneratorWizard directly
export { STEP_LABELS };

const VALID_STEPS: WizardStep[] = [
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

export default function V2GeneratorWizardPage() {
  const params = useParams<{ step: string }>();
  const [, navigate] = useLocation();

  const step = params.step as WizardStep;

  // Guard: if step is not valid, redirect back to v2-dashboard
  if (!VALID_STEPS.includes(step)) {
    navigate("/v2-dashboard");
    return null;
  }

  return (
    <V2GeneratorWizard
      step={step}
      onBack={() => navigate("/v2-dashboard")}
    />
  );
}
