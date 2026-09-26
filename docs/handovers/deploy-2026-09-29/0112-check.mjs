// READ-ONLY check for migration 0112 (ghl_access_tokens: reconnectRequiredAt, lastRenewalError).
// Runs inside a READ ONLY transaction; refuses any target that is not production MySQL.
// Usage: railway run --environment production --service coachflow node docs/handovers/deploy-2026-09-29/0112-check.mjs
import mysql from "../../../node_modules/mysql2/promise.js";
const c = await mysql.createConnection(process.env.DATABASE_URL);
await c.query("SET SESSION TRANSACTION READ ONLY");
await c.query("START TRANSACTION READ ONLY");
const [[t]] = await c.query("SELECT @@version_comment vc, DATABASE() db, @@transaction_read_only ro, NOW() at");
console.log("target:", t.vc, "|", t.db, "| read_only =", t.ro, "|", t.at);
if (t.vc !== "MySQL Community Server - GPL" || t.db !== "railway" || Number(t.ro) !== 1) { console.log("REFUSED: not production / not read-only"); process.exit(2); }
const [cols] = await c.query("SELECT COLUMN_NAME c, COLUMN_TYPE t, IS_NULLABLE n FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='railway' AND TABLE_NAME='ghl_access_tokens' ORDER BY ORDINAL_POSITION");
console.log("columns (" + cols.length + "):", cols.map((r) => `${r.c}:${r.t}:${r.n}`).join("  "));
const has = (n) => cols.some((r) => r.c === n);
console.log("reconnectRequiredAt present:", has("reconnectRequiredAt"), "| lastRenewalError present:", has("lastRenewalError"));
const [[n]] = await c.query("SELECT COUNT(*) n FROM ghl_access_tokens");
console.log("row count:", n.n);
if (has("reconnectRequiredAt")) {
  const [[r]] = await c.query("SELECT COUNT(*) n FROM ghl_access_tokens WHERE reconnectRequiredAt IS NOT NULL");
  console.log("rows with reconnectRequiredAt set:", r.n);
}
await c.query("ROLLBACK"); await c.end();
