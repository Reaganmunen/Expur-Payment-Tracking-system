const User = require('../models/userModel');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireFields, ensureFound } = require('../utils/validate');

const ROLES = ['admin', 'staff'];
const checkRole = (r) => { if (r !== undefined && !ROLES.includes(r)) throw new ApiError(400, `role must be one of: ${ROLES.join(', ')}`); };
const checkPassword = (p) => { if (String(p).length < 8) throw new ApiError(400, 'password must be at least 8 characters'); };

exports.list = asyncHandler(async (req, res) => res.json(await User.getAll()));

exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'email', 'password']);
  if (!/^\S+@\S+\.\S+$/.test(req.body.email)) throw new ApiError(400, 'Invalid email address');
  checkPassword(req.body.password);
  checkRole(req.body.role);
  res.status(201).json(await User.create(req.body));
});

exports.update = asyncHandler(async (req, res) => {
  checkRole(req.body.role);
  const self = Number(req.params.id) === req.user.id;
  if (self && (req.body.active === false || (req.body.role && req.body.role !== 'admin'))) {
    throw new ApiError(400, 'You cannot deactivate or demote your own account');
  }
  res.json(ensureFound(await User.update(req.params.id, req.body), 'User'));
});

exports.resetPassword = asyncHandler(async (req, res) => {
  requireFields(req.body, ['password']);
  checkPassword(req.body.password);
  ensureFound(await User.setPassword(req.params.id, req.body.password), 'User');
  res.json({ message: 'Password reset' });
});
