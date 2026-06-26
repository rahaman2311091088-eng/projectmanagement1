// ============================================================
// App shell: sidebar, topbar, command palette, notifications
// ============================================================

function renderShell(activeNav, pageContent) {
  const u = Store.user;
  const isSup = u.role === 'supervisor' || u.role === 'admin';
  const unread = Store.notifications.filter(n => !n.is_read).length;

  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', link: '/app' },
    { id: 'projects', label: 'Projects', icon: 'folder', link: '/app/projects' },
    { id: 'knowledge', label: 'Knowledge Base', icon: 'book', link: '/app/knowledge' },
  ];
  if (isSup) {
    nav.push({ id: 'students', label: 'Students', icon: 'users', link: '/app/students' });
  }
  nav.push({ id: 'meetings', label: 'Meetings', icon: 'calendar', link: '/app/meetings' });

  document.getElementById('app').innerHTML = `
  <div class="shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="brand-logo">${icon('flask', 18)}</div>
        <div class="col"><div class="brand-name">RSMS</div><div class="brand-sub">Research Supervision</div></div>
      </div>
      <nav class="nav-section">
        ${nav.map(n => `<div class="nav-item ${activeNav === n.id ? 'active' : ''}" data-link="${n.link}">${icon(n.icon, 18)}<span>${n.label}</span></div>`).join('')}
      </nav>
      <div class="nav-spacer"></div>
      <div class="nav-item" id="themeToggle">${icon(Store.theme === 'dark' ? 'sun' : 'moon', 18)}<span>${Store.theme === 'dark' ? 'Light' : 'Dark'} mode</span></div>
      <div class="sidebar-user" id="userMenu">
        ${avatar(u.full_name, u.avatar_color)}
        <div class="col" style="min-width:0;flex:1">
          <div class="text-sm fw-600 truncate">${esc(u.full_name)}</div>
          <div class="text-xs tertiary truncate" style="text-transform:capitalize">${u.role}</div>
        </div>
        ${icon('chevronRight', 16, 'tertiary')}
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="btn btn-ghost btn-icon menu-toggle" id="menuToggle">${icon('list', 20)}</button>
        <div class="topbar-search" id="cmdkOpen">
          ${icon('search', 16)}<span class="label-text muted">Search or jump to…</span>
          <span class="spacer"></span><span class="kbd label-text">⌘K</span>
        </div>
        <div class="spacer"></div>
        ${isSup ? `<button class="btn btn-primary btn-sm" id="newProjectBtn">${icon('plus', 16)} New Project</button>` : ''}
        <div class="dropdown">
          <button class="btn btn-ghost btn-icon" id="notifBtn" style="position:relative">
            ${icon('bell', 19)}
            ${unread ? `<span style="position:absolute;top:4px;right:4px;width:8px;height:8px;background:var(--danger);border-radius:50%;border:2px solid var(--bg-elev)"></span>` : ''}
          </button>
        </div>
      </header>
      <div class="content" id="pageContent">${pageContent || spinner()}</div>
    </div>
  </div>`;

  // Wire events
  document.getElementById('themeToggle').onclick = () => { applyTheme(Store.theme === 'dark' ? 'light' : 'dark'); Router.resolve(); };
  document.getElementById('menuToggle').onclick = () => document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('cmdkOpen').onclick = openCommandPalette;
  document.getElementById('userMenu').onclick = (e) => { e.stopPropagation(); openUserMenu(e.currentTarget); };
  document.getElementById('notifBtn').onclick = (e) => { e.stopPropagation(); openNotifications(e.currentTarget); };
  const npb = document.getElementById('newProjectBtn');
  if (npb) npb.onclick = openNewProjectModal;
}

function openUserMenu(anchor) {
  const existing = document.querySelector('.dropdown-menu.user-dd'); if (existing) { existing.remove(); return; }
  const dd = document.createElement('div');
  dd.className = 'dropdown-menu user-dd';
  dd.style.cssText = 'position:fixed;left:14px;bottom:64px;width:220px';
  dd.innerHTML = `
    <div style="padding:8px 10px"><div class="fw-600 text-sm">${esc(Store.user.full_name)}</div><div class="text-xs tertiary">${esc(Store.user.email)}</div></div>
    <div class="dropdown-divider"></div>
    <div class="dropdown-item" data-act="profile">${icon('settings', 16)} Profile & Settings</div>
    <div class="dropdown-item" data-act="logout" style="color:var(--danger)">${icon('logout', 16)} Sign out</div>`;
  document.body.appendChild(dd);
  const close = () => { dd.remove(); document.removeEventListener('click', close); };
  setTimeout(() => document.addEventListener('click', close), 0);
  dd.querySelector('[data-act=logout]').onclick = async () => { await API.post('/auth/logout'); Store.user = null; Router.go('/login'); };
  dd.querySelector('[data-act=profile]').onclick = () => { close(); Router.go('/app/profile'); };
}

