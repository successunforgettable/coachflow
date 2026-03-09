import { createConnection } from 'mysql2/promise';
const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT id FROM services WHERE userId = 7110001 LIMIT 1');
console.log(JSON.stringify(rows));
await conn.end();
