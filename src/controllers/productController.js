const Product = require('../models/productModel');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, nonNegativeNumber, ensureFound } = require('../utils/validate');
const { forRole } = require('../utils/redact');

exports.list = asyncHandler(async (req, res) =>
  res.json(forRole(req.user, await Product.getAll(req.query.include_inactive === 'true'))));

exports.get = asyncHandler(async (req, res) =>
  res.json(forRole(req.user, ensureFound(await Product.getById(req.params.id), 'Product'))));

exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'unit_cost', 'unit_price']);
  nonNegativeNumber(req.body.unit_cost, 'unit_cost');
  nonNegativeNumber(req.body.unit_price, 'unit_price');
  res.status(201).json(await Product.create(req.body));
});

exports.update = asyncHandler(async (req, res) => {
  ['unit_cost', 'unit_price'].forEach((f) => {
    if (req.body[f] !== undefined) nonNegativeNumber(req.body[f], f);
  });
  res.json(ensureFound(await Product.update(req.params.id, req.body), 'Product'));
});

exports.remove = asyncHandler(async (req, res) => {
  ensureFound(await Product.deactivate(req.params.id), 'Product');
  res.status(204).end();
});
