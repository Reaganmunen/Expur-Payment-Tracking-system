/* Expur shared frontend: auth, API, shell, dialogs, formatting */
const TZ = 'Africa/Nairobi';
const tok = () => localStorage.getItem('token');
const me = () => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } };
const isAdmin = () => me()?.role === 'admin';
const logout = () => { localStorage.clear(); location.href = '/index.html'; };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------------------------------------------ formatting */
const kes = (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 });
const plain = (n) => Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// "KES 128,450" + muted ".30", like the reference dashboard
const money = (n) => {
  const v = Number(n || 0), neg = v < 0;
  const [i, d] = Math.abs(v).toFixed(2).split('.');
  return `<small>KES</small>${neg ? '-' : ''}${Number(i).toLocaleString('en-KE')}<span class="dim">.${d}</span>`;
};
const compact = (n) => {
  const a = Math.abs(n);
  if (a >= 1e6) return +(n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return +(n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
};
const fmtDate = (s) => (s ? new Date(String(s).slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');
const fmtStamp = (ts) => (ts ? new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }) : '');
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // Nairobi's date, not UTC's
const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const pct = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
const delta = (cur, prev, goodWhenUp = true, label = 'vs last month') => {
  const p = pct(cur, prev);
  if (p === null) return `<span class="delta">No figures for last month</span>`;
  const good = goodWhenUp ? p >= 0 : p <= 0;
  return `<span class="delta"><b class="${good ? 'up' : 'down'}">${p >= 0 ? '+' : ''}${p.toFixed(1)}%</b> ${label}</span>`;
};

/* ------------------------------------------------------------ icons (stroke, 24px grid) */
const ICONS = {
  grid: '<rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/>',
  invoice: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  box: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  panel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  menu: '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  cheque: '<rect width="20" height="12" x="2" y="6" rx="2"/><path d="M6 14h6"/><path d="M6 10h3"/><path d="M16 10h2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  arrow: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
};
const ico = (n, extra = '') => `<svg class="i ${extra}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ------------------------------------------------------------ status pills */
const STATUS = {
  PAID: ['ok', 'Paid'], PARTIAL: ['info', 'Part paid'], UNPAID: ['', 'Unpaid'], OVERDUE: ['bad', 'Overdue'], WRITTEN_OFF: ['dark', 'Written off'],
  pending: ['warn', 'To review'], recorded: ['ok', 'Recorded'], void: ['dark', 'Void'],
};
const METHOD = { mpesa: 'M-Pesa', cash: 'Cash', bank: 'Bank transfer', cheque: 'Cheque' };
const methodLabel = (m) => METHOD[m] || m;
const badge = (s) => { const [c, l] = STATUS[s] || ['', s]; return `<span class="pill ${c}">${esc(l)}</span>`; };

/* ------------------------------------------------------------ API */
const authHeader = () => ({ Authorization: 'Bearer ' + tok() });

async function readJson(r) {
  const data = await r.json().catch(() => null);
  if (r.status === 401 && tok()) { logout(); throw new Error('Session expired'); } // (no token = a failed login, show its message)
  if (!r.ok) throw new Error(data?.error || data?.message || `Request failed (${r.status})`);
  return data;
}
async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch('/api' + path, {
    method,
    headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...authHeader() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return readJson(r);
}
// photo goes up as the raw request body
async function upload(path, blob) {
  const r = await fetch('/api' + path, { method: 'POST', headers: { 'Content-Type': blob.type || 'image/jpeg', ...authHeader() }, body: blob });
  return readJson(r);
}
async function download(path, fallbackName) {
  const r = await fetch('/api' + path, { headers: authHeader() });
  if (r.status === 401) { logout(); return; }
  if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.error || `Download failed (${r.status})`); }
  const name = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '')?.[1] || fallbackName;
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
const photoUrls = new Map();
async function chequePhoto(id) {
  if (photoUrls.has(id)) return photoUrls.get(id);
  const r = await fetch(`/api/cheques/${id}/image`, { headers: authHeader() });
  if (!r.ok) throw new Error('Could not load the photo');
  const u = URL.createObjectURL(await r.blob());
  photoUrls.set(id, u);
  return u;
}

// Shrink phone photos (often 8-12 MB) to ~300-500 KB before they leave the phone.
// createImageBitmap applies the EXIF rotation, so portrait photos stay upright.
async function prepImage(file, max = 1800) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file is not a readable image')); i.src = URL.createObjectURL(file); });
  }
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * s), height: Math.round(bmp.height * s) });
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not process the photo'))), 'image/jpeg', 0.86));
}

/* ------------------------------------------------------------ toasts + dialogs */
function notify(msg, type = 'ok') {
  let box = $('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'danger' || type === 'bad' ? 'bad' : '');
  t.innerHTML = ico(type === 'ok' ? 'check' : 'alert') + `<span>${esc(msg)}</span>`;
  box.appendChild(t);
  setTimeout(() => t.remove(), type === 'ok' ? 3500 : 7000);
}

function dialog(html, cls) {
  const d = document.createElement('dialog');
  d.className = cls;
  d.innerHTML = html;
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
  d.addEventListener('close', () => d.remove());
  document.body.appendChild(d);
  d.setAttribute('tabindex', '-1');
  d.showModal();
  d.focus({ preventScroll: true });   // start on the panel, not on the close button
  return d;
}
const openDrawer = (html) => dialog(html, 'drawer');
const openModal = (html, wide) => dialog(html, 'modal' + (wide ? ' wide' : ''));
const closeBtn = `<button class="icon-btn" data-close aria-label="Close">${ico('x')}</button>`;

function confirmBox(message, { title = 'Are you sure?', ok = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    const d = openModal(`<div class="dlg-h"><h2>${esc(title)}</h2></div>
      <div class="dlg-b"><p>${esc(message)}</p></div>
      <div class="dlg-f"><button class="btn" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cb-ok">${esc(ok)}</button></div>`);
    let yes = false;
    $('#cb-ok', d).onclick = () => { yes = true; d.close(); };
    d.addEventListener('close', () => resolve(yes));
  });
}

