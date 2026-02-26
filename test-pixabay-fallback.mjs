import { fetchStockFootageWithFallback } from './server/pixabay.ts';

console.log('=== TESTING PIXABAY FALLBACK SYSTEM ===\n');

const testQueries = [
  'crypto charts FOMO',
  'crypto trader frustrated',
  'institutional crypto trader',
  'crypto trading strategy',
  'crypto success money'
];

for (const query of testQueries) {
  console.log(`Testing: "${query}"`);
  try {
    const url = await fetchStockFootageWithFallback(query, 'portrait');
    if (url) {
      console.log(`✅ Got footage: ${url.substring(0, 80)}\n`);
    } else {
      console.log(`❌ No footage found\n`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}\n`);
  }
}

console.log('=== TEST COMPLETE ===');
