export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
// IMPORTANT: The Manus platform registers /manus-oauth/callback as the redirect URI
// for custom domains (e.g. zapcampaigns.com). Both redirectUri and state must use
// this path so the SDK's ExchangeToken call matches what the server received.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  // Use the platform-registered callback path for custom domains
  const redirectUri = `${window.location.origin}/manus-oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
