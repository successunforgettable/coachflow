import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GenerateICPStepProps {
  data: { serviceId?: number; icpId?: string };
  onComplete: (data: { icpId: string }) => void;
  onNext: () => void;
}

export default function GenerateICPStep({ data, onComplete, onNext }: GenerateICPStepProps) {
  const { toast } = useToast();
  const [generatedICP, setGeneratedICP] = useState<any>(null);

  const { data: service } = trpc.services.get.useQuery(
    { id: data.serviceId! },
    { enabled: !!data.serviceId }
  );

  const generateICP = trpc.icps.generate.useMutation({
    onSuccess: (result) => {
      setGeneratedICP(result);
      toast({ title: "ICP generated successfully!" });
      onComplete({ icpId: result.id.toString() });
    },
    onError: (error) => {
      toast({
        title: "Failed to generate ICP",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!data.serviceId || !service) return;
    generateICP.mutate({ serviceId: data.serviceId, name: service.name });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold mb-2">Generate Your Ideal Customer Profile</h3>
        <p className="text-muted-foreground">
          We'll use AI to create a detailed profile of your ideal customer based on your service.
        </p>
      </div>

      {service && (
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="font-semibold">Service: {service.name}</h4>
          <p className="text-sm text-muted-foreground">
            Target Customer: {service.targetCustomer}
          </p>
          <p className="text-sm text-muted-foreground">
            Main Benefit: {service.mainBenefit}
          </p>
        </div>
      )}

      {!generatedICP ? (
        <div className="space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-semibold mb-2">What we'll generate:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Demographics (age, income, location, education)</li>
                  <li>• Psychographics (values, goals, challenges)</li>
                  <li>• Behavioral patterns and buying triggers</li>
                  <li>• Communication preferences</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            className="w-full"
            disabled={generateICP.isPending || !data.serviceId}
          >
            {generateICP.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating ICP...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate ICP with AI
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
              ✓ ICP Generated Successfully!
            </h4>
            <p className="text-sm text-green-700 dark:text-green-300">
              Your ideal customer profile has been created. You can view and edit it later from the ICP page.
            </p>
          </div>

          <Button onClick={onNext} className="w-full">
            Continue to Headlines
          </Button>
        </div>
      )}
    </div>
  );
}
