// ============================================================
// Core utilities: API client, store, router, toast, helpers
// ============================================================

const API = {
  async req(method, url, body, isForm) {
    const opts = { method, headers: {}, credentials: 'same-origin' };
    if (body && !isForm) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    if (body && isForm) opts.body = body;
    const res = await fetch('/api' + url, opts);
    if (res.status === 401 && !url.includes('/auth/me')) { Store.user = null; Router.go('/login'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  get(u) { return this.req('GET', u); },
  post(u, b) { return this.req('POST', u, b); },
  patch(u, b) { return this.req('PATCH', u, b); },
  del(u) { return this.req('DELETE', u); },
  upload(u, formData) { return this.req('POST', u, formData, true); },
};

const Store = {
  user: null,
  profile: null,
  catalog: [],
  notifications: [],
  theme: localStorage.getItem('rsms-theme') || 'light',
};

function applyTheme(t) {
  Store.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('rsms-theme', t);
}
applyTheme(Store.theme);

// ---------- Router ----------
const Router = {
  routes: [],
  on(pattern, handler) { this.routes.push({ pattern, handler }); },
  go(path) { history.pushState({}, '', path); this.resolve(); },
  replace(path) { history.replaceState({}, '', path); this.resolve(); },
  async resolve() {
    const path = location.pathname;
    for (const r of this.routes) {
      const m = matchRoute(r.pattern, path);
      if (m) { await r.handler(m); return; }
    }
    // default
    Router.go(Store.user ? '/app' : '/login');
  },
  start() {
    window.addEventListener('popstate', () => this.resolve());
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-link]');
      if (a) { e.preventDefault(); this.go(a.getAttribute('data-link')); }
    });
    this.resolve();
  }
};
function matchRoute(pattern, path) {
  const pp = pattern.split('/').filter(Boolean);
  const xp = path.split('/').filter(Boolean);
  if (pp.length !== xp.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(xp[i]);
    else if (pp[i] !== xp[i]) return null;
  }
  return params;
}

// ---------- Toast ----------
function toast(msg, type = 'success') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const ic = type === 'success' ? 'checkCircle' : type === 'error' ? 'alert' : 'bell';
  const col = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--info)';
  el.innerHTML = `<span style="color:${col}">${icon(ic, 18)}</span><span class="text-sm">${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; el.style.transition = 'all .25s'; setTimeout(() => el.remove(), 250); }, 3200);
}

// ---------- Modal ----------
function modal({ title, body, footer, wide, onClose }) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">
    <div class="modal-head"><div class="modal-title">${title}</div>
      <button class="btn btn-ghost btn-icon" data-close>${icon('x', 18)}</button></div>
    <div class="modal-body">${body}</div>
    ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
  </div>`;
  document.body.appendChild(overlay);
  const close = () => { overlay.remove(); onClose && onClose(); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-close]').addEventListener('click', close);
  const esc = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
  return { overlay, close, el: overlay.querySelector('.modal') };
}

// ---------- Helpers ----------
function initials(name) { return (name || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase(); }
function avatar(name, color, size = 'md') {
  const cls = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : size === 'xl' ? 'xl' : '';
  return `<div class="avatar ${cls}" style="background:${color || '#6366f1'}">${initials(name)}</div>`;
}
function fmtDate(d) { if (!d) return '—'; const dt = new Date(d.length <= 10 ? d + 'T00:00' : d); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function fmtDateTime(d) { if (!d) return '—'; return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function relTime(d) {
  if (!d) return '';
  const diff = (Date.now() - new Date(d.includes('T') || d.includes(' ') ? d.replace(' ', 'T') + (d.includes('Z') ? '' : 'Z') : d).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return fmtDate(d);
}
function daysUntil(d) { if (!d) return null; return Math.ceil((new Date(d + 'T00:00') - new Date(new Date().toISOString().slice(0,10) + 'T00:00')) / 86400000); }
function fileSize(b) { if (!b) return '0 B'; const u = ['B','KB','MB','GB']; const i = Math.floor(Math.log(b) / Math.log(1024)); return (b / Math.pow(1024, i)).toFixed(1) + ' ' + u[i]; }
function esc(s) { return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const STATUS_LABELS = { not_started: 'Not Started', in_progress: 'In Progress', submitted: 'Submitted', revision: 'Revision', approved: 'Approved', completed: 'Completed' };
function statusBadge(s) { return `<span class="badge st-${s}">${STATUS_LABELS[s] || s}</span>`; }

const CAT_COLORS = {
  'Sample Preparation': '#10b981', 'Phytochemical & Analytical': '#0ea5e9', 'In Vitro Bioassay': '#8b5cf6',
  'In Vivo & Pharmacology': '#f43f5e', 'Computational': '#6366f1', 'Analysis & Documentation': '#f59e0b',
};
function catColor(c) { return CAT_COLORS[c] || '#6b7280'; }

// Minimal markdown renderer
function md(text) {
  if (!text) return '';
  let h = esc(text);
  h = h.replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/`(.+?)`/g, '<code>$1</code>');
  h = h.replace(/^- \[ \] (.*)$/gm, '<li><input type="checkbox" disabled> $1</li>');
  h = h.replace(/^- \[x\] (.*)$/gm, '<li><input type="checkbox" checked disabled> $1</li>');
  h = h.replace(/^[-*] (.*)$/gm, '<li>$1</li>');
  h = h.replace(/^\d+\. (.*)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>.*<\/li>\n?)+/g, m => '<ul>' + m + '</ul>');
  h = h.split(/\n{2,}/).map(b => b.match(/^<(h\d|ul|ol)/) ? b : '<p>' + b.replace(/\n/g, '<br>') + '</p>').join('');
  return `<div class="markdown">${h}</div>`;
}

function spinner() { return `<div style="display:grid;place-items:center;padding:60px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" style="animation:spin .8s linear infinite"><path d="M21 12a9 9 0 1 1-6.2-8.5" stroke-linecap="round"/></svg></div>`; }
const _sp = document.createElement('style'); _sp.textContent = '@keyframes spin{to{transform:rotate(360deg)}}'; document.head.appendChild(_sp);
