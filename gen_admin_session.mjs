import { SignJWT } from 'jose';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const APP_ID = process.env.VITE_APP_ID;

if (!JWT_SECRET) {
  console.error('JWT_SECRET not found');
  process.exit(1);
}

// Create session token matching the SDK's signSession format
const secretKey = new TextEncoder().encode(JWT_SECRET);
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const issuedAt = Date.now();
const expirationSeconds = Math.floor((issuedAt + ONE_YEAR_MS) / 1000);

const token = await new SignJWT({
  openId: 'YAadMRwhwu3fpQ3qJTRrw4',
  appId: APP_ID || 'coachflow',
  name: 'Arfeen Khan',
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setExpirationTime(expirationSeconds)
  .sign(secretKey);

console.log('TOKEN:' + token);
