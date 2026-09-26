// GUARDED APPLY of drizzle/0112_ghl_reconnect_required.sql — the ONLY write in the 9/29 runbook.
// Runs ONLY with Arfeen's explicit go-ahead in the immediately preceding message, and only with CONFIRM=APPLY-0112.
// Aborts unless: target is production MySQL (`MySQL Community Server - GPL`, database `railway`), the two columns are
// ABSENT, and the SQL file contains exactly one ALTER TABLE on ghl_access_tokens adding exactly those two columns.
// Usage: railway run --environment production --service coachflow sh -c 'CONFIRM=APPLY-0112 node docs/handovers/deploy-2026-09-29/0112-apply.mjs'
import mysql from "../../../node_modules/mysql2/promise.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const abort = (why) => { console.log("ABORTED — nothing written:", why); process.exit(2); };
if (process.env.CONFIRM !== "APPLY-0112") abort("CONFIRM=APPLY-0112 not set");
const raw = readFileSync(join(here, "..", "..", "..", "drizzle", "0112_ghl_reconnect_required.sql"), "utf8");
const sql = raw.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").trim().replace(/;\s*$/, "");
const expected = /^ALTER TABLE `ghl_access_tokens`\s+ADD COLUMN `reconnectRequiredAt` TIMESTAMP NULL DEFAULT NULL,\s+ADD COLUMN `lastRenewalError` VARCHAR\(512\) NULL DEFAULT NULL$/;
if (!expected.test(sql)) abort("migration SQL is not the reviewed statement: " + JSON.stringify(sql));
const c = await mysql.createConnection(process.env.DATABASE_URL);
const [[t]] = await c.query("SELECT @@version_comment vc, DATABASE() db");
console.log("target:", t.vc, "|", t.db);
if (t.vc !== "MySQL Community Server - GPL") abort("target is not production MySQL (" + t.vc + ")");
if (t.db !== "railway") abort("database is not railway (" + t.db + ")");
const colsOf = async () => (await c.query("SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='railway' AND TABLE_NAME='ghl_access_tokens'"))[0].map((r) => r.c);
const before = await colsOf();
if (before.length === 0) abort("ghl_access_tokens not found");
if (before.includes("reconnectRequiredAt") || before.includes("lastRenewalError")) abort("0112 columns already present — someone applied it; stop and report");
const [[b]] = await c.query("SELECT COUNT(*) n FROM ghl_access_tokens");
console.log("before: " + before.length + " columns, " + b.n + " rows. Applying:\n" + sql);
await c.query(sql);
const after = await colsOf();
const [[a]] = await c.query("SELECT COUNT(*) n FROM ghl_access_tokens");
const added = after.filter((x) => !before.includes(x));
console.log("after: " + after.length + " columns, " + a.n + " rows. Added:", added.join(", "));
const ok = added.length === 2 && added.includes("reconnectRequiredAt") && added.includes("lastRenewalError") && before.every((x) => after.includes(x)) && Number(a.n) === Number(b.n);
console.log(ok ? "APPLIED — verified: exactly the two columns added, no column lost, row count unchanged" : "⚠️ VERIFY FAILED — report before anything else");
await c.end();
process.exit(ok ? 0 : 3);
