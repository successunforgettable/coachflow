import React, { createContext, useContext, useState, useCallback } from 'react';
import Joyride, { Step, CallBackProps, STATUS, EVENTS } from 'react-joyride';

interface TourContextType {
  startTour: (tourId: string) => void;
  stopTour: () => void;
  isTourActive: boolean;
  currentTourId: string | null;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within TourProvider');
  }
  return context;
};

interface TourProviderProps {
  children: React.ReactNode;
}

// Tour step configurations
const TOUR_STEPS: Record<string, Step[]> = {
  landing: [
    {
      target: 'body',
      content: 'Welcome to ZAP! Let me show you around. This quick tour will introduce you to the platform\'s key features.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="hero"]',
      content: 'Generate 300+ high-converting marketing assets in one afternoon with our AI-powered platform.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="features"]',
      content: '9 AI-powered content generators at your fingertips - from headlines to complete email sequences.',
      placement: 'top',
    },
    {
      target: '[data-tour="pricing"]',
      content: 'Start with a 7-day free trial. No credit card required. Upgrade anytime to unlock more features.',
      placement: 'top',
    },
    {
      target: '[data-tour="cta"]',
      content: 'Ready to get started? Click here to begin your free trial!',
      placement: 'bottom',
    },
  ],
  dashboard: [
    {
      target: 'body',
      content: 'Welcome to your ZAP dashboard! Let me show you the key features.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="generators-grid"]',
      content: 'These are your 9 AI generators. Each one creates specific types of marketing content.',
      placement: 'top',
    },
    {
      target: '[data-tour="quick-actions"]',
      content: 'Use these quick actions to jump into common tasks like creating a service or generating content.',
      placement: 'top',
    },
    {
      target: '[data-tour="sidebar"]',
      content: 'Navigate between different sections using this sidebar. Access your services, campaigns, and settings.',
      placement: 'right',
    },
    {
      target: '[data-tour="quota-display"]',
      content: 'Track your usage here. Pro and Agency plans get more generations per month.',
      placement: 'bottom',
    },
  ],
  headlines: [
    {
      target: 'body',
      content: 'Let\'s create some high-converting headlines! This generator uses 5 proven formulas.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="service-select"]',
      content: 'First, select a service. Your service details will auto-fill the form fields.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="power-mode"]',
      content: 'Power Mode (Pro/Agency only) generates 3x more variations in a single generation.',
      placement: 'left',
    },
    {
      target: '[data-tour="generate-button"]',
      content: 'Click here to generate 25 headlines across 5 proven formulas.',
      placement: 'top',
    },
  ],
  results: [
    {
      target: '[data-tour="results-tabs"]',
      content: 'Your headlines are organized by formula type. Each tab contains 5 variations.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="copy-button"]',
      content: 'Copy any headline with one click. Perfect for quick testing.',
      placement: 'left',
    },
    {
      target: '[data-tour="pdf-export"]',
      content: 'Export all headlines as a professional PDF for your records or client presentations.',
      placement: 'left',
    },
    {
      target: '[data-tour="regenerate"]',
      content: 'Need more variations? Click "+15 More Like This" to generate additional headlines.',
      placement: 'top',
    },
  ],
};

export const TourProvider: React.FC<TourProviderProps> = ({ children }) => {
  const [run, setRun] = useState(false);
  const [currentTourId, setCurrentTourId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);

  const startTour = useCallback((tourId: string) => {
    const tourSteps = TOUR_STEPS[tourId];
    if (!tourSteps) {
      console.warn(`Tour "${tourId}" not found`);
      return;
    }

    // Check if user has completed this tour before
    const completedTours = JSON.parse(localStorage.getItem('completedTours') || '[]');
    if (completedTours.includes(tourId)) {
      // Tour already completed, but allow restart
      console.log(`Restarting tour: ${tourId}`);
    }

    setSteps(tourSteps);
    setCurrentTourId(tourId);
    setRun(true);
  }, []);

  const stopTour = useCallback(() => {
    setRun(false);
    setCurrentTourId(null);
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type } = data;

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any)) {
      setRun(false);

      // Mark tour as completed
      if (currentTourId && status === STATUS.FINISHED) {
        const completedTours = JSON.parse(localStorage.getItem('completedTours') || '[]');
        if (!completedTours.includes(currentTourId)) {
          completedTours.push(currentTourId);
          localStorage.setItem('completedTours', JSON.stringify(completedTours));
        }
      }

      setCurrentTourId(null);
    }

    // Log events for analytics (optional)
    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      console.log('Tour event:', { type, status, currentTourId });
    }
  };

  return (
    <TourContext.Provider
      value={{
        startTour,
        stopTour,
        isTourActive: run,
        currentTourId,
      }}
    >
      <Joyride
        steps={steps}
        run={run}
        continuous
        showProgress
        showSkipButton
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: '#8b5cf6', // Purple theme
            textColor: '#ffffff',
            backgroundColor: '#1a1a1a',
            overlayColor: 'rgba(0, 0, 0, 0.7)',
            arrowColor: '#1a1a1a',
            zIndex: 10000,
          },
          tooltip: {
            borderRadius: '8px',
            padding: '20px',
          },
          tooltipContainer: {
            textAlign: 'left',
          },
          buttonNext: {
            backgroundColor: '#8b5cf6',
            borderRadius: '6px',
            padding: '8px 16px',
          },
          buttonBack: {
            color: '#9ca3af',
            marginRight: '10px',
          },
          buttonSkip: {
            color: '#9ca3af',
          },
        }}
        locale={{
          back: 'Previous',
          close: 'Close',
          last: 'Finish Tour',
          next: 'Next',
          skip: 'Skip Tour',
        }}
      />
      {children}
    </TourContext.Provider>
  );
};