async function openNotifications(anchor) {
  const existing = document.querySelector('.dropdown-menu.notif-dd'); if (existing) { existing.remove(); return; }
  Store.notifications = await API.get('/notifications').catch(() => []);
  const dd = document.createElement('div');
  dd.className = 'dropdown-menu notif-dd notif-panel';
  dd.style.cssText = 'position:fixed;right:24px;top:60px';
  const list = Store.notifications;
  dd.innerHTML = `
    <div class="row between" style="padding:12px 16px;border-bottom:1px solid var(--border)">
      <span class="fw-700">Notifications</span>
      <button class="btn btn-ghost btn-sm" id="markAll">Mark all read</button>
    </div>
    ${list.length ? list.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" ${n.link ? `data-link="${n.link}"` : ''}>
        <span style="color:var(--primary)">${icon(n.icon || 'bell', 18)}</span>
        <div class="col" style="min-width:0"><div class="text-sm fw-600">${esc(n.title)}</div>
        <div class="text-xs muted">${esc(n.body || '')}</div>
        <div class="text-xs tertiary mt-1">${relTime(n.created_at)}</div></div>
      </div>`).join('') : `<div class="empty" style="padding:40px">${icon('bell', 40)}<p class="text-sm">No notifications</p></div>`}`;
  document.body.appendChild(dd);
  const close = (e) => { if (!dd.contains(e?.target)) { dd.remove(); document.removeEventListener('click', close); } };
  setTimeout(() => document.addEventListener('click', close), 0);
  dd.querySelector('#markAll').onclick = async (e) => { e.stopPropagation(); await API.post('/notifications/read', {}); dd.remove(); renderShell(currentNav, document.getElementById('pageContent').innerHTML); };
}

// ---------- Command Palette ----------
let cmdkProjects = [];
async function openCommandPalette() {
  if (document.querySelector('.cmdk-overlay')) return;
  if (!cmdkProjects.length) cmdkProjects = await API.get('/projects').catch(() => []);
  const overlay = document.createElement('div');
  overlay.className = 'overlay cmdk-overlay';
  overlay.style.alignItems = 'flex-start';
  overlay.style.paddingTop = '12vh';
  const isSup = Store.user.role !== 'student';
  const commands = [
    { type: 'Navigation', label: 'Go to Dashboard', icon: 'dashboard', action: () => Router.go('/app') },
    { type: 'Navigation', label: 'Go to Projects', icon: 'folder', action: () => Router.go('/app/projects') },
    { type: 'Navigation', label: 'Go to Knowledge Base', icon: 'book', action: () => Router.go('/app/knowledge') },
    { type: 'Navigation', label: 'Go to Meetings', icon: 'calendar', action: () => Router.go('/app/meetings') },
    ...(isSup ? [{ type: 'Actions', label: 'Create new project', icon: 'plus', action: openNewProjectModal },
                 { type: 'Navigation', label: 'Go to Students', icon: 'users', action: () => Router.go('/app/students') }] : []),
    { type: 'Actions', label: 'Toggle theme', icon: Store.theme === 'dark' ? 'sun' : 'moon', action: () => { applyTheme(Store.theme === 'dark' ? 'light' : 'dark'); Router.resolve(); } },
    ...cmdkProjects.map(p => ({ type: 'Projects', label: p.title, sub: p.code, icon: 'flask', action: () => Router.go('/app/projects/' + p.id) })),
  ];
  overlay.innerHTML = `<div class="modal cmdk">
    <input class="cmdk-input" placeholder="Type a command or search projects…" autofocus>
    <div class="cmdk-list"></div>
    <div class="cmdk-foot"><span><span class="kbd">↑↓</span> navigate</span><span><span class="kbd">↵</span> select</span><span><span class="kbd">esc</span> close</span></div>
  </div>`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector('.cmdk-input');
  const list = overlay.querySelector('.cmdk-list');
  let filtered = commands, sel = 0;
  function render() {
    const groups = {};
    filtered.forEach(c => { (groups[c.type] = groups[c.type] || []).push(c); });
    let i = 0, html = '';
    Object.entries(groups).forEach(([g, items]) => {
      html += `<div class="cmdk-group-label">${g}</div>`;
      items.forEach(c => {
        const idx = filtered.indexOf(c);
        html += `<div class="cmdk-item ${idx === sel ? 'active' : ''}" data-i="${idx}">${icon(c.icon, 17)}<span class="truncate">${esc(c.label)}</span>${c.sub ? `<span class="meta">${esc(c.sub)}</span>` : ''}</div>`;
      });
    });
    list.innerHTML = html || `<div class="empty" style="padding:30px">No results</div>`;
    list.querySelectorAll('.cmdk-item').forEach(el => el.onclick = () => { filtered[+el.dataset.i].action(); close(); });
  }
  render();
  input.oninput = () => { const q = input.value.toLowerCase(); filtered = commands.filter(c => c.label.toLowerCase().includes(q) || (c.sub || '').toLowerCase().includes(q)); sel = 0; render(); };
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, filtered.length - 1); render(); list.querySelector('.active')?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); render(); list.querySelector('.active')?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[sel]?.action(); close(); }
    else if (e.key === 'Escape') close();
  };
  const close = () => { overlay.remove(); };
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  setTimeout(() => input.focus(), 50);
}

let currentNav = 'dashboard';
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); if (Store.user) openCommandPalette(); }
});
