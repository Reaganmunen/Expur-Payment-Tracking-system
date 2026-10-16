const Invoice = require('../models/invoiceModel');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireFields, positiveNumber, nonNegativeNumber, ensureFound } = require('../utils/validate');
const { forRole, isAdmin } = require('../utils/redact');

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
