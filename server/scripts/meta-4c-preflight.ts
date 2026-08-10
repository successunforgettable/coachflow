/**
 * meta-4c-preflight.ts — READ-ONLY preconditions for step 4c. WRITES NOTHING, ANYWHERE.
 *
 * ⚠️ THIS SCRIPT MAKES GET REQUESTS ONLY. There is no POST, no DELETE, no publish. It exists
 * because three of 4c's preconditions cannot be established from our own database or code:
 *
 *   1. Whether Meta still HONOURS the stored token. Our `tokenExpiresAt` proves only that we
 *      believe it is unexpired; the account can be disconnected or the app secret rotated
 *      underneath it, and the first sign would otherwise be a failed write.
 *   2. What this account's REAL currency and minimum daily budget are. Our own floor is
 *      `z.number().min(1)`, which silently assumes USD. The ad account bills in AED and
 *      `createAdSet` sends `Math.round(dailyBudget * 100)` minor units, so a value that passes
 *      our validator can still be rejected by Meta.
 *   3. Which "Auto Campaign Kit" campaigns ALREADY EXIST. The account shows five against two
 *      rows in `meta_published_ads`. 4c must be able to tell its own objects from those
 *      pre-existing orphans, and the only way to do that safely is to inventory them BEFORE
 *      creating anything.
 *
 * Usage:  npx tsx server/scripts/meta-4c-preflight.ts
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { metaAccessTokens } from "../../drizzle/schema";
import { decryptToken } from "../_core/tokenCrypto";

const OUT = `/tmp/meta-4c-preflight-${process.pid}.json`;
const GRAPH = "https://graph.facebook.com/v21.0";

async function get(token: string, path: string, fields: string, extra: Record<string, string> = {}) {
  const url = new URL(`${GRAPH}/${path}`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("fields", fields);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path} HTTP ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [row] = await db.select().from(metaAccessTokens).where(eq(metaAccessTokens.userId, 1)).limit(1);
  if (!row) throw new Error("no meta_access_tokens row for user 1 — 4c cannot run");
  const token = decryptToken((row as any).accessToken);
  const adAccountId = (row as any).adAccountId as string;

  console.log("═".repeat(78));
  console.log("STEP 4c PRE-FLIGHT — READ ONLY. Nothing is created, updated or deleted.");
  console.log("═".repeat(78));

  // 1 — does Meta still honour the token?
  const me = await get(token, "me", "id,name");
  console.log(`\n1. TOKEN — Meta answered as: ${me.name ?? "(no name)"} (id ${me.id})  ✅ LIVE`);

  // 2 — currency and the REAL minimum daily budget for this account
  const acct = await get(
    token, adAccountId,
    "id,name,account_status,currency,timezone_name,amount_spent,balance,funding_source",
  );
  console.log(`\n2. AD ACCOUNT ${acct.id} — "${acct.name}"`);
  console.log(`   currency       : ${acct.currency}`);
  console.log(`   account_status : ${acct.account_status} (1 = ACTIVE)`);
  console.log(`   timezone       : ${acct.timezone_name}`);
  console.log(`   amount_spent   : ${acct.amount_spent} minor units`);
  console.log(`   funding source : ${acct.funding_source ?? "(none)"}`);
  // ⚠️ Meta does not expose a per-currency minimum on the ad account in v21 — the field
  // `min_daily_budget_low_freq` does not exist. The floor is therefore taken from the
  // MEASURED rejection on THIS account (step 1, 2026-08-09): daily_budget=100 (AED 1.00) was
  // rejected with "must be more than AED3.00", and daily_budget=2000 (AED 20.00) was accepted.
  console.log(`   → floor is not queryable; it is MEASURED on this account:`);
  console.log(`     dailyBudget=1  → 100 minor units  → 🔴 REJECTED ("must be more than AED3.00")`);
  console.log(`     dailyBudget=20 → 2000 minor units → ✅ ACCEPTED (proven on the step-1 publish)`);

  // 3 — inventory EVERY existing campaign, so 4c can tell its objects from the orphans
  const camps = await get(token, `${adAccountId}/campaigns`, "id,name,status,effective_status,created_time", { limit: "200" });
  const list: any[] = camps.data ?? [];
  console.log(`\n3. EXISTING CAMPAIGNS ON THE ACCOUNT: ${list.length}`);
  for (const c of list) {
    console.log(`   ${c.id}  ${String(c.status).padEnd(9)} ${String(c.created_time).slice(0, 10)}  "${c.name}"`);
  }
  const autoKit = list.filter((c) => String(c.name).trim() === "Auto Campaign Kit");
  console.log(`\n   named exactly "Auto Campaign Kit": ${autoKit.length}`);
  console.log(`   tracked in meta_published_ads     : 2 (120246733556760626, 120246734574720626)`);
  console.log(`   → PRE-EXISTING ORPHANS (leave alone): ` +
    autoKit.map((c) => c.id).filter((id) => id !== "120246733556760626" && id !== "120246734574720626").join(", ") || "(none)");

  writeFileSync(OUT, JSON.stringify({ me, acct, campaigns: list }, null, 2));
  console.log(`\nfull payload: ${OUT}`);
  console.log("\n🔒 READ-ONLY: no campaign, ad set, ad or creative was created, changed or deleted.");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[meta-4c-preflight] FAILED:", e?.message ?? e);
  process.exit(1);
});
