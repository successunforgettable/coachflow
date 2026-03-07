import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import Footer from "@/components/Footer";
import { 
  LayoutDashboard, 
  LogOut, 
  PanelLeft, 
  Users, 
  FileText, 
  Target, 
  Zap, 
  Mail, 
  MessageSquare, 
  FileCode, 
  DollarSign, 
  BarChart3, 
  FolderKanban,
  Settings as SettingsIcon,
  Home,
  Shield,
  Coins,
  Video
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { Breadcrumb } from "./Breadcrumb";
import OnboardingProgressTracker from "./OnboardingProgressTracker";
import { trpc } from "@/lib/trpc";

const menuItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Coins, label: "Video Credits", path: "/video-credits", showBadge: true },
  { icon: Video, label: "My Videos", path: "/videos" },
  { icon: FileText, label: "Your Headlines", path: "/headlines" },
  { icon: FileText, label: "Your Free Opt-In", path: "/hvco-titles" },
  { icon: Zap, label: "Your Unique Method", path: "/hero-mechanisms" },
  { icon: Target, label: "Your Ideal Customer", path: "/generators/icp" },
  { icon: FileCode, label: "Your Ads", path: "/ad-copy" },
  { icon: Mail, label: "Your Email Follow-Up", path: "/generators/email" },
  { icon: MessageSquare, label: "Your WhatsApp Follow-Up", path: "/generators/whatsapp" },
  { icon: FileCode, label: "Your Landing Page", path: "/landing-pages" },
  { icon: DollarSign, label: "Your Sales Offer", path: "/offers" },
  { icon: FolderKanban, label: "Campaigns", path: "/campaigns" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: SettingsIcon, label: "Settings", path: "/settings" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

// Credit balance badge component
function CreditBadge() {
  const { data: balance } = trpc.videoCredits.getBalance.useQuery();
  
  if (!balance || balance.balance === 0) return null;
  
  return (
    <span className="ml-auto bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
      {balance.balance}
    </span>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = "/login";
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-3 min-w-0">
                  <img 
                    src="/zap-logo.png" 
                    alt="ZAP Logo" 
                    className="h-20 w-20 object-contain shrink-0"
                  />
                  <span className="font-bold text-xl tracking-tight truncate">
                    ZAP
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {/* Progress Tracker - shown for first 30 days */}
            <div className="px-2">
              <OnboardingProgressTracker />
            </div>

            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal ${
                        isActive
                          ? 'bg-primary/20 text-primary font-semibold border-l-2 border-primary rounded-l-none'
                          : 'text-sidebar-foreground/70 hover:text-sidebar-foreground'
                      }`}
                    >
                      <item.icon
                        className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                      />
                      <span>{item.label}</span>
                      {(item as any).showBadge && <CreditBadge />}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              
              {/* Admin Panel link — visible to admin and superuser roles only */}
              {(user?.role === 'admin' || user?.role === 'superuser') && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={location === '/admin' || location.startsWith('/admin/')}
                    onClick={() => setLocation('/admin')}
                    tooltip="Admin Panel"
                    className={`h-10 transition-all font-normal ${
                      location === '/admin' || location.startsWith('/admin/')
                        ? 'bg-primary/20 text-primary font-semibold border-l-2 border-primary rounded-l-none'
                        : 'text-sidebar-foreground/70 hover:text-sidebar-foreground'
                    }`}
                  >
                    <Shield
                      className={`h-4 w-4 flex-shrink-0 ${location === '/admin' || location.startsWith('/admin/') ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                    <span>Admin Panel</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 space-y-1">
            {/* User info row */}
            <div className="flex items-center gap-3 rounded-lg px-1 py-1 w-full group-data-[collapsible=icon]:justify-center">
              <Avatar className="h-9 w-9 border shrink-0">
                <AvatarFallback className="text-xs font-medium">
                  {user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-medium truncate leading-none">
                  {user?.name || "-"}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-1.5">
                  {user?.email || "-"}
                </p>
              </div>
            </div>
            {/* Logout button — always visible */}
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full rounded-lg px-2 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
            </button>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {/* Header with Logo - Always visible */}
        <div className="flex border-b h-16 items-center justify-between bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
          <div className="flex items-center gap-4">
            {isMobile && <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />}
            <img 
              src="/zap-logo.png" 
              alt="ZAP Logo" 
              className="h-12 w-12 object-contain"
            />
            <span className="font-bold text-2xl tracking-tight">
              ZAP
            </span>
          </div>
          {/* Right side: user info + sign out */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.name}</span>
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
        <main className="flex-1 p-4">
          <Breadcrumb />
          {children}
        </main>
        <Footer />
      </SidebarInset>
    </>
  );
}
