import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GenerateOfferStepProps {
  data: {
    serviceId?: number;
    icpId?: string;
    offerId?: number;
  };
  onComplete: (data: { offerId: number }) => void;
  onNext: () => void;
}

const OFFER_TYPE_EXAMPLES = {
  standard: [
    "Core Program: Complete system with step-by-step training, templates, and 30-day support - $997",
    "Starter Package: Essential tools and resources to get quick wins in 30 days - $497",
  ],
  premium: [
    "VIP Coaching: Core program + 6 months 1-on-1 coaching + implementation support - $4,997",
    "Accelerator Package: Everything in Standard + weekly group calls + done-for-you templates - $2,997",
  ],
  vip: [
    "Platinum Mastermind: Everything + 12 months private coaching + in-person retreat - $25,000",
    "Done-For-You Service: We implement everything for you + ongoing optimization - $50,000",
  ],
};

export default function GenerateOfferStep({ data, onComplete, onNext }: GenerateOfferStepProps) {
  const [offerType, setOfferType] = useState<"standard" | "premium" | "vip">("standard");
  const [generatedOffer, setGeneratedOffer] = useState<any>(null);
  const [complianceWarnings, setComplianceWarnings] = useState<string[]>([]);

  // Fetch existing offers list to find the one we generated
  const { data: offers } = trpc.offers.list.useQuery(undefined, { enabled: !!data.offerId });
  const existingOffer = offers?.find(o => o.id === data.offerId);

  const generateMutation = trpc.offers.generate.useMutation({
    onSuccess: (result) => {
      setGeneratedOffer(result);
      onComplete({ offerId: result.id });
      
      // Check for Meta compliance issues
      const warnings = checkMetaCompliance(result);
      setComplianceWarnings(warnings);
      
      if (warnings.length > 0) {
        toast.warning("Offer generated with compliance warnings", {
          description: "Review the flagged guarantee language before using in Meta ads",
        });
      } else {
        toast.success("Offer generated successfully!");
      }
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });

  useEffect(() => {
    if (existingOffer) {
      setGeneratedOffer(existingOffer);
      const warnings = checkMetaCompliance(existingOffer);
      setComplianceWarnings(warnings);
    }
  }, [existingOffer]);

  const handleGenerate = () => {
    if (!data.serviceId) {
      toast.error("Service not found. Please go back and create a service first.");
      return;
    }

    generateMutation.mutate({
      serviceId: data.serviceId,
      offerType,
    });
  };

  const handleContinue = () => {
    if (!generatedOffer) {
      toast.error("Please generate an offer first");
      return;
    }
    onNext();
  };

  // Meta compliance checker
  const checkMetaCompliance = (offer: any): string[] => {
    const warnings: string[]  = [];
    const text = `${offer.godfatherAngle} ${offer.freeAngle} ${offer.dollarAngle} ${offer.guarantee || ""}`.toLowerCase();

    // Prohibited guarantee language patterns
    const prohibitedPatterns = [
      { pattern: /100%\s*(guarantee|guaranteed|refund)/i, message: "100% guarantee claims are prohibited" },
      { pattern: /money\s*back\s*guarantee/i, message: "Money-back guarantee must be qualified (e.g., 'conditional refund policy')" },
      { pattern: /no\s*risk/i, message: "'No risk' claims are prohibited" },
      { pattern: /guaranteed\s*(results|income|profit|revenue|sales)/i, message: "Guaranteed results/income claims are prohibited" },
      { pattern: /you\s*will\s*(make|earn|get)\s*\$?\d+/i, message: "Specific income promises are prohibited" },
      { pattern: /risk\s*free/i, message: "'Risk-free' claims are prohibited" },
      { pattern: /can't\s*lose/i, message: "'Can't lose' claims are prohibited" },
      { pattern: /guaranteed\s*to\s*work/i, message: "'Guaranteed to work' claims are prohibited" },
    ];

    for (const { pattern, message } of prohibitedPatterns) {
      if (pattern.test(text)) {
        warnings.push(message);
      }
    }

    // Remove duplicates manually
    const unique: string[] = [];
    for (const w of warnings) {
      if (!unique.includes(w)) unique.push(w);
    }
    return unique;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">Step 3: Craft Your Irresistible Offer</h3>
        <p className="text-muted-foreground">
          Create a compelling offer with 3 angle variations (Super ZAP, Free, Dollar)
        </p>
      </div>

      {!generatedOffer ? (
        <Card>
          <CardHeader>
            <CardTitle>Generate Offer</CardTitle>
            <CardDescription>
              Select your offer type and we'll generate 3 proven angles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Offer Type</label>
              <Select value={offerType} onValueChange={(v) => setOfferType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard ($497-$997)</SelectItem>
                  <SelectItem value="premium">Premium ($1,997-$4,997)</SelectItem>
                  <SelectItem value="vip">VIP ($10,000+)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Examples for {offerType}:</label>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                {OFFER_TYPE_EXAMPLES[offerType].map((example, i) => (
                  <li key={i}>{example}</li>
                ))}
              </ul>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="w-full"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Offer"
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Compliance Warnings */}
          {complianceWarnings.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">⚠️ Meta Ads Compliance Warnings:</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {complianceWarnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm">
                  These guarantee phrases may violate Meta's advertising policies. Consider revising before using in ads.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {complianceWarnings.length === 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-600">
                ✓ No Meta compliance issues detected. This offer is safe to use in Meta ads.
              </AlertDescription>
            </Alert>
          )}

          {/* Generated Offer */}
          <Card>
            <CardHeader>
              <CardTitle>{generatedOffer.productName}</CardTitle>
              <CardDescription>3 Angle Variations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">🎯 Super ZAP Angle</h4>
                <p className="text-sm text-muted-foreground">{generatedOffer.godfatherAngle}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2">🎁 Free Angle</h4>
                <p className="text-sm text-muted-foreground">{generatedOffer.freeAngle}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2">💵 Dollar Angle</h4>
                <p className="text-sm text-muted-foreground">{generatedOffer.dollarAngle}</p>
              </div>
              {generatedOffer.guarantee && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">🛡️ Guarantee</h4>
                  <p className="text-sm text-muted-foreground">{generatedOffer.guarantee}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleContinue} className="w-full" size="lg">
            Continue to Headlines
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            onClick={() => setGeneratedOffer(null)}
            className="w-full"
          >
            Generate Different Offer
          </Button>
        </div>
      )}
    </div>
  );
}
