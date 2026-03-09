import { createConnection } from 'mysql2/promise';
const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT id FROM users WHERE email = ?', ['zapreviewer@zapcampaigns.com']);
console.log(JSON.stringify(rows));
await conn.end();
