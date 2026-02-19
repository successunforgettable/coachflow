import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import OnboardingWizard from "@/components/OnboardingWizard";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

/**
 * OnboardingPage - Wrapper component for the onboarding wizard
 * 
 * This page manages the modal state and handles completion/skip logic.
 * It automatically opens the wizard for new users who haven't completed onboarding.
 */
export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(true);

  const { data: onboardingStatus } = trpc.onboarding.getStatus.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // If user has already completed onboarding, redirect to dashboard
  useEffect(() => {
    if (onboardingStatus?.completed) {
      setLocation("/dashboard");
    }
  }, [onboardingStatus, setLocation]);

  const handleClose = () => {
    setIsOpen(false);
    // Redirect to dashboard when wizard is closed
    setLocation("/dashboard");
  };

  // Don't render anything if onboarding is already completed
  if (onboardingStatus?.completed) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <OnboardingWizard open={isOpen} onClose={handleClose} />
    </div>
  );
}
