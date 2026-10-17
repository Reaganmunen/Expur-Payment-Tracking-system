const Cheque = require('../models/chequeModel');
const Scanner = require('../services/chequeScanner');
const Matcher = require('../services/chequeMatcher');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireFields, positiveNumber, ensureFound } = require('../utils/validate');
const { isAdmin } = require('../utils/redact');

const MAX_IMAGE = 4 * 1024 * 1024;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T00:00:00Z').getTime());
const text = (v, max, name) => {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  if (s.length > max) throw new ApiError(400, `${name} is too long (max ${max} characters)`);
  return s || null;
};

// Staff only ever see the cheques they uploaded; a foreign id looks like "not found"
const loadVisible = async (req) => {
  const c = ensureFound(await Cheque.getById(req.params.id), 'Cheque');
  if (!isAdmin(req.user) && c.uploaded_by !== req.user.id) throw new ApiError(404, 'Cheque not found');
  return c;
};

// ---- things worth a second look before someone clicks "record" ----
const warningsFor = (c, scan, dup) => {
  const w = [];
  const add = (level, message) => w.push({ level, message });
  if (scan && scan.is_cheque === false) add('bad', 'This photo does not look like a cheque.');
  if (scan?.image_quality === 'poor') add('warn', 'The photo is hard to read. Check every field against the paper, or retake it.');

  const f = scan?.amount_figures, words = scan?.amount_words_value;
  if (f && words && Math.abs(f - words) > 0.5) {
    add('bad', `The figures say ${f.toLocaleString('en-KE')} but the words say ${words.toLocaleString('en-KE')}. Look at the cheque before choosing either.`);
  }
  if (scan && !f && !words) add('warn', 'The amount could not be read. Type it in from the cheque.');
  if (scan && !scan.cheque_no) add('warn', 'The cheque number could not be read. Type it in from the cheque.');

  if (c.cheque_date) {
    const d = new Date(c.cheque_date + 'T00:00:00Z');
    const now = Date.now();
    if (d.getTime() > now + 86400000) add('warn', `Post-dated: this cheque is dated ${c.cheque_date}. The bank will not pay it before then.`);
    if (d.getTime() < now - 183 * 86400000) add('warn', `Dated ${c.cheque_date}, which is more than 6 months ago. Banks usually refuse stale cheques.`);
  }
  if (dup) add('bad', `A cheque with this number and amount was already recorded on ${new Date(dup.recorded_at).toISOString().slice(0, 10)}. Recording it again would count it twice.`);
  if (scan?.notes) add('info', `Noted on the cheque: ${scan.notes}`);
  return w;
};

const buildReview = async (user, id, scanError = null) => {
  const { scan, ...cheque } = ensureFound(await Cheque.getById(id), 'Cheque');
  const [suggestion, dup] = await Promise.all([
    cheque.status === 'pending'
      ? Matcher.match({ payer_name: cheque.payer_name, amount: cheque.amount, references: scan?.references || [], cheque_no: cheque.cheque_no }, user)
      : null,
    cheque.status === 'pending' ? Cheque.findDuplicate({ cheque_no: cheque.cheque_no, amount: cheque.amount, exclude_id: cheque.id }) : null,
  ]);
  return {
    cheque,
    extracted: scan && {
      payee: scan.payee, amount_words: scan.amount_words, amount_figures: scan.amount_figures,
      amount_words_value: scan.amount_words_value, references: scan.references, crossed: scan.crossed,
      image_quality: scan.image_quality, notes: scan.notes,
    },
    warnings: warningsFor(cheque, scan, dup),
    suggestion,
    scan_error: scanError,
    scan_available: Scanner.isConfigured(),
  };
};

// A failed read must never lose the photo: the cheque is kept and can be filled in by hand or rescanned.
const runScan = async (id) => {
  try {
    const img = await Cheque.getImage(id);
    await Cheque.saveScan(id, await Scanner.scan({ buffer: img.data, mime: img.mime }));
    return null;
  } catch (e) {
    if (!(e instanceof ApiError)) console.error('cheque scan failed:', e);
    return e instanceof ApiError ? e.message : 'Reading the cheque failed unexpectedly. You can enter it by hand.';
  }
};

exports.scan = asyncHandler(async (req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || !buf.length) throw new ApiError(400, 'No photo received.');
  if (buf.length > MAX_IMAGE) throw new ApiError(413, 'That photo is too large (max 4 MB). Try again with a smaller picture.');
  const mime = Scanner.sniff(buf);
  if (!mime) throw new ApiError(400, 'Unsupported photo. Use a JPEG, PNG or WebP image.');

  const id = await Cheque.createPending({ uploaded_by: req.user.id, image: buf, mime });
  const scanError = await runScan(id);
  res.status(201).json(await buildReview(req.user, id, scanError));
});

