import { useState } from 'react';
import { X, ArrowRight, Sparkles } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';

export function PostOnboardingWelcomeBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const dismissBanner = trpc.user.dismissWelcomeBanner.useMutation({
    onSuccess: () => {
      setIsVisible(false);
      toast({
        title: "Got it!",
        description: "You can always access generators from the sidebar.",
      });
      utils.user.getPreferences.invalidate();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDismiss = () => {
    dismissBanner.mutate();
  };

  if (!isVisible) return null;

  return (
    <div className="relative bg-gradient-to-r from-purple-900/20 to-purple-800/20 border border-purple-500/30 rounded-lg p-6 mb-6">
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-1 hover:bg-purple-500/20 rounded transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="w-5 h-5 text-gray-400 hover:text-white" />
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 bg-purple-500/20 rounded-lg">
          <Sparkles className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white mb-1">
            🎉 Setup Complete! Here's Your Recommended Workflow
          </h3>
          <p className="text-sm text-gray-400">
            Follow this proven sequence to create your first complete campaign in under 30 minutes
          </p>
        </div>
      </div>

      {/* Workflow Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {/* Step 1 */}
        <div className="flex items-start gap-3 p-4 bg-[#1E1E1E] border border-purple-500/20 rounded-lg hover:border-purple-500/40 transition-colors">
          <div className="flex-shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
            1
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-white mb-1">Your Ads Generator</h4>
            <p className="text-sm text-gray-400 mb-2">
              Generate 25+ headlines and body copy variations using proven formulas
            </p>
            <a
              href="/ad-copy"
              className="inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Start here <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex items-start gap-3 p-4 bg-[#1E1E1E] border border-purple-500/20 rounded-lg hover:border-purple-500/40 transition-colors">
          <div className="flex-shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
            2
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-white mb-1">Landing Pages</h4>
            <p className="text-sm text-gray-400 mb-2">
              Create high-converting sales pages with multiple angles
            </p>
            <a
              href="/landing-pages"
              className="inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Then this <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex items-start gap-3 p-4 bg-[#1E1E1E] border border-purple-500/20 rounded-lg hover:border-purple-500/40 transition-colors">
          <div className="flex-shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
            3
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-white mb-1">Email Sequences</h4>
            <p className="text-sm text-gray-400 mb-2">
              Build automated follow-up sequences using Russell Brunson's framework
            </p>
            <a
              href="/email-sequences"
              className="inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Finish with this <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Footer tip */}
      <div className="mt-4 pt-4 border-t border-purple-500/20">
        <p className="text-sm text-gray-400">
          💡 <span className="font-semibold text-gray-300">Pro tip:</span> Complete all three steps to unlock your first complete campaign. 
          Your progress tracker (sidebar) will guide you through each milestone.
        </p>
      </div>
    </div>
  );
}
