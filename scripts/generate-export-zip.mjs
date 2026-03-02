/**
 * Standalone script to generate the campaign export ZIP for evidence inspection.
 * Bypasses HTTP auth by connecting directly to the database.
 */
import { createConnection } from "mysql2/promise";
import archiver from "archiver";
import fs from "fs";
import { createWriteStream } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// Load the formatters
const formatters = await import(path.join(projectRoot, "server/campaignExportFormatters.ts")).catch(async () => {
  // Try compiled JS
  return import(path.join(projectRoot, "dist/server/campaignExportFormatters.js")).catch(() => null);
});

if (!formatters) {
  console.error("Could not load formatters. Run with tsx instead.");
  process.exit(1);
}

const {
  formatSalesOffer, formatUniqueMethod, formatFreeOptIn, formatHeadlines,
  formatIdealCustomerProfile, formatAdCopy, formatVideoScripts, formatLandingPage,
  formatEmailSequence, formatWhatsappSequence, generateReadme
} = formatters;

const conn = await createConnection(process.env.DATABASE_URL);
const campaignId = 90002;

// Fetch campaign
const [campaigns] = await conn.execute("SELECT * FROM campaigns WHERE id = ?", [campaignId]);
const campaign = campaigns[0];
console.log("Campaign:", campaign.name);

// Fetch all assets
const [offersRows] = await conn.execute("SELECT * FROM offers WHERE campaignId = ? ORDER BY createdAt DESC", [campaignId]);
const [heroRows] = await conn.execute("SELECT * FROM heroMechanisms WHERE campaignId = ? ORDER BY createdAt DESC", [campaignId]);
const [hvcoRows] = await conn.execute("SELECT * FROM hvcoTitles WHERE campaignId = ? ORDER BY createdAt DESC", [campaignId]);
const [headlineRows] = await conn.execute("SELECT * FROM headlines WHERE campaignId = ? ORDER BY createdAt DESC", [campaignId]);
const [icpRows] = await conn.execute("SELECT * FROM idealCustomerProfiles WHERE campaignId = ? ORDER BY createdAt DESC", [campaignId]);
const [adCopyRows] = await conn.execute("SELECT * FROM adCopy WHERE campaignId = ? ORDER BY createdAt DESC", [campaignId]);
const [adCreativeRows] = await conn.execute("SELECT * FROM adCreatives WHERE campaignId = ? ORDER BY createdAt DESC", [campaignId]);
const [videoScriptRows] = await conn.execute("SELECT * FROM videoScripts WHERE campaignId = ? ORDER BY createdAt DESC", [campaignId]);
const [videoRows] = await conn.execute("SELECT * FROM videos WHERE campaignId = ? ORDER BY createdAt DESC", [campaignId]);
const [landingPageRows] = await conn.execute("SELECT * FROM landingPages WHERE campaignId = ? ORDER BY createdAt DESC", [campaignId]);
const [emailRows] = await conn.execute("SELECT * FROM emailSequences WHERE campaignId = ? ORDER BY createdAt DESC", [campaignId]);
const [whatsappRows] = await conn.execute("SELECT * FROM whatsappSequences WHERE campaignId = ? ORDER BY createdAt DESC", [campaignId]);

await conn.end();

console.log("\nRow counts:");
console.log("  01-sales-offer:", offersRows.length);
console.log("  02-unique-method:", heroRows.length);
console.log("  03-free-opt-in:", hvcoRows.length);
console.log("  04-headlines:", headlineRows.length);
console.log("  05-ideal-customer:", icpRows.length);
console.log("  06-ad-copy:", adCopyRows.length);
console.log("  07-ad-images:", adCreativeRows.filter(r => r.imageUrl).length);
console.log("  08-video-scripts:", videoScriptRows.length);
console.log("  09-landing-page:", landingPageRows.length);
console.log("  10-email:", emailRows.length);
console.log("  11-whatsapp:", whatsappRows.length);

// Build step summaries
const stepSummaries = [
  { number: 1, name: "Sales Offer", included: offersRows.length > 0 },
  { number: 2, name: "Unique Method", included: heroRows.length > 0 },
  { number: 3, name: "Free Opt-In", included: hvcoRows.length > 0 },
  { number: 4, name: "Headlines", included: headlineRows.length > 0 },
  { number: 5, name: "Ideal Customer Profile", included: icpRows.length > 0 },
  { number: 6, name: "Ad Copy", included: adCopyRows.length > 0 },
  { number: 7, name: "Ad Images", included: adCreativeRows.filter(r => r.imageUrl).length > 0 },
  { number: 8, name: "Ad Videos", included: videoScriptRows.length > 0 || videoRows.filter(v => v.videoUrl && v.creatomateStatus === "succeeded").length > 0 },
  { number: 9, name: "Landing Page", included: landingPageRows.length > 0 },
  { number: 10, name: "Email Follow-Up", included: emailRows.length > 0 },
  { number: 11, name: "WhatsApp Follow-Up", included: whatsappRows.length > 0 },
];
for (const s of stepSummaries) {
  if (!s.included) s.reason = "No assets generated";
}

// Create ZIP
const outputPath = "/tmp/campaign-export-evidence.zip";
const output = createWriteStream(outputPath);
const archive = archiver("zip", { zlib: { level: 6 } });

archive.pipe(output);

// Add text assets (skip empty steps)
if (offersRows.length > 0) archive.append(formatSalesOffer(offersRows), { name: "01-sales-offer/sales-offer.md" });
if (heroRows.length > 0) archive.append(formatUniqueMethod(heroRows), { name: "02-unique-method/unique-method.md" });
if (hvcoRows.length > 0) archive.append(formatFreeOptIn(hvcoRows), { name: "03-free-opt-in/free-opt-in.md" });
if (headlineRows.length > 0) archive.append(formatHeadlines(headlineRows), { name: "04-headlines/headlines.md" });
if (icpRows.length > 0) archive.append(formatIdealCustomerProfile(icpRows), { name: "05-ideal-customer-profile/icp.md" });
if (adCopyRows.length > 0) archive.append(formatAdCopy(adCopyRows), { name: "06-ad-copy/ad-copy.md" });
if (videoScriptRows.length > 0) archive.append(formatVideoScripts(videoScriptRows), { name: "08-ad-videos/video-scripts.md" });
if (landingPageRows.length > 0) archive.append(formatLandingPage(landingPageRows), { name: "09-landing-page/landing-page.md" });
if (emailRows.length > 0) archive.append(formatEmailSequence(emailRows), { name: "10-email-follow-up/email-sequence.md" });
if (whatsappRows.length > 0) archive.append(formatWhatsappSequence(whatsappRows), { name: "11-whatsapp-follow-up/whatsapp-sequence.md" });

// README
archive.append(generateReadme(campaign.name, new Date(), stepSummaries), { name: "README.txt" });

await archive.finalize();

output.on("close", () => {
  console.log(`\nZIP created: ${outputPath} (${archive.pointer()} bytes)`);
  console.log("Done.");
});
