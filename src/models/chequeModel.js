const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');

// Never SELECT * here: keep the heavy `scan` JSON out of lists. Images are in a separate table.
const LIST_COLS = `c.id, c.status, c.payer_name, c.cheque_no, c.bank, c.cheque_date, c.amount,
  c.customer_id, cu.name AS customer, c.allocations, c.uploaded_by, u.name AS uploaded_by_name,
  c.created_at, c.recorded_at, c.voided_at, c.void_reason`;
const FROM = `FROM cheques c LEFT JOIN customers cu ON cu.id = c.customer_id LEFT JOIN users u ON u.id = c.uploaded_by`;

exports.getAll = async ({ status, uploaded_by } = {}) => {
  const cond = [];
  const params = [];
  if (status) { params.push(status); cond.push(`c.status = $${params.length}`); }
  if (uploaded_by) { params.push(uploaded_by); cond.push(`c.uploaded_by = $${params.length}`); }
  return (await query(
    `SELECT ${LIST_COLS} ${FROM} ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
     ORDER BY c.created_at DESC, c.id DESC LIMIT 300`, params)).rows;
};

exports.getById = async (id) =>
  (await query(`SELECT ${LIST_COLS}, c.scan ${FROM} WHERE c.id = $1`, [id])).rows[0];

exports.getImage = async (id) =>
  (await query('SELECT mime, data FROM cheque_images WHERE cheque_id = $1', [id])).rows[0];

exports.createPending = ({ uploaded_by, image, mime }) =>
  withTransaction(async (client) => {
    const { rows: [c] } = await client.query(
      'INSERT INTO cheques (uploaded_by) VALUES ($1) RETURNING id', [uploaded_by]);
    await client.query('INSERT INTO cheque_images (cheque_id, mime, data) VALUES ($1,$2,$3)', [c.id, mime, image]);
    return c.id;
  });

// Store what the scanner read. Only fills the editable columns while the cheque is still pending.
exports.saveScan = async (id, scan) =>
  (await query(
    `UPDATE cheques SET scan = $2, payer_name = $3, cheque_no = $4, bank = $5, cheque_date = $6::date, amount = $7
     WHERE id = $1 AND status = 'pending'`,
    [id, scan, scan.payer_name, scan.cheque_no, scan.bank, scan.cheque_date,
     scan.amount_figures ?? scan.amount_words_value ?? null])).rowCount > 0;

// Another recorded cheque with the same number and amount = the same piece of paper scanned twice.
exports.findDuplicate = async ({ cheque_no, amount, exclude_id }) => {
  if (!cheque_no || !amount) return null;
  return (await query(
    `SELECT id, recorded_at, allocations FROM cheques
     WHERE status = 'recorded' AND lower(cheque_no) = lower($1) AND amount = $2 AND id <> $3
     ORDER BY recorded_at DESC LIMIT 1`, [cheque_no, amount, exclude_id || 0])).rows[0] || null;
};

const cents = (n) => Math.round(Number(n) * 100);

// Turns a pending cheque into real payments. All or nothing.
//   fields:      { payer_name, cheque_no, bank, cheque_date, amount, customer_id }
//   allocations: [{ invoice_id, amount }]
//   restrict_to: staff may only apply cheques to invoices they created
exports.record = (id, fields, allocations, { userId, restrict_to }) =>
  withTransaction(async (client) => {
    const { rows: [ch] } = await client.query('SELECT id, status, uploaded_by FROM cheques WHERE id = $1 FOR UPDATE', [id]);
    if (!ch || (restrict_to && ch.uploaded_by !== restrict_to)) throw new ApiError(404, 'Cheque not found');
    if (ch.status === 'recorded') throw new ApiError(409, 'This cheque has already been recorded.');
    if (ch.status === 'void') throw new ApiError(409, 'This cheque was voided and cannot be recorded.');

    const dup = await client.query(
      `SELECT id, recorded_at FROM cheques
       WHERE status = 'recorded' AND lower(cheque_no) = lower($1) AND amount = $2 AND id <> $3 LIMIT 1`,
      [fields.cheque_no, fields.amount, id]);
    if (dup.rows.length) {
      throw new ApiError(409, `Cheque ${fields.cheque_no} for ${fields.amount} was already recorded on ${new Date(dup.rows[0].recorded_at).toISOString().slice(0, 10)}. Recording it again would count it twice.`);
    }

    // lock invoices in a fixed order so two people recording at once cannot deadlock
    const ordered = [...allocations].sort((a, b) => a.invoice_id - b.invoice_id);
    const saved = [];
    for (const a of ordered) {
      const { rows: [inv] } = await client.query(
        'SELECT id, invoice_no, written_off, created_by FROM invoices WHERE id = $1 FOR UPDATE', [a.invoice_id]);
      if (!inv || (restrict_to && inv.created_by !== restrict_to)) throw new ApiError(404, `Invoice ${a.invoice_id} not found`);
      if (inv.written_off) throw new ApiError(409, `Invoice ${inv.invoice_no} is written off. Reverse the write-off first.`);

      const { rows: [s] } = await client.query('SELECT balance FROM invoice_summary WHERE id = $1', [inv.id]);
      if (cents(a.amount) > cents(s.balance)) {
        throw new ApiError(409, `Invoice ${inv.invoice_no} only has ${s.balance} left to pay, but ${a.amount} was applied to it.`);
      }
      const { rows: [pay] } = await client.query(
        `INSERT INTO payments (invoice_id, amount, method, reference, recorded_by, cheque_id)
         VALUES ($1,$2,'cheque',$3,$4,$5) RETURNING id`,
        [inv.id, a.amount, `CHQ-${fields.cheque_no}/${inv.invoice_no}`, userId, id]);
      saved.push({ payment_id: pay.id, invoice_id: inv.id, invoice_no: inv.invoice_no, amount: a.amount });
    }

    await client.query(
      `UPDATE cheques SET status = 'recorded', payer_name = $2, cheque_no = $3, bank = $4, cheque_date = $5::date,
              amount = $6, customer_id = $7, allocations = $8, recorded_at = now()
       WHERE id = $1`,
      [id, fields.payer_name, fields.cheque_no, fields.bank, fields.cheque_date, fields.amount,
       fields.customer_id, JSON.stringify(saved)]);
    return saved;
  });

// Only a cheque nobody has acted on can be thrown away
exports.discard = async (id, { restrict_to } = {}) => {
  const { rowCount } = await query(
    `DELETE FROM cheques WHERE id = $1 AND status = 'pending' ${restrict_to ? 'AND uploaded_by = $2' : ''}`,
    restrict_to ? [id, restrict_to] : [id]);
  return rowCount > 0;
};

// Bounced / cancelled cheque: remove the payments it created so the invoices go back to unpaid.
// The cheque row, photo and what it had paid stay on record.
exports.voidCheque = (id, reason) =>
  withTransaction(async (client) => {
    const { rows: [ch] } = await client.query('SELECT id, status FROM cheques WHERE id = $1 FOR UPDATE', [id]);
    if (!ch) throw new ApiError(404, 'Cheque not found');
    if (ch.status !== 'recorded') throw new ApiError(409, 'Only a recorded cheque can be voided.');
    const { rowCount } = await client.query('DELETE FROM payments WHERE cheque_id = $1', [id]);
    await client.query(`UPDATE cheques SET status = 'void', voided_at = now(), void_reason = $2 WHERE id = $1`, [id, reason || null]);
    return rowCount;
  });
