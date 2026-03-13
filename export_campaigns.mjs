import { createConnection } from 'mysql2/promise';
import { createWriteStream, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

const TEST_EMAILS = [
  'test-fitness@zapcampaigns.com',
  'test-realestate@zapcampaigns.com',
  'test-mindset@zapcampaigns.com',
  'test-relationships@zapcampaigns.com',
  'test-business@zapcampaigns.com',
];

const CAMPAIGN_NAMES = [
  'Fitness_Coaching',
  'Real_Estate_Investment_Coaching',
  'Mindset_Performance_Coaching',
  'Relationship_Coaching',
  'Business_Launch_Coaching',
];

function safeStr(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    return Object.entries(v)
      .map(([k, val]) => `${k.charAt(0).toUpperCase() + k.slice(1)}:\n${val}`)
      .join('\n\n---\n\n');
  }
  return String(v);
}

function parseJsonField(v) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return v; }
}

const OUTPUT_DIR = '/home/ubuntu/campaign_exports';
if (existsSync(OUTPUT_DIR)) rmSync(OUTPUT_DIR, { recursive: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

for (let i = 0; i < TEST_EMAILS.length; i++) {
  const email = TEST_EMAILS[i];
  const name = CAMPAIGN_NAMES[i];
  console.log(`\n=== Processing ${email} ===`);

  // Get user
  const [users] = await conn.execute('SELECT id, email, name FROM users WHERE email = ?', [email]);
  if (!users.length) { console.log('  User not found, skipping'); continue; }
  const user = users[0];
  const uid = user.id;

  // Get service
  const [svcs] = await conn.execute('SELECT * FROM services WHERE userId = ? LIMIT 1', [uid]);
  const svc = svcs[0] || {};

  // Get ICP
  const [icps] = await conn.execute('SELECT * FROM idealCustomerProfiles WHERE serviceId = ? LIMIT 1', [svc.id]);
  const icp = icps[0] || {};

  // Get offer
  const [offers] = await conn.execute('SELECT * FROM offers WHERE serviceId = ? LIMIT 1', [svc.id]);
  const offer = offers[0] || {};

  // Get hero mechanisms
  const [heroes] = await conn.execute('SELECT * FROM heroMechanisms WHERE serviceId = ? ORDER BY id', [svc.id]);

  // Get HVCO titles
  const [hvcos] = await conn.execute('SELECT * FROM hvcoTitles WHERE serviceId = ? ORDER BY id', [svc.id]);

  // Get headlines
  const [headlines] = await conn.execute('SELECT * FROM headlines WHERE serviceId = ? ORDER BY id', [svc.id]);

  // Get ad copy
  const [adCopies] = await conn.execute('SELECT * FROM adCopy WHERE serviceId = ? ORDER BY id', [svc.id]);

  // Get landing page
  const [lps] = await conn.execute('SELECT * FROM landingPages WHERE serviceId = ? LIMIT 1', [svc.id]);
  const lp = lps[0] || {};

  // Get email sequences
  const [emailSeqs] = await conn.execute('SELECT * FROM emailSequences WHERE serviceId = ? ORDER BY id', [svc.id]);

  // Get WhatsApp sequences
  const [waSeqs] = await conn.execute('SELECT * FROM whatsappSequences WHERE serviceId = ? ORDER BY id', [svc.id]);

  // Get meta published ads (node 11)
  const [metaAds] = await conn.execute('SELECT * FROM metaPublishedAds WHERE userId = ? LIMIT 1', [uid]).catch(() => [[]]);

  // Create folder for this campaign
  const campaignDir = join(OUTPUT_DIR, `${i + 1}_${name}`);
  mkdirSync(campaignDir, { recursive: true });

  // ── Node 1: Service Profile ──────────────────────────────────────────────────
  let node1 = `ZAP CAMPAIGN EXPORT — NODE 1: SERVICE PROFILE
${'='.repeat(60)}
Campaign: ${name.replace(/_/g, ' ')}
Email: ${email}
Generated: ${new Date().toISOString()}

SERVICE NAME: ${svc.name || ''}
CATEGORY: ${svc.category || ''}
TARGET CUSTOMER: ${svc.targetCustomer || ''}
MAIN BENEFIT: ${svc.mainBenefit || ''}
PAIN POINTS: ${svc.painPoints || ''}
HVCO TOPIC: ${svc.hvcoTopic || ''}
UNIQUE MECHANISM: ${svc.uniqueMechanismSuggestion || svc.mechanismDescriptor || ''}
DESCRIPTION: ${svc.description || ''}
`;
  writeFileSync(join(campaignDir, '01_Service_Profile.txt'), node1);
  console.log('  ✓ Node 1: Service Profile');

  // ── Node 2: ICP ──────────────────────────────────────────────────────────────
  let node2 = `ZAP CAMPAIGN EXPORT — NODE 2: IDEAL CUSTOMER PROFILE
${'='.repeat(60)}

PROFILE NAME: ${icp.name || ''}
INTRODUCTION: ${icp.introduction || ''}

DEMOGRAPHICS:
${safeStr(parseJsonField(icp.demographics))}

PSYCHOGRAPHICS:
${safeStr(parseJsonField(icp.psychographics))}

TOP FEARS:
${safeStr(parseJsonField(icp.fears))}

GOALS & DESIRES:
${safeStr(parseJsonField(icp.goals))}

OBJECTIONS:
${safeStr(parseJsonField(icp.objections))}

BUYING TRIGGERS:
${safeStr(parseJsonField(icp.buyingTriggers))}

VALUES:
${safeStr(parseJsonField(icp.values))}
`;
  writeFileSync(join(campaignDir, '02_Ideal_Customer_Profile.txt'), node2);
  console.log('  ✓ Node 2: ICP');

  // ── Node 3: Offer ─────────────────────────────────────────────────────────────
  let node3 = `ZAP CAMPAIGN EXPORT — NODE 3: OFFER
${'='.repeat(60)}

PRODUCT NAME: ${offer.productName || ''}

${'─'.repeat(60)}
GODFATHER OFFER ANGLE
${'─'.repeat(60)}
${safeStr(parseJsonField(offer.godfatherAngle))}

${'─'.repeat(60)}
FREE ANGLE
${'─'.repeat(60)}
${safeStr(parseJsonField(offer.freeAngle))}

${'─'.repeat(60)}
DOLLAR ANGLE
${'─'.repeat(60)}
${safeStr(parseJsonField(offer.dollarAngle))}

${'─'.repeat(60)}
ACTIVE ANGLE
${'─'.repeat(60)}
${safeStr(parseJsonField(offer.activeAngle))}
`;
  writeFileSync(join(campaignDir, '03_Offer.txt'), node3);
  console.log('  ✓ Node 3: Offer');

  // ── Node 4: Hero Mechanisms ───────────────────────────────────────────────────
  let node4 = `ZAP CAMPAIGN EXPORT — NODE 4: UNIQUE METHOD / HERO MECHANISMS
${'='.repeat(60)}

`;
  heroes.forEach((h, idx) => {
    node4 += `MECHANISM ${idx + 1}: ${h.name || ''}
${'─'.repeat(40)}
DESCRIPTION: ${h.description || ''}
HOW IT WORKS: ${h.howItWorks || ''}
CREDIBILITY: ${h.credibility || ''}
SOCIAL PROOF: ${h.socialProof || ''}
UNIQUE FACTOR: ${h.uniqueFactor || ''}

`;
  });
  writeFileSync(join(campaignDir, '04_Hero_Mechanisms.txt'), node4);
  console.log(`  ✓ Node 4: ${heroes.length} hero mechanisms`);

  // ── Node 5: HVCO Titles ───────────────────────────────────────────────────────
  let node5 = `ZAP CAMPAIGN EXPORT — NODE 5: FREE OPT-IN (HVCO) TITLES
${'='.repeat(60)}

`;
  hvcos.forEach((h, idx) => {
    node5 += `HVCO ${idx + 1} — Type: ${h.type || h.tabType || ''}
${'─'.repeat(40)}
TITLE: ${h.title || ''}
SUBTITLE: ${h.subtitle || ''}
DESCRIPTION: ${h.description || ''}

`;
  });
  writeFileSync(join(campaignDir, '05_HVCO_Titles.txt'), node5);
  console.log(`  ✓ Node 5: ${hvcos.length} HVCO titles`);

  // ── Node 6: Headlines ─────────────────────────────────────────────────────────
  let node6 = `ZAP CAMPAIGN EXPORT — NODE 6: HEADLINES
${'='.repeat(60)}

`;
  headlines.forEach((h, idx) => {
    node6 += `HEADLINE ${idx + 1} — Formula: ${h.formulaType || h.formula || ''}
${'─'.repeat(40)}
EYEBROW: ${h.eyebrow || ''}
HEADLINE: ${h.headline || ''}
SUBHEADLINE: ${h.subheadline || ''}
UNIQUE MECHANISM: ${h.uniqueMechanism || ''}

`;
  });
  writeFileSync(join(campaignDir, '06_Headlines.txt'), node6);
  console.log(`  ✓ Node 6: ${headlines.length} headlines`);

  // ── Node 7: Ad Copy ───────────────────────────────────────────────────────────
  let node7 = `ZAP CAMPAIGN EXPORT — NODE 7: AD COPY
${'='.repeat(60)}

`;
  adCopies.forEach((a, idx) => {
    node7 += `AD COPY ${idx + 1} — Angle: ${a.angle || a.adAngle || ''}
${'─'.repeat(40)}
HOOK: ${a.hook || ''}
BODY:
${a.body || a.adCopy || ''}

CTA: ${a.cta || a.callToAction || ''}

`;
  });
  writeFileSync(join(campaignDir, '07_Ad_Copy.txt'), node7);
  console.log(`  ✓ Node 7: ${adCopies.length} ad copy variants`);

  // ── Node 8: Landing Page ──────────────────────────────────────────────────────
  let node8 = `ZAP CAMPAIGN EXPORT — NODE 8: LANDING PAGE COPY
${'='.repeat(60)}

PRODUCT: ${lp.productName || ''}
DESCRIPTION: ${lp.productDescription || ''}

${'─'.repeat(60)}
GODFATHER ANGLE
${'─'.repeat(60)}
${safeStr(parseJsonField(lp.godfatherAngle))}

${'─'.repeat(60)}
FREE ANGLE
${'─'.repeat(60)}
${safeStr(parseJsonField(lp.freeAngle))}

${'─'.repeat(60)}
DOLLAR ANGLE
${'─'.repeat(60)}
${safeStr(parseJsonField(lp.dollarAngle))}

${'─'.repeat(60)}
ACTIVE ANGLE
${'─'.repeat(60)}
${safeStr(parseJsonField(lp.activeAngle))}
`;
  writeFileSync(join(campaignDir, '08_Landing_Page_Copy.txt'), node8);
  console.log('  ✓ Node 8: Landing Page');

  // ── Node 9: Email Sequence ────────────────────────────────────────────────────
  let node9 = `ZAP CAMPAIGN EXPORT — NODE 9: EMAIL SEQUENCE
${'='.repeat(60)}

`;
  emailSeqs.forEach((seq, idx) => {
    const emails = parseJsonField(seq.emails) || parseJsonField(seq.sequence) || [];
    node9 += `EMAIL SEQUENCE ${idx + 1} — Type: ${seq.sequenceType || seq.type || ''}
${'─'.repeat(40)}
`;
    if (Array.isArray(emails)) {
      emails.forEach((em, ei) => {
        const body = typeof em === 'string' ? em : em.body || em.content || em.email || JSON.stringify(em, null, 2);
        const subject = typeof em === 'object' ? (em.subject || em.Subject || '') : '';
        node9 += `\nEMAIL ${ei + 1}${subject ? ` — Subject: ${subject}` : ''}:\n${'·'.repeat(40)}\n${body}\n`;
      });
    } else {
      node9 += safeStr(emails) + '\n';
    }
    node9 += '\n';
  });
  writeFileSync(join(campaignDir, '09_Email_Sequence.txt'), node9);
  console.log(`  ✓ Node 9: ${emailSeqs.length} email sequences`);

  // ── Node 10: WhatsApp Sequence ────────────────────────────────────────────────
  let node10 = `ZAP CAMPAIGN EXPORT — NODE 10: WHATSAPP SEQUENCE
${'='.repeat(60)}

`;
  waSeqs.forEach((seq, idx) => {
    const msgs = parseJsonField(seq.messages) || parseJsonField(seq.sequence) || [];
    node10 += `WHATSAPP SEQUENCE ${idx + 1} — Type: ${seq.sequenceType || seq.type || ''}
${'─'.repeat(40)}
`;
    if (Array.isArray(msgs)) {
      msgs.forEach((msg, mi) => {
        const text = typeof msg === 'string' ? msg : msg.message || msg.content || msg.text || JSON.stringify(msg, null, 2);
        const day = typeof msg === 'object' ? (msg.day || '') : '';
        const timing = typeof msg === 'object' ? (msg.timing || '') : '';
        node10 += `\nMESSAGE ${mi + 1}${day ? ` — Day ${day}` : ''}${timing ? ` (${timing})` : ''}:\n${'·'.repeat(40)}\n${text}\n`;
      });
    } else {
      node10 += safeStr(msgs) + '\n';
    }
    node10 += '\n';
  });
  writeFileSync(join(campaignDir, '10_WhatsApp_Sequence.txt'), node10);
  console.log(`  ✓ Node 10: ${waSeqs.length} WhatsApp sequences`);

  // ── Node 11: Push to Meta ─────────────────────────────────────────────────────
  let node11 = `ZAP CAMPAIGN EXPORT — NODE 11: PUSH TO META / GOHIGHLEVEL
${'='.repeat(60)}

STATUS: ${metaAds.length > 0 ? 'PUBLISHED' : 'PENDING — Ready to push'}
${metaAds.length > 0 ? `
AD ACCOUNT ID: ${metaAds[0].adAccountId || ''}
CAMPAIGN ID: ${metaAds[0].campaignId || ''}
AD SET ID: ${metaAds[0].adSetId || ''}
AD ID: ${metaAds[0].adId || ''}
STATUS: ${metaAds[0].status || ''}
PUBLISHED AT: ${metaAds[0].createdAt || ''}
` : `
This campaign is ready to be pushed to Meta/GoHighLevel.
All assets (ad copy, landing page, email sequence, WhatsApp sequence) have been generated.
`}
`;
  writeFileSync(join(campaignDir, '11_Push_to_Meta_GHL.txt'), node11);
  console.log('  ✓ Node 11: Push to Meta');

  // ── Create README ─────────────────────────────────────────────────────────────
  const readme = `ZAP CAMPAIGNS — COMPLETE CAMPAIGN EXPORT
${'='.repeat(60)}
Campaign: ${name.replace(/_/g, ' ')}
Account: ${email}
Generated: ${new Date().toISOString()}
Subscription: PRO (Active)

FILES IN THIS PACKAGE:
  01_Service_Profile.txt       — Node 1: Service details & HVCO topic
  02_Ideal_Customer_Profile.txt — Node 2: Full ICP with fears, goals, objections
  03_Offer.txt                 — Node 3: All 4 offer angles (Godfather, Free, Dollar, Active)
  04_Hero_Mechanisms.txt       — Node 4: Unique method & hero mechanisms
  05_HVCO_Titles.txt           — Node 5: Free opt-in titles & descriptions
  06_Headlines.txt             — Node 6: All headline variants with formulas
  07_Ad_Copy.txt               — Node 7: All ad copy variants with hooks & CTAs
  08_Landing_Page_Copy.txt     — Node 8: Full landing page copy (all 4 angles)
  09_Email_Sequence.txt        — Node 9: Complete email sequence
  10_WhatsApp_Sequence.txt     — Node 10: Complete WhatsApp follow-up sequence
  11_Push_to_Meta_GHL.txt      — Node 11: Push to Meta/GoHighLevel status

All content generated via Claude AI using the ZAP Campaigns platform.
zapcampaigns.com
`;
  writeFileSync(join(campaignDir, 'README.txt'), readme);

  // ── Zip the campaign folder ───────────────────────────────────────────────────
  const zipPath = join(OUTPUT_DIR, `${i + 1}_${name}.zip`);
  execSync(`cd "${OUTPUT_DIR}" && zip -r "${zipPath}" "${i + 1}_${name}/"`, { stdio: 'pipe' });
  console.log(`  ✓ Zipped → ${zipPath}`);
}

await conn.end();
console.log('\n✅ All 5 campaign zip files created in /home/ubuntu/campaign_exports/');
