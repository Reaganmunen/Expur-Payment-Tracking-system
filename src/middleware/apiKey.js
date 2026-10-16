const ApiError = require('../utils/ApiError');

// Disabled unless API_KEY is set in .env
module.exports = (req, res, next) => {
  const key = process.env.API_KEY;
  if (!key) return next();
  if (req.get('x-api-key') !== key) return next(new ApiError(401, 'Invalid or missing API key'));
  next();
};
