import { config } from 'dotenv';
config();

const apiKey = process.env.ANTHROPIC_API_KEY;
console.log('Key prefix:', apiKey?.substring(0, 15));
console.log('Key length:', apiKey?.length);

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-3-haiku-20240307',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'Say OK' }],
  }),
});

const data = await response.json();
console.log('Status:', response.status);
console.log('Response:', JSON.stringify(data).substring(0, 400));
