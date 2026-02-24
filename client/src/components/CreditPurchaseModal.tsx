import { useState } from "react";
import { trpc } from "../lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Check, Coins, Loader2 } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useToast } from "../hooks/use-toast";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface CreditPurchaseModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreditPurchaseModal({ open, onClose }: CreditPurchaseModalProps) {
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const { data: bundles, isLoading } = trpc.videoCredits.getBundles.useQuery();
  const createPaymentIntent = trpc.videoCredits.createPaymentIntent.useMutation();

  const handleSelectBundle = async (bundleId: string) => {
    setSelectedBundle(bundleId);
    
    try {
      const result = await createPaymentIntent.mutateAsync({ bundleId });
      setClientSecret(result.clientSecret);
    } catch (error: any) {
      console.error("Failed to create payment intent:", error);
    }
  };

  const handleBack = () => {
    setSelectedBundle(null);
    setClientSecret(null);
  };

  const handleSuccess = () => {
    setSelectedBundle(null);
    setClientSecret(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Purchase Video Credits</DialogTitle>
        </DialogHeader>

        {!selectedBundle ? (
          /* Bundle Selection */
          <div className="space-y-6">
            <p className="text-muted-foreground">
              Choose a credit bundle to generate AI video ads with voiceover
            </p>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bundles?.map((bundle) => (
                  <Card
                    key={bundle.id}
                    className={`p-6 cursor-pointer transition-all hover:border-purple-500 hover:shadow-lg ${
                      (bundle as any).popular ? "border-purple-500 shadow-lg relative" : ""
                    }`}
                    onClick={() => handleSelectBundle(bundle.id)}
                  >
                    {(bundle as any).popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        MOST POPULAR
                      </div>
                    )}

                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Coins className="w-6 h-6 text-purple-500" />
                        <h3 className="text-xl font-bold">{bundle.name}</h3>
                      </div>

                      <div className="text-4xl font-bold text-foreground my-4">
                        {bundle.credits}
                        <span className="text-lg text-muted-foreground ml-2">credits</span>
                      </div>

                      <div className="text-3xl font-bold text-purple-600 mb-2">
                        {bundle.priceDisplay}
                      </div>

                      <div className="text-sm text-muted-foreground mb-4">
                        {bundle.perVideoPrice} per video
                      </div>

                      {bundle.savings && (
                        <div className="inline-block bg-green-500/10 text-green-600 text-sm font-semibold px-3 py-1 rounded-full mb-4">
                          {bundle.savings}
                        </div>
                      )}

                      <div className="space-y-2 text-left mt-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="w-4 h-4 text-green-500" />
                          <span>15-30s videos (1 credit each)</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="w-4 h-4 text-green-500" />
                          <span>60s videos (2 credits each)</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="w-4 h-4 text-green-500" />
                          <span>90s videos (3 credits each)</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="w-4 h-4 text-green-500" />
                          <span>AI voiceover included</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="w-4 h-4 text-green-500" />
                          <span>Professional templates</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Payment Form */
          <div className="space-y-6">
            <Button variant="ghost" onClick={handleBack} className="mb-4">
              ← Back to bundles
            </Button>

            {clientSecret && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "night",
                    variables: {
                      colorPrimary: "#8B5CF6",
                    },
                  },
                }}
              >
                <CheckoutForm
                  bundleId={selectedBundle}
                  bundles={bundles || []}
                  onSuccess={handleSuccess}
                />
              </Elements>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface CheckoutFormProps {
  bundleId: string;
  bundles: readonly any[];
  onSuccess: () => void;
}

function CheckoutForm({ bundleId, bundles, onSuccess }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const bundle = bundles.find((b) => b.id === bundleId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/video-credits`,
        },
        redirect: "if_required",
      });

      if (error) {
        toast({
          title: "Payment failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment successful!",
          description: `${bundle?.credits} credits added to your account`,
        });
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Payment error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-6 bg-purple-500/10 border-purple-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{bundle?.name}</h3>
            <p className="text-sm text-muted-foreground">
              {bundle?.credits} video credits
            </p>
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {bundle?.priceDisplay}
          </div>
        </div>
      </Card>

      <PaymentElement />

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-purple-600 hover:bg-purple-700"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Coins className="w-4 h-4 mr-2" />
            Pay {bundle?.priceDisplay}
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Secure payment powered by Stripe. Credits never expire.
      </p>
    </form>
  );
}
