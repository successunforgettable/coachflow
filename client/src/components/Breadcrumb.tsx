import { ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "wouter";

interface BreadcrumbItem {
  label: string;
  path?: string;
}

// Human-readable label overrides for specific path segments
const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin Panel",
  "audit-log": "Audit Log",
  "content-moderation": "Content Moderation",
  "system-health": "System Health",
  users: "Users",
  compliance: "Compliance",
  analytics: "Analytics",
  "ad-copy": "Your Ads",
  "landing-pages": "Your Landing Page",
  hvco: "Your Free Opt-In",
  "hero-mechanisms": "Your Unique Method",
  headlines: "Your Headlines",
  offers: "Your Sales Offer",
  campaigns: "Campaigns",
  settings: "Settings",
  generators: "Generators",
  icp: "Ideal Customer",
  email: "Email Follow-Up",
  whatsapp: "WhatsApp Follow-Up",
  videos: "My Videos",
  "video-credits": "Video Credits",
};

export function Breadcrumb() {
  const [location] = useLocation();

  // Don't show breadcrumbs on home or dashboard
  if (location === "/" || location === "/dashboard") {
    return null;
  }

  const pathSegments = location.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Home", path: "/" },
  ];

  // Build breadcrumb trail
  let currentPath = "";
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;

    // Use override label if available, otherwise auto-format
    const label =
      SEGMENT_LABELS[segment] ??
      segment
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    // Last segment is current page (no link)
    if (index === pathSegments.length - 1) {
      breadcrumbs.push({ label });
    } else {
      breadcrumbs.push({ label, path: currentPath });
    }
  });

  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
      {breadcrumbs.map((crumb, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && <ChevronRight className="h-4 w-4" />}
          {crumb.path ? (
            <Link href={crumb.path}>
              <a className="hover:text-foreground transition-colors flex items-center gap-1">
                {index === 0 && <Home className="h-4 w-4" />}
                {crumb.label}
              </a>
            </Link>
          ) : (
            <span className="text-foreground font-medium">{crumb.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
