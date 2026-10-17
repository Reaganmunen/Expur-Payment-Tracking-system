// CSV that opens cleanly in Excel.
//  - UTF-8 BOM so names with accents/apostrophes are not garbled
//  - CRLF line endings
//  - Digit-only text with a leading zero (invoice 0457, cheque 000412) is written as ="0457",
//    otherwise Excel silently turns it into the number 457
//  - Text starting with = + - @ is prefixed with ' so a customer named "=HYPERLINK(...)"
//    cannot run as a formula when someone opens the file
const BOM = '\uFEFF';

function cell(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  let s = String(v);
  if (/^0\d+$/.test(s)) s = `="${s}"`;
  else if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// columns: [{ header, key | get }]
exports.toCsv = (columns, rows) => {
  const head = columns.map((c) => cell(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => cell(c.get ? c.get(r) : r[c.key])).join(','));
  return BOM + [head, ...body].join('\r\n') + '\r\n';
};

exports.cell = cell;
