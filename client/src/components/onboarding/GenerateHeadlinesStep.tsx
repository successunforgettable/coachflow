import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GenerateHeadlinesStepProps {
  data: { serviceId?: number; headlineSetId?: string };
  onComplete: (data: { headlineSetId: string }) => void;
  onNext: () => void;
}

export default function GenerateHeadlinesStep({ data, onComplete, onNext }: GenerateHeadlinesStepProps) {
  const { toast } = useToast();
  const [generatedHeadlines, setGeneratedHeadlines] = useState<any>(null);

  const { data: service } = trpc.services.get.useQuery(
    { id: data.serviceId! },
    { enabled: !!data.serviceId }
  );

  const generateHeadlines = trpc.headlines.generate.useMutation({
    onSuccess: (result) => {
      setGeneratedHeadlines(result);
      toast({ title: "Headlines generated successfully!" });
      onComplete({ headlineSetId: result.headlineSetId });
    },
    onError: (error) => {
      toast({
        title: "Failed to generate headlines",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!data.serviceId || !service) return;
    generateHeadlines.mutate({
      serviceId: data.serviceId,
      targetMarket: service.targetCustomer,
      pressingProblem: `Struggling with ${service.mainBenefit.toLowerCase()}`,
      desiredOutcome: service.mainBenefit,
      uniqueMechanism: service.description,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold mb-2">25 headlines. 4 proven formulas. Zero blank page.</h3>
        <p className="text-muted-foreground">
          These aren't generic templates. These are headlines built specifically for your offer, targeting your dream buyer, powered by the same frameworks used by the world's top direct response marketers.
        </p>
      </div>

      {service && (
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="font-semibold">Service: {service.name}</h4>
          <p className="text-sm text-muted-foreground">
            Target: {service.targetCustomer}
          </p>
          <p className="text-sm text-muted-foreground">
            Benefit: {service.mainBenefit}
          </p>
        </div>
      )}

      {!generatedHeadlines ? (
        <div className="space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-semibold mb-2">What we'll generate:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>👁️ <strong>Eyebrow Headlines</strong> — Stop the scroll instantly</li>
                  <li>🏆 <strong>Authority Headlines</strong> — Build credibility before they read another word</li>
                  <li>⏰ <strong>Urgency Headlines</strong> — Make waiting feel costly</li>
                  <li>📖 <strong>Story Headlines</strong> — Pull them in with narrative</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            className="w-full"
            disabled={generateHeadlines.isPending || !data.serviceId || !service}
          >
            {generateHeadlines.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Your Headlines...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate My Headlines →
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
              ✓ {generatedHeadlines.count} headlines created across 4 proven formulas.
            </h4>
            <p className="text-sm text-green-700 dark:text-green-300">
              These are yours — use them on ads, landing pages, emails, social media. Anywhere attention matters.
            </p>
          </div>

          <Button onClick={onNext} className="w-full">
            Continue to Campaign →
          </Button>
        </div>
      )}
    </div>
  );
}
