import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  Sparkles,
  Zap,
  Target,
  MessageSquare,
  Mail,
  FileText,
  DollarSign,
  TrendingUp,
  Check,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTour } from "@/contexts/TourContext";
import Footer from "@/components/Footer";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { startTour } = useTour();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, setLocation]);

  const features = [
    {
      icon: <Sparkles className="w-8 h-8 text-primary" />,
      title: "Headlines Generator",
      description: "25 high-converting headlines across 5 proven formulas. Perfect for ads, emails, and landing pages.",
    },
    {
      icon: <FileText className="w-8 h-8 text-primary" />,
      title: "Your Free Opt-In",
      description: "Create compelling titles for your high-value content offers. 50 variations to choose from.",
    },
    {
      icon: <Target className="w-8 h-8 text-primary" />,
      title: "Your Unique Method",
      description: "Develop unique mechanisms that set your offer apart. 15 Unique Methods with supporting copy.",
    },
    {
      icon: <Target className="w-8 h-8 text-primary" />,
      title: "Your Ideal Customer Generator",
      description: "Build detailed customer profiles with 17 comprehensive sections. Know exactly who you're marketing to.",
    },
    {
      icon: <Zap className="w-8 h-8 text-primary" />,
      title: "Your Ads Generator",
      description: "Generate complete ad campaigns with headlines, body copy, and CTAs. 15 variations per generation.",
    },
    {
      icon: <Mail className="w-8 h-8 text-primary" />,
      title: "Email Sequences",
      description: "Create 5-email sequences using proven frameworks. Perfect for webinars, launches, and nurture campaigns.",
    },
    {
      icon: <MessageSquare className="w-8 h-8 text-primary" />,
      title: "WhatsApp Sequences",
      description: "Build 7-message WhatsApp sequences for high-engagement marketing. Mobile-first messaging that converts.",
    },
    {
      icon: <FileText className="w-8 h-8 text-primary" />,
      title: "Your Landing Page",
      description: "Generate complete landing page copy with headlines, bullets, and CTAs. 5 angle variations included.",
    },
    {
      icon: <DollarSign className="w-8 h-8 text-primary" />,
      title: "Offers Generator",
      description: "Craft irresistible offers with pricing, bonuses, and guarantees. 5 offer variations to test.",
    },
  ];

  const pricingTiers = [
    {
      name: "Trial",
      price: "$0",
      period: "7 days",
      description: "Try all features risk-free",
      features: [
        "3 generations per tool",
        "All 9 content generators",
        "PDF export",
        "Campaign builder",
        "No credit card required",
      ],
      cta: "Start Free Trial",
      highlighted: false,
    },
    {
      name: "Pro",
      price: "$99",
      period: "per month",
      description: "For serious marketers",
      features: [
        "50 generations per tool",
        "All 9 content generators",
        "PDF export",
        "Campaign builder",
        "Advanced options (3x output)",
        "Priority support",
      ],
      cta: "Start Free Trial",
      highlighted: true,
    },
    {
      name: "Agency",
      price: "$299",
      period: "per month",
      description: "For teams and agencies",
      features: [
        "Unlimited generations",
        "All 9 content generators",
        "PDF export",
        "Campaign builder",
        "Advanced options (3x output)",
        "Priority support",
        "White-label options",
      ],
      cta: "Start Free Trial",
      highlighted: false,
    },
  ];

  const faqs = [
    {
      question: "What is ZAP?",
      answer:
        "ZAP is an AI-powered marketing automation platform specifically designed for coaches, speakers, and consultants. It includes 9 content generators, integrated email/WhatsApp/SMS sequences, a campaign builder, and PDF export - all in one platform.",
    },
    {
      question: "How does AI content generation work?",
      answer:
        "Our AI analyzes your service details and generates high-converting marketing content using proven copywriting frameworks. You simply fill in a few fields about your offer, and the AI creates multiple variations of headlines, ad copy, emails, landing pages, and more.",
    },
    {
      question: "Can I export the generated content?",
      answer:
        "Yes! All generated content can be exported as PDF or copied to your clipboard for easy use in your marketing campaigns. You can also organize content in the campaign builder for complete campaign planning.",
    },
    {
      question: "What's the difference between Trial, Pro, and Agency?",
      answer:
        "Trial gives you 3 generations per tool for 7 days (no credit card required). Pro gives you 50 generations per tool per month plus Advanced options for 3x output. Agency gives you unlimited generations plus white-label options for client work.",
    },
    {
      question: "How many generations do I get?",
      answer:
        "Trial: 3 per tool. Pro: 50 per tool per month. Agency: Unlimited. Quotas reset monthly. Advanced options (Pro/Agency only) generates 3x more variations in a single generation.",
    },
    {
      question: "Can I cancel anytime?",
      answer:
        "Yes! You can cancel your subscription at any time from your account settings. Your access will continue until the end of your current billing period.",
    },
    {
      question: "Do you offer refunds?",
      answer:
        "We offer a 7-day free trial so you can test all features before committing. If you're not satisfied within the first 30 days of a paid subscription, contact support for a full refund.",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept all major credit cards (Visa, Mastercard, American Express, Discover) through our secure Stripe payment processor. All payments are encrypted and secure.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663026750612/elkADmeWGCobYXio.png" 
              alt="ZAP Logo" 
              className="h-12 w-12 object-contain transition-all duration-300 hover:scale-110 hover:drop-shadow-[0_0_15px_rgba(255,68,68,0.6)] cursor-pointer"
            />
            <div className="text-2xl font-bold text-primary">ZAP</div>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </a>
            <Button variant="ghost" onClick={() => startTour('landing')}>
              Take a Tour
            </Button>
            <Button variant="outline" asChild>
              <a href={getLoginUrl()}>Login</a>
            </Button>
            <Button asChild data-tour="cta">
              <a href={getLoginUrl()}>Start Free Trial</a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 md:py-32" data-tour="hero">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight">
            Generate 300+ Marketing Assets
            <br />
            <span className="text-primary">in One Afternoon</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            AI-powered content generation for coaches, speakers, and consultants. Create high-converting headlines,
            emails, ads, landing pages, and complete campaigns in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" asChild className="text-lg px-8 py-6">
              <a href={getLoginUrl()}>
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-lg px-8 py-6">
              <a href="#features">Learn More</a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">No credit card required • 7-day free trial</p>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="py-20 bg-accent/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Stop Struggling with Marketing Content</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Creating high-converting marketing content is time-consuming and expensive. ZAP solves this.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-destructive">❌ The Old Way</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Spend hours writing ads</li>
                  <li>• Hire expensive copywriters</li>
                  <li>• Run out of creative ideas</li>
                  <li>• Test one variation at a time</li>
                  <li>• Struggle with writer's block</li>
                </ul>
              </CardContent>
            </Card>
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="text-primary">✅ The ZAP Way</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Generate content in minutes</li>
                  <li>• Pay a fraction of copywriter costs</li>
                  <li>• Get unlimited creative variations</li>
                  <li>• Test 15+ variations instantly</li>
                  <li>• Never run out of ideas</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-green-500">📈 The Results</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• 10x faster content creation</li>
                  <li>• 90% cost savings</li>
                  <li>• More variations to test</li>
                  <li>• Higher conversion rates</li>
                  <li>• Complete campaign planning</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20" data-tour="features">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">9 AI-Powered Content Generators</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Everything you need to create complete marketing campaigns in one platform
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="hover:border-primary transition-colors">
                <CardHeader>
                  <div className="mb-4">{feature.icon}</div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-accent/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Get Started in 3 Simple Steps</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-3xl font-bold text-primary-foreground mx-auto mb-4">
                1
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Create Your Service</h3>
              <p className="text-muted-foreground">
                Fill in 6 simple fields about your coaching program, course, or service. Takes less than 2 minutes.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-3xl font-bold text-primary-foreground mx-auto mb-4">
                2
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Generate Content</h3>
              <p className="text-muted-foreground">
                Choose any of the 9 generators and click "Generate". AI creates 15-50 variations in seconds.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-3xl font-bold text-primary-foreground mx-auto mb-4">
                3
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Export & Use</h3>
              <p className="text-muted-foreground">
                Export as PDF or copy to clipboard. Use in your ads, emails, landing pages, and campaigns.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-accent/50" data-tour="pricing">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-muted-foreground">Start with a 7-day free trial. No credit card required.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <Card
                key={index}
                className={tier.highlighted ? "border-primary shadow-lg scale-105" : ""}
              >
                <CardHeader>
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">{tier.price}</span>
                    <span className="text-muted-foreground ml-2">/ {tier.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={tier.highlighted ? "default" : "outline"}
                    asChild
                  >
                    <a href={getLoginUrl()}>{tier.cta}</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-accent/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <Card key={index} className="cursor-pointer" onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{faq.question}</CardTitle>
                    <ChevronDown
                      className={`w-5 h-5 transition-transform ${openFaq === index ? "rotate-180" : ""}`}
                    />
                  </div>
                </CardHeader>
                {openFaq === index && (
                  <CardContent>
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Ready to 10x Your Content Creation?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Join hundreds of coaches, speakers, and consultants who are creating high-converting marketing content in
            minutes, not hours.
          </p>
          <Button size="lg" asChild className="text-lg px-8 py-6">
            <a href={getLoginUrl()}>
              Start Your Free Trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </a>
          </Button>
          <p className="text-sm text-muted-foreground mt-4">No credit card required • 7-day free trial • Cancel anytime</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-bold text-foreground mb-4">Product</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                    Generators
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-4">Company</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                    Support
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-4">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                    Refund Policy
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-4">ZAP</h3>
              <p className="text-muted-foreground text-sm mb-4">
                AI-powered marketing automation for coaches, speakers, and consultants.
              </p>
            </div>
          </div>
          <div className="text-center text-muted-foreground text-sm border-t border-border pt-8">
            © 2026 ZAP. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Footer Component */}
      <Footer />
    </div>
  );
}
