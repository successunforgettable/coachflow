import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { QuotaSummaryCard } from "@/components/QuotaSummaryCard";
import { StripeSandboxBanner } from "@/components/StripeSandboxBanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Link, useLocation, Redirect } from "wouter";
import { useState } from "react";
import OnboardingProgressTracker from "@/components/OnboardingProgressTracker";
import { PostOnboardingWelcomeBanner } from "@/components/PostOnboardingWelcomeBanner";
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
  Play,
  Menu,
  X,
} from "lucide-react";

export default function Dashboard() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [location] = useLocation();
  const { startTour } = useTour();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const { data: userPreferences } = trpc.user.getPreferences.useQuery(undefined, {
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
      href: "/ad-copy",
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
      href: "/landing-pages",
    },
    {
      title: "Godfather Offers",
      description: "Create irresistible offers your customers can't refuse",
      icon: Gift,
      count: offers?.length || 0,
      href: "/offers",
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

  return (
    <div className="dashboard-layout">
      {/* Mobile Hamburger Button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#1E1E1E] border border-[rgba(139,92,246,0.2)] rounded-lg hover:bg-[#252525] transition-colors"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <Menu className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`sidebar fixed lg:static inset-y-0 left-0 z-50 transform ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 transition-transform duration-200`}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <img 
            src="/zap-logo.png" 
            alt="ZAP Logo" 
            style={{ height: '64px', width: '64px', objectFit: 'contain' }}
          />
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--text-muted)',
          marginBottom: '28px',
        }}>
          Generators · Superpowers just a click away
        </div>

        {/* Progress Tracker */}
        <OnboardingProgressTracker />

        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
          marginBottom: '8px',
          padding: '0 12px',
        }}>
          Generators
        </div>

        <Link href="/generators/icp">
          <div className="nav-item"><Sparkles className="w-3.5 h-3.5 inline-block mr-2" /> Dream Buyer Avatars</div>
        </Link>
        <Link href="/ad-copy">
          <div className="nav-item"><FileText className="w-3.5 h-3.5 inline-block mr-2" /> Facebook Ad Generator</div>
        </Link>
        <Link href="/headlines">
          <div className="nav-item"><Type className="w-3.5 h-3.5 inline-block mr-2" /> Direct Response Headlines</div>
        </Link>
        <Link href="/hvco-titles">
          <div className="nav-item"><Lightbulb className="w-3.5 h-3.5 inline-block mr-2" /> HVCO Titles</div>
        </Link>
        <Link href="/hero-mechanisms">
          <div className="nav-item"><Zap className="w-3.5 h-3.5 inline-block mr-2" /> Hero Mechanisms</div>
        </Link>
        <Link href="/ad-creatives">
          <div className="nav-item"><Image className="w-3.5 h-3.5 inline-block mr-2" /> Ad Creatives</div>
        </Link>
        <Link href="/landing-pages">
          <div className="nav-item"><Globe className="w-3.5 h-3.5 inline-block mr-2" /> Landing Pages</div>
        </Link>
        <Link href="/offers">
          <div className="nav-item"><Gift className="w-3.5 h-3.5 inline-block mr-2" /> Godfather Offers</div>
        </Link>

        <div style={{ height: '16px' }}></div>
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
          marginBottom: '8px',
          padding: '0 12px',
        }}>
          Resources
        </div>
        <Link href="/services">
          <div className="nav-item">📦 Products</div>
        </Link>

        <div style={{
          marginTop: 'auto',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '16px',
        }}>
          <div className="nav-item">☀️ Light Mode</div>
          <div className="nav-item">💬 Support</div>
          <Link href="/settings">
            <div className="nav-item">⚙️ Settings</div>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content p-4 md:p-6 lg:p-10">
        {/* Welcome */}
        <h1 className="welcome-heading text-2xl md:text-3xl lg:text-4xl">
          Welcome {user?.name || 'Arfeen'} 👋
        </h1>
        <p className="welcome-sub text-sm md:text-base">
          Let's get started with something awesome.
        </p>

        {/* Post-Onboarding Welcome Banner */}
        {isAuthenticated && 
         onboardingStatus?.completed && 
         userPreferences && 
         !userPreferences.dismissedWelcomeBanner && (
          <PostOnboardingWelcomeBanner />
        )}

        {/* Video Section: Video Left, Stripe/Quota Right */}
        <div className="video-section grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5">
          <div className="video-player">
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at 50% 60%, rgba(139, 92, 246, 0.1) 0%, transparent 65%)',
            }}></div>
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.01) 2px, rgba(255,255,255,0.01) 4px)',
              pointerEvents: 'none',
            }}></div>
            <div
              style={{
                width: '64px',
                height: '64px',
                background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 0 40px rgba(139, 92, 246, 0.5)',
                transition: 'all 200ms ease',
                position: 'relative',
                zIndex: 1,
              }}
              className="play-btn-hover"
              >
                <Play className="w-6 h-6 text-white" fill="white" />
              </div>
              <div style={{
                fontSize: '14px',
                color: 'var(--text-muted)',
                position: 'relative',
                zIndex: 1,
              }}>
                Getting Started Video
              </div>
          </div>

          {/* Right: Stripe and Quota Cards */}
          <div className="right-column">
            <StripeSandboxBanner />
            {authData && quotaLimits && (
              <div>
                <QuotaSummaryCard authData={authData} quotaLimits={quotaLimits} />
              </div>
            )}
          </div>
        </div>

        {/* Generators Grid */}
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            marginBottom: '14px',
          }}>
            AI Generators
          </div>

          <div className="generators-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {generators.map((gen, index) => (
              <Link key={gen.href} href={gen.href}>
                <div className="generator-card flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4">
                  <div className="w-10 h-10 bg-[rgba(139,92,246,0.1)] rounded-lg flex items-center justify-center flex-shrink-0">
                    <gen.icon className="w-5 h-5" />
                  </div>
                  <div className="text-base font-semibold text-white">{gen.title}</div>
                  <div className="text-sm text-[#9CA3AF]">{gen.description}</div>
                  <button
                    className="gen-btn px-4 py-2 bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA] rounded-lg text-white text-sm font-semibold hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:-translate-y-px transition-all duration-200"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = gen.href;
                    }}
                  >
                    Generate
                  </button>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Start Tour Button */}
        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <Button variant="outline" onClick={() => startTour('dashboard')}>
            Start Tour
          </Button>
        </div>
      </div>
    </div>
  );
}
