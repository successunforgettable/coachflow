import bcrypt from 'bcryptjs';
const hash = await bcrypt.hash('MetaReview2026!', 12);
console.log(hash);
