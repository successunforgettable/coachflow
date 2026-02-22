import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Import wizard steps
import WelcomeStep from "./onboarding/WelcomeStep";
import CreateServiceStep from "./onboarding/CreateServiceStep";
import GenerateICPStep from "./onboarding/GenerateICPStep";
import GenerateOfferStep from "./onboarding/GenerateOfferStep";
import GenerateHeadlinesStep from "./onboarding/GenerateHeadlinesStep";
import CreateCampaignStep from "./onboarding/CreateCampaignStep";
import SkipConfirmationDialog from "./onboarding/SkipConfirmationDialog";
import { useToast } from "@/hooks/use-toast";

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  { id: 1, title: "Welcome", component: WelcomeStep },
  { id: 2, title: "Define Service", component: CreateServiceStep },
  { id: 3, title: "Create ICP", component: GenerateICPStep },
  { id: 4, title: "Craft Offer", component: GenerateOfferStep },
  { id: 5, title: "Generate Headlines", component: GenerateHeadlinesStep },
  { id: 6, title: "Create Campaign", component: CreateCampaignStep },
];

export default function OnboardingWizard({ open, onClose }: OnboardingWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [onboardingData, setOnboardingData] = useState<{
    serviceId?: number;
    icpId?: string;
    offerId?: number;
    headlineSetId?: string;
    campaignId?: number;
  }>({});

  // Fetch onboarding status
  const { data: status } = trpc.onboarding.getStatus.useQuery(undefined, {
    enabled: open,
  });

  // Update step mutation
  const updateStep = trpc.onboarding.updateStep.useMutation();

  // Complete onboarding mutation
  const completeOnboarding = trpc.onboarding.complete.useMutation({
    onSuccess: () => {
      onClose();
    },
  });

  // Load saved progress
  useEffect(() => {
    if (status && !status.completed) {
      setCurrentStep(status.currentStep);
      setOnboardingData({
        serviceId: status.serviceId || undefined,
        icpId: status.icpId || undefined,
        offerId: status.offerId || undefined,
        headlineSetId: status.headlineSetId || undefined,
        campaignId: status.campaignId || undefined,
      });
    }
  }, [status]);

  const handleNext = async () => {
    if (currentStep < STEPS.length) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      await updateStep.mutateAsync({ step: nextStep, data: onboardingData });
    } else {
      // Complete onboarding
      await completeOnboarding.mutateAsync(onboardingData);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkipClick = () => {
    setSkipDialogOpen(true);
  };

  const handleConfirmSkip = async () => {
    setSkipDialogOpen(false);
    await completeOnboarding.mutateAsync({ ...onboardingData, skipped: true });
    toast({
      title: "Got it. Your generators are ready whenever you are.",
      description: "We'd recommend starting with the Ideal Customer Profile — everything else builds from there.",
    });
  };

  const handleStepComplete = (data: Partial<typeof onboardingData>) => {
    setOnboardingData((prev) => ({ ...prev, ...data }));
  };

  const CurrentStepComponent = STEPS[currentStep - 1].component;
  const progress = (currentStep / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">Welcome to ZAP</h2>
              <p className="text-muted-foreground">
                Let's get you started with your first marketing campaign
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSkipClick}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].title}
              </span>
              <span className="text-muted-foreground">{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-between mt-4">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors",
                    currentStep > step.id
                      ? "bg-primary border-primary text-primary-foreground"
                      : currentStep === step.id
                      ? "border-primary text-primary"
                      : "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {currentStep > step.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-medium">{step.id}</span>
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-12 mx-2 transition-colors",
                      currentStep > step.id ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="p-6">
          <CurrentStepComponent
            data={onboardingData}
            onComplete={handleStepComplete}
            onNext={handleNext}
          />
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t p-6 flex items-center justify-between">
          <Button variant="ghost" onClick={handleSkipClick}>
            Skip onboarding
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleNext}>
              {currentStep === STEPS.length ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Complete
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      <SkipConfirmationDialog
        open={skipDialogOpen}
        onOpenChange={setSkipDialogOpen}
        onConfirmSkip={handleConfirmSkip}
      />
    </Dialog>
  );
}
