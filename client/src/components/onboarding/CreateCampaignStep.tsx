import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PartyPopper } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreateCampaignStepProps {
  data: { serviceId?: number; icpId?: string; headlineSetId?: string; campaignId?: number };
  onComplete: (data: { campaignId: number }) => void;
  onNext: () => void;
}

export default function CreateCampaignStep({ data, onComplete, onNext }: CreateCampaignStepProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const { data: service } = trpc.services.get.useQuery(
    { id: data.serviceId! },
    { enabled: !!data.serviceId }
  );

  const createCampaign = trpc.campaigns.create.useMutation({
    onSuccess: (result) => {
      toast({ title: "Campaign created successfully!" });
      onComplete({ campaignId: result.id });
      // Don't call onNext here - this is the final step
    },
    onError: (error) => {
      toast({
        title: "Failed to create campaign",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.serviceId) return;
    createCampaign.mutate({
      ...formData,
      serviceId: data.serviceId,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold mb-2">Look what we built together.</h3>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <div className="space-y-2 text-sm">
          {data.serviceId && (
            <div className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✅</span>
              <div>
                <span className="font-semibold">Your Service</span> — {service?.name || 'Defined'} is defined and ready to power every generator
              </div>
            </div>
          )}
          {data.icpId && (
            <div className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✅</span>
              <div>
                <span className="font-semibold">Your Ideal Customer</span> — Built with full psychology and buying triggers
              </div>
            </div>
          )}
          {data.headlineSetId && (
            <div className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✅</span>
              <div>
                <span className="font-semibold">25+ Headlines</span> — Across 4 proven formulas, ready to deploy
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-muted-foreground text-center">
        Now let's give this campaign a name so you can find it later.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">
            Campaign Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="e.g., Q1 2026 Product Launch"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">
            Campaign Description
          </Label>
          <Textarea
            id="description"
            placeholder="Describe your campaign goals and strategy..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <h4 className="font-semibold text-sm mb-2">💡 Next Steps:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Go deeper on any asset — edit, regenerate, or create variations</li>
            <li>• Build your full ad campaign using your new headlines</li>
            <li>• Generate landing page copy, email sequences and WhatsApp campaigns</li>
          </ul>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={createCampaign.isPending || !formData.name}
        >
          {createCampaign.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Setting Up Your Dashboard...
            </>
          ) : (
            <>
              <PartyPopper className="h-4 w-4 mr-2" />
              Take Me to My Dashboard 🎉
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
