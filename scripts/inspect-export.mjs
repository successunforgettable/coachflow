/**
 * Standalone script to generate and inspect the campaign export ZIP
 * for Item 2.4 evidence screenshots.
 */
import { createConnection } from "mysql2/promise";
import archiver from "archiver";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await createConnection(DATABASE_URL);

// Fetch all assets for campaign 90002
const campaignId = 90002;

const [campaigns] = await conn.execute("SELECT * FROM campaigns WHERE id = ?", [campaignId]);
const campaign = campaigns[0];
console.log("Campaign:", campaign.name);

// Count assets per step
const tables = [
  { name: "offers", label: "01-sales-offer" },
  { name: "hero_mechanisms", label: "02-unique-method" },
  { name: "hvco_titles", label: "03-free-opt-in" },
  { name: "headlines", label: "04-headlines" },
  { name: "ideal_customer_profiles", label: "05-ideal-customer" },
  { name: "ad_copy", label: "06-ads" },
  { name: "ad_creatives", label: "07-ad-images" },
  { name: "video_scripts", label: "08-video-scripts" },
  { name: "landing_pages", label: "09-landing-page" },
  { name: "email_sequences", label: "10-email-follow-up" },
  { name: "whatsapp_sequences", label: "11-whatsapp-follow-up" },
];

console.log("\nAsset counts per step:");
for (const { name, label } of tables) {
  try {
    const [rows] = await conn.execute(`SELECT COUNT(*) as cnt FROM ${name} WHERE campaign_id = ?`, [campaignId]);
    console.log(`  ${label}: ${rows[0].cnt} rows`);
  } catch (e) {
    console.log(`  ${label}: ERROR - ${e.message}`);
  }
}

await conn.end();
console.log("\nDone.");
