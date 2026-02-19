import { useState } from "react";
import { QuotaProgressBar } from "@/components/QuotaProgressBar";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CharLimitInput } from "@/components/CharLimitInput";
import { CHARACTER_LIMITS } from "@/lib/characterLimits";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Loader2, Trash2, Eye, Sparkles } from "lucide-react";
import { SkeletonCardList } from "@/components/SkeletonCard";
import { Link } from "wouter";
import { toast } from "sonner";
import { SearchBar } from "@/components/SearchBar";
import { QuotaIndicator } from "@/components/QuotaIndicator";
import ExamplesCarousel from "@/components/ExamplesCarousel";

export default function AdCopyGenerator() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { data: quotaLimits } = trpc.auth.getQuotaLimits.useQuery();
  
  // Form state - all 17 Kong fields
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [adStyle, setAdStyle] = useState<string>("");
  const [adCallToAction, setAdCallToAction] = useState<string>("");
  const [targetMarket, setTargetMarket] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [specificProductName, setSpecificProductName] = useState("");
  const [pressingProblem, setPressingProblem] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [uniqueMechanism, setUniqueMechanism] = useState("");
  const [listBenefits, setListBenefits] = useState("");
  const [specificTechnology, setSpecificTechnology] = useState("");
  const [scientificStudies, setScientificStudies] = useState("");
  const [credibleAuthority, setCredibleAuthority] = useState("");
  const [featuredIn, setFeaturedIn] = useState("");
  const [numberOfReviews, setNumberOfReviews] = useState("");
  const [averageReviewRating, setAverageReviewRating] = useState("");
  const [totalCustomers, setTotalCustomers] = useState("");
  const [testimonials, setTestimonials] = useState("");
  
  const [searchQuery, setSearchQuery] = useState("");

  const { data: services } = trpc.services.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: adSets, refetch: refetchAdCopy } = trpc.adCopy.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const generateMutation = trpc.adCopy.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`Generated ${data.headlineCount} headlines, ${data.bodyCount} body copies, ${data.linkCount} link descriptions!`);
      refetchAdCopy();
      // Reset form
      setTargetMarket("");
      setProductCategory("");
      setSpecificProductName("");
      setPressingProblem("");
      setDesiredOutcome("");
      setUniqueMechanism("");
      setListBenefits("");
      setSpecificTechnology("");
      setScientificStudies("");
      setCredibleAuthority("");
      setFeaturedIn("");
      setNumberOfReviews("");
      setAverageReviewRating("");
      setTotalCustomers("");
      setTestimonials("");
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const deleteAdSetMutation = trpc.adCopy.deleteAdSet.useMutation({
    onSuccess: () => {
      toast.success("Ad set deleted");
      refetchAdCopy();
    },
  });

  const handleGenerate = () => {
    if (!serviceId) {
      toast.error("Please select a service");
      return;
    }
    if (!adStyle) {
      toast.error("Please select an ad style");
      return;
    }
    if (!adCallToAction) {
      toast.error("Please select a call to action");
      return;
    }
    if (!targetMarket.trim()) {
      toast.error("Please enter target market");
      return;
    }
    if (!productCategory.trim()) {
      toast.error("Please enter product category");
      return;
    }
    if (!specificProductName.trim()) {
      toast.error("Please enter specific product name");
      return;
    }
    if (!pressingProblem.trim()) {
      toast.error("Please describe the pressing problem");
      return;
    }
    if (!desiredOutcome.trim()) {
      toast.error("Please describe the desired outcome");
      return;
    }

    generateMutation.mutate({
      serviceId,
      adType: "lead_gen", // Default to lead_gen
      adStyle,
      adCallToAction,
      targetMarket,
      productCategory,
      specificProductName,
      pressingProblem,
      desiredOutcome,
      uniqueMechanism,
      listBenefits,
      specificTechnology,
      scientificStudies,
      credibleAuthority,
      featuredIn,
      numberOfReviews,
      averageReviewRating,
      totalCustomers,
      testimonials,
    });
  };

  const filteredAdSets = adSets?.filter((adSet) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      adSet.targetMarket?.toLowerCase().includes(searchLower) ||
      adSet.adStyle?.toLowerCase().includes(searchLower)
    );
  });

  if (authLoading) {
    return (
      <div className="container max-w-7xl py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="h-[600px] bg-card rounded-lg animate-pulse" />
          </div>
          <div className="lg:col-span-2">
            <SkeletonCardList count={3} />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-3xl font-bold mb-4">Ad Copy Generator</h1>
        <p className="text-muted-foreground mb-6">
          Please sign in to generate ad copy
        </p>
        <Button asChild>
          <a href={getLoginUrl()}>Sign In</a>
        </Button>
      </div>
    );
  }

  const { data: authData } = trpc.auth.me.useQuery();

  // Check if user has reached quota limit
  const isQuotaExceeded = !!(authData && quotaLimits && authData.adCopyGeneratedCount >= quotaLimits.adCopy);

  return (
    <div className="container mx-auto py-8">
      <PageHeader title="Ad Copy Generator" />

      {/* Quota Progress Bar */}
      {authData && (
        <div className="mb-6">
          <QuotaProgressBar
            used={authData.adCopyGeneratedCount}
            limit={quotaLimits?.adCopy || 50}
            label="Ad Copy Quota"
            resetDate={authData.usageResetAt ? new Date(authData.usageResetAt) : undefined}
          />
        </div>
      )}

      {/* Upgrade Prompt */}
      {authData && authData.subscriptionTier && quotaLimits && authData.adCopyGeneratedCount >= quotaLimits.adCopy && (
        <div className="mb-6">
          <UpgradePrompt
            generatorName="Ad Copy"
            currentTier={authData.subscriptionTier}
            used={authData.adCopyGeneratedCount}
            limit={quotaLimits.adCopy}
          />
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ad Copy Generator</h1>
          <p className="text-muted-foreground mt-1">
            Generate high-converting Facebook/social media ads with 17 data points
          </p>
        </div>
        <QuotaIndicator generatorType="adCopy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Generator Form */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Generate Ad Copy
              </CardTitle>
              <CardDescription>
                Fill in all 17 fields to generate high-converting ads
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Service Selection */}
              <div>
                <Label htmlFor="service">Select Service*</Label>
                <Select
                  value={serviceId?.toString() || ""}
                  onValueChange={(value) => setServiceId(parseInt(value))}
                >
                  <SelectTrigger id="service">
                    <SelectValue placeholder="Choose a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services?.map((service) => (
                      <SelectItem key={service.id} value={service.id.toString()}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 1. Ad Style */}
              <div>
                <Label htmlFor="adStyle">1. Ad Style*</Label>
                <Select value={adStyle} onValueChange={setAdStyle}>
                  <SelectTrigger id="adStyle">
                    <SelectValue placeholder="Select ad style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hero Ad">Hero Ad</SelectItem>
                    <SelectItem value="Weird Authority Ad">Weird Authority Ad</SelectItem>
                    <SelectItem value="A Secret Piece Of Information">A Secret Piece Of Information</SelectItem>
                    <SelectItem value="Commitment And Consistency">Commitment And Consistency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Ad Call To Action */}
              <div>
                <Label htmlFor="adCallToAction">2. Ad Call To Action*</Label>
                <Select value={adCallToAction} onValueChange={setAdCallToAction}>
                  <SelectTrigger id="adCallToAction">
                    <SelectValue placeholder="Select CTA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Download free report">Download free report</SelectItem>
                    <SelectItem value="Watch free video training">Watch free video training</SelectItem>
                    <SelectItem value="Book a free 30-minute call">Book a free 30-minute call</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Target Market */}
              <CharLimitInput
                label="3. Target Market*"
                value={targetMarket}
                onChange={setTargetMarket}
                maxLength={CHARACTER_LIMITS.adCopy.targetMarket}
                placeholder="e.g., Busy entrepreneurs"
                required
                id="targetMarket"
              />

              {/* 4. Product Category */}
              <CharLimitInput
                label="4. Product Category*"
                value={productCategory}
                onChange={setProductCategory}
                maxLength={CHARACTER_LIMITS.adCopy.productCategory}
                placeholder="e.g., Business coaching program"
                required
                id="productCategory"
              />

              {/* 5. Specific Product Name */}
              <CharLimitInput
                label="5. Specific Product Name*"
                value={specificProductName}
                onChange={setSpecificProductName}
                maxLength={CHARACTER_LIMITS.adCopy.specificProductName}
                placeholder="e.g., 7-Figure Coach Academy"
                required
                id="specificProductName"
              />

              {/* 6. Pressing Problem */}
              <CharLimitInput
                label="6. Pressing Problem*"
                value={pressingProblem}
                onChange={setPressingProblem}
                maxLength={CHARACTER_LIMITS.adCopy.pressingProblem}
                placeholder="What keeps them up at night?"
                multiline
                rows={2}
                required
                id="pressingProblem"
              />

              {/* 7. Desired Outcome */}
              <CharLimitInput
                label="7. Desired Outcome*"
                value={desiredOutcome}
                onChange={setDesiredOutcome}
                maxLength={CHARACTER_LIMITS.adCopy.desiredOutcome}
                placeholder="What do they want?"
                multiline
                rows={2}
                required
                id="desiredOutcome"
              />

              {/* 8. Unique Mechanism */}
              <div>
                <Label htmlFor="uniqueMechanism">8. Unique Mechanism</Label>
                <ExamplesCarousel
                  examples={[
                    "The 3-Step Framework That Helped 10,000+ Entrepreneurs Scale to 7-Figures",
                    "A Proprietary Algorithm That Predicts Market Trends With 94% Accuracy",
                    "The 'Reverse Engineering' Method Used by Fortune 500 Companies",
                    "A Little-Known Loophole That Cuts Tax Bills by 40% (100% Legal)",
                    "The 5-Minute Morning Ritual That Doubles Productivity",
                    "A Counterintuitive Strategy That Turns Objections Into Sales",
                    "The 'Invisible Funnel' That Converts 3X Better Than Traditional Funnels",
                    "A Breakthrough Discovery From Stanford That Accelerates Learning by 10X",
                    "The 'Compound Effect' System That Builds Wealth on Autopilot",
                    "A Secret Ingredient Used by Olympic Athletes for Peak Performance",
                    "The 'Anti-Hustle' Method That Generates More Revenue in Less Time",
                    "A Proven Framework That Eliminates 90% of Marketing Guesswork",
                    "The 'Invisible Hand' Technique That Attracts High-Ticket Clients",
                    "A Counterintuitive Approach That Turns Competitors Into Allies",
                    "The 'Leverage Loop' That Multiplies Results Without Extra Effort",
                    "A Little-Known Psychological Trigger That Doubles Conversion Rates",
                    "The 'Shortcut Stack' That Compresses 10 Years Into 10 Months",
                    "A Proprietary System That Automates 80% of Your Busywork",
                  ]}
                  onSelectExample={setUniqueMechanism}
                  title="Unique Mechanism Examples (Click to Use)"
                />
                <CharLimitInput
                  label=""
                  value={uniqueMechanism}
                  onChange={setUniqueMechanism}
                  maxLength={0}
                  placeholder="What makes your solution different?"
                  multiline
                  rows={3}
                  id="uniqueMechanism"
                />
              </div>

              {/* 9. List Benefits */}
              <CharLimitInput
                label="9. List Benefits"
                value={listBenefits}
                onChange={setListBenefits}
                maxLength={0}
                placeholder="Key benefits of your offer"
                multiline
                rows={3}
                id="listBenefits"
              />

              {/* 10. Specific Technology */}
              <CharLimitInput
                label="10. Specific Technology/Ingredient/Methodology"
                value={specificTechnology}
                onChange={setSpecificTechnology}
                maxLength={CHARACTER_LIMITS.adCopy.specificTechnology}
                placeholder="e.g., AI-powered system"
                id="specificTechnology"
              />

              {/* 11. Scientific Studies */}
              <CharLimitInput
                label="11. Scientific Studies/Research/Stats"
                value={scientificStudies}
                onChange={setScientificStudies}
                maxLength={CHARACTER_LIMITS.adCopy.scientificStudies}
                placeholder="e.g., Harvard study shows..."
                id="scientificStudies"
              />

              {/* 12. Credible Authority */}
              <CharLimitInput
                label="12. Credible Authority Figure"
                value={credibleAuthority}
                onChange={setCredibleAuthority}
                maxLength={CHARACTER_LIMITS.adCopy.credibleAuthority}
                placeholder="e.g., Tony Robbins, Russell Brunson"
                id="credibleAuthority"
              />

              {/* 13. Featured In */}
              <CharLimitInput
                label="13. Featured In (Social Proof)"
                value={featuredIn}
                onChange={setFeaturedIn}
                maxLength={CHARACTER_LIMITS.adCopy.featuredIn}
                placeholder="e.g., Forbes, Inc, Entrepreneur"
                id="featuredIn"
              />

              {/* 14. Number of Reviews */}
              <CharLimitInput
                label="14. Number of Reviews"
                value={numberOfReviews}
                onChange={setNumberOfReviews}
                maxLength={0}
                placeholder="e.g., 1,247"
                id="numberOfReviews"
              />

              {/* 15. Average Review Rating */}
              <CharLimitInput
                label="15. Average Review Rating"
                value={averageReviewRating}
                onChange={setAverageReviewRating}
                maxLength={0}
                placeholder="e.g., 4.9/5"
                id="averageReviewRating"
              />

              {/* 16. Total Customers */}
              <CharLimitInput
                label="16. Total Number of Customers (All Time)"
                value={totalCustomers}
                onChange={setTotalCustomers}
                maxLength={0}
                placeholder="e.g., 10,000+"
                id="totalCustomers"
              />

              {/* 17. Testimonials */}
              <CharLimitInput
                label="17. Testimonials"
                value={testimonials}
                onChange={setTestimonials}
                maxLength={CHARACTER_LIMITS.adCopy.testimonials}
                placeholder="Paste 2-3 customer testimonials"
                multiline
                rows={4}
                id="testimonials"
              />

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || isQuotaExceeded}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Ad Copy
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Ad Sets List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Your Ad Sets</CardTitle>
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search ad sets..."
              />
            </CardHeader>
            <CardContent>
              {filteredAdSets && filteredAdSets.length > 0 ? (
                <div className="space-y-4">
                  {filteredAdSets.map((adSet, index) => (
                    <Card 
                      key={adSet.adSetId} 
                      className="p-4 hover-lift transition-smooth animate-fade-in-up"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-primary/20 text-primary rounded text-xs font-medium">
                              {adSet.adStyle || "Ad Copy"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(adSet.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            <strong>Target:</strong> {adSet.targetMarket || "Not specified"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            <strong>Product:</strong> {adSet.specificProductName || "Not specified"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/ad-copy/${adSet.adSetId}`}>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 active-press">
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="active-press"
                            onClick={() => deleteAdSetMutation.mutate({ adSetId: adSet.adSetId })}
                            disabled={deleteAdSetMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No ad sets generated yet. Fill in the form to generate your first ad set!
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
