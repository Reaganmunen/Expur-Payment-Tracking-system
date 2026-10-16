const { query } = require('../config/db');

exports.getCategories = async () =>
  (await query('SELECT * FROM expense_categories ORDER BY name')).rows;

exports.createCategory = async (name) =>
  (await query('INSERT INTO expense_categories (name) VALUES ($1) RETURNING *', [name])).rows[0];

exports.getAll = async ({ from, to, category_id, created_by } = {}) => {
  const cond = [];
  const params = [];
  if (from) { params.push(from); cond.push(`e.expense_date >= $${params.length}`); }
  if (to) { params.push(to); cond.push(`e.expense_date <= $${params.length}`); }
  if (category_id) { params.push(category_id); cond.push(`e.category_id = $${params.length}`); }
  if (created_by) { params.push(created_by); cond.push(`e.created_by = $${params.length}`); }
  const { rows } = await query(
    `SELECT e.*, c.name AS category, i.invoice_no, u.name AS recorded_by_name
     FROM expenses e JOIN expense_categories c ON c.id = e.category_id
     LEFT JOIN invoices i ON i.id = e.invoice_id
     LEFT JOIN users u ON u.id = e.created_by
     ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
     ORDER BY e.expense_date DESC, e.id DESC`, params);
  return rows;
};

exports.getById = async (id) =>
  (await query(
    `SELECT e.*, c.name AS category FROM expenses e
     JOIN expense_categories c ON c.id = e.category_id WHERE e.id = $1`, [id])).rows[0];

exports.create = async (b) =>
  (await query(
    `INSERT INTO expenses (category_id, description, amount, expense_date, paid_via, reference, invoice_id, created_by)
     VALUES ($1,$2,$3, COALESCE($4::date, CURRENT_DATE), COALESCE($5,'cash'), $6, $7, $8) RETURNING *`,
    [b.category_id, b.description || null, b.amount, b.expense_date || null,
     b.paid_via || null, b.reference || null, b.invoice_id || null, b.created_by || null])).rows[0];

exports.update = async (id, b) =>
  (await query(
    `UPDATE expenses SET category_id = COALESCE($2,category_id), description = COALESCE($3,description),
            amount = COALESCE($4,amount), expense_date = COALESCE($5::date,expense_date),
            paid_via = COALESCE($6,paid_via), reference = COALESCE($7,reference),
            invoice_id = COALESCE($8,invoice_id)
     WHERE id = $1 RETURNING *`,
    [id, b.category_id ?? null, b.description ?? null, b.amount ?? null, b.expense_date ?? null,
     b.paid_via ?? null, b.reference ?? null, b.invoice_id ?? null])).rows[0];

exports.remove = async (id) => (await query('DELETE FROM expenses WHERE id = $1', [id])).rowCount > 0;
