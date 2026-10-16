const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

exports.authenticate = asyncHandler(async (req, res, next) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Authentication required');

  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { throw new ApiError(401, 'Invalid or expired token'); }

  // Checked on every request so a deactivated user is locked out immediately
  const user = await User.getById(payload.id);
  if (!user || !user.active) throw new ApiError(401, 'Account not found or disabled');
  req.user = user;
  next();
});

exports.authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new ApiError(403, 'You do not have permission to do this'));
