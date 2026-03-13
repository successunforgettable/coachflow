import 'dotenv/config';
import mysql from 'mysql2/promise';
import { SignJWT } from 'jose';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT id, email, openId FROM users WHERE email = 'test-fitness@zapcampaigns.com' LIMIT 1"
);
const user = rows[0];
console.error('User:', user.id, user.email, 'openId:', user.openId);

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const token = await new SignJWT({
  openId: user.openId,
  appId: process.env.VITE_APP_ID,
  name: user.email
})
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('365d')
  .sign(secret);

console.log(token);
await conn.end();
process.exit(0);
