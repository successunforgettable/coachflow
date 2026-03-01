import { useState } from "react";
import { Stage1Questions } from "./Stage1Questions";
import { Stage2Video } from "./Stage2Video";
import { Stage3InstantWin } from "./Stage3InstantWin";
import { Stage4Streak } from "./Stage4Streak";

type CampaignType = "webinar" | "challenge" | "course_launch" | "product_launch";

interface FlowState {
  stage: 1 | 2 | 3 | 4;
  programName: string;
  campaignType: CampaignType | null;
  serviceId: number | null;
  campaignId: number | null;
  generatedHeadline: string | null;
}

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [state, setState] = useState<FlowState>({
    stage: 1,
    programName: "",
    campaignType: null,
    serviceId: null,
    campaignId: null,
    generatedHeadline: null,
  });

  function handleStage1Complete(data: {
    programName: string;
    campaignType: CampaignType;
    serviceId: number;
    campaignId: number;
  }) {
    setState((s) => ({
      ...s,
      stage: 2,
      programName: data.programName,
      campaignType: data.campaignType,
      serviceId: data.serviceId,
      campaignId: data.campaignId,
    }));
  }

  function handleStage2Complete(generatedHeadline: string | null) {
    setState((s) => ({ ...s, stage: 3, generatedHeadline }));
  }

  function handleStage3Complete() {
    setState((s) => ({ ...s, stage: 4 }));
  }

  function handleStage4Complete() {
    onComplete();
  }

  // Wrap each stage in the .zap-onboarding design system scope
  return (
    <div className="zap-onboarding">
      {state.stage === 1 && <Stage1Questions onComplete={handleStage1Complete} />}

      {state.stage === 2 && state.serviceId && state.campaignId && (
        <Stage2Video
          programName={state.programName}
          serviceId={state.serviceId}
          campaignId={state.campaignId}
          onComplete={handleStage2Complete}
        />
      )}

      {state.stage === 3 && (
        <Stage3InstantWin
          programName={state.programName}
          campaignType={state.campaignType || "webinar"}
          generatedHeadline={state.generatedHeadline}
          onComplete={handleStage3Complete}
        />
      )}

      {state.stage === 4 && (
        <Stage4Streak
          programName={state.programName}
          campaignId={state.campaignId}
          campaignType={state.campaignType || "webinar"}
          onComplete={handleStage4Complete}
        />
      )}
    </div>
  );
}
