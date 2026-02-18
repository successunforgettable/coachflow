import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Loader2, Trash2, Eye, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { SearchBar } from "@/components/SearchBar";
import { QuotaIndicator } from "@/components/QuotaIndicator";
import ExamplesCarousel from "@/components/ExamplesCarousel";

export default function AdCopyGenerator() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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

  return (
    <div className="container mx-auto py-8">
      <PageHeader title="Ad Copy Generator" />

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
              <div>
                <Label htmlFor="targetMarket">3. Target Market* (52 char max)</Label>
                <Input
                  id="targetMarket"
                  placeholder="e.g., Busy entrepreneurs"
                  value={targetMarket}
                  onChange={(e) => setTargetMarket(e.target.value)}
                  maxLength={52}
                />
                <p className="text-xs text-muted-foreground mt-1">{targetMarket.length}/52</p>
              </div>

              {/* 4. Product Category */}
              <div>
                <Label htmlFor="productCategory">4. Product Category* (79 char max)</Label>
                <Input
                  id="productCategory"
                  placeholder="e.g., Business coaching program"
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  maxLength={79}
                />
                <p className="text-xs text-muted-foreground mt-1">{productCategory.length}/79</p>
              </div>

              {/* 5. Specific Product Name */}
              <div>
                <Label htmlFor="specificProductName">5. Specific Product Name* (72 char max)</Label>
                <Input
                  id="specificProductName"
                  placeholder="e.g., 7-Figure Coach Academy"
                  value={specificProductName}
                  onChange={(e) => setSpecificProductName(e.target.value)}
                  maxLength={72}
                />
                <p className="text-xs text-muted-foreground mt-1">{specificProductName.length}/72</p>
              </div>

              {/* 6. Pressing Problem */}
              <div>
                <Label htmlFor="pressingProblem">6. Pressing Problem* (48 char max)</Label>
                <Textarea
                  id="pressingProblem"
                  placeholder="What keeps them up at night?"
                  value={pressingProblem}
                  onChange={(e) => setPressingProblem(e.target.value)}
                  maxLength={48}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground mt-1">{pressingProblem.length}/48</p>
              </div>

              {/* 7. Desired Outcome */}
              <div>
                <Label htmlFor="desiredOutcome">7. Desired Outcome* (25 char max)</Label>
                <Textarea
                  id="desiredOutcome"
                  placeholder="What do they want?"
                  value={desiredOutcome}
                  onChange={(e) => setDesiredOutcome(e.target.value)}
                  maxLength={25}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground mt-1">{desiredOutcome.length}/25</p>
              </div>

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
                <Textarea
                  id="uniqueMechanism"
                  placeholder="What makes your solution different?"
                  value={uniqueMechanism}
                  onChange={(e) => setUniqueMechanism(e.target.value)}
                  rows={3}
                  className="mt-2"
                />
              </div>

              {/* 9. List Benefits */}
              <div>
                <Label htmlFor="listBenefits">9. List Benefits</Label>
                <Textarea
                  id="listBenefits"
                  placeholder="Key benefits of your offer"
                  value={listBenefits}
                  onChange={(e) => setListBenefits(e.target.value)}
                  rows={3}
                />
              </div>

              {/* 10. Specific Technology */}
              <div>
                <Label htmlFor="specificTechnology">10. Specific Technology/Ingredient/Methodology (23 char max)</Label>
                <Input
                  id="specificTechnology"
                  placeholder="e.g., AI-powered system"
                  value={specificTechnology}
                  onChange={(e) => setSpecificTechnology(e.target.value)}
                  maxLength={23}
                />
                <p className="text-xs text-muted-foreground mt-1">{specificTechnology.length}/23</p>
              </div>

              {/* 11. Scientific Studies */}
              <div>
                <Label htmlFor="scientificStudies">11. Scientific Studies/Research/Stats (31 char max)</Label>
                <Input
                  id="scientificStudies"
                  placeholder="e.g., Harvard study shows..."
                  value={scientificStudies}
                  onChange={(e) => setScientificStudies(e.target.value)}
                  maxLength={31}
                />
                <p className="text-xs text-muted-foreground mt-1">{scientificStudies.length}/31</p>
              </div>

              {/* 12. Credible Authority */}
              <div>
                <Label htmlFor="credibleAuthority">12. Credible Authority Figure (70 char max)</Label>
                <Input
                  id="credibleAuthority"
                  placeholder="e.g., Tony Robbins, Russell Brunson"
                  value={credibleAuthority}
                  onChange={(e) => setCredibleAuthority(e.target.value)}
                  maxLength={70}
                />
                <p className="text-xs text-muted-foreground mt-1">{credibleAuthority.length}/70</p>
              </div>

              {/* 13. Featured In */}
              <div>
                <Label htmlFor="featuredIn">13. Featured In (Social Proof) (65 char max)</Label>
                <Input
                  id="featuredIn"
                  placeholder="e.g., Forbes, Inc, Entrepreneur"
                  value={featuredIn}
                  onChange={(e) => setFeaturedIn(e.target.value)}
                  maxLength={65}
                />
                <p className="text-xs text-muted-foreground mt-1">{featuredIn.length}/65</p>
              </div>

              {/* 14. Number of Reviews */}
              <div>
                <Label htmlFor="numberOfReviews">14. Number of Reviews</Label>
                <Input
                  id="numberOfReviews"
                  placeholder="e.g., 1,247"
                  value={numberOfReviews}
                  onChange={(e) => setNumberOfReviews(e.target.value)}
                />
              </div>

              {/* 15. Average Review Rating */}
              <div>
                <Label htmlFor="averageReviewRating">15. Average Review Rating</Label>
                <Input
                  id="averageReviewRating"
                  placeholder="e.g., 4.9/5"
                  value={averageReviewRating}
                  onChange={(e) => setAverageReviewRating(e.target.value)}
                />
              </div>

              {/* 16. Total Customers */}
              <div>
                <Label htmlFor="totalCustomers">16. Total Number of Customers (All Time)</Label>
                <Input
                  id="totalCustomers"
                  placeholder="e.g., 10,000+"
                  value={totalCustomers}
                  onChange={(e) => setTotalCustomers(e.target.value)}
                />
              </div>

              {/* 17. Testimonials */}
              <div>
                <Label htmlFor="testimonials">17. Testimonials (511 char max)</Label>
                <Textarea
                  id="testimonials"
                  placeholder="Paste 2-3 customer testimonials"
                  value={testimonials}
                  onChange={(e) => setTestimonials(e.target.value)}
                  maxLength={511}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">{testimonials.length}/511</p>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
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
                  {filteredAdSets.map((adSet) => (
                    <Card key={adSet.adSetId} className="p-4">
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
                            <Button size="sm" variant="outline">
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="destructive"
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
