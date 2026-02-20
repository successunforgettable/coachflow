import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreateServiceStepProps {
  data: { serviceId?: number };
  onComplete: (data: { serviceId: number }) => void;
  onNext: () => void;
}

export default function CreateServiceStep({ data, onComplete, onNext }: CreateServiceStepProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    category: "coaching" as "coaching" | "speaking" | "consulting",
    description: "",
    targetCustomer: "",
    mainBenefit: "",
  });

  const createService = trpc.services.create.useMutation({
    onSuccess: (result) => {
      toast({ title: "Service created successfully!" });
      onComplete({ serviceId: result.id });
      onNext();
    },
    onError: (error) => {
      toast({
        title: "Failed to create service",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createService.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold mb-2">What transformation do you sell?</h3>
        <p className="text-muted-foreground">
          Be specific. The more precise you are here, the more powerful your AI-generated assets will be.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">
            Service Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="e.g., Executive Leadership Coaching"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <p className="text-sm text-muted-foreground">
            What service or program do you offer?
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetCustomer">
            Target Customer <span className="text-destructive">*</span>
          </Label>
          <Input
            id="targetCustomer"
            placeholder="e.g., C-suite executives in tech companies"
            value={formData.targetCustomer}
            onChange={(e) => setFormData({ ...formData, targetCustomer: e.target.value })}
            required
          />
          <p className="text-sm text-muted-foreground">
            Who is your ideal customer?
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mainBenefit">
            Main Benefit <span className="text-destructive">*</span>
          </Label>
          <Input
            id="mainBenefit"
            placeholder="e.g., Increase leadership effectiveness by 40%"
            value={formData.mainBenefit}
            onChange={(e) => setFormData({ ...formData, mainBenefit: e.target.value })}
            required
          />
          <p className="text-sm text-muted-foreground">
            What's the key transformation or result?
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">
            Service Description <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="description"
            placeholder="Describe your service, key benefits, and what makes it unique..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            required
          />
          <p className="text-sm text-muted-foreground">
            Provide details about your service (2-3 sentences)
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-semibold text-sm mb-2">💡 Pro Tips:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Don't say 'business coaching' — say 'I help first-generation entrepreneurs hit their first ₹1 crore in 12 months'</li>
            <li>• Your main benefit should be a result, not a feature — transformation, not information</li>
            <li>• You can add more services later — start with your #1 offer</li>
          </ul>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={createService.isPending || !formData.name || !formData.targetCustomer || !formData.mainBenefit || !formData.description}
        >
          {createService.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Building Your Assets...
            </>
          ) : (
            "Build My Assets →"
          )}
        </Button>
      </form>
    </div>
  );
}
