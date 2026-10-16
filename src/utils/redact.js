// Staff must not see cost prices or margins. Admins see everything.
const COST_KEYS = new Set(['unit_cost', 'unit_margin', 'margin', 'line_margin', 'gross_profit']);

const strip = (v) => {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).filter(([k]) => !COST_KEYS.has(k)).map(([k, x]) => [k, strip(x)]));
  }
  return v;
};

exports.forRole = (user, data) => (user.role === 'admin' ? data : strip(data));
exports.isAdmin = (user) => user.role === 'admin';
