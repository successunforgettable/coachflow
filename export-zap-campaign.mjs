import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import schema
import { 
  adCopy, 
  services, 
  adCreatives,
  landingPages,
  emailSequences,
  whatsappSequences,
  hvcoTitles,
  heroMechanisms,
  offers,
  headlines
} from './drizzle/schema.ts';

const DATABASE_URL = process.env.DATABASE_URL;

(async () => {
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);
  
  // Get ZAP service
  const [zapService] = await db.select().from(services).where(eq(services.name, 'ZAP')).limit(1);
  
  if (!zapService) {
    console.log('ZAP service not found');
    await connection.end();
    return;
  }
  
  console.log('Found ZAP service:', zapService.id);
  
  // Export Ad Copy
  const adCopyData = await db.select().from(adCopy).where(eq(adCopy.serviceId, zapService.id));
  fs.writeFileSync('/home/ubuntu/zap-campaign-export/ad-copy/ad-copy.json', JSON.stringify(adCopyData, null, 2));
  console.log(`✅ Exported ${adCopyData.length} ad copy records`);
  
  // Export Ad Creatives
  const adCreativesData = await db.select().from(adCreatives).where(eq(adCreatives.serviceId, zapService.id));
  fs.writeFileSync('/home/ubuntu/zap-campaign-export/ad-creatives/ad-creatives.json', JSON.stringify(adCreativesData, null, 2));
  console.log(`✅ Exported ${adCreativesData.length} ad creative records`);
  
  // Export Landing Pages
  const landingPagesData = await db.select().from(landingPages).where(eq(landingPages.serviceId, zapService.id));
  fs.writeFileSync('/home/ubuntu/zap-campaign-export/landing-pages/landing-pages.json', JSON.stringify(landingPagesData, null, 2));
  console.log(`✅ Exported ${landingPagesData.length} landing page records`);
  
  // Export Email Sequences
  const emailSequencesData = await db.select().from(emailSequences).where(eq(emailSequences.serviceId, zapService.id));
  fs.writeFileSync('/home/ubuntu/zap-campaign-export/email-sequences/email-sequences.json', JSON.stringify(emailSequencesData, null, 2));
  console.log(`✅ Exported ${emailSequencesData.length} email sequence records`);
  
  // Export WhatsApp Sequences
  const whatsappSequencesData = await db.select().from(whatsappSequences).where(eq(whatsappSequences.serviceId, zapService.id));
  fs.writeFileSync('/home/ubuntu/zap-campaign-export/whatsapp-sequences/whatsapp-sequences.json', JSON.stringify(whatsappSequencesData, null, 2));
  console.log(`✅ Exported ${whatsappSequencesData.length} WhatsApp sequence records`);
  
  // Export HVCO Titles
  const hvcoTitlesData = await db.select().from(hvcoTitles).where(eq(hvcoTitles.serviceId, zapService.id));
  fs.writeFileSync('/home/ubuntu/zap-campaign-export/hvco-titles/hvco-titles.json', JSON.stringify(hvcoTitlesData, null, 2));
  console.log(`✅ Exported ${hvcoTitlesData.length} HVCO title records`);
  
  // Export Hero Mechanisms
  const heroMechanismsData = await db.select().from(heroMechanisms).where(eq(heroMechanisms.serviceId, zapService.id));
  fs.writeFileSync('/home/ubuntu/zap-campaign-export/hero-mechanisms/hero-mechanisms.json', JSON.stringify(heroMechanismsData, null, 2));
  console.log(`✅ Exported ${heroMechanismsData.length} hero mechanism records`);
  
  // Export Offers
  const offersData = await db.select().from(offers).where(eq(offers.serviceId, zapService.id));
  fs.writeFileSync('/home/ubuntu/zap-campaign-export/offers/offers.json', JSON.stringify(offersData, null, 2));
  console.log(`✅ Exported ${offersData.length} offer records`);
  
  // Export Headlines
  const headlinesData = await db.select().from(headlines).where(eq(headlines.serviceId, zapService.id));
  fs.writeFileSync('/home/ubuntu/zap-campaign-export/headlines/headlines.json', JSON.stringify(headlinesData, null, 2));
  console.log(`✅ Exported ${headlinesData.length} headline records`);
  
  await connection.end();
  console.log('\n✅ All ZAP campaign data exported successfully!');
})();
