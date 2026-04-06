import { ReactNode } from "react";
import { Link, useLocation } from "wouter";

const navLinks = [
  { label: "Dashboard", href: "/admin", exact: true },
  { label: "Users", href: "/admin", exact: true },
  { label: "Audit Log", href: "/admin/audit-log" },
  { label: "Content Moderation", href: "/admin/content-moderation" },
  { label: "Compliance", href: "/admin/compliance" },
  { label: "System Health", href: "/admin/system-health" },
  { label: "Test Campaigns", href: "/admin/test-campaigns" },
];

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [path] = useLocation();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return path === href;
    return path.startsWith(href);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          minWidth: 220,
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          background: "#1A1624",
          display: "flex",
          flexDirection: "column",
          padding: "24px 16px",
          boxSizing: "border-box",
          zIndex: 50,
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            fontFamily: "'Fraunces', serif",
            fontStyle: "italic",
            fontSize: 22,
            fontWeight: 700,
            color: "#fff",
            marginBottom: 32,
            paddingLeft: 8,
          }}
        >
          ZAP Admin
        </div>

        {/* Nav links */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {navLinks.map((link) => {
            const active = isActive(link.href, link.exact);
            return (
              <Link key={link.label} href={link.href}>
                <span
                  style={{
                    display: "block",
                    padding: "8px 14px",
                    borderRadius: 9999,
                    fontSize: 14,
                    fontWeight: active ? 600 : 400,
                    color: active ? "#fff" : "#999",
                    background: active ? "#FF5B1D" : "transparent",
                    cursor: "pointer",
                    transition: "color 0.15s",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.color = "#ccc";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.color = "#999";
                  }}
                >
                  {link.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main
        style={{
          marginLeft: 220,
          flex: 1,
          overflowY: "auto",
          padding: 32,
          minHeight: "100vh",
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>
    </div>
  );
}
