/**
 * V2GeneratorWizardPage — Sprint 3
 *
 * Route wrapper for /v2-dashboard/wizard/:step
 * Reads the :step param from wouter and renders V2GeneratorWizard.
 * Zero backend changes. Isolated to /v2 routes.
 */
import { useParams, useLocation } from "wouter";
import V2GeneratorWizard from "./V2GeneratorWizard";
import { type WizardStep, STEP_LABELS } from "./v2-constants";
import { trpc } from "@/lib/trpc";

// Re-export STEP_LABELS for convenience
export { STEP_LABELS };

const VALID_STEPS: WizardStep[] = [
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

export default function V2GeneratorWizardPage() {
  const params = useParams<{ step: string }>();
  const [, navigate] = useLocation();

  // Fetch services so we can pass serviceId down to the wizard.
  // Must be called unconditionally (before any early returns) to satisfy React hook rules.
  const { data: servicesData } = trpc.services.list.useQuery();
  const serviceId = servicesData?.[0]?.id;

  const step = params.step as WizardStep;

  // Guard: if step is not valid, redirect back to v2-dashboard
  if (!VALID_STEPS.includes(step)) {
    navigate("/v2-dashboard");
    return null;
  }

  return (
    <V2GeneratorWizard
      step={step}
      serviceId={serviceId}
      onBack={() => navigate("/v2-dashboard")}
    />
  );
}
