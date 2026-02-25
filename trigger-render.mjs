// Manually trigger a video render by inserting a record
import { createConnection } from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function triggerRender() {
  const conn = await createConnection(DATABASE_URL);
  
  try {
    // Insert a new video record that will be picked up by the render process
    const [result] = await conn.execute(`
      INSERT INTO videos (
        userId, serviceId, scriptId, videoType, duration, 
        visualStyle, creatomateStatus, creditsUsed, createdAt, updatedAt
      ) VALUES (
        1, 780001, 120005, 'explainer', '30',
        'text_only', 'queued', 1, NOW(), NOW()
      )
    `);
    
    const videoId = result.insertId;
    console.log(`✅ Created video record ID: ${videoId}`);
    console.log(`\nNow manually call the renderVideo procedure with this ID to test the 30s outro fix.`);
    console.log(`\nOr wait - let me directly call the render logic...`);
    
  } finally {
    await conn.end();
  }
}

triggerRender().catch(console.error);
