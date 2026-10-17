const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');

exports.getAll = async ({ status, customer_id, from, to, created_by, search } = {}) => {
  const cond = [];
  const params = [];
  if (status) {
    if (status.toLowerCase() === 'outstanding') cond.push(`status IN ('UNPAID','PARTIAL','OVERDUE')`);
    else { params.push(status.toUpperCase()); cond.push(`status = $${params.length}`); }
  }
  if (customer_id) { params.push(customer_id); cond.push(`customer_id = $${params.length}`); }
  if (from) { params.push(from); cond.push(`issue_date >= $${params.length}`); }
  if (to) { params.push(to); cond.push(`issue_date <= $${params.length}`); }
  if (created_by) { params.push(created_by); cond.push(`created_by = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    cond.push(`(invoice_no ILIKE $${params.length} OR delivery_note_no ILIKE $${params.length} OR customer ILIKE $${params.length})`);
  }
  const { rows } = await query(
    `SELECT * FROM invoice_summary ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
     ORDER BY issue_date DESC, id DESC`, params);
  return rows;
};

exports.getById = async (id) => {
  const { rows: [invoice] } = await query(
    `SELECT s.*, i.notes FROM invoice_summary s JOIN invoices i ON i.id = s.id WHERE s.id = $1`, [id]);
  if (!invoice) return null;
  const { rows: items } = await query(
    `SELECT ii.*, p.name AS product,
            ii.quantity * ii.unit_price AS line_total,
            ii.quantity * (ii.unit_price - ii.unit_cost) AS line_margin
     FROM invoice_items ii JOIN products p ON p.id = ii.product_id
     WHERE ii.invoice_id = $1 ORDER BY ii.id`, [id]);
  const { rows: payments } = await query(
    'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY paid_at', [id]);
  return { ...invoice, items, payments };
};

exports.create = async ({ invoice_no, delivery_note_no, customer_id, issue_date, due_date, notes, items, created_by }) => {
  const id = await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(7001)'); // serialises invoice numbering
    const year = issue_date ? new Date(issue_date).getFullYear() : new Date().getFullYear();
    const { rows: [{ next }] } = await client.query(
      `SELECT COALESCE(MAX(SUBSTRING(invoice_no FROM '[0-9]+$')::int), 0) + 1 AS next
       FROM invoices WHERE invoice_no LIKE $1`, [`INV-${year}-%`]);
    // Use the number typed in from the invoice book; auto-generate only if left blank
    const invoiceNo = invoice_no ? String(invoice_no).trim() : `INV-${year}-${String(next).padStart(4, '0')}`;
    const { rows: dup } = await client.query('SELECT 1 FROM invoices WHERE invoice_no = $1', [invoiceNo]);
    if (dup.length) throw new ApiError(409, `Invoice number ${invoiceNo} already exists`);

    const { rows: [inv] } = await client.query(
      `INSERT INTO invoices (invoice_no, customer_id, issue_date, due_date, notes, created_by, delivery_note_no)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE),
               COALESCE($4::date, COALESCE($3::date, CURRENT_DATE) + 30), $5, $6, $7) RETURNING id`,
      [invoiceNo, customer_id, issue_date || null, due_date || null, notes || null, created_by || null,
       delivery_note_no ? String(delivery_note_no).trim() : null]);

    for (const it of items) {
      const { rows: [p] } = await client.query(
        'SELECT id, unit_price, unit_cost FROM products WHERE id = $1 AND active', [it.product_id]);
      if (!p) throw new ApiError(400, `Product ${it.product_id} not found or inactive`);
      await client.query(
        `INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, unit_cost)
         VALUES ($1,$2,$3,$4,$5)`,
        [inv.id, p.id, it.quantity, it.unit_price ?? p.unit_price, p.unit_cost]);
    }
    return inv.id;
  });
  return exports.getById(id);
};

exports.updateDetails = async (id, { invoice_no, delivery_note_no, issue_date, due_date, notes }) =>
  (await query(
    `UPDATE invoices SET invoice_no = COALESCE($2, invoice_no), delivery_note_no = COALESCE($3, delivery_note_no),
            issue_date = COALESCE($4::date, issue_date), due_date = COALESCE($5::date, due_date),
            notes = COALESCE($6, notes)
     WHERE id = $1`,
    [id, invoice_no ? String(invoice_no).trim() : null, delivery_note_no ?? null,
     issue_date ?? null, due_date ?? null, notes ?? null])).rowCount > 0;

exports.setWrittenOff = async (id, flag) =>
  (await query('UPDATE invoices SET written_off = $2 WHERE id = $1', [id, flag])).rowCount > 0;

exports.remove = async (id) => {
  const { rows } = await query('SELECT 1 FROM payments WHERE invoice_id = $1 LIMIT 1', [id]);
  if (rows.length) throw new ApiError(409, 'Invoice has payments and cannot be deleted. Write it off instead.');
  return (await query('DELETE FROM invoices WHERE id = $1', [id])).rowCount > 0;
};

// One row per invoice for the Excel/CSV export, with payment details folded in.
// scope: 'all' | 'paid' | 'unpaid' (unpaid = unpaid + part paid + overdue; written-off debts are only in 'all')
exports.getExportRows = async ({ scope = 'all', from, to, customer_id, created_by } = {}) => {
  const TZ = process.env.APP_TZ || 'Africa/Nairobi';
  const cond = [];
  const params = [TZ];
  if (scope === 'paid') cond.push(`s.status = 'PAID'`);
  if (scope === 'unpaid') cond.push(`s.status IN ('UNPAID','PARTIAL','OVERDUE')`);
  if (from) { params.push(from); cond.push(`s.issue_date >= $${params.length}`); }
  if (to) { params.push(to); cond.push(`s.issue_date <= $${params.length}`); }
  if (customer_id) { params.push(customer_id); cond.push(`s.customer_id = $${params.length}`); }
  if (created_by) { params.push(created_by); cond.push(`s.created_by = $${params.length}`); }
  // NB: no margin/cost columns here on purpose, staff can export too
  const { rows } = await query(
    `SELECT s.invoice_no, s.delivery_note_no, s.customer, s.issue_date, s.due_date,
            s.total, s.paid, s.balance, s.status,
            CASE WHEN s.status = 'OVERDUE' THEN CURRENT_DATE - s.due_date END AS days_overdue,
            p.last_paid, p.methods, p.refs, p.cheque_nos, p.cheque_payers, s.seller
     FROM invoice_summary s
     LEFT JOIN (
       SELECT py.invoice_id,
              (MAX(py.paid_at) AT TIME ZONE $1)::date AS last_paid,
              string_agg(DISTINCT py.method, ', ') AS methods,
              string_agg(py.reference, ', ' ORDER BY py.paid_at) FILTER (WHERE py.reference IS NOT NULL) AS refs,
              string_agg(DISTINCT ch.cheque_no, ', ') AS cheque_nos,
              string_agg(DISTINCT ch.payer_name, ', ') AS cheque_payers
       FROM payments py LEFT JOIN cheques ch ON ch.id = py.cheque_id
       GROUP BY py.invoice_id
     ) p ON p.invoice_id = s.id
     ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
     ORDER BY s.issue_date DESC, s.id DESC`, params);
  return rows;
};
