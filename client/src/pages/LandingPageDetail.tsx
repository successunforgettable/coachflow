import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, Loader2, Star } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";
import type { LandingPageContent } from "../../../drizzle/schema";
import { exportLandingPageToPDF } from "@/lib/landingPagePdfExport";
import { ComplianceBadge } from "@/components/ComplianceBadge";
import { checkCompliance } from "@/lib/complianceUtils";

export default function LandingPageDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const [activeAngle, setActiveAngle] = useState<"original" | "godfather" | "free" | "dollar">("original");

  const { data: page, isLoading } = trpc.landingPages.get.useQuery(
    { id: Number(id) },
    { enabled: isAuthenticated && !!id }
  );

  const updateAngleMutation = trpc.landingPages.updateActiveAngle.useMutation({
    onSuccess: () => {
      toast.success("Angle updated!");
    },
  });

  const updateRatingMutation = trpc.landingPages.updateRating.useMutation({
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

  if (!page) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a1a1a] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Landing Page Not Found</h1>
          <Link href="/landing-pages">
            <Button className="bg-purple-600 hover:bg-purple-700">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Your Landing Page
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Get content for active angle
  const content: LandingPageContent | null = 
    activeAngle === "original" ? page.originalAngle :
    activeAngle === "godfather" ? page.godfatherAngle :
    activeAngle === "free" ? page.freeAngle :
    page.dollarAngle;

  if (!content) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a1a1a] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Content Not Available</h1>
          <p className="text-gray-400 mb-4">This angle hasn't been generated yet.</p>
          <Link href="/landing-pages">
            <Button className="bg-purple-600 hover:bg-purple-700">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Your Landing Page
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleExportPDF = () => {
    if (!page || !content) {
      toast.error("No content to export");
      return;
    }

    try {
      exportLandingPageToPDF({
        productName: page.productName,
        angle: activeAngle,
        angleData: content,
      });
      toast.success("PDF exported successfully!");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top Navigation */}
      <div className="border-b border-gray-800 bg-[#111111]">
        <div className="container max-w-6xl py-4 flex items-center justify-between">
          <Link href="/landing-pages">
            <Button variant="ghost" className="text-white hover:bg-gray-800">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Your Landing Page
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={handleExportPDF}
              className="border-gray-700 text-white hover:bg-gray-800"
            >
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => updateRatingMutation.mutate({ id: page.id, rating: star })}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`h-5 w-5 ${
                      star <= (page.rating || 0)
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

      {/* Landing Page Content */}
      <div className="container max-w-4xl py-12 space-y-16">
        {/* Section 1: Eyebrow + Main Headline + Subheadline + CTA */}
        <section className="text-center space-y-6">
          <p className="text-[#ff3366] text-sm font-bold uppercase tracking-wider">
            {content.eyebrowHeadline}
          </p>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            {content.mainHeadline}
          </h1>
          <ComplianceBadge score={checkCompliance(content.mainHeadline).score} compliant={checkCompliance(content.mainHeadline).compliant} issues={checkCompliance(content.mainHeadline).issues} suggestions={checkCompliance(content.mainHeadline).suggestions} />
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            {content.subheadline}
          </p>
          <ComplianceBadge score={checkCompliance(content.subheadline).score} compliant={checkCompliance(content.subheadline).compliant} issues={checkCompliance(content.subheadline).issues} suggestions={checkCompliance(content.subheadline).suggestions} />
          <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-lg px-8 py-6 rounded-lg font-semibold">
            {content.primaryCta}
          </Button>
        </section>

        {/* Section 2: As Seen In */}
        <section className="border-y border-gray-800 py-12">
          <p className="text-center text-gray-500 text-sm uppercase tracking-wider mb-8">
            As Seen In
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {content.asSeenIn.map((logo, idx) => (
              <div key={idx} className="text-gray-400 font-semibold text-lg">
                {logo}
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Quiz Section */}
        <section className="bg-[#222222] rounded-2xl p-8 md:p-12">
          <h2 className="text-3xl font-bold mb-6">{content.quizSection.question}</h2>
          <div className="space-y-3 mb-6">
            {content.quizSection.options.map((option, idx) => (
              <div
                key={idx}
                className="bg-[#2a2a2a] border border-gray-700 rounded-lg p-4 hover:border-purple-500 transition-colors cursor-pointer"
              >
                <span className="font-semibold mr-3">{String.fromCharCode(65 + idx)}.</span>
                {option}
              </div>
            ))}
          </div>
          <div className="bg-[#8B5CF6] bg-opacity-10 border border-[#8B5CF6] rounded-lg p-4">
            <p className="text-[#8B5CF6] font-semibold">Answer: {content.quizSection.answer}</p>
          </div>
        </section>

        {/* Section 4: Problem Agitation */}
        <section className="space-y-6">
          <h2 className="text-4xl font-bold text-center mb-8">
            {content.problemAgitation.split('\n')[0]}
          </h2>
          <div className="text-gray-300 text-lg leading-relaxed space-y-4">
            {content.problemAgitation.split('\n').slice(1).map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
        </section>

        {/* Section 5: Solution Introduction */}
        <section className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 rounded-2xl p-8 md:p-12 space-y-6">
          <h2 className="text-4xl font-bold">
            {content.solutionIntro.split('\n')[0]}
          </h2>
          <div className="text-gray-300 text-lg leading-relaxed space-y-4">
            {content.solutionIntro.split('\n').slice(1).map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
        </section>

        {/* Section 6: Why Old Methods Fail */}
        <section className="space-y-6">
          <h2 className="text-4xl font-bold text-center text-[#ff3366] mb-8">
            {content.whyOldFail.split('\n')[0]}
          </h2>
          <div className="text-gray-300 text-lg leading-relaxed space-y-4">
            {content.whyOldFail.split('\n').slice(1).map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
        </section>

        {/* Section 7: Unique Mechanism */}
        <section className="bg-[#222222] rounded-2xl p-8 md:p-12 space-y-6">
          <h2 className="text-4xl font-bold text-[#8B5CF6]">
            {content.uniqueMechanism.split('\n')[0]}
          </h2>
          <div className="text-gray-300 text-lg leading-relaxed space-y-4">
            {content.uniqueMechanism.split('\n').slice(1).map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
        </section>

        {/* Section 8: Testimonials */}
        <section className="space-y-8">
          <h2 className="text-4xl font-bold text-center mb-12">What Our Clients Say</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {content.testimonials.map((testimonial, idx) => (
              <Card key={idx} className="bg-[#222222] border-gray-800 p-6 space-y-4">
                <h3 className="text-xl font-bold text-[#8B5CF6]">{testimonial.headline}</h3>
                <p className="text-gray-300 italic">"{testimonial.quote}"</p>
                <div className="text-sm text-gray-400">
                  <p className="font-semibold text-white">{testimonial.name}</p>
                  <p>{testimonial.location}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Section 9: Insider Advantages */}
        <section className="bg-gradient-to-br from-green-900/20 to-blue-900/20 rounded-2xl p-8 md:p-12 space-y-6">
          <h2 className="text-4xl font-bold">
            {content.insiderAdvantages.split('\n')[0]}
          </h2>
          <div className="text-gray-300 text-lg leading-relaxed space-y-4">
            {content.insiderAdvantages.split('\n').slice(1).map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
        </section>

        {/* Section 10: Scarcity / Urgency */}
        <section className="border-2 border-[#ff3366] rounded-2xl p-8 md:p-12 space-y-6">
          <h2 className="text-4xl font-bold text-[#ff3366]">
            {content.scarcityUrgency.split('\n')[0]}
          </h2>
          <div className="text-gray-300 text-lg leading-relaxed space-y-4">
            {content.scarcityUrgency.split('\n').slice(1).map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
        </section>

        {/* Section 11: Shocking Statistic */}
        <section className="text-center space-y-6 py-12">
          <div className="text-6xl font-bold text-[#ff3366] mb-4">
            {content.shockingStat.match(/\d+%/)?.[0] || "92%"}
          </div>
          <p className="text-2xl text-gray-300 max-w-2xl mx-auto">
            {content.shockingStat}
          </p>
        </section>

        {/* Section 12: Time-Saving Benefit */}
        <section className="bg-[#222222] rounded-2xl p-8 md:p-12 space-y-6">
          <h2 className="text-4xl font-bold">
            {content.timeSavingBenefit.split('\n')[0]}
          </h2>
          <div className="text-gray-300 text-lg leading-relaxed space-y-4">
            {content.timeSavingBenefit.split('\n').slice(1).map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
        </section>

        {/* Section 13: Consultation Outline */}
        <section className="space-y-8">
          <h2 className="text-4xl font-bold text-center mb-12">
            What You'll Get in Your FREE Consultation
          </h2>
          <div className="space-y-4">
            {content.consultationOutline.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#222222] border border-gray-800 rounded-lg p-6 hover:border-purple-500 transition-colors"
              >
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#8B5CF6] rounded-full flex items-center justify-center font-bold">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                    <p className="text-gray-300">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="text-center space-y-6 py-12">
          <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
          <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xl px-12 py-8 rounded-lg font-semibold">
            {content.primaryCta}
          </Button>
        </section>
      </div>

      {/* Angle Toggle Buttons - Fixed at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#111111] border-t border-gray-800 py-4 shadow-lg">
        <div className="container max-w-6xl">
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm text-gray-400 font-semibold mr-4">TOGGLE OFFERS:</span>
            <Button
              onClick={() => {
                setActiveAngle("original");
                updateAngleMutation.mutate({ id: page.id, activeAngle: "original" });
              }}
              className={`${
                activeAngle === "original"
                  ? "bg-[#8B5CF6] text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              } font-bold uppercase px-6 py-3 rounded-lg transition-all`}
            >
              ORIGINAL
            </Button>
            <Button
              onClick={() => {
                setActiveAngle("godfather");
                updateAngleMutation.mutate({ id: page.id, activeAngle: "godfather" });
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
                updateAngleMutation.mutate({ id: page.id, activeAngle: "free" });
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
                updateAngleMutation.mutate({ id: page.id, activeAngle: "dollar" });
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
