export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Custom auth: redirect to the ZAP login page (no Manus OAuth involved)
export const getLoginUrl = (returnPath?: string) => {
  const path = returnPath ? `?returnTo=${encodeURIComponent(returnPath)}` : "";
  return `/login${path}`;
};
