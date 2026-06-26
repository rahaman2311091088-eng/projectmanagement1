async function renderDashboard() {
  currentNav = 'dashboard';
  renderShell('dashboard', skeletonDash());
  const data = await API.get('/dashboard');
  const el = document.getElementById('pageContent');
  const u = Store.user;
  if (u.role === 'student') return renderStudentDash(el, data);
  return renderSupervisorDash(el, data);
}

function skeletonDash() {
  return `<div class="sk-title skeleton"></div>
  <div class="stat-grid">${Array(4).fill('<div class="stat"><div class="sk-text skeleton" style="width:50%"></div><div class="skeleton" style="height:30px;width:40%;margin-top:10px"></div></div>').join('')}</div>
  <div class="card card-pad"><div class="sk-text skeleton" style="width:30%"></div>${Array(4).fill('<div class="sk-text skeleton"></div>').join('')}</div>`;
}

function statCard(label, value, iconName, color, sub) {
  return `<div class="stat">
    <div class="row between"><span class="stat-label">${label}</span>
      <span class="stat-icon" style="background:${color}1a;color:${color}">${icon(iconName, 17)}</span></div>
    <div class="stat-value">${value}</div>
    ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
  </div>`;
}

function ringProgress(pct, size = 44) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
  const col = pct >= 80 ? 'var(--success)' : pct >= 40 ? 'var(--primary)' : 'var(--warning)';
  return `<svg class="ring" width="${size}" height="${size}"><circle class="ring-bg" cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke-width="5"/><circle class="ring-fg" cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke-width="5" stroke="${col}" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg>`;
}

function renderSupervisorDash(el, data) {
  const s = data.stats;
  const cats = Object.entries(data.category_breakdown || {}).sort((a, b) => b[1] - a[1]);
  const totalCat = cats.reduce((a, c) => a + c[1], 0) || 1;
  el.innerHTML = `
  <div class="page-head">
    <div><h1 class="page-title">Good ${greeting()}, ${esc(Store.user.full_name.split(' ').slice(-1)[0])}</h1>
    <p class="page-sub">Overview of all research projects under your supervision.</p></div>
  </div>
  <div class="stat-grid">
    ${statCard('Active Projects', s.active_projects, 'folder', '#6d5dfc', `${s.total_projects} total · ${s.students} students`)}
    ${statCard('Pending Review', s.pending_review, 'inbox', '#d97706', 'awaiting your approval')}
    ${statCard('Overdue Milestones', s.overdue, 'alert', '#dc2626', 'across all projects')}
    ${statCard('Avg. Completion', s.avg_progress + '%', 'target', '#16a34a', `${s.in_writing} in writing stage`)}
  </div>
  <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:18px;align-items:start">
    <div class="card">
      <div class="row between" style="padding:18px 20px 14px"><h3 class="fw-700">Projects requiring attention</h3>
        <a class="btn btn-ghost btn-sm" data-link="/app/projects">View all ${icon('chevronRight', 14)}</a></div>
      <div style="padding:0 8px 8px">${renderAttentionList(data.projects)}</div>
    </div>
    <div class="col gap-lg">
      <div class="card card-pad">
        <h3 class="fw-700 mb-2">Research module distribution</h3>
        ${cats.length ? cats.map(([c, n]) => `
          <div class="mb-1"><div class="row between text-sm" style="margin-bottom:4px"><span>${c}</span><span class="tertiary">${n}</span></div>
          <div class="progress"><div class="progress-bar" style="width:${(n/totalCat*100)}%;background:${catColor(c)}"></div></div></div>`).join('') : '<p class="muted text-sm">No modules yet.</p>'}
      </div>
      <div class="card card-pad" id="upcomingMeetings"><h3 class="fw-700 mb-2">Upcoming meetings</h3><div class="muted text-sm">Loading…</div></div>
    </div>
  </div>`;
  loadUpcomingMeetings();
}

function renderAttentionList(projects) {
  const sorted = [...projects].sort((a, b) => (b.pending + b.overdue) - (a.pending + a.overdue));
  if (!sorted.length) return `<div class="empty">${icon('folder', 40)}<h3>No projects yet</h3><p class="text-sm">Create your first research project to get started.</p></div>`;
  return sorted.slice(0, 6).map(p => `
    <div class="module-row" data-link="/app/projects/${p.id}">
      ${ringProgress(p.progress)}
      <div class="col" style="min-width:0;flex:1">
        <div class="row gap-sm"><span class="fw-600 text-sm truncate">${esc(p.title)}</span></div>
        <div class="row gap-sm text-xs tertiary mt-1">
          <span class="mono">${p.code}</span> · <span>${avatarInline(p.student)}</span>
          ${p.plant_name ? `· <span style="color:var(--success)">${icon('leaf', 12)} ${esc(p.plant_name)}</span>` : ''}
        </div>
      </div>
      <div class="col" style="align-items:flex-end;gap:6px">
        ${p.pending ? `<span class="badge badge-warning">${p.pending} to review</span>` : ''}
        ${p.overdue ? `<span class="badge badge-danger">${p.overdue} overdue</span>` : ''}
        ${!p.pending && !p.overdue ? `<span class="badge badge-success">${icon('check', 12)} On track</span>` : ''}
      </div>
    </div>`).join('');
}

function avatarInline(s) { if (!s) return ''; return `<span style="display:inline-flex;align-items:center;gap:5px">${avatar(s.full_name, s.avatar_color, 'sm')}${esc(s.full_name)}</span>`; }

