/**
 * V2Layout — Sprint 1
 *
 * ISOLATION CONTRACT:
 * - Imports v2-theme.css ONLY here. No other file imports it.
 * - Applies data-v2 attribute so all CSS tokens are scoped.
 * - Does NOT import or modify any existing layout, ThemeProvider, or global CSS.
 * - Renders children inside a full-screen cream container.
 */
import "./v2-theme.css";

interface V2LayoutProps {
  children: React.ReactNode;
}

export default function V2Layout({ children }: V2LayoutProps) {
  return (
    <div data-v2="" style={{ minHeight: "100vh" }}>
      {children}
    </div>
  );
}
