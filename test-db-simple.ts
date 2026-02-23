import { getDb } from "./server/db";

async function testDatabase() {
  console.log('Testing Database Connection...');
  
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }
    
    console.log('✅ Database connection successful!');
    
    // Test query
    const result = await db.execute('SELECT 1 as test');
    console.log('✅ Query executed successfully');
    
    console.log('\n✅ All database tests passed!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Database error:', error.message);
    process.exit(1);
  }
}

testDatabase();
