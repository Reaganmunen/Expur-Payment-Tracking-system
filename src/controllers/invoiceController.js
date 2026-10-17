const Invoice = require('../models/invoiceModel');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireFields, positiveNumber, nonNegativeNumber, ensureFound } = require('../utils/validate');
const { forRole, isAdmin } = require('../utils/redact');
const { toCsv } = require('../utils/csv');

// Staff only ever see invoices they created; a foreign id looks like "not found"
const loadVisible = async (req) => {
  const inv = ensureFound(await Invoice.getById(req.params.id), 'Invoice');
  if (!isAdmin(req.user) && inv.created_by !== req.user.id) throw new ApiError(404, 'Invoice not found');
  return inv;
};

exports.list = asyncHandler(async (req, res) => {
  const filters = { ...req.query };
  if (!isAdmin(req.user)) filters.created_by = req.user.id;
  res.json(forRole(req.user, await Invoice.getAll(filters)));
});

exports.get = asyncHandler(async (req, res) => res.json(forRole(req.user, await loadVisible(req))));

exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['customer_id']);
  ['invoice_no', 'delivery_note_no'].forEach((f) => {
    if (req.body[f] && String(req.body[f]).trim().length > 50) throw new ApiError(400, `${f} is too long (max 50 characters)`);
  });
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) throw new ApiError(400, 'items must be a non-empty array');
  items.forEach((it, i) => {
    requireFields(it, ['product_id', 'quantity']);
    positiveNumber(it.quantity, `items[${i}].quantity`);
    if (it.unit_price !== undefined) nonNegativeNumber(it.unit_price, `items[${i}].unit_price`);
  });
  const invoice = await Invoice.create({ ...req.body, created_by: req.user.id });
  res.status(201).json(forRole(req.user, invoice));
});

exports.update = asyncHandler(async (req, res) => {
  ['invoice_no', 'delivery_note_no'].forEach((f) => {
    if (req.body[f] === undefined || req.body[f] === null) return;
    const v = String(req.body[f]).trim();
    if (f === 'invoice_no' && !v) throw new ApiError(400, 'Invoice number cannot be empty');
    if (v.length > 50) throw new ApiError(400, `${f} is too long (max 50 characters)`);
    req.body[f] = v;
  });
  ensureFound(await Invoice.updateDetails(req.params.id, req.body), 'Invoice');
  res.json(await Invoice.getById(req.params.id));
});

exports.writeOff = asyncHandler(async (req, res) => {
  ensureFound(await Invoice.setWrittenOff(req.params.id, true), 'Invoice');
  res.json(await Invoice.getById(req.params.id));
});

exports.reverseWriteOff = asyncHandler(async (req, res) => {
  ensureFound(await Invoice.setWrittenOff(req.params.id, false), 'Invoice');
  res.json(await Invoice.getById(req.params.id));
});

exports.remove = asyncHandler(async (req, res) => {
  ensureFound(await Invoice.remove(req.params.id), 'Invoice');
  res.status(204).end();
});

// ---- Excel/CSV: what has been paid and what has not ----
const STATUS_LABEL = { PAID: 'Paid', PARTIAL: 'Part paid', UNPAID: 'Unpaid', OVERDUE: 'Overdue', WRITTEN_OFF: 'Written off' };
const EXPORT_COLUMNS = [
  { header: 'Invoice No', key: 'invoice_no' },
  { header: 'Delivery Note No', key: 'delivery_note_no' },
  { header: 'Customer', key: 'customer' },
  { header: 'Issue Date', key: 'issue_date' },
  { header: 'Due Date', key: 'due_date' },
  { header: 'Total (KES)', key: 'total' },
  { header: 'Paid (KES)', key: 'paid' },
  { header: 'Balance (KES)', key: 'balance' },
  { header: 'Status', get: (r) => STATUS_LABEL[r.status] || r.status },
  { header: 'Days Overdue', key: 'days_overdue' },
  { header: 'Last Payment Date', key: 'last_paid' },
  { header: 'Payment Method', key: 'methods' },
  { header: 'Payment Reference', key: 'refs' },
  { header: 'Cheque No', key: 'cheque_nos' },
  { header: 'Cheque Payer', key: 'cheque_payers' },
  { header: 'Seller', key: 'seller' },
];
const isDay = (s) => s === undefined || s === '' || /^\d{4}-\d{2}-\d{2}$/.test(s);

exports.exportCsv = asyncHandler(async (req, res) => {
  const scope = ['all', 'paid', 'unpaid'].includes(req.query.scope) ? req.query.scope : 'all';
  const { from, to, customer_id } = req.query;
  if (!isDay(from) || !isDay(to)) throw new ApiError(400, 'from and to must look like 2026-10-16');

  const rows = await Invoice.getExportRows({
    scope, from: from || undefined, to: to || undefined, customer_id: customer_id || undefined,
    created_by: isAdmin(req.user) ? undefined : req.user.id,   // staff export only their own invoices
  });
  const day = new Date().toLocaleDateString('en-CA', { timeZone: process.env.APP_TZ || 'Africa/Nairobi' });
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="invoices-${scope}-${day}.csv"`,
    'Cache-Control': 'no-store',
  }).send(toCsv(EXPORT_COLUMNS, rows));
});
