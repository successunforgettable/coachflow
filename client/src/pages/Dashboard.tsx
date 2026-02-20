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
  Play,
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
      href: "/generators/email-sequences",
    },
    {
      title: "WhatsApp Sequences",
      description: "Helo.ai's 7-Strategy Framework for high engagement",
      icon: MessageCircle,
      count: whatsappSequences?.length || 0,
      href: "/generators/whatsapp-sequences",
    },
    {
      title: "Landing Pages",
      description: "High-converting sales pages with multiple angles",
      icon: Globe,
      count: landingPages?.length || 0,
      href: "/generators/landing-pages",
    },
    {
      title: "Godfather Offers",
      description: "Create irresistible offers your customers can't refuse",
      icon: Gift,
      count: offers?.length || 0,
      href: "/generators/offers",
    },
    {
      title: "Direct Response Headlines",
      description: "25 headlines across 5 proven formulas",
      icon: Type,
      count: headlines?.length || 0,
      href: "/generators/headlines",
    },
    {
      title: "HVCO Titles",
      description: "Compelling titles for high-value content offers",
      icon: Lightbulb,
      count: hvcoTitles?.length || 0,
      href: "/generators/hvco",
    },
    {
      title: "Hero Mechanisms",
      description: "Unique features and benefits that set you apart",
      icon: Zap,
      count: heroMechanisms?.length || 0,
      href: "/generators/hero-mechanisms",
    },
    {
      title: "Ad Creatives",
      description: "AI-powered scroll-stopping Facebook ad creatives",
      icon: Image,
      count: 0,
      href: "/generators/ad-creatives",
    },
  ];

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div style={{
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: '4px',
        }}>
          CoachFlow
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--text-muted)',
          marginBottom: '28px',
        }}>
          Generators · Superpowers just a click away
        </div>

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
          <div className="nav-item">👤 Dream Buyer Avatars</div>
        </Link>
        <Link href="/generators/ad-copy">
          <div className="nav-item">📝 Facebook Ad Generator</div>
        </Link>
        <Link href="/generators/headlines">
          <div className="nav-item">📰 Direct Response Headlines</div>
        </Link>
        <Link href="/generators/hvco">
          <div className="nav-item">🎯 HVCO Titles</div>
        </Link>
        <Link href="/generators/hero-mechanisms">
          <div className="nav-item">⚡ Hero Mechanisms</div>
        </Link>
        <Link href="/generators/ad-creatives">
          <div className="nav-item">🎨 Ad Creatives</div>
        </Link>
        <Link href="/generators/landing-pages">
          <div className="nav-item">📄 Landing Pages</div>
        </Link>
        <Link href="/generators/offers">
          <div className="nav-item">🤝 Godfather Offers</div>
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
      <div className="main-content">
        {/* Welcome */}
        <h1 className="welcome-heading">
          Welcome {user?.name || 'Arfeen'} 👋
        </h1>
        <p className="welcome-sub">
          Let's get started with something awesome.
        </p>

        {/* Full Width Video */}
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
          <div style={{
            width: '64px',
            height: '64px',
            background: 'rgba(139, 92, 246, 0.9)',
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

        {/* Two Column: Generators + Right Cards */}
        <div className="below-video">
          {/* Left: Generators */}
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

            {generators.map((gen, index) => (
              <Link key={gen.href} href={gen.href}>
                <div
                  className="flex items-center gap-4 p-5 bg-[#14141F] border border-[#27273A] rounded-xl mb-1.5 cursor-pointer hover:bg-[#1C1C2E] hover:border-[#8B5CF6] transition-all duration-200"
                  style={{
                    animationDelay: `${index * 60}ms`,
                    animation: 'fadeInUp 0.4s ease-out both',
                  }}
                >
                  <div className="w-10 h-10 bg-[rgba(139,92,246,0.1)] rounded-lg flex items-center justify-center flex-shrink-0">
                    <gen.icon className="w-[18px] h-[18px]" />
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-semibold text-white">{gen.title}</div>
                    <div className="text-sm text-[#9CA3AF] mt-0.5">{gen.description}</div>
                  </div>
                  <button
                    className="ml-auto px-5 py-2 bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA] rounded-lg text-white text-sm font-semibold flex-shrink-0 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:-translate-y-px transition-all duration-200"
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

          {/* Right: Info Cards */}
          <div className="right-column">
            {/* Stripe Banner */}
            <StripeSandboxBanner />

            {/* Quota Card */}
            {authData && quotaLimits && (
              <div>
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
                transition: 'border-color 200ms ease',
              }}
              className="right-card-hover"
            >
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Products</h3>
              </div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                A central place for your product/service's details, to be used in resource generation
              </p>
              <div className="flex gap-2 text-xs">
                <Link href="/services" style={{ color: 'var(--text-tertiary)', transition: 'color 150ms ease' }} className="right-action-link-hover">View All</Link>
                <span style={{ color: 'var(--border-default)' }}>·</span>
                <Link href="/services" style={{ color: 'var(--text-tertiary)', transition: 'color 150ms ease' }} className="right-action-link-hover">Create New Product</Link>
              </div>
            </div>

            {/* Dream Buyer Avatar Card - Compact */}
            <div
              style={{
                padding: 'var(--card-padding-md)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
                transition: 'border-color 200ms ease',
              }}
              className="right-card-hover"
            >
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Dream Buyer Avatar</h3>
              </div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                Create a detailed and idealized representation of your target customer
              </p>
              <Link href="/generators/icp" className="text-xs" style={{ color: 'var(--accent-hover)', fontWeight: 600 }}>Generate →</Link>
            </div>
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
