import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, Loader2, Star, Copy } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";
import type { OfferContent } from "../../../drizzle/schema";

export default function OfferDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const [activeAngle, setActiveAngle] = useState<"godfather" | "free" | "dollar">("godfather");

  const { data: offer, isLoading } = trpc.offers.get.useQuery(
    { id: Number(id) },
    { enabled: isAuthenticated && !!id }
  );

  const updateAngleMutation = trpc.offers.updateActiveAngle.useMutation({
    onSuccess: () => {
      toast.success("Angle updated!");
    },
  });

  const updateRatingMutation = trpc.offers.update.useMutation({
    onSuccess: () => {
      toast.success("Rating updated!");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a1a1a]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a1a1a] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Offer Not Found</h1>
          <Link href="/offers">
            <Button className="bg-purple-600 hover:bg-purple-700">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Offers
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Get content for active angle
  const content: OfferContent | null = 
    activeAngle === "godfather" ? offer.godfatherAngle :
    activeAngle === "free" ? offer.freeAngle :
    offer.dollarAngle;

  if (!content) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a1a1a] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Content Not Available</h1>
          <p className="text-gray-400 mb-4">This angle hasn't been generated yet.</p>
          <Link href="/offers">
            <Button className="bg-purple-600 hover:bg-purple-700">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Offers
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top Navigation */}
      <div className="border-b border-gray-800 bg-[#111111]">
        <div className="container max-w-6xl py-4 flex items-center justify-between">
          <Link href="/offers">
            <Button variant="ghost" className="text-white hover:bg-gray-800">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Offers
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => updateRatingMutation.mutate({ id: offer.id, rating: star })}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`h-5 w-5 ${
                      star <= (offer.rating || 0)
                        ? "fill-yellow-500 text-yellow-500"
                        : "text-gray-600"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Offer Content */}
      <div className="container max-w-4xl py-12 space-y-12">
        {/* Product Name & Offer Type */}
        <div className="text-center space-y-2">
          <p className="text-[#ff3366] text-sm font-bold uppercase tracking-wider">
            {offer.offerType?.toUpperCase()} OFFER
          </p>
          <h1 className="text-4xl md:text-5xl font-bold">
            {offer.productName}
          </h1>
          <p className="text-purple-400 text-lg uppercase tracking-wide">
            {activeAngle === "godfather" ? "GODFATHER ANGLE" : 
             activeAngle === "free" ? "FREE ANGLE" : 
             "DOLLAR ANGLE"}
          </p>
        </div>

        {/* Section 1: Offer Name */}
        <section className="bg-[#222222] rounded-2xl p-8 md:p-12">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-3xl font-bold text-[#8B5CF6]">Offer Name</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(content.offerName, "Offer Name")}
              className="text-gray-400 hover:text-white"
            >
              <Copy className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-2xl font-bold">{content.offerName}</p>
        </section>

        {/* Section 2: Value Proposition */}
        <section className="bg-[#222222] rounded-2xl p-8 md:p-12">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-3xl font-bold text-[#8B5CF6]">Value Proposition</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(content.valueProposition, "Value Proposition")}
              className="text-gray-400 hover:text-white"
            >
              <Copy className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-xl text-gray-300 leading-relaxed">{content.valueProposition}</p>
        </section>

        {/* Section 3: Pricing */}
        <section className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-2xl p-8 md:p-12">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-3xl font-bold">Pricing</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(content.pricing, "Pricing")}
              className="text-white/80 hover:text-white"
            >
              <Copy className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-xl leading-relaxed">{content.pricing}</p>
        </section>

        {/* Section 4: Bonuses */}
        <section className="bg-[#222222] rounded-2xl p-8 md:p-12">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-3xl font-bold text-[#8B5CF6]">Bonuses</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(content.bonuses, "Bonuses")}
              className="text-gray-400 hover:text-white"
            >
              <Copy className="h-5 w-5" />
            </Button>
          </div>
          <div className="text-lg text-gray-300 leading-relaxed whitespace-pre-wrap">
            {content.bonuses}
          </div>
        </section>

        {/* Section 5: Guarantee */}
        <section className="bg-green-900/20 border-2 border-green-500/30 rounded-2xl p-8 md:p-12">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-3xl font-bold text-green-400">Guarantee</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(content.guarantee, "Guarantee")}
              className="text-gray-400 hover:text-white"
            >
              <Copy className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-lg text-gray-300 leading-relaxed">{content.guarantee}</p>
        </section>

        {/* Section 6: Urgency/Scarcity */}
        <section className="bg-red-900/20 border-2 border-red-500/30 rounded-2xl p-8 md:p-12">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-3xl font-bold text-red-400">Urgency</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(content.urgency, "Urgency")}
              className="text-gray-400 hover:text-white"
            >
              <Copy className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-lg text-gray-300 leading-relaxed">{content.urgency}</p>
        </section>

        {/* Section 7: Call to Action */}
        <section className="bg-[#222222] rounded-2xl p-8 md:p-12 text-center">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-3xl font-bold text-[#8B5CF6]">Call to Action</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(content.cta, "CTA")}
              className="text-gray-400 hover:text-white"
            >
              <Copy className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-xl text-gray-300 leading-relaxed mb-8">{content.cta}</p>
          <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-lg px-12 py-6 rounded-lg font-semibold">
            {activeAngle === "godfather" ? "Claim Your Risk-Free Spot" :
             activeAngle === "free" ? "Claim Your FREE Offer" :
             "Get Started Now"}
          </Button>
        </section>
      </div>

      {/* Fixed Angle Toggle Buttons at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#111111] border-t border-gray-800 py-4 z-50">
        <div className="container max-w-4xl">
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={() => {
                setActiveAngle("godfather");
                updateAngleMutation.mutate({ id: offer.id, activeAngle: "godfather" });
              }}
              className={`${
                activeAngle === "godfather"
                  ? "bg-[#8B5CF6] text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              } font-bold uppercase px-6 py-3 rounded-lg transition-all`}
            >
              GODFATHER OFFER
            </Button>
            <Button
              onClick={() => {
                setActiveAngle("free");
                updateAngleMutation.mutate({ id: offer.id, activeAngle: "free" });
              }}
              className={`${
                activeAngle === "free"
                  ? "bg-[#8B5CF6] text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              } font-bold uppercase px-6 py-3 rounded-lg transition-all`}
            >
              FREE OFFER
            </Button>
            <Button
              onClick={() => {
                setActiveAngle("dollar");
                updateAngleMutation.mutate({ id: offer.id, activeAngle: "dollar" });
              }}
              className={`${
                activeAngle === "dollar"
                  ? "bg-[#8B5CF6] text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              } font-bold uppercase px-6 py-3 rounded-lg transition-all`}
            >
              DOLLAR OFFER
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom padding to prevent content from being hidden by fixed buttons */}
      <div className="h-24"></div>
    </div>
  );
}
