import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { QuotaSummaryCard } from "@/components/QuotaSummaryCard";
import { StripeSandboxBanner } from "@/components/StripeSandboxBanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Link, useLocation, Redirect } from "wouter";
import { useTour } from "@/contexts/TourContext";
import {
  Sparkles,
  FileText,
  Mail,
  MessageCircle,
  Globe,
  Gift,
  Settings,
  LogOut,
  LayoutDashboard,
  Briefcase,
  FolderOpen,
  BookOpen,
  Type,
  Lightbulb,
  Zap,
  Image,
  Package,
} from "lucide-react";

export default function Dashboard() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [location] = useLocation();
  const { startTour } = useTour();

  // Queries
  const { data: services } = trpc.services.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: icps } = trpc.icps.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: adCopy } = trpc.adCopy.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: emailSequences } = trpc.emailSequences.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: whatsappSequences } = trpc.whatsappSequences.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: authData } = trpc.auth.me.useQuery();
  const { data: quotaLimits } = trpc.auth.getQuotaLimits.useQuery();
  const { data: onboardingStatus } = trpc.onboarding.getStatus.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: landingPages } = trpc.landingPages.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: offers } = trpc.offers.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: headlines } = trpc.headlines.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: hvcoTitles } = trpc.hvco.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: heroMechanisms } = trpc.heroMechanisms.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Redirect to login if not authenticated
  if (!authLoading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  // Redirect to onboarding if not completed
  if (isAuthenticated && onboardingStatus && !onboardingStatus.completed) {
    return <Redirect to="/onboarding" />;
  }

  const generators = [
    {
      title: "Ideal Customer Profile",
      description: "AI-powered customer research with demographics and pain points",
      icon: Sparkles,
      count: icps?.length || 0,
      href: "/generators/icp",
    },
    {
      title: "Ad Copy Generator",
      description: "Multiple headline variations with proven formulas",
      icon: FileText,
      count: adCopy?.length || 0,
      href: "/generators/ad-copy",
    },
    {
      title: "Email Sequences",
      description: "Russell Brunson's Soap Opera Sequence framework",
      icon: Mail,
      count: emailSequences?.length || 0,
      href: "/generators/email",
    },
    {
      title: "WhatsApp Sequences",
      description: "Helo.ai's 7-Strategy Framework for high engagement",
      icon: MessageCircle,
      count: whatsappSequences?.length || 0,
      href: "/generators/whatsapp",
    },
    {
      title: "Landing Pages",
      description: "High-converting sales pages with multiple angles",
      icon: Globe,
      count: landingPages?.length || 0,
      href: "/generators/landing-page",
    },
    {
      title: "Offers",
      description: "Godfather Offers with irresistible value stacks",
      icon: Gift,
      count: offers?.length || 0,
      href: "/generators/offers",
    },
    {
      title: "Direct Response Headlines",
      description: "25 headlines across 5 proven formulas",
      icon: Type,
      count: headlines?.length || 0,
      href: "/headlines",
    },
    {
      title: "HVCO Titles",
      description: "Compelling titles for high-value content offers",
      icon: Lightbulb,
      count: hvcoTitles?.length || 0,
      href: "/hvco-titles",
    },
    {
      title: "Hero Mechanisms",
      description: "Unique features and benefits that set you apart",
      icon: Zap,
      count: heroMechanisms?.length || 0,
      href: "/hero-mechanisms",
    },
    {
      title: "Ad Creatives",
      description: "AI-powered scroll-stopping Facebook ad creatives",
      icon: Image,
      count: 0,
      href: "/ad-creatives",
    },
  ];

  const navigationItems = [
    { title: "Dream Buyer Avatars", href: "/generators/icp" },
    { title: "Facebook Ad Generator", href: "/generators/ad-copy" },
    { title: "Direct Response Headlines", href: "/headlines" },
    { title: "HVCO Titles", href: "/hvco-titles" },
    { title: "Hero Mechanisms", href: "/hero-mechanisms" },
    { title: "Ad Creatives", href: "/ad-creatives" },
    { title: "Landing Pages", href: "/generators/landing-page" },
    { title: "Godfather Offers", href: "/generators/offers" },
    { title: "Products", href: "/services" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Text-only navigation like Kong */}
      <div className="w-56 bg-card flex flex-col sidebar">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>CoachFlow</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Generators</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Superpowers just a click away</p>
        </div>

        {/* Navigation - Text only, no icons */}
        <nav className="flex-1 p-4 space-y-1" data-tour="sidebar">
          {navigationItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`block px-4 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "text-white font-medium"
                    : "hover:bg-accent/50"
                }`}
                style={{
                  backgroundColor: isActive ? 'var(--accent-primary)' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                }}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-4 border-t border-border space-y-1">
          <Link 
            href="/settings"
            className="block px-4 py-2 rounded-md text-sm hover:bg-accent/50"
            style={{ color: 'var(--text-secondary)' }}
          >
            Light Mode
          </Link>
          <Link 
            href="/settings"
            className="block px-4 py-2 rounded-md text-sm hover:bg-accent/50"
            style={{ color: 'var(--text-secondary)' }}
          >
            Support
          </Link>
          <Link 
            href="/settings"
            className="block px-4 py-2 rounded-md text-sm hover:bg-accent/50"
            style={{ color: 'var(--text-secondary)' }}
          >
            Settings
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-12 py-16 max-w-[1400px]">
          {/* Hero Section: 60% left + 40% right */}
          <div className="flex gap-8 mb-20">
            {/* Left: Hero Welcome (60%) */}
            <div className="flex-[6]">
              {/* Welcome Header */}
              <div 
                className="rounded-2xl p-8 mb-8"
                style={{
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-elevated)',
                }}
              >
                <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Welcome {user?.name?.split(' ')[0]} 👋
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Let's get started with something awesome.
                </p>
              </div>

              {/* Featured Content Area - Video placeholder */}
              <div 
                className="rounded-2xl overflow-hidden"
                style={{
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-elevated)',
                  aspectRatio: '16/9',
                }}
              >
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}>
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--accent-primary)' }}>
                      <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    </div>
                    <p style={{ color: 'var(--text-secondary)' }}>Getting Started Video</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Info Cards (40%) */}
            <div className="flex-[4]" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Stripe Banner */}
              <StripeSandboxBanner />

              {/* Quota Card */}
              {authData && quotaLimits && (
                <div data-tour="quota-display">
                  <QuotaSummaryCard authData={authData} quotaLimits={quotaLimits} />
                </div>
              )}

              {/* Products Card - Compact */}
              <div
                style={{
                  padding: 'var(--card-padding-md)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-secondary)',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Products</h3>
                </div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                  A central place for your product/service's details, to be used in resource generation
                </p>
                <div className="flex gap-2 text-xs">
                  <Link href="/services" style={{ color: 'var(--accent-primary)' }}>View All</Link>
                  <span style={{ color: 'var(--text-tertiary)' }}>•</span>
                  <Link href="/services" style={{ color: 'var(--accent-primary)' }}>Create New Product</Link>
                </div>
              </div>

              {/* Dream Buyer Avatar Card - Compact */}
              <div
                style={{
                  padding: 'var(--card-padding-md)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-secondary)',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Dream Buyer Avatar</h3>
                </div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Create a detailed and idealized representation of your target customer
                </p>
                <Link href="/generators/icp" className="text-xs" style={{ color: 'var(--accent-primary)' }}>Generate →</Link>
              </div>
            </div>
          </div>

          {/* Generator Cards - Horizontal layout like Kong */}
          <div className="space-y-4" data-tour="generators-grid">
            {generators.map((generator, index) => {
              const Icon = generator.icon;
              return (
                <div
                  key={generator.href}
                  className="animate-fade-in-up"
                  style={{
                    animationDelay: `${index * 50}ms`,
                    animationFillMode: 'both'
                  }}
                >
                  <div className="generator-row">
                      {/* Icon - Small, left-aligned */}
                      <div className="generator-icon">
                        <Icon className="w-5 h-5" style={{ color: '#8B5CF6' }} />
                      </div>

                      {/* Title + Description - Middle, takes up remaining space */}
                      <div className="flex-1 min-w-0">
                        <h3 className="generator-title">
                          {generator.title}
                        </h3>
                        <p className="generator-description">
                          {generator.description}
                        </p>
                      </div>

                      {/* Generate Button - Right-aligned */}
                      <Link href={generator.href}>
                        <button className="generate-btn">Generate</button>
                      </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Start Tour Button */}
          <div className="mt-12 text-center">
            <Button variant="outline" onClick={() => startTour('dashboard')}>
              Start Tour
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
