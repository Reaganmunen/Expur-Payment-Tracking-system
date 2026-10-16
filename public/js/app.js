const tok = () => localStorage.getItem('token');
const me = () => JSON.parse(localStorage.getItem('user') || 'null');
const isAdmin = () => me()?.role === 'admin';
const logout = () => { localStorage.clear(); location.href = '/index.html'; };

async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(tok() && { Authorization: 'Bearer ' + tok() }) },
    body: body && JSON.stringify(body),
  });
  if (r.status === 401 && !path.startsWith('/auth/login')) { logout(); throw new Error('Session expired'); }
  const d = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || `Request failed (${r.status})`);
  return d;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kes = (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 });
const COLORS = { PAID: 'success', PARTIAL: 'info', UNPAID: 'secondary', OVERDUE: 'danger', WRITTEN_OFF: 'dark' };
const badge = (s) => `<span class="badge text-bg-${COLORS[s] || 'secondary'}">${s.replace('_', ' ')}</span>`;
const today = () => new Date().toISOString().slice(0, 10);

function notify(msg, type = 'danger') {
  document.getElementById('alerts').innerHTML =
    `<div class="alert alert-${type} alert-dismissible">${esc(msg)}<button class="btn-close" data-bs-dismiss="alert"></button></div>`;
  scrollTo(0, 0);
}

// Call first on every protected page. Returns false if redirecting.
function init(active, adminOnly = false) {
  if (!tok()) { location.href = '/index.html'; return false; }
  if (adminOnly && !isAdmin()) { location.href = '/dashboard.html'; return false; }
  const links = [['dashboard', 'Dashboard'], ['invoices', 'Invoices'], ['invoice-new', 'New invoice'],
    ['customers', 'Customers'], ['expenses', 'Expenses'], ...(isAdmin() ? [['products', 'Products']] : [])];
  document.getElementById('nav').innerHTML = `
  <nav class="navbar navbar-expand-md navbar-dark app-nav mb-4"><div class="container">
    <a class="navbar-brand d-flex align-items-center gap-2" href="/dashboard.html"><span class="logo-mark sm">E</span>Expur</a>
    <button class="navbar-toggler" data-bs-toggle="collapse" data-bs-target="#m"><span class="navbar-toggler-icon"></span></button>
    <div class="collapse navbar-collapse" id="m">
      <ul class="navbar-nav me-auto">${links.map(([p, t]) =>
        `<li class="nav-item"><a class="nav-link ${p === active ? 'active' : ''}" href="/${p}.html">${t}</a></li>`).join('')}</ul>
      <span class="user-chip me-3">${esc(me().name)}<small>${me().role}</small></span>
      <button class="btn btn-outline-light btn-sm" onclick="logout()">Logout</button>
    </div></div></nav>`;
  return true;
}
