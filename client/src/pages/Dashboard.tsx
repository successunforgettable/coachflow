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
      color: "text-blue-500",
    },
    {
      title: "Ad Copy Generator",
      description: "Multiple headline variations with proven formulas",
      icon: FileText,
      count: adCopy?.length || 0,
      href: "/generators/ad-copy",
      color: "text-green-500",
    },
    {
      title: "Email Sequences",
      description: "Russell Brunson's Soap Opera Sequence framework",
      icon: Mail,
      count: emailSequences?.length || 0,
      href: "/generators/email",
      color: "text-purple-500",
    },
    {
      title: "WhatsApp Sequences",
      description: "Helo.ai's 7-Strategy Framework for high engagement",
      icon: MessageCircle,
      count: whatsappSequences?.length || 0,
      href: "/generators/whatsapp",
      color: "text-emerald-500",
    },
    {
      title: "Landing Pages",
      description: "High-converting sales pages with multiple angles",
      icon: Globe,
      count: landingPages?.length || 0,
      href: "/generators/landing-page",
      color: "text-orange-500",
    },
    {
      title: "Offers",
      description: "Godfather Offers with irresistible value stacks",
      icon: Gift,
      count: offers?.length || 0,
      href: "/generators/offers",
      color: "text-pink-500",
    },
    {
      title: "Direct Response Headlines",
      description: "25 headlines across 5 proven formulas (Industry standard)",
      icon: Type,
      count: headlines?.length || 0,
      href: "/headlines",
      color: "text-yellow-500",
    },
    {
      title: "HVCO Titles",
      description: "Compelling titles for high-value content offers (Industry standard)",
      icon: Lightbulb,
      count: hvcoTitles?.length || 0,
      href: "/hvco-titles",
      color: "text-cyan-500",
    },
    {
      title: "Hero Mechanisms",
      description: "Unique features and benefits that set you apart (Industry standard)",
      icon: Zap,
      count: heroMechanisms?.length || 0,
      href: "/hero-mechanisms",
      color: "text-indigo-500",
    },
    {
      title: "Ad Creatives",
      description: "AI-powered scroll-stopping Facebook ad creatives",
      icon: Image,
      count: 0,
      href: "/ad-creatives",
      color: "text-pink-500",
    },
  ];

  const navigationItems = [
    { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { title: "Source of Truth", icon: BookOpen, href: "/source-of-truth" },
    { title: "Services", icon: Briefcase, href: "/services" },
    { title: "Campaigns", icon: FolderOpen, href: "/campaigns" },
    { title: "Settings", icon: Settings, href: "/settings" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold text-primary">CoachFlow</h1>
          <p className="text-sm text-muted-foreground mt-1">Marketing Automation</p>
        </div>

        <nav className="flex-1 p-4 space-y-2" data-tour="sidebar">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.title}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={() => logout()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-8 py-8 max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Welcome back, {user?.name}!</h1>
            <p className="text-muted-foreground mt-1">
              Your all-in-one marketing automation platform for coaches, speakers, and consultants
            </p>
          </div>

          {/* Stripe Sandbox Banner */}
          <StripeSandboxBanner />

          {/* Quota Summary Card */}
          {authData && quotaLimits && (
            <div className="mb-8" data-tour="quota-display">
              <QuotaSummaryCard authData={authData} quotaLimits={quotaLimits} />
            </div>
          )}

          {/* Stats - Display size with purple accent */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-6xl font-extrabold" style={{ color: 'var(--accent-primary)' }}>
                  {services?.length || 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Generated Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-6xl font-extrabold" style={{ color: 'var(--accent-primary)' }}>
                  {(icps?.length || 0) +
                    (adCopy?.length || 0) +
                    (emailSequences?.length || 0) +
                    (whatsappSequences?.length || 0) +
                    (landingPages?.length || 0) +
                    (offers?.length || 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Generators
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-6xl font-extrabold" style={{ color: 'var(--accent-primary)' }}>6</p>
              </CardContent>
            </Card>
          </div>

          {/* Generators Grid - with borders, shadows, hover states, and entrance animations */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-foreground">AI Generators</h2>
              <Button variant="outline" size="sm" onClick={() => startTour('dashboard')}>
                Start Tour
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-tour="generators-grid">
              {generators.map((generator, index) => {
                const Icon = generator.icon;
                return (
                  <Link key={generator.href} href={generator.href}>
                    <div
                      className="cursor-pointer h-full animate-fade-in-up"
                      style={{
                        animationDelay: `${index * 100}ms`,
                        animationFillMode: 'both'
                      }}
                    >
                      <Card 
                        className="h-full transition-all duration-200"
                        style={{
                          border: '1px solid var(--border-subtle)',
                          boxShadow: 'var(--shadow-md)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.borderColor = 'var(--accent-primary)';
                          e.currentTarget.style.boxShadow = '0 0 20px rgba(139, 92, 246, 0.3), var(--shadow-lg)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                        }}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              {/* Icon with gradient and purple glow */}
                              <div 
                                className="p-3 rounded-lg"
                                style={{
                                  background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-hover) 100%)',
                                  boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)',
                                }}
                              >
                                <Icon className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <CardTitle className="text-lg">{generator.title}</CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {generator.count} generated
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <CardDescription>{generator.description}</CardDescription>
                        </CardContent>
                      </Card>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Quick Actions - styled as interactive rows */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Get started with your marketing automation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/services">
                <div 
                  className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200"
                  style={{
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-tertiary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <Briefcase className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Create New Service</span>
                </div>
              </Link>
              <Link href="/generators/icp">
                <div 
                  className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200"
                  style={{
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-tertiary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <Sparkles className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Generate Customer Profile</span>
                </div>
              </Link>
              <Link href="/generators/email">
                <div 
                  className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200"
                  style={{
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-tertiary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <Mail className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Create Email Sequence</span>
                </div>
              </Link>
              <Link href="/campaigns">
                <div 
                  className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200"
                  style={{
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-tertiary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <FolderOpen className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Organize Campaign</span>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
