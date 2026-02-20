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
        <h3 className="text-2xl font-bold mb-2">Who is the person whose life you change?</h3>
        <p className="text-muted-foreground">
          We're not building a demographic spreadsheet. We're building a complete human — their fears, desires, objections, and the exact words that make them say yes.
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
                  <li>🧠 Deep psychology — what keeps them up at 3am</li>
                  <li>💬 Their exact language — words they use to describe their problem</li>
                  <li>🎯 Their buying triggers — what makes them finally take action</li>
                  <li>🚫 Their objections — what stops them from saying yes</li>
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
                Building Your Dream Buyer...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate My Dream Buyer →
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
              ✓ Your dream buyer is ready.
            </h4>
            <p className="text-sm text-green-700 dark:text-green-300">
              Every piece of copy CoachFlow generates from here will speak directly to this person.
            </p>
          </div>

          <Button onClick={onNext} className="w-full">
            Continue to Headlines →
          </Button>
        </div>
      )}
    </div>
  );
}
