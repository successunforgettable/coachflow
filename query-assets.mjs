import { getDb } from './server/db.ts';
import { campaigns, campaignAssets, adCreatives, videos } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const db = await getDb();

// Get campaign
const campaign = await db.query.campaigns.findFirst({
  where: eq(campaigns.id, 90002)
});

console.log('Campaign:', campaign?.name);

// Get all assets
const allAssets = await db.query.campaignAssets.findMany({
  where: eq(campaignAssets.campaignId, 90002)
});

// Count by type
const counts = {};
const assetTypes = ['headline', 'hvco', 'hero_mechanism', 'ad_copy', 'email_sequence', 'whatsapp_sequence', 'landing_page', 'offer', 'icp'];

assetTypes.forEach(type => {
  counts[type] = allAssets.filter(a => a.assetType === type).length;
});

// Count ad creatives and videos
const adCreativesCount = await db.query.adCreatives.findMany({
  where: eq(adCreatives.campaignId, 90002)
});

const videosCount = await db.query.videos.findMany({
  where: eq(videos.campaignId, 90002)
});

const assetCounts = {
  ...counts,
  ad_creatives: adCreativesCount.length,
  videos: videosCount.length
};

console.log('assetCounts:', JSON.stringify(assetCounts, null, 2));
