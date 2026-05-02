import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // const domain =
  //   shouldSetDomain && !hostname.startsWith(".")
  //     ? `.${hostname}`
  //     : shouldSetDomain
  //       ? hostname
  //       : undefined;

  return {
    httpOnly: true,
    path: "/",
    // SameSite=Lax — first-party auth cookie, never used in cross-site
    // iframe or POST contexts. SameSite=None previously here was a holdover
    // from the Manus SDK era when the app was platform-proxied through
    // iframes; that requirement disappeared with the switch to custom JWT
    // auth (commit f4dad8f). Chrome's tracking-protection heuristic treats
    // SameSite=None cookies as cross-site tracking signals and purges them
    // on browser-close even in first-party context — the symptom that
    // surfaced in 2026-05-02 ops audit. Lax matches the actual usage
    // pattern (top-level navigations + same-site fetches) and survives
    // browser-restart correctly.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || isSecureRequest(req),
  };
}
