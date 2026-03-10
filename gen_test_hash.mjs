import bcrypt from 'bcryptjs';
const hash = await bcrypt.hash('TestCampaign2026', 10);
console.log(hash);