function renderStudentDash(el, data) {
  const s = data.stats;
  const proj = data.projects[0];
  el.innerHTML = `
  <div class="page-head">
    <div><h1 class="page-title">Good ${greeting()}, ${esc(Store.user.full_name.split(' ')[0])}</h1>
    <p class="page-sub">Your research workspace and current progress.</p></div>
  </div>
  <div class="stat-grid">
    ${statCard('Overall Progress', (proj?.progress || 0) + '%', 'target', '#16a34a', proj ? proj.code : '')}
    ${statCard('Active Modules', s.active_modules, 'zap', '#0ea5e9', 'in progress now')}
    ${statCard('Needs Revision', s.needs_revision, 'alert', '#dc2626', 'requested by supervisor')}
    ${statCard('Completed', s.completed + '/' + s.total, 'checkCircle', '#16a34a', 'milestones approved')}
  </div>
  <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:18px;align-items:start">
    <div class="col gap-lg">
      ${proj ? `<div class="card card-pad card-hover" data-link="/app/projects/${proj.id}">
        <div class="row between"><span class="badge badge-primary">${proj.degree_level || 'Research'}</span><span class="mono text-xs tertiary">${proj.code}</span></div>
        <h3 class="fw-700 mt-1" style="font-size:16px;line-height:1.4">${esc(proj.title)}</h3>
        <div class="row gap-sm mt-2 wrap">
          ${proj.plant_name ? `<span class="chip" style="color:var(--success)">${icon('leaf', 13)} ${esc(proj.plant_name)}</span>` : ''}
          ${proj.disease_area ? `<span class="chip">${icon('target', 13)} ${esc(proj.disease_area)}</span>` : ''}
          <span class="chip">${icon('layers', 13)} ${proj.module_count} modules</span>
        </div>
        <div class="mt-2"><div class="row between text-sm mb-1"><span class="muted">Progress</span><span class="fw-600">${proj.progress}%</span></div>
        <div class="progress"><div class="progress-bar ${proj.progress>=80?'success':''}" style="width:${proj.progress}%"></div></div></div>
      </div>` : `<div class="empty card card-pad">${icon('folder', 40)}<h3>No project assigned yet</h3><p class="text-sm">Your supervisor will assign your research project soon.</p></div>`}
      <div class="card">
        <div class="row between" style="padding:18px 20px 14px"><h3 class="fw-700">Upcoming deadlines</h3></div>
        <div style="padding:0 8px 8px">${data.upcoming.length ? data.upcoming.map(m => {
          const d = daysUntil(m.deadline);
          return `<div class="module-row" data-link="/app/projects/${m.project_id}">
            <div class="module-icon" style="color:${catColor(m.category)};background:${catColor(m.category)}1a">${icon('flask', 18)}</div>
            <div class="col" style="flex:1"><span class="fw-600 text-sm">${esc(m.name)}</span><span class="text-xs tertiary">${m.code} · ${m.category}</span></div>
            ${statusBadge(m.status)}
            <span class="badge ${d <= 3 ? 'badge-danger' : d <= 7 ? 'badge-warning' : 'badge-neutral'}">${d <= 0 ? 'Due today' : d + 'd left'}</span>
          </div>`; }).join('') : `<div class="empty">${icon('checkCircle', 36)}<p class="text-sm">No upcoming deadlines 🎉</p></div>`}</div>
      </div>
    </div>
    <div class="col gap-lg">
      <div class="card card-pad"><h3 class="fw-700 mb-2">Status summary</h3>
        ${renderStatusSummary(s)}</div>
      <div class="card card-pad" id="upcomingMeetings"><h3 class="fw-700 mb-2">Upcoming meetings</h3><div class="muted text-sm">Loading…</div></div>
    </div>
  </div>`;
  loadUpcomingMeetings();
}

function renderStatusSummary(s) {
  const items = [
    ['In Progress', s.active_modules, '#0ea5e9'],
    ['Pending Review', s.pending_review, '#d97706'],
    ['Needs Revision', s.needs_revision, '#dc2626'],
    ['Overdue', s.overdue, '#dc2626'],
    ['Completed', s.completed, '#16a34a'],
  ];
  return items.map(([l, v, c]) => `<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--border)">
    <span class="row gap-sm text-sm"><span class="dot" style="width:8px;height:8px;border-radius:50%;background:${c};display:inline-block"></span>${l}</span>
    <span class="fw-700">${v}</span></div>`).join('');
}

async function loadUpcomingMeetings() {
  const box = document.getElementById('upcomingMeetings');
  if (!box) return;
  const meetings = await API.get('/meetings/upcoming').catch(() => []);
  box.innerHTML = `<h3 class="fw-700 mb-2">Upcoming meetings</h3>` + (meetings.length ? meetings.slice(0, 4).map(m => `
    <div class="row gap-sm" style="padding:9px 0;border-bottom:1px solid var(--border)" data-link="/app/projects/${m.project_id}" style="cursor:pointer">
      <div class="col" style="align-items:center;min-width:42px"><span class="fw-700" style="font-size:16px">${new Date(m.scheduled_at).getDate()}</span><span class="text-xs tertiary" style="text-transform:uppercase">${new Date(m.scheduled_at).toLocaleDateString('en',{month:'short'})}</span></div>
      <div class="col" style="min-width:0"><span class="text-sm fw-600 truncate">${esc(m.title)}</span><span class="text-xs tertiary">${fmtDateTime(m.scheduled_at)} · ${esc(m.location||'')}</span></div>
    </div>`).join('') : `<p class="muted text-sm">No meetings scheduled.</p>`);
}

function greeting() { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; }
