const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireFields } = require('../utils/validate');

exports.login = asyncHandler(async (req, res) => {
  requireFields(req.body, ['email', 'password']);
  const user = await User.getByEmail(req.body.email);
  const ok = user && user.active && (await bcrypt.compare(String(req.body.password), user.password_hash));
  if (!ok) throw new ApiError(401, 'Invalid email or password');

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  });
  const { password_hash, ...safe } = user; // eslint-disable-line no-unused-vars
  res.json({ token, user: safe });
});

exports.me = asyncHandler(async (req, res) => res.json(req.user));

exports.changePassword = asyncHandler(async (req, res) => {
  requireFields(req.body, ['current_password', 'new_password']);
  if (String(req.body.new_password).length < 8) throw new ApiError(400, 'new_password must be at least 8 characters');
  const user = await User.getByEmail(req.user.email);
  if (!(await bcrypt.compare(String(req.body.current_password), user.password_hash))) {
    throw new ApiError(400, 'Current password is incorrect');
  }
  await User.setPassword(req.user.id, req.body.new_password);
  res.json({ message: 'Password updated' });
});
