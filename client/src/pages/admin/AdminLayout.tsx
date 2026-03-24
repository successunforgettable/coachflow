import { ReactNode } from "react";
import { Link, useLocation } from "wouter";

const navLinks = [
  { label: "Dashboard", href: "/admin", exact: true },
  { label: "Users", href: "/admin", exact: true },
  { label: "Subscriptions", href: "/admin/compliance" },
  { label: "Content", href: "/admin/content-moderation" },
  { label: "Settings", href: "/admin/system-health" },
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
          justifyContent: "space-between",
        }}
      >
        <div>
          {/* Wordmark */}
          <div
            style={{
              fontFamily: "'Fraunces', serif",
              fontStyle: "italic",
              fontSize: 22,
              fontWeight: 900,
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
                      padding: "10px 14px",
                      borderRadius: 9999,
                      fontSize: 14,
                      fontFamily: "'Instrument Sans', sans-serif",
                      fontWeight: active ? 600 : 400,
                      color: active ? "#fff" : "#777",
                      background: active ? "#FF5B1D" : "transparent",
                      cursor: "pointer",
                      transition: "color 0.15s, background 0.15s",
                      textDecoration: "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.color = "#bbb";
                    }}
                    onMouseLeave={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.color = "#777";
                    }}
                  >
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Back to dashboard */}
        <Link href="/v2-dashboard">
          <span style={{
            display: "block",
            padding: "10px 14px",
            fontSize: 13,
            fontFamily: "'Instrument Sans', sans-serif",
            color: "#666",
            cursor: "pointer",
            textDecoration: "none",
          }}>
            ← Back to Dashboard
          </span>
        </Link>
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
          background: "#F5F1EA",
        }}
      >
        {children}
      </main>
    </div>
  );
}
