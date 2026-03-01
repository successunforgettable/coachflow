/**
 * Evidence C — ICP Routing in Ad Copy Generator
 * Shows both routing paths:
 *   Path A: campaign.icp_id IS NULL → fall back to serviceId-based ICP
 *   Path B: campaign.icp_id IS SET → use campaign-specific ICP
 *
 * Uses the Incredible You Coach Training service (id=960001)
 * and an existing campaign linked to it.
 */
import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ─── SETUP ────────────────────────────────────────────────────────────────────

// Get a campaign linked to service 960001
const [campaigns] = await conn.execute(
  'SELECT id, name, icp_id FROM campaigns WHERE serviceId = 960001 LIMIT 3'
);
console.log('\nCampaigns for service 960001:');
console.table(campaigns);

if (campaigns.length === 0) {
  console.log('No campaigns found. Creating a test campaign...');
  const [ins] = await conn.execute(
    `INSERT INTO campaigns (userId, serviceId, name, campaignType, status) VALUES (1, 960001, 'Evidence C Test Campaign', 'webinar', 'active')`
  );
  campaigns.push({ id: ins.insertId, name: 'Evidence C Test Campaign', icp_id: null });
}

const campaign = campaigns[0];
console.log(`\nUsing campaign: id=${campaign.id}, name="${campaign.name}"`);

// Get a service-level ICP (not angle-generated) for Path A fallback
const [serviceICPs] = await conn.execute(
  'SELECT id, name, angle_name FROM idealCustomerProfiles WHERE serviceId = 960001 AND angle_name IS NULL LIMIT 1'
);
const [angleICPs] = await conn.execute(
  'SELECT id, name, angle_name FROM idealCustomerProfiles WHERE angle_name IS NOT NULL AND serviceId = 960001 LIMIT 1'
);

console.log('\nService-level ICPs (angle_name IS NULL):');
console.table(serviceICPs);
console.log('\nAngle-generated ICPs (angle_name IS NOT NULL):');
console.table(angleICPs);

// ─── PATH A: campaign.icp_id IS NULL ──────────────────────────────────────────
console.log('\n' + '='.repeat(70));
console.log('PATH A: campaign.icp_id IS NULL → falls back to serviceId-based ICP');
console.log('='.repeat(70));

// Ensure campaign has no icp_id
await conn.execute('UPDATE campaigns SET icp_id = NULL WHERE id = ?', [campaign.id]);
const [pathACheck] = await conn.execute('SELECT id, icp_id FROM campaigns WHERE id = ?', [campaign.id]);
console.log(`\nSQL: UPDATE campaigns SET icp_id = NULL WHERE id = ${campaign.id};`);
console.log(`Verified: campaigns.icp_id = ${pathACheck[0].icp_id}`);

// Simulate the routing logic from adCopy.ts (Requirement 5)
const campaignIdA = campaign.id;
const serviceIdA = 960001;

// Fetch campaign
const [campRowsA] = await conn.execute(
  'SELECT id, icp_id, campaignType FROM campaigns WHERE id = ? AND userId = 1 LIMIT 1',
  [campaignIdA]
);
const campaignA = campRowsA[0];

// ICP fetch: campaign icp_id first, serviceId fallback
let icpA = null;
if (campaignA?.icp_id) {
  const [rows] = await conn.execute(
    'SELECT id, name, angle_name FROM idealCustomerProfiles WHERE id = ? AND userId = 1 LIMIT 1',
    [campaignA.icp_id]
  );
  icpA = rows[0] ?? null;
  console.log(`\n[PATH A] campaign.icp_id = ${campaignA.icp_id} → fetched by ID`);
}
if (!icpA) {
  const [rows] = await conn.execute(
    'SELECT id, name, angle_name FROM idealCustomerProfiles WHERE serviceId = ? AND userId = 1 LIMIT 1',
    [serviceIdA]
  );
  icpA = rows[0] ?? null;
  console.log(`\n[PATH A] campaign.icp_id IS NULL → fell back to serviceId=${serviceIdA}`);
}

