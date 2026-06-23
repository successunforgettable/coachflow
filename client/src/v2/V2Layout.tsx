/**
 * V2Layout — Sprint 1 (updated Sprint 5, nav Sprint 7, auth guard Sprint 7)
 *
 * ISOLATION CONTRACT:
 * - Imports v2-theme.css ONLY here. No other file imports it.
 * - Applies data-v2 attribute so all CSS tokens are scoped.
 * - Does NOT import or modify any existing layout, ThemeProvider, or global CSS.
 * - Renders children inside a full-screen cream container.
 * - On mount, overrides html/body background to cream to prevent dark theme bleed.
 * - On unmount, restores original html/body background.
 *
 * AUTH GUARD:
 * - Calls useAuth() and gates the entire subtree on auth resolution.
 * - While auth.me is loading: renders a minimal loading indicator. Children
 *   are NOT mounted, so no page-level tRPC queries fire (they live inside
 *   the page components which are {children} — unmounted = no hooks run).
 * - If auth resolves with no user (loading=false, user=null): redirects to
 *   /login. Children never mount, no data leaks, no broken error screens.
 * - If auth resolves with a user: renders children normally.
 * - Signal: `loading === false && user === null` — keyed off the definite
 *   resolved-and-empty state, never the transient loading state.
 *
 * NAVIGATION:
 * - Renders a persistent back link at top-left of every V2 page.
 * - Defaults to "← Dashboard" pointing at /v2-dashboard.
 * - Pages can override via backLabel/backHref props.
 * - Pass backHref={null} to suppress (used by the dashboard itself).
 * - Uses wouter navigate() for client-side routing (no full-page reload).
 */
import { useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import "./v2-theme.css";

interface V2LayoutProps {
  children: React.ReactNode;
  /** Label for the back link. Defaults to "Dashboard". */
  backLabel?: string;
  /** Href for the back link. Defaults to "/v2-dashboard". Pass null to hide. */
  backHref?: string | null;
}

const V2_BG = "#F5F1EA";
const FONT_BODY = "'Instrument Sans', sans-serif";

export default function V2Layout({ children, backLabel = "Dashboard", backHref = "/v2-dashboard" }: V2LayoutProps) {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlOverflow = document.documentElement.style.overflowX;
    const prevBodyOverflow = document.body.style.overflowX;

    document.documentElement.style.backgroundColor = V2_BG;
    document.body.style.backgroundColor = V2_BG;
    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";

    return () => {
      document.documentElement.style.backgroundColor = prevHtmlBg;
      document.body.style.backgroundColor = prevBodyBg;
      document.documentElement.style.overflowX = prevHtmlOverflow;
      document.body.style.overflowX = prevBodyOverflow;
    };
  }, []);

  // Auth redirect: only on definite resolved-and-empty, never on loading.
  useEffect(() => {
    if (loading) return; // still resolving — do nothing
    if (!user) {
      window.location.href = "/login";
    }
  }, [loading, user]);

  const handleBack = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (backHref) navigate(backHref);
  }, [backHref, navigate]);

  // Gate: while auth is loading or user is absent, do NOT render children.
  // This prevents page-level tRPC queries from firing (hooks inside children
  // don't run when children aren't mounted) and prevents content flash.
  if (loading || !user) {
    return (
      <div
        data-v2=""
        style={{
          minHeight: "100vh",
          width: "100%",
          backgroundColor: V2_BG,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: "#999", opacity: 0.6 }}>
          Loading…
        </span>
      </div>
    );
  }

  return (
    <div
      data-v2=""
      style={{
        minHeight: "100vh",
        width: "100%",
        overflowX: "hidden",
        backgroundColor: V2_BG,
      }}
    >
      {backHref && (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 12px 0" }}>
          <a
            href={backHref}
            onClick={handleBack}
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: "#999",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ← {backLabel}
          </a>
        </div>
      )}
      {children}
    </div>
  );
}
