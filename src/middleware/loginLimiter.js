const ApiError = require('../utils/ApiError');

// 10 failed attempts per IP+email per 15 minutes (in-memory)
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
const MAX = 10;

module.exports = (req, res, next) => {
  const key = `${req.ip}:${String(req.body?.email || '').toLowerCase()}`;
  const now = Date.now();
  const rec = attempts.get(key);

  if (rec && now - rec.start < WINDOW) {
    if (rec.count >= MAX) return next(new ApiError(429, 'Too many login attempts. Try again in 15 minutes.'));
  } else {
    attempts.set(key, { count: 0, start: now });
  }

  res.on('finish', () => {
    const r = attempts.get(key);
    if (!r) return;
    if (res.statusCode === 401) r.count += 1;
    else if (res.statusCode === 200) attempts.delete(key);
  });
  next();
};
