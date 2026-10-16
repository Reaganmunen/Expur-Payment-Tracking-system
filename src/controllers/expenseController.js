const Expense = require('../models/expenseModel');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireFields, positiveNumber, ensureFound } = require('../utils/validate');
const { isAdmin } = require('../utils/redact');

const PAID_VIA = ['mpesa', 'cash', 'bank'];
const checkPaidVia = (v) => {
  if (v !== undefined && !PAID_VIA.includes(v)) throw new ApiError(400, `paid_via must be one of: ${PAID_VIA.join(', ')}`);
};

exports.listCategories = asyncHandler(async (req, res) => res.json(await Expense.getCategories()));

exports.createCategory = asyncHandler(async (req, res) => {
  requireFields(req.body, ['name']);
  res.status(201).json(await Expense.createCategory(req.body.name.trim()));
});

exports.list = asyncHandler(async (req, res) => {
  const filters = { ...req.query };
  if (!isAdmin(req.user)) filters.created_by = req.user.id;
  res.json(await Expense.getAll(filters));
});

exports.get = asyncHandler(async (req, res) => {
  const e = ensureFound(await Expense.getById(req.params.id), 'Expense');
  if (!isAdmin(req.user) && e.created_by !== req.user.id) throw new ApiError(404, 'Expense not found');
  res.json(e);
});

exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['category_id', 'amount']);
  const amount = positiveNumber(req.body.amount, 'amount');
  checkPaidVia(req.body.paid_via);
  res.status(201).json(await Expense.create({ ...req.body, amount, created_by: req.user.id }));
});

exports.update = asyncHandler(async (req, res) => {
  if (req.body.amount !== undefined) positiveNumber(req.body.amount, 'amount');
  checkPaidVia(req.body.paid_via);
  res.json(ensureFound(await Expense.update(req.params.id, req.body), 'Expense'));
});

exports.remove = asyncHandler(async (req, res) => {
  ensureFound(await Expense.remove(req.params.id), 'Expense');
  res.status(204).end();
});
