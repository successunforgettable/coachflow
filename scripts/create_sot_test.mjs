import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check if SOT already exists for user 1
const [existingRows] = await conn.execute('SELECT id FROM sourceOfTruth WHERE userId = 1');

if (existingRows.length > 0) {
  // Update existing record
  await conn.execute(
    `UPDATE sourceOfTruth SET
      programName = ?,
      coreOffer = ?,
      targetAudience = ?,
      mainPainPoint = ?,
      mainBenefits = ?,
      uniqueValue = ?,
      idealCustomerAvatar = ?
    WHERE userId = 1`,
    [
      'Incredible You Coach Training',
      'A 12-week certification program that trains coaches to use the Mind-Heart Activation Protocol to produce measurable, lasting results for their clients',
      'Aspiring coaches aged 30-55 who want a science-backed methodology and proprietary system to differentiate themselves and justify premium pricing',
      "Coaches feel like generic coaches with no differentiation — their clients get short-term results but relapse within 90 days because they lack a systematic protocol",
      'A certified proprietary protocol, a complete client system, the ability to charge premium fees, and measurable HRV-based results that prove transformation',
      "The only coaching certification that combines neuroscience, HRV biofeedback, and a complete client business system — not just a methodology but a full practice launch kit",
      "Sarah, 42, former corporate manager who has taken 3 coaching courses but still feels like an imposter. She has 5 clients paying low rates and wants to charge 3x more but can't justify it without a proven system."
    ]
  );
  console.log('SOT record updated for userId=1');
} else {
  // Insert new record
  const [result] = await conn.execute(
    `INSERT INTO sourceOfTruth (userId, programName, coreOffer, targetAudience, mainPainPoint, mainBenefits, uniqueValue, idealCustomerAvatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      1,
      'Incredible You Coach Training',
      'A 12-week certification program that trains coaches to use the Mind-Heart Activation Protocol to produce measurable, lasting results for their clients',
      'Aspiring coaches aged 30-55 who want a science-backed methodology and proprietary system to differentiate themselves and justify premium pricing',
      "Coaches feel like generic coaches with no differentiation — their clients get short-term results but relapse within 90 days because they lack a systematic protocol",
      'A certified proprietary protocol, a complete client system, the ability to charge premium fees, and measurable HRV-based results that prove transformation',
      "The only coaching certification that combines neuroscience, HRV biofeedback, and a complete client business system — not just a methodology but a full practice launch kit",
      "Sarah, 42, former corporate manager who has taken 3 coaching courses but still feels like an imposter. She has 5 clients paying low rates and wants to charge 3x more but can't justify it without a proven system."
    ]
  );
  console.log('SOT record inserted, id:', result.insertId);
}

// Verify the record
const [rows] = await conn.execute(
  'SELECT id, userId, programName, coreOffer, uniqueValue, idealCustomerAvatar FROM sourceOfTruth WHERE userId = 1'
);
console.log('\nSOT record verified:');
console.log('  id:', rows[0].id);
console.log('  userId:', rows[0].userId);
console.log('  programName:', rows[0].programName);
console.log('  coreOffer (first 80 chars):', rows[0].coreOffer?.substring(0, 80));
console.log('  uniqueValue (first 80 chars):', rows[0].uniqueValue?.substring(0, 80));
console.log('  idealCustomerAvatar (first 80 chars):', rows[0].idealCustomerAvatar?.substring(0, 80));

// Verify the service was created
const [svcRows] = await conn.execute(
  "SELECT id, userId, name FROM services WHERE name = 'Incredible You Coach Training' AND userId = 1"
);
if (svcRows.length > 0) {
  console.log('\nService verified:');
  console.log('  id:', svcRows[0].id);
  console.log('  name:', svcRows[0].name);
} else {
  console.log('\nService NOT found — need to create it');
}

await conn.end();
