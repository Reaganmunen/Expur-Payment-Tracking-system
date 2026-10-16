const { query } = require('../config/db');

exports.getAll = async (search) => {
  const params = [];
  let where = '';
  if (search) {
    params.push(`%${search}%`);
    where = 'WHERE c.name ILIKE $1 OR c.phone ILIKE $1';
  }
  const { rows } = await query(
    `SELECT c.*,
            COALESCE(SUM(s.balance) FILTER (WHERE s.status NOT IN ('PAID','WRITTEN_OFF')), 0) AS outstanding
     FROM customers c
     LEFT JOIN invoice_summary s ON s.customer_id = c.id
     ${where}
     GROUP BY c.id ORDER BY c.name`, params);
  return rows;
};

exports.getById = async (id) => {
  const { rows: [customer] } = await query('SELECT * FROM customers WHERE id = $1', [id]);
  if (!customer) return null;
  const { rows: invoices } = await query(
    'SELECT * FROM invoice_summary WHERE customer_id = $1 ORDER BY issue_date DESC', [id]);
  return { ...customer, invoices };
};

exports.create = async ({ name, phone, email }) => {
  const { rows: [row] } = await query(
    'INSERT INTO customers (name, phone, email) VALUES ($1,$2,$3) RETURNING *',
    [name, phone || null, email || null]);
  return row;
};

exports.update = async (id, { name, phone, email }) => {
  const { rows: [row] } = await query(
    `UPDATE customers SET name = COALESCE($2, name), phone = COALESCE($3, phone),
            email = COALESCE($4, email) WHERE id = $1 RETURNING *`,
    [id, name ?? null, phone ?? null, email ?? null]);
  return row;
};

exports.remove = async (id) => (await query('DELETE FROM customers WHERE id = $1', [id])).rowCount > 0;
