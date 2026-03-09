
import { createConnection } from 'mysql2/promise';
const conn = await createConnection(process.env.DATABASE_URL);

const [[user]] = await conn.execute(
  'SELECT id, name, email, subscriptionTier, subscriptionStatus, DATE_FORMAT(subscriptionEndsAt, "%Y-%m-%d") as subscriptionEndsAt, createdAt FROM users WHERE email = ?',
  ['zapreviewer@zapcampaigns.com']
);

const [[service]] = await conn.execute(
  'SELECT id, name, targetCustomer, mainBenefit, hvcoTopic, uniqueMechanismSuggestion FROM services WHERE userId = ?',
  [user.id]
);

const [[counts]] = await conn.execute(`
  SELECT 
    (SELECT COUNT(*) FROM services WHERE userId = ?) as node1_service,
    (SELECT COUNT(*) FROM idealCustomerProfiles WHERE userId = ?) as node2_icp,
    (SELECT COUNT(*) FROM offers WHERE userId = ?) as node3_offer,
    (SELECT COUNT(*) FROM heroMechanisms WHERE userId = ?) as node4_mechanism,
    (SELECT COUNT(*) FROM hvcoTitles WHERE userId = ?) as node5_hvco,
    (SELECT COUNT(*) FROM headlines WHERE userId = ?) as node6_headlines,
    (SELECT COUNT(*) FROM adCopy WHERE userId = ?) as node7_adcopy,
    (SELECT COUNT(*) FROM landingPages WHERE userId = ?) as node8_landing,
    (SELECT COUNT(*) FROM emailSequences WHERE userId = ?) as node9_email,
    (SELECT COUNT(*) FROM whatsappSequences WHERE userId = ?) as node10_whatsapp,
    (SELECT COUNT(*) FROM meta_published_ads WHERE userId = ?) as node11_meta
`, Array(11).fill(user.id));

console.log(JSON.stringify({ user, service, counts }, null, 2));
await conn.end();
