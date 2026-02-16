import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
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
} from "lucide-react";

export default function Dashboard() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [location] = useLocation();

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

  const { data: landingPages } = trpc.landingPages.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: offers } = trpc.offers.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Redirect to login if not authenticated
  if (!authLoading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
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
  ];

  const navigationItems = [
    { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
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

        <nav className="flex-1 p-4 space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.title}</span>
                </a>
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

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">{services?.length || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Generated Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">
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
                <p className="text-3xl font-bold text-foreground">6</p>
              </CardContent>
            </Card>
          </div>

          {/* Generators Grid */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">AI Generators</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generators.map((generator) => {
                const Icon = generator.icon;
                return (
                  <Link key={generator.href} href={generator.href}>
                    <Card className="cursor-pointer hover:border-primary transition-colors h-full">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-accent">
                              <Icon className={`w-6 h-6 ${generator.color}`} />
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
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Get started with your marketing automation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/services">
                <Button className="w-full justify-start" variant="outline">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Create New Service
                </Button>
              </Link>
              <Link href="/generators/icp">
                <Button className="w-full justify-start" variant="outline">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Customer Profile
                </Button>
              </Link>
              <Link href="/generators/email">
                <Button className="w-full justify-start" variant="outline">
                  <Mail className="w-4 h-4 mr-2" />
                  Create Email Sequence
                </Button>
              </Link>
              <Link href="/campaigns">
                <Button className="w-full justify-start" variant="outline">
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Organize Campaign
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
