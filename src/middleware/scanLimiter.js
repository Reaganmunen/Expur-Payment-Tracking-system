const ApiError = require('../utils/ApiError');

// Each scan costs one vision-API call, so cap it per user (in-memory, resets on restart).
const hits = new Map();
const WINDOW = 60 * 60 * 1000;
const MAX = Number(process.env.SCAN_LIMIT_PER_HOUR) || 40;

module.exports = (req, res, next) => {
  const now = Date.now();
  const recent = (hits.get(req.user.id) || []).filter((t) => now - t < WINDOW);
  if (recent.length >= MAX) {
    return next(new ApiError(429, `Scan limit reached (${MAX} per hour). You can still enter a cheque by hand.`));
  }
  recent.push(now);
  hits.set(req.user.id, recent);
  next();
};
