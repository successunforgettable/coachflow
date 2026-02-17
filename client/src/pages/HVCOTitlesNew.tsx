import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function HVCOTitlesNew() {
  const [, setLocation] = useLocation();
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [targetMarket, setTargetMarket] = useState("");
  const [hvcoTopic, setHvcoTopic] = useState("");

  const { data: services } = trpc.services.list.useQuery();
  const generateMutation = trpc.hvco.generate.useMutation({
    onSuccess: (data) => {
      toast.success("HVCO Titles generated successfully!");
      setLocation(`/hvco-titles/${data.hvcoSetId}`);
    },
    onError: (error) => {
      toast.error(`Failed to generate HVCO Titles: ${error.message}`);
    },
  });

  // Auto-fill target market when service is selected
  const handleServiceChange = (serviceId: string) => {
    const id = parseInt(serviceId);
    setSelectedServiceId(id);
    
    const service = services?.find((s) => s.id === id);
    if (service) {
      setTargetMarket(service.targetCustomer || "");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedServiceId) {
      toast.error("Please select a product");
      return;
    }

    if (!targetMarket.trim()) {
      toast.error("Please enter a target market");
      return;
    }

    if (!hvcoTopic.trim()) {
      toast.error("Please describe what the HVCO talks about");
      return;
    }

    generateMutation.mutate({
      serviceId: selectedServiceId,
      targetMarket: targetMarket.trim(),
      hvcoTopic: hvcoTopic.trim(),
    });
  };

  const targetMarketCharsLeft = 100 - targetMarket.length;
  const hvcoTopicCharsLeft = 800 - hvcoTopic.length;

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New HVCO</h1>
        <p className="text-muted-foreground">
          Generate compelling titles for your high-value content offer
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selected Product */}
          <div className="space-y-2">
            <Label htmlFor="service">
              Selected Product <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedServiceId?.toString()}
              onValueChange={handleServiceChange}
            >
              <SelectTrigger id="service">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {services?.map((service) => (
                  <SelectItem key={service.id} value={service.id.toString()}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedServiceId && (
              <p className="text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setSelectedServiceId(null)}
                  className="text-primary hover:underline"
                >
                  Change
                </button>
              </p>
            )}
          </div>

          {/* Target Market */}
          <div className="space-y-2">
            <Label htmlFor="targetMarket">
              Target Market <span className="text-red-500">*</span>
            </Label>
            <Input
              id="targetMarket"
              placeholder="e.g. Women over 45."
              value={targetMarket}
              onChange={(e) => setTargetMarket(e.target.value.slice(0, 100))}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              {targetMarketCharsLeft} chars left
            </p>
          </div>

          {/* HVCO Topic */}
          <div className="space-y-2">
            <Label htmlFor="hvcoTopic">
              What does the HVCO talk about? <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="hvcoTopic"
              placeholder="e.g. replacing a 9 to 5 income and retiring 8 to 15 years earlier through building an investment property portfolio."
              value={hvcoTopic}
              onChange={(e) => setHvcoTopic(e.target.value.slice(0, 800))}
              maxLength={800}
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {hvcoTopicCharsLeft} chars left
            </p>
          </div>

          {/* Disclaimer */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              HVCOs are AI-generated. Please review and edit all content for accuracy before using or publishing.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Button
              type="submit"
              disabled={generateMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {generateMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Create HVCO
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLocation("/hvco-titles")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
