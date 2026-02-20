import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

interface OnboardingProgressTrackerProps {
  className?: string;
}

export default function OnboardingProgressTracker({ className }: OnboardingProgressTrackerProps) {
  const [, setLocation] = useLocation();
  
  // Fetch real progress data
  const { data: progressData, isLoading } = trpc.progress.getProgress.useQuery();

  // Don't render if loading or not visible (past 30 days)
  if (isLoading || !progressData?.visible) {
    return null;
  }

  const { progress, milestones } = progressData;

  const getLabel = () => {
    if (progress === 0) return "GET STARTED";
    if (progress === 100) return "CAMPAIGN READY ✓";
    return "YOUR PROGRESS";
  };

  const getMotivationalText = () => {
    if (progress === 30) return "Great start! Keep building.";
    if (progress === 50) return "You're halfway to a complete campaign";
    if (progress === 80) return "Almost there! One more step.";
    return null;
  };

  const getButtonText = () => {
    if (progress === 0) return "Finish Setup →";
    if (progress === 30) return "Continue Building →";
    if (progress === 50) return "One step away →";
    if (progress === 80) return "Complete your campaign →";
    if (progress === 100) return "View Campaign →";
    return "Continue →";
  };

  const getButtonRoute = () => {
    // Find first incomplete milestone
    const nextMilestone = milestones.find(m => !m.completed);
    if (nextMilestone) return nextMilestone.route;
    
    // All complete - go to campaigns
    if (progress === 100) return "/campaigns";
    
    // Fallback
    return "/dashboard";
  };

  const handleButtonClick = () => {
    const route = getButtonRoute();
    setLocation(route);
  };

  return (
    <div className={cn("bg-purple-500/10 border border-purple-500/20 rounded-lg p-3.5 my-4", className)}>
      {/* Label */}
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
        {getLabel()}
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-border rounded-full mb-3 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-500" 
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Motivational Text */}
      {getMotivationalText() && (
        <div className="text-xs text-muted-foreground mb-3">
          {getMotivationalText()}
        </div>
      )}

      {/* Milestone Checklist */}
      {progress > 0 && progress < 100 && (
        <div className="space-y-1 mb-3">
          {milestones.map((milestone) => (
            <div
              key={milestone.id}
              className={cn(
                "text-xs flex items-center",
                milestone.completed ? "text-green-500" : "text-muted-foreground"
              )}
            >
              <span className="mr-1.5">
                {milestone.completed ? "✓" : "○"}
              </span>
              {milestone.label}
            </div>
          ))}
        </div>
      )}

      {/* Special message for 0% state */}
      {progress === 0 && (
        <div className="text-xs text-muted-foreground mb-3">
          Complete setup to unlock your marketing machine
        </div>
      )}

      {/* Special message for 100% state */}
      {progress === 100 && (
        <div className="text-xs text-muted-foreground mb-3">
          Your first campaign is fully built.
        </div>
      )}

      {/* CTA Button */}
      <Button
        className="w-full mt-3 bg-gradient-to-br from-purple-600 to-purple-400 hover:shadow-[0_0_16px_rgba(139,92,246,0.4)] transition-all"
        size="sm"
        onClick={handleButtonClick}
      >
        {getButtonText()}
      </Button>
    </div>
  );
}
