const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

const COLS = 'id, name, email, role, active, created_at';
const clean = (email) => String(email).toLowerCase().trim();

exports.getAll = async () => (await query(`SELECT ${COLS} FROM users ORDER BY name`)).rows;
exports.getById = async (id) => (await query(`SELECT ${COLS} FROM users WHERE id = $1`, [id])).rows[0];
exports.getByEmail = async (email) => (await query('SELECT * FROM users WHERE email = $1', [clean(email)])).rows[0];

exports.create = async ({ name, email, password, role }) => {
  const hash = await bcrypt.hash(password, 10);
  return (await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, COALESCE($4, 'staff')) RETURNING ${COLS}`,
    [name, clean(email), hash, role || null])).rows[0];
};

exports.update = async (id, { name, role, active }) =>
  (await query(
    `UPDATE users SET name = COALESCE($2, name), role = COALESCE($3, role), active = COALESCE($4, active)
     WHERE id = $1 RETURNING ${COLS}`, [id, name ?? null, role ?? null, active ?? null])).rows[0];

exports.setPassword = async (id, password) => {
  const hash = await bcrypt.hash(password, 10);
  return (await query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, hash])).rowCount > 0;
};
