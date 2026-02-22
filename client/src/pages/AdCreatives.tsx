import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Sparkles, Zap, Image, TrendingUp } from "lucide-react";

export default function AdCreatives() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Ad Creatives"
        description="Generate attention-grabbing Facebook ad creatives using AI-powered scroll-stopper technology"
      />

      <div className="container py-8">
        {/* Hero Banner */}
        <Card className="mb-8 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <Sparkles className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl mb-2">
              Take Your Ads to the Next Level
            </CardTitle>
            <CardDescription className="text-lg">
              ZAP uses the powerful <strong>Scroll-Stopper Ad Creator</strong> to generate
              high-converting ad creatives tailored to your audience
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-6">
            <Button size="lg" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Launch Scroll-Stopper Ad Creator
            </Button>
          </CardContent>
        </Card>

        {/* What is Scroll-Stopper Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">What is Scroll-Stopper Ad Creator?</h2>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground leading-relaxed mb-4">
                The <strong>Scroll-Stopper Ad Creator</strong> is an AI-powered tool that generates
                visually stunning Facebook ad creatives designed to stop users mid-scroll. Unlike
                traditional template libraries with 154 static designs, this tool creates custom,
                data-driven ad visuals based on your specific product, audience, and marketing goals.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Each ad creative is optimized for engagement, conversion, and brand consistency—giving
                you professional-quality designs in seconds without the need for a graphic designer.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How It Works Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <span className="text-2xl font-bold text-primary">1</span>
                  </div>
                  <CardTitle className="text-lg">Connect Your Data</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Select a product from your Source of Truth or input your target market, pressing
                  problem, and desired outcome directly into the tool.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <span className="text-2xl font-bold text-primary">2</span>
                  </div>
                  <CardTitle className="text-lg">AI Generates Designs</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  The Scroll-Stopper engine analyzes your inputs and generates multiple ad creative
                  variations with optimized layouts, colors, and messaging.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <span className="text-2xl font-bold text-primary">3</span>
                  </div>
                  <CardTitle className="text-lg">Download & Deploy</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Review your ad creatives, select your favorites, and download them in
                  Facebook-ready formats (1080x1080, 1200x628, etc.) for immediate use.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Key Benefits Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Key Benefits</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Zap className="h-6 w-6 text-yellow-500" />
                  <CardTitle>Lightning-Fast Creation</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Generate 10+ professional ad creatives in under 60 seconds—no design skills required.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Image className="h-6 w-6 text-blue-500" />
                  <CardTitle>Custom, Not Templates</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Every ad is uniquely generated for your product—no generic templates that look like
                  everyone else's ads.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                  <CardTitle>Conversion-Optimized</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Built on proven design principles and A/B-tested patterns that drive clicks and sales.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Sparkles className="h-6 w-6 text-purple-500" />
                  <CardTitle>Brand Consistency</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Maintains your brand colors, fonts, and messaging across all generated ad variations.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Getting Started Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Getting Started</h2>
          <Card>
            <CardContent className="pt-6">
              <ol className="space-y-4 text-muted-foreground">
                <li className="flex gap-3">
                  <span className="font-bold text-foreground">Step 1:</span>
                  <span>
                    Click the <strong>"Launch Scroll-Stopper Ad Creator"</strong> button above to open
                    the tool in a new window.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-foreground">Step 2:</span>
                  <span>
                    Select a product from your ZAP Source of Truth or manually enter your target
                    market, pressing problem, and desired outcome.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-foreground">Step 3:</span>
                  <span>
                    Choose your ad type (Ecommerce or Lead Generation) and preferred design style
                    (bold, minimal, lifestyle, etc.).
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-foreground">Step 4:</span>
                  <span>
                    Click <strong>"Generate Ad Creatives"</strong> and watch as the AI creates 10-15
                    unique ad variations in seconds.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-foreground">Step 5:</span>
                  <span>
                    Review, rate, and download your favorite ad creatives in Facebook-ready formats.
                  </span>
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="text-center py-12">
            <h3 className="text-2xl font-bold mb-4">Ready to Create Scroll-Stopping Ads?</h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Launch the Scroll-Stopper Ad Creator now and generate professional Facebook ad creatives
              that drive results—no design experience needed.
            </p>
            <Button size="lg" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Launch Scroll-Stopper Ad Creator
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
