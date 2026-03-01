import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import OnboardingWizard from "@/components/OnboardingWizard";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

/**
 * OnboardingPage — Item 2.0
 *
 * New users (onboardingStage === 0 or null) see the new 4-stage ZAP onboarding flow.
 * Returning users who somehow land here see the legacy wizard.
 * Completed users are redirected to /dashboard immediately.
 */
export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [isLegacyOpen, setIsLegacyOpen] = useState(true);

  const { data: onboardingStatus, isLoading } = trpc.onboarding.getStatus.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Redirect already-completed users
  useEffect(() => {
    if (onboardingStatus?.completed) {
      setLocation("/dashboard");
    }
  }, [onboardingStatus, setLocation]);

  function handleFlowComplete() {
    setLocation("/dashboard");
  }

  function handleLegacyClose() {
    setIsLegacyOpen(false);
    setLocation("/dashboard");
  }

  // Show loading spinner until status is known
  if (isLoading || !isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F5F1EA",
        }}
      >
        <div style={{ fontSize: "32px" }}>⚡</div>
      </div>
    );
  }

  // Already completed — redirect handled by useEffect above
  if (onboardingStatus?.completed) {
    return null;
  }

  // New user (stage 1 = default) → new 4-stage flow
  const onboardingStage = (onboardingStatus as any)?.onboardingStage ?? 1;
  if (onboardingStage === 1) {
    return <OnboardingFlow onComplete={handleFlowComplete} />;
  }

  // Returning user mid-onboarding → legacy wizard
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <OnboardingWizard open={isLegacyOpen} onClose={handleLegacyClose} />
    </div>
  );
}
