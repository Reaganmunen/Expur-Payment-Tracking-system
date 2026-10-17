// Works out which customer and which invoices a cheque most likely pays.
//
// Evidence, strongest first:
//   1. An invoice / delivery-note number written on the cheque or remittance slip
//   2. The payer's name, compared with customer names
//   3. The amount: does it equal one invoice, or a combination of one customer's open invoices?
//
// The result is only ever a SUGGESTION. A person confirms it before any payment exists.
const { query } = require('../config/db');

const cents = (n) => Math.round(Number(n) * 100);

// ---------- names ----------
const STOP = new Set(['ltd', 'limited', 'co', 'company', 'enterprises', 'enterprise', 'inc', 'plc', 'the', 'and', 'of', 'ent', 'ke', 'kenya']);

const tokens = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));

const lev = (a, b) => {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
};

// handwriting/OCR slips: allow one wrong letter on longer words
const sameToken = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && lev(a, b) <= 1);

// 0..1. "Naivas Ltd" vs "Naivas Supermarket" -> 0.8; identical -> 1; unrelated -> 0
const nameScore = (a, b) => {
  const A = tokens(a), B = tokens(b);
  if (!A.length || !B.length) return 0;
  let common = 0;
  const used = new Set();
  for (const t of A) {
    const j = B.findIndex((u, i) => !used.has(i) && sameToken(t, u));
    if (j !== -1) { used.add(j); common += 1; }
  }
  const containment = common / Math.min(A.length, B.length);
  const jaccard = common / (A.length + B.length - common);
  return Math.round((0.6 * containment + 0.4 * jaccard) * 100) / 100;
};

// ---------- invoice references ----------
// "INV-0457", "inv 457", "0457" all collapse to the same set of comparable keys.
const keys = (raw) => {
  const out = new Set();
  const s = String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!s) return out;
  out.add(s);
  const tail = String(raw).match(/(\d+)\D*$/);          // trailing number: "INV-2026-0003" -> "0003", "DN 1021" -> "1021"
  const prefixed = s.match(/^[a-z]{1,4}(\d+)$/);         // "inv0457" -> "0457"
  for (const d of [tail && tail[1], prefixed && prefixed[1], /^\d+$/.test(s) ? s : null]) {
    if (!d) continue;
    if (d.length >= 3) out.add(d);                        // "12" alone is too weak to trust
    const trimmed = d.replace(/^0+/, '');                 // "0457" and "457" are the same number
    if (trimmed.length >= 3) out.add(trimmed);
  }
  return out;
};

const refKeys = (refs, exclude = []) => {
  const skip = new Set(exclude.flatMap((e) => [...keys(e)]));
  const out = new Set();
  for (const r of refs || []) {
    // "Inv 0457, 0458 & DN-1021" -> separate candidates, plus the whole string
    const parts = String(r).split(/[,;&/\s]+|\band\b/i).filter(Boolean);
    for (const p of [r, ...parts]) for (const k of keys(p)) if (!skip.has(k) && k.length >= 3) out.add(k);
  }
  return out;
};

const invoiceMatchesRefs = (inv, rk) => {
  for (const k of keys(inv.invoice_no)) if (rk.has(k)) return 'invoice number';
  for (const k of keys(inv.delivery_note_no)) if (rk.has(k)) return 'delivery note number';
  return null;
};

// ---------- amounts ----------
// Smallest set of invoices whose balances add up to exactly `target` (in cents).
const findSubset = (invoices, target) => {
  const items = invoices.map((i) => ({ i, c: cents(i.balance) })).filter((x) => x.c > 0).sort((a, b) => b.c - a.c).slice(0, 24);
  let budget = 300000;                                   // hard stop so a big ledger can never hang a request
  const suffix = Array(items.length + 1).fill(0);
  for (let k = items.length - 1; k >= 0; k--) suffix[k] = suffix[k + 1] + items[k].c;

  const dfs = (k, left, size, maxSize, picked) => {
    if (left === 0) return picked.slice();
    if (k >= items.length || size >= maxSize || left < 0 || suffix[k] < left || budget-- <= 0) return null;
    picked.push(items[k].i);
    const withIt = dfs(k + 1, left - items[k].c, size + 1, maxSize, picked);
    picked.pop();
    return withIt || dfs(k + 1, left, size, maxSize, picked);
  };

  for (let size = 1; size <= 8; size++) {                // prefer paying fewer invoices
    const hit = dfs(0, target, 0, size, []);
    if (hit) return hit;
  }
  return null;
};

// Pay oldest first until the cheque is used up (last invoice may be part-paid).
const oldestFirst = (invoices, amountC) => {
  let left = amountC;
  const out = [];
  for (const inv of invoices) {
    if (left <= 0) break;
    const use = Math.min(left, cents(inv.balance));
    out.push({ inv, applyC: use });
    left -= use;
  }
  return out;
};

const byAge = (a, b) =>
  String(a.due_date).localeCompare(String(b.due_date)) || String(a.issue_date).localeCompare(String(b.issue_date)) || a.id - b.id;

const shape = (inv, applyC) => ({
  invoice_id: inv.id,
  invoice_no: inv.invoice_no,
  delivery_note_no: inv.delivery_note_no,
  customer_id: inv.customer_id,
  customer: inv.customer,
  issue_date: inv.issue_date,
  due_date: inv.due_date,
  status: inv.status,
  total: inv.total,
  balance: inv.balance,
  apply: applyC === null ? null : applyC / 100,
});

