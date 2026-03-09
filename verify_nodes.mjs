import { createConnection } from 'mysql2/promise';
const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(`
SELECT 
  (SELECT COUNT(*) FROM services WHERE userId = 7110001) as node1_service,
  (SELECT COUNT(*) FROM idealCustomerProfiles WHERE userId = 7110001) as node2_icp,
  (SELECT COUNT(*) FROM offers WHERE userId = 7110001) as node3_offer,
  (SELECT COUNT(*) FROM heroMechanisms WHERE userId = 7110001) as node4_mechanism,
  (SELECT COUNT(*) FROM hvcoTitles WHERE userId = 7110001) as node5_hvco,
  (SELECT COUNT(*) FROM headlines WHERE userId = 7110001) as node6_headlines,
  (SELECT COUNT(*) FROM adCopy WHERE userId = 7110001) as node7_adcopy,
  (SELECT COUNT(*) FROM landingPages WHERE userId = 7110001) as node8_landing,
  (SELECT COUNT(*) FROM emailSequences WHERE userId = 7110001) as node9_email,
  (SELECT COUNT(*) FROM whatsappSequences WHERE userId = 7110001) as node10_whatsapp,
  (SELECT COUNT(*) FROM meta_published_ads WHERE userId = 7110001) as node11_meta
`);
console.log(JSON.stringify(rows[0], null, 2));
await conn.end();