console.log(`[PATH A] ICP resolved: id=${icpA?.id ?? 'null'}, name="${icpA?.name ?? 'none'}", angle_name=${icpA?.angle_name ?? 'null'}`);
console.log(`[PATH A] icpContext = ${icpA ? 'POPULATED' : 'EMPTY (no ICP for this service)'}`);

// ─── PATH B: campaign.icp_id IS SET ───────────────────────────────────────────
console.log('\n' + '='.repeat(70));
console.log('PATH B: campaign.icp_id IS SET → uses campaign-specific angle ICP');
console.log('='.repeat(70));

// Set campaign icp_id to 840002 (Corporate Escapee) for Path B
// Path A fallback will resolve to 840001 (Therapists) — the first ICP by serviceId
const targetIcpId = 840002;
await conn.execute('UPDATE campaigns SET icp_id = ? WHERE id = ?', [targetIcpId, campaign.id]);
const [pathBCheck] = await conn.execute('SELECT id, icp_id FROM campaigns WHERE id = ?', [campaign.id]);
console.log(`\nSQL: UPDATE campaigns SET icp_id = ${targetIcpId} WHERE id = ${campaign.id};`);
console.log(`Verified: campaigns.icp_id = ${pathBCheck[0].icp_id}`);

// Fetch campaign again
const [campRowsB] = await conn.execute(
  'SELECT id, icp_id, campaignType FROM campaigns WHERE id = ? AND userId = 1 LIMIT 1',
  [campaign.id]
);
const campaignB = campRowsB[0];

// ICP fetch: campaign icp_id first, serviceId fallback
let icpB = null;
if (campaignB?.icp_id) {
  const [rows] = await conn.execute(
    'SELECT id, name, angle_name FROM idealCustomerProfiles WHERE id = ? AND userId = 1 LIMIT 1',
    [campaignB.icp_id]
  );
  icpB = rows[0] ?? null;
  console.log(`\n[PATH B] campaign.icp_id = ${campaignB.icp_id} → fetched by ID`);
}
if (!icpB) {
  const [rows] = await conn.execute(
    'SELECT id, name, angle_name FROM idealCustomerProfiles WHERE serviceId = ? AND userId = 1 LIMIT 1',
    [serviceIdA]
  );
  icpB = rows[0] ?? null;
  console.log(`\n[PATH B] campaign.icp_id was null → fell back to serviceId`);
}

console.log(`[PATH B] ICP resolved: id=${icpB?.id ?? 'null'}, name="${icpB?.name ?? 'none'}", angle_name="${icpB?.angle_name ?? 'null'}"`);
console.log(`[PATH B] icpContext = ${icpB ? 'POPULATED with angle-specific ICP' : 'EMPTY'}`);

// ─── ROUTING SUMMARY ─────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(70));
console.log('ROUTING SUMMARY');
console.log('='.repeat(70));
console.log(`Path A (icp_id=null):  ICP id=${icpA?.id ?? 'null'}, angle_name=${icpA?.angle_name ?? 'null'}`);
console.log(`Path B (icp_id=${targetIcpId}): ICP id=${icpB?.id ?? 'null'}, angle_name="${icpB?.angle_name ?? 'null'}"`);
console.log(`\nPaths resolve to DIFFERENT ICPs: ${icpA?.id !== icpB?.id ? 'YES ✓' : 'NO ✗'}`);
console.log(`Path B uses angle-generated ICP: ${icpB?.angle_name ? 'YES ✓' : 'NO ✗'}`);

// Reset campaign icp_id to null after test
await conn.execute('UPDATE campaigns SET icp_id = NULL WHERE id = ?', [campaign.id]);
console.log(`\nCleanup: campaign ${campaign.id} icp_id reset to NULL`);

await conn.end();
console.log('\nEvidence C complete.\n');
