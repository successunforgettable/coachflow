import { useEffect } from "react";

/**
 * OAuthCallback — frontend shim for /manus-oauth/callback
 *
 * The Manus platform registers /manus-oauth/callback as the redirect URI for
 * custom domains. However, the production proxy only forwards /api/* paths to
 * the Express server. This React component runs when the static frontend
 * receives the callback, and immediately redirects to /api/oauth/callback
 * (which IS forwarded to Express) preserving all query parameters so the
 * server can complete the token exchange and set the session cookie.
 */
export default function OAuthCallback() {
  useEffect(() => {
    // Preserve all query params (code, state) and redirect to the API handler
    const search = window.location.search;
    window.location.replace(`/api/oauth/callback${search}`);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
      <div className="text-center">
        <div className="text-2xl font-bold text-[#1A1A1A] mb-2">ZAP</div>
        <div className="text-sm text-[#666]">Completing sign in…</div>
      </div>
    </div>
  );
}
