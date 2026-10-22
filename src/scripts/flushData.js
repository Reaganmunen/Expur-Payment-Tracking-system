// Wipes all business data. KEEPS: users, products, expense_categories.
// WIPES: customers, invoices, invoice_items, payments, cheques, cheque_images, expenses.
// ID counters of wiped tables restart at 1.
//
// Put this file in src/scripts/ and run (it reads DATABASE_URL / DB_SSL from .env):
//   node src/scripts/flushData.js --yes
//
// To run it against your Vercel database, put that database's URL in your local .env first.
require('dotenv').config();
const { pool } = require('../config/db');

(async () => {
  if (!process.argv.includes('--yes')) {
    console.error('This permanently deletes customers, invoices, payments, cheques and expenses.\nRe-run with --yes to confirm:\n  node src/scripts/flushData.js --yes');
    process.exit(1);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      TRUNCATE TABLE
        cheque_images,
        cheques,
        payments,
        invoice_items,
        invoices,
        expenses,
        customers
      RESTART IDENTITY
    `);
    await client.query('COMMIT');
    const { rows } = await client.query(`
      SELECT (SELECT COUNT(*) FROM users)    AS users,
             (SELECT COUNT(*) FROM products) AS products,
             (SELECT COUNT(*) FROM invoices) AS invoices`);
    console.log('Done. Kept:', rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Failed, nothing was changed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();