exports.rescan = asyncHandler(async (req, res) => {
  const c = await loadVisible(req);
  if (c.status !== 'pending') throw new ApiError(409, 'Only a cheque that has not been recorded can be rescanned.');
  const scanError = await runScan(c.id);
  res.json(await buildReview(req.user, c.id, scanError));
});

exports.get = asyncHandler(async (req, res) => {
  const c = await loadVisible(req);
  res.json(await buildReview(req.user, c.id));
});

exports.list = asyncHandler(async (req, res) => {
  const filters = { status: ['pending', 'recorded', 'void'].includes(req.query.status) ? req.query.status : undefined };
  if (!isAdmin(req.user)) filters.uploaded_by = req.user.id;
  res.json(await Cheque.getAll(filters));
});

exports.image = asyncHandler(async (req, res) => {
  const c = await loadVisible(req);
  const img = ensureFound(await Cheque.getImage(c.id), 'Photo');
  res.set({ 'Content-Type': img.mime, 'Cache-Control': 'private, max-age=3600' }).send(img.data);
});

// Re-suggest after the person edits the payer/amount or picks a different customer.
exports.match = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const amount = b.amount === undefined || b.amount === null || b.amount === '' ? null : positiveNumber(b.amount, 'amount');
  const references = Array.isArray(b.references) ? b.references.map((r) => String(r).slice(0, 60)).slice(0, 10) : [];
  const suggestion = await Matcher.match({
    payer_name: text(b.payer_name, 120, 'payer_name'), amount, references,
    cheque_no: text(b.cheque_no, 50, 'cheque_no'), customer_id: b.customer_id ? Number(b.customer_id) : null,
  }, req.user);
  res.json({ suggestion });
});

exports.record = asyncHandler(async (req, res) => {
  const c = await loadVisible(req);
  const b = req.body || {};
  requireFields(b, ['cheque_no', 'amount']);

  const amount = positiveNumber(b.amount, 'amount');
  const fields = {
    cheque_no: text(b.cheque_no, 50, 'cheque_no'),
    payer_name: text(b.payer_name, 120, 'payer_name'),
    bank: text(b.bank, 80, 'bank'),
    cheque_date: b.cheque_date ? String(b.cheque_date) : null,
    amount,
    customer_id: b.customer_id ? Number(b.customer_id) : null,
  };
  if (fields.cheque_date && !isDate(fields.cheque_date)) throw new ApiError(400, 'cheque_date must look like 2026-10-16');

  const list = Array.isArray(b.allocations) ? b.allocations : [];
  if (!list.length) throw new ApiError(400, 'Choose at least one invoice this cheque pays.');
  const seen = new Set();
  const allocations = list.map((a, i) => {
    const invoice_id = Number(a.invoice_id);
    if (!Number.isInteger(invoice_id)) throw new ApiError(400, `allocations[${i}].invoice_id is invalid`);
    if (seen.has(invoice_id)) throw new ApiError(400, 'The same invoice was listed twice.');
    seen.add(invoice_id);
    return { invoice_id, amount: positiveNumber(a.amount, `allocations[${i}].amount`) };
  });
  const total = allocations.reduce((s, a) => s + Math.round(a.amount * 100), 0);
  if (total > Math.round(amount * 100)) {
    throw new ApiError(400, 'The invoices add up to more than the cheque amount. Reduce what is applied.');
  }

  const payments = await Cheque.record(c.id, fields, allocations, {
    userId: req.user.id, restrict_to: isAdmin(req.user) ? null : req.user.id,
  });
  const { scan, ...cheque } = await Cheque.getById(c.id); // eslint-disable-line no-unused-vars
  res.status(201).json({ cheque, payments, unallocated: (Math.round(amount * 100) - total) / 100 });
});

exports.discard = asyncHandler(async (req, res) => {
  const c = await loadVisible(req);
  if (c.status !== 'pending') throw new ApiError(409, 'Only a cheque that has not been recorded can be discarded. Void it instead.');
  ensureFound(await Cheque.discard(c.id, { restrict_to: isAdmin(req.user) ? null : req.user.id }), 'Cheque');
  res.status(204).end();
});

exports.void = asyncHandler(async (req, res) => {
  const c = await loadVisible(req);
  const removed = await Cheque.voidCheque(c.id, text(req.body?.reason, 200, 'reason'));
  res.json({ message: `Cheque voided. ${removed} payment(s) removed and the invoices are open again.`, removed });
});
