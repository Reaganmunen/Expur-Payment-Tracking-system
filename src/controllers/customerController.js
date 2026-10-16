const Customer = require('../models/customerModel');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, ensureFound } = require('../utils/validate');
const { forRole } = require('../utils/redact');

exports.list = asyncHandler(async (req, res) => res.json(await Customer.getAll(req.query.search)));

exports.get = asyncHandler(async (req, res) =>
  res.json(forRole(req.user, ensureFound(await Customer.getById(req.params.id), 'Customer'))));

exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['name']);
  res.status(201).json(await Customer.create(req.body));
});

exports.update = asyncHandler(async (req, res) =>
  res.json(ensureFound(await Customer.update(req.params.id, req.body), 'Customer')));

exports.remove = asyncHandler(async (req, res) => {
  ensureFound(await Customer.remove(req.params.id), 'Customer');
  res.status(204).end();
});
