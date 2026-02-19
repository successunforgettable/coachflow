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
        <h3 className="text-2xl font-bold mb-2">Generate Marketing Headlines</h3>
        <p className="text-muted-foreground">
          We'll create attention-grabbing headlines using proven formulas (Eyebrow, Authority, Urgency, Story).
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
                  <li>• <strong>Eyebrow Headlines:</strong> Attention-grabbing openers</li>
                  <li>• <strong>Authority Headlines:</strong> Credibility-building statements</li>
                  <li>• <strong>Urgency Headlines:</strong> Time-sensitive offers</li>
                  <li>• <strong>Story Headlines:</strong> Narrative-driven hooks</li>
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
                Generating Headlines...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Headlines with AI
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
              ✓ Headlines Generated Successfully!
            </h4>
            <p className="text-sm text-green-700 dark:text-green-300">
              {generatedHeadlines.count} headlines created across 4 proven formulas. You can view and edit them later from the Headlines page.
            </p>
          </div>

          <Button onClick={onNext} className="w-full">
            Continue to Campaign
          </Button>
        </div>
      )}
    </div>
  );
}
