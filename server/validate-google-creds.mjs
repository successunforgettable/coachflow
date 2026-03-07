import { execSync } from 'child_process';

// Load env
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

console.log('GOOGLE_CLIENT_ID set:', !!clientId);
console.log('GOOGLE_CLIENT_ID format valid:', clientId?.endsWith('.apps.googleusercontent.com') ?? false);
console.log('GOOGLE_CLIENT_SECRET set:', !!clientSecret);
console.log('GOOGLE_CLIENT_SECRET format valid:', clientSecret?.startsWith('GOCSPX-') ?? false);

if (!clientId || !clientSecret) {
  console.error('ERROR: One or both credentials missing');
  process.exit(1);
}

if (!clientId.endsWith('.apps.googleusercontent.com')) {
  console.error('ERROR: GOOGLE_CLIENT_ID format invalid - should end with .apps.googleusercontent.com');
  process.exit(1);
}

console.log('Credentials look valid. Testing OAuth discovery endpoint...');

// Verify Google OAuth endpoint is reachable
const response = await fetch('https://accounts.google.com/.well-known/openid-configuration');
if (response.ok) {
  console.log('Google OAuth endpoint reachable: OK');
} else {
  console.error('ERROR: Cannot reach Google OAuth endpoint');
  process.exit(1);
}

console.log('All checks passed.');
