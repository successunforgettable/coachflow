/**
 * V2Layout — Sprint 1 (updated Sprint 5)
 *
 * ISOLATION CONTRACT:
 * - Imports v2-theme.css ONLY here. No other file imports it.
 * - Applies data-v2 attribute so all CSS tokens are scoped.
 * - Does NOT import or modify any existing layout, ThemeProvider, or global CSS.
 * - Renders children inside a full-screen cream container.
 * - On mount, overrides html/body background to cream to prevent dark theme bleed.
 * - On unmount, restores original html/body background.
 */
import { useEffect } from "react";
import "./v2-theme.css";

interface V2LayoutProps {
  children: React.ReactNode;
}

const V2_BG = "#F5F1EA";

export default function V2Layout({ children }: V2LayoutProps) {
  useEffect(() => {
    // Save original values
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlOverflow = document.documentElement.style.overflowX;
    const prevBodyOverflow = document.body.style.overflowX;

    // Apply cream background to html and body to prevent dark theme bleed
    document.documentElement.style.backgroundColor = V2_BG;
    document.body.style.backgroundColor = V2_BG;
    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";

    return () => {
      // Restore original values when leaving V2
      document.documentElement.style.backgroundColor = prevHtmlBg;
      document.body.style.backgroundColor = prevBodyBg;
      document.documentElement.style.overflowX = prevHtmlOverflow;
      document.body.style.overflowX = prevBodyOverflow;
    };
  }, []);

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
      {children}
    </div>
  );
}
