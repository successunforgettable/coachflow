import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET not found');
  process.exit(1);
}

// Create a session token for admin user ID 1
const token = jwt.sign(
  { userId: 1, role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('TOKEN:' + token);
