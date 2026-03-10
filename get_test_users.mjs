import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT id, email, name FROM users WHERE email LIKE 'test-%@zapcampaigns.com' ORDER BY id"
);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
