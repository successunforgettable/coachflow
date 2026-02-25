// Test script to call renderVideo API directly
import http from 'http';

const payload = {
  scriptId: 120005,
  visualStyle: "text_only",
  musicStyle: "energetic"
};

const data = JSON.stringify({
  "0": {
    json: payload
  }
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/trpc/videos.renderVideo?batch=1',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    // Add a test user ID cookie (assuming user 1 exists)
    'Cookie': 'session=test'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', responseData);
    try {
      const parsed = JSON.parse(responseData);
      console.log('\nParsed:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Could not parse JSON');
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
