const Payment = require('../models/paymentModel');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireFields, positiveNumber, ensureFound } = require('../utils/validate');
const { isAdmin } = require('../utils/redact');

const METHODS = ['mpesa', 'cash', 'bank', 'cheque'];

exports.list = asyncHandler(async (req, res) => {
  const filters = { ...req.query };
  if (!isAdmin(req.user)) filters.created_by = req.user.id;
  res.json(await Payment.getAll(filters));
});

exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['invoice_id', 'amount', 'method']);
  const amount = positiveNumber(req.body.amount, 'amount');
  if (!METHODS.includes(req.body.method)) throw new ApiError(400, `method must be one of: ${METHODS.join(', ')}`);
  res.status(201).json(await Payment.create({
    ...req.body, amount, recorded_by: req.user.id, restrict_to: isAdmin(req.user) ? null : req.user.id,
  }));
});

exports.remove = asyncHandler(async (req, res) => {
  ensureFound(await Payment.remove(req.params.id), 'Payment');
  res.status(204).end();
});
