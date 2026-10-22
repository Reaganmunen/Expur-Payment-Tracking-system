const { Pool, types } = require('pg');

// NUMERIC -> number, BIGINT (COUNT) -> number, DATE -> 'YYYY-MM-DD' string (no timezone shifts)
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  // Each Vercel function instance gets its own pool, so keep it small
  max: process.env.VERCEL ? 3 : 10,
  idleTimeoutMillis: 10000,
});

pool.on('error', (err) => console.error('Unexpected PG pool error:', err));

const query = (text, params) => pool.query(text, params);

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };