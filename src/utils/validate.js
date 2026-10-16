const ApiError = require('./ApiError');

exports.requireFields = (body, fields) => {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  if (missing.length) throw new ApiError(400, `Missing required field(s): ${missing.join(', ')}`);
};

exports.positiveNumber = (value, name) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new ApiError(400, `${name} must be a positive number`);
  return n;
};

exports.nonNegativeNumber = (value, name) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new ApiError(400, `${name} must be 0 or more`);
  return n;
};

exports.ensureFound = (row, label) => {
  if (!row) throw new ApiError(404, `${label} not found`);
  return row;
};
