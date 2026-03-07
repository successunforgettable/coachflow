import "dotenv/config";
import { SignJWT } from "jose";

// Generate a session token in the exact same format as sdk.signSession()
const JWT_SECRET = process.env.JWT_SECRET;
const APP_ID = process.env.VITE_APP_ID ?? "";

if (!JWT_SECRET) {
  console.error("JWT_SECRET not set");
  process.exit(1);
}

const openId = "zap_test_e2e_newuser_001";
const name = "Test User E2E";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const issuedAt = Date.now();
const expiresInMs = ONE_YEAR_MS;
const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
const secretKey = new TextEncoder().encode(JWT_SECRET);

const token = await new SignJWT({
  openId,
  appId: APP_ID,
  name,
})
  .setProtectedHeader({ alg: "HS256", typ: "JWT" })
  .setExpirationTime(expirationSeconds)
  .sign(secretKey);

console.log("SESSION_TOKEN=" + token);
