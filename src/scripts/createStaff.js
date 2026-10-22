
require('dotenv').config();

const User = require('../models/userModel');
const { pool } = require('../config/db');

const staffAccounts = [
  {
    name: 'Reagan Munene',
    email: 'reagan@expur.com',
    password: 'Password@2026',
    role: 'staff',
  },
  {
    name: 'David Waigeria',
    email: 'david@expur.com',
    password: 'Password@2026',
    role: 'staff',
  },
];

(async () => {
  try {
    for (const staff of staffAccounts) {
      try {
        const user = await User.create(staff);
        console.log(`Staff created: ${user.email} (id ${user.id})`);
      } catch (error) {
        if (error.code === '23505') {
          console.error(`User already exists: ${staff.email}`);
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('Error creating staff accounts:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