/* Excel/CSV export: paid, unpaid or both */
function openExport() {
  const d = openModal(`<div class="dlg-h"><div><h2>Export to Excel</h2><p class="muted">Downloads a CSV file that opens in Excel.</p></div>${closeBtn}</div>
    <div class="dlg-b">
      <div class="radio-list">
        <label><input type="radio" name="scope" value="all" checked><span><b>Everything</b><small>Every invoice, with a Status column showing paid or not</small></span></label>
        <label><input type="radio" name="scope" value="unpaid"><span><b>Not paid yet</b><small>Unpaid, part paid and overdue invoices</small></span></label>
        <label><input type="radio" name="scope" value="paid"><span><b>Paid</b><small>Fully paid invoices only</small></span></label>
      </div>
      <div class="form-grid">
        <div class="field c6"><label>Issued from</label><input class="in" type="date" id="x-from"></div>
        <div class="field c6"><label>Issued to</label><input class="in" type="date" id="x-to"></div>
      </div>
      <p class="err" id="x-err" role="alert"></p>
    </div>
    <div class="dlg-f"><button class="btn" data-close>Cancel</button><button class="btn primary" id="x-go">${ico('download')} Download</button></div>`);
  $('#x-go', d).onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true;
    const q = new URLSearchParams({ scope: $('input[name=scope]:checked', d).value });
    if ($('#x-from', d).value) q.set('from', $('#x-from', d).value);
    if ($('#x-to', d).value) q.set('to', $('#x-to', d).value);
    try { await download('/invoices/export.csv?' + q, 'invoices.csv'); d.close(); notify('Export downloaded'); }
    catch (err) { $('#x-err', d).textContent = err.message; b.disabled = false; }
  };
}

/* ------------------------------------------------------------ page shell */
function init({ active, title, adminOnly = false, search = false, actions = '' } = {}) {
  if (!tok()) { location.href = '/index.html'; return false; }
  if (adminOnly && !isAdmin()) { location.href = '/dashboard.html'; return false; }

  const u = me() || {};
  const nav = [
    ['dashboard', '/dashboard.html', 'grid', 'Overview'],
    ['invoices', '/invoices.html', 'invoice', 'Invoices'],
    ['cheques', '/cheques.html', 'scan', 'Cheques'],
    ['customers', '/customers.html', 'users', 'Customers'],
    ['expenses', '/expenses.html', 'wallet', 'Expenses'],
    ...(isAdmin() ? [['products', '/products.html', 'box', 'Products']] : []),
  ];
  const view = $('#view');
  const shell = document.createElement('div');
  shell.className = 'shell' + (localStorage.getItem('nav') === 'collapsed' ? ' collapsed' : '');
  shell.innerHTML = `
    <aside class="side" id="side">
      <div class="brand"><span class="logo">E</span><span class="brand-name">Expur</span>
        <button class="icon-btn collapse-btn" id="collapse" aria-label="Collapse sidebar">${ico('panel')}</button></div>
      <nav class="nav" aria-label="Main">
        ${nav.map(([k, href, ic, label]) => `<a class="nav-i ${k === active ? 'active' : ''}" href="${href}" ${k === active ? 'aria-current="page"' : ''} title="${label}">${ico(ic)}<span>${label}</span>${k === 'cheques' ? '<em class="count hide" id="pend-count" style="font-style:normal"></em>' : ''}</a>`).join('')}
      </nav>
      <div class="side-foot"><div class="user"><span class="avatar">${esc(initials(u.name))}</span>
        <div class="user-t"><b>${esc(u.name || 'User')}</b><small>${esc(u.role || '')}</small></div>
        <button class="icon-btn" id="logout" aria-label="Sign out" title="Sign out">${ico('logout')}</button></div></div>
    </aside>
    <div class="scrim" id="scrim"></div>
    <div class="main"><header class="top">
      <button class="icon-btn menu-btn" id="menu" aria-label="Open menu">${ico('menu')}</button>
      <h1>${esc(title)}</h1>
      ${search ? `<div class="search">${ico('search')}<input class="in" id="gsearch" type="search" placeholder="Search invoices" autocomplete="off"></div>` : ''}
      ${actions}
    </header></div>`;
  $('.main', shell).appendChild(view);
  document.body.prepend(shell);
  document.title = `${title} - Expur`;

  $('#collapse').onclick = () => { shell.classList.toggle('collapsed'); localStorage.setItem('nav', shell.classList.contains('collapsed') ? 'collapsed' : ''); };
  $('#menu').onclick = () => shell.classList.add('nav-open');
  $('#scrim').onclick = () => shell.classList.remove('nav-open');
  $('#logout').onclick = logout;
  const gs = $('#gsearch');
  if (gs) {
    gs.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      if (window.onSearch) window.onSearch(gs.value);
      else location.href = '/invoices.html?q=' + encodeURIComponent(gs.value.trim());
    });
  }
  // little badge on "Cheques" when scans are waiting for review
  api('/cheques?status=pending').then((l) => { if (l.length) { const c = $('#pend-count'); c.textContent = l.length; c.classList.remove('hide'); } }).catch(() => {});
  return true;
}

const headerBtn = (href, icon, label, primary) => `<a class="btn ${primary ? 'primary' : ''}" href="${href}">${ico(icon)}${label}</a>`;