// ---------- the matcher ----------
// `open` and `customers` are passed in so this function stays pure and testable.
exports.suggest = ({ payer_name, amount, references, cheque_no, customer_id }, open, customers) => {
  const amountC = amount ? cents(amount) : 0;
  const rk = refKeys(references, [cheque_no]);

  const scored = customers
    .map((c) => ({ id: c.id, name: c.name, score: nameScore(payer_name, c.name) }))
    .filter((c) => c.score >= 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  // invoices named on the paper
  const refHits = rk.size ? open.map((inv) => ({ inv, why: invoiceMatchesRefs(inv, rk) })).filter((x) => x.why) : [];

  let chosen = customer_id ? Number(customer_id) : null;
  let how = chosen ? 'chosen by you' : null;
  let payerDiffers = false;

  if (!chosen && refHits.length) {
    const tally = new Map();
    refHits.forEach(({ inv }) => tally.set(inv.customer_id, (tally.get(inv.customer_id) || 0) + 1));
    chosen = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
    how = `${refHits[0].why} on the cheque`;
    const s = scored.find((c) => c.id === chosen);
    payerDiffers = !s || s.score < 0.5;
  }

  if (!chosen && scored.length && scored[0].score >= 0.6) {
    const top = scored.filter((c) => scored[0].score - c.score <= 0.1);
    if (top.length > 1 && amountC) {
      // two similar names: let the amount decide which one actually owes this much
      const fits = top.find((c) => {
        const inv = open.filter((i) => i.customer_id === c.id);
        return inv.some((i) => cents(i.balance) === amountC) || findSubset(inv, amountC);
      });
      chosen = (fits || top[0]).id;
      how = fits ? 'payer name and amount' : 'payer name (several similar customers)';
    } else {
      chosen = scored[0].id;
      how = 'payer name';
    }
  }

  const candidates = scored;
  if (!chosen) return { customer_id: null, candidates, allocations: [], open_invoices: [], method: null, confidence: 'none', reason: null, payer_differs: false, unallocated: amountC / 100 };

  const customer = customers.find((c) => c.id === chosen);
  const mine = open.filter((i) => i.customer_id === chosen).sort(byAge);
  const mineRefs = refHits.filter((h) => h.inv.customer_id === chosen).map((h) => h.inv);

  let picks = [];
  let method;

  if (mineRefs.length) {
    method = 'reference';
    picks = oldestFirst(mineRefs.sort(byAge), amountC || Infinity);
    const used = picks.reduce((s, p) => s + p.applyC, 0);
    if (amountC && used < amountC) {
      // the named invoices don't use the whole cheque: see whether other invoices fill the gap exactly
      const rest = mine.filter((i) => !mineRefs.includes(i));
      const extra = findSubset(rest, amountC - used);
      if (extra) { picks.push(...extra.map((inv) => ({ inv, applyC: cents(inv.balance) }))); method = 'reference + amount'; }
    }
  } else if (amountC) {
    const single = mine.find((i) => cents(i.balance) === amountC);
    if (single) { picks = [{ inv: single, applyC: amountC }]; method = 'exact amount'; }
    else {
      const sub = findSubset(mine, amountC);
      if (sub) { picks = sub.sort(byAge).map((inv) => ({ inv, applyC: cents(inv.balance) })); method = 'combination'; }
      else { picks = oldestFirst(mine, amountC); method = 'oldest first'; }
    }
  }

  const allocatedC = picks.reduce((s, p) => s + p.applyC, 0);
  const nameOk = (scored.find((c) => c.id === chosen)?.score || 0) >= 0.6;
  // "clears exactly": the cheque pays every chosen invoice in full, to the cent
  const clearsExactly = amountC > 0 && allocatedC === amountC && picks.every((p) => p.applyC === cents(p.inv.balance));

  let confidence = 'low';
  if (method === 'reference' || method === 'reference + amount') confidence = clearsExactly && !payerDiffers ? 'high' : 'medium';
  else if (nameOk && (method === 'exact amount' || method === 'combination')) confidence = 'high';
  else if (nameOk && method === 'oldest first') confidence = 'medium';
  else if (method === 'exact amount' || method === 'combination') confidence = 'medium';

  return {
    customer_id: chosen,
    customer: customer?.name || null,
    candidates,
    method,
    confidence,
    reason: how,
    payer_differs: payerDiffers,
    allocations: picks.map((p) => shape(p.inv, p.applyC)),
    open_invoices: mine.map((i) => shape(i, null)),
    unallocated: amountC ? (amountC - allocatedC) / 100 : null,
  };
};

// ---------- DB loader ----------
exports.loadOpenInvoices = async (user) => {
  const params = [];
  let scope = '';
  if (user.role !== 'admin') { params.push(user.id); scope = 'AND created_by = $1'; }   // staff only ever see their own invoices
  const { rows } = await query(
    `SELECT id, invoice_no, delivery_note_no, customer_id, customer, issue_date, due_date, total, balance, status
     FROM invoice_summary WHERE status IN ('UNPAID','PARTIAL','OVERDUE') ${scope}`, params);
  return rows;
};

exports.loadCustomers = async () => (await query('SELECT id, name FROM customers ORDER BY name')).rows;

exports.match = async (input, user) => {
  const [open, customers] = await Promise.all([exports.loadOpenInvoices(user), exports.loadCustomers()]);
  return exports.suggest(input, open, customers);
};

// exported for tests
exports._internal = { nameScore, keys, refKeys, findSubset, tokens };
