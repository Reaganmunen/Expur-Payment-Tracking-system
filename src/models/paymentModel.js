const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');

// created_by filters on the invoice's seller (used to scope staff)
exports.getAll = async ({ invoice_id, from, to, created_by, limit } = {}) => {
  const cond = [];
  const params = [];
  if (invoice_id) { params.push(invoice_id); cond.push(`p.invoice_id = $${params.length}`); }
  if (from) { params.push(from); cond.push(`p.paid_at >= $${params.length}::date`); }
  if (to) { params.push(to); cond.push(`p.paid_at < ($${params.length}::date + 1)`); }
  if (created_by) { params.push(created_by); cond.push(`i.created_by = $${params.length}`); }
  const { rows } = await query(
    `SELECT p.*, i.invoice_no, i.delivery_note_no, c.name AS customer, u.name AS recorded_by_name
     FROM payments p JOIN invoices i ON i.id = p.invoice_id
     JOIN customers c ON c.id = i.customer_id
     LEFT JOIN users u ON u.id = p.recorded_by
     ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY p.paid_at DESC ${Number(limit) > 0 ? 'LIMIT ' + Math.min(Math.floor(Number(limit)), 500) : ''}`, params);
  return rows;
};

// restrict_to: when set, the invoice must have been created by that user
exports.create = ({ invoice_id, amount, method, reference, paid_at, recorded_by, restrict_to }) =>
  withTransaction(async (client) => {
    const { rows: [inv] } = await client.query(
      'SELECT id, written_off, created_by FROM invoices WHERE id = $1 FOR UPDATE', [invoice_id]);
    if (!inv || (restrict_to && inv.created_by !== restrict_to)) throw new ApiError(404, 'Invoice not found');
    if (inv.written_off) throw new ApiError(409, 'Invoice is written off. Reverse the write-off before recording payment.');

    const { rows: [s] } = await client.query('SELECT balance FROM invoice_summary WHERE id = $1', [invoice_id]);
    if (amount > s.balance + 0.005) {
      throw new ApiError(409, `Payment of ${amount} exceeds the outstanding balance of ${s.balance}`);
    }
    const { rows: [pay] } = await client.query(
      `INSERT INTO payments (invoice_id, amount, method, reference, paid_at, recorded_by)
       VALUES ($1,$2,$3,$4, COALESCE($5::timestamptz, now()), $6) RETURNING *`,
      [invoice_id, amount, method, reference || null, paid_at || null, recorded_by || null]);
    return pay;
  });

exports.remove = async (id) => (await query('DELETE FROM payments WHERE id = $1', [id])).rowCount > 0;
