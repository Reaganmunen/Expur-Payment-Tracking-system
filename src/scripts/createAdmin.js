// Usage: npm run create-admin -- "Full Name" email@example.com StrongPassword
require('dotenv').config();
const User = require('../models/userModel');
const { pool } = require('../config/db');

(async () => {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Usage: npm run create-admin -- "Full Name" email password');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }
  try {
    const u = await User.create({ name, email, password, role: 'admin' });
    console.log(`Admin created: ${u.email} (id ${u.id})`);
  } catch (e) {
    console.error(e.code === '23505' ? 'A user with that email already exists.' : e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
