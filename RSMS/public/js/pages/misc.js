// ---------- Students page ----------
async function renderStudents() {
  currentNav = 'students';
  renderShell('students', spinner());
  const [students, projects] = await Promise.all([API.get('/students'), API.get('/projects')]);
  const el = document.getElementById('pageContent');
  const byStudent = {};
  projects.forEach(p => { (byStudent[p.student_id] = byStudent[p.student_id] || []).push(p); });
  el.innerHTML = `
  <div class="page-head"><div><h1 class="page-title">Students</h1><p class="page-sub">${students.length} researchers in the laboratory.</p></div>
    <button class="btn btn-primary" id="addStudent">${icon('plus',16)} Add Student</button></div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
    ${students.map(s => { const projs = byStudent[s.id]||[]; const avg = projs.length?Math.round(projs.reduce((a,p)=>a+p.progress,0)/projs.length):0;
      return `<div class="card card-pad ${projs.length?'card-hover':''}" ${projs.length?`data-link="/app/projects/${projs[0].id}"`:''}>
      <div class="row gap-sm mb-2">${avatar(s.full_name,s.avatar_color,'lg')}<div class="col"><span class="fw-700">${esc(s.full_name)}</span><span class="text-xs tertiary mono">${s.reg_no||''}</span></div></div>
      <div class="row gap-sm wrap mb-2">${s.degree_level?`<span class="badge badge-primary">${s.degree_level}</span>`:''}${s.batch?`<span class="badge badge-neutral">Batch ${s.batch}</span>`:''}</div>
      <div class="row between text-sm"><span class="muted">${projs.length} project${projs.length!==1?'s':''}</span><span class="fw-600">${avg}% avg</span></div>
      ${projs.length?`<div class="progress mt-1"><div class="progress-bar ${avg>=80?'success':''}" style="width:${avg}%"></div></div>`:`<p class="text-xs tertiary mt-1">No project assigned</p>`}
    </div>`; }).join('')}
  </div>`;
  el.querySelector('#addStudent').onclick = () => {
    const dlg = modal({ title:'Add Student', body:`
      <div class="field"><label class="label">Full name <span class="req">*</span></label><input class="input" id="s_name" placeholder="e.g. Tahmina Akter"></div>
      <div class="field"><label class="label">Email <span class="req">*</span></label><input class="input" type="email" id="s_email" placeholder="student@rsms.edu"></div>
      <div class="row gap-sm"><div class="field" style="flex:1"><label class="label">Registration no.</label><input class="input" id="s_reg" placeholder="PH-PhD-24-001"></div>
      <div class="field" style="width:130px"><label class="label">Degree</label><select class="select" id="s_degree"><option></option>${['BPharm','MPharm','MPhil','PhD','PostDoc'].map(d=>`<option>${d}</option>`).join('')}</select></div></div>
      <div class="field"><label class="label">Batch</label><input class="input" id="s_batch" placeholder="2024"></div>
      <div class="hint">A default password (student123) will be set. The student can change it later.</div>`,
      footer:`<button class="btn" data-close-s>Cancel</button><button class="btn btn-primary" id="s_save">Add student</button>` });
    dlg.el.querySelector('[data-close-s]').onclick = dlg.close;
    dlg.el.querySelector('#s_save').onclick = async () => {
      try { await API.post('/students',{ full_name:dlg.el.querySelector('#s_name').value.trim(), email:dlg.el.querySelector('#s_email').value.trim(), reg_no:dlg.el.querySelector('#s_reg').value.trim(), degree_level:dlg.el.querySelector('#s_degree').value, batch:dlg.el.querySelector('#s_batch').value.trim() }); toast('Student added (password: student123)'); dlg.close(); renderStudents(); } catch(e){ toast(e.message,'error'); }
    };
  };
}

// ---------- Meetings page ----------
async function renderMeetings() {
  currentNav = 'meetings';
  renderShell('meetings', spinner());
  const meetings = await API.get('/meetings/upcoming').catch(()=>[]);
  const el = document.getElementById('pageContent');
  el.innerHTML = `<div class="page-head"><div><h1 class="page-title">Meetings</h1><p class="page-sub">Upcoming supervisory meetings across your projects.</p></div></div>
  ${meetings.length?`<div style="display:grid;gap:12px;max-width:820px">${meetings.map(m=>`<div class="card card-pad card-hover row gap-lg" data-link="/app/projects/${m.project_id}">
    <div class="col" style="align-items:center;min-width:64px"><span class="fw-700" style="font-size:24px">${new Date(m.scheduled_at).getDate()}</span><span class="text-xs tertiary" style="text-transform:uppercase">${new Date(m.scheduled_at).toLocaleDateString('en',{month:'short'})}</span><span class="text-xs tertiary">${new Date(m.scheduled_at).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}</span></div>
    <div style="width:1px;background:var(--border);align-self:stretch"></div>
    <div class="col" style="flex:1"><span class="fw-700">${esc(m.title)}</span><span class="text-xs tertiary mono mt-1">${m.code} — ${esc(m.ptitle||'')}</span>${m.agenda?`<p class="text-sm muted mt-1">${esc(m.agenda)}</p>`:''}<div class="row gap-sm text-xs tertiary mt-1">${m.location?`${icon('target',12)} ${esc(m.location)}`:''} · ${m.duration_min}min</div></div>
    <span class="badge badge-info">${daysUntil(m.scheduled_at.slice(0,10))<=0?'Today':daysUntil(m.scheduled_at.slice(0,10))+'d'}</span>
  </div>`).join('')}</div>`:`<div class="empty card card-pad">${icon('calendar',40)}<h3>No upcoming meetings</h3><p class="text-sm">Schedule meetings from within a project workspace.</p></div>`}`;
}

// ---------- Profile page ----------
async function renderProfile() {
  currentNav = '';
  renderShell('', spinner());
  const me = await API.get('/auth/me');
  const u = me.user;
  const el = document.getElementById('pageContent');
  el.innerHTML = `<div class="page-head"><div><h1 class="page-title">Profile & Settings</h1></div></div>
  <div class="card card-pad" style="max-width:620px">
    <div class="row gap-lg mb-2">${avatar(u.full_name,u.avatar_color,'xl')}<div class="col"><span class="fw-700" style="font-size:18px">${esc(u.full_name)}</span><span class="muted">${esc(u.title||'')}</span><span class="text-sm tertiary">${esc(u.email)}</span></div></div>
    <div class="divider"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="col"><span class="text-xs tertiary">Role</span><span class="fw-600" style="text-transform:capitalize">${u.role}</span></div>
      <div class="col"><span class="text-xs tertiary">Department</span><span class="fw-600">${esc(u.department||'—')}</span></div>
      <div class="col"><span class="text-xs tertiary">Laboratory</span><span class="fw-600">${esc(u.lab||'—')}</span></div>
      ${me.profile?`<div class="col"><span class="text-xs tertiary">Registration</span><span class="fw-600 mono">${esc(me.profile.reg_no||'—')}</span></div>
      <div class="col"><span class="text-xs tertiary">Degree level</span><span class="fw-600">${esc(me.profile.degree_level||'—')}</span></div>
      <div class="col"><span class="text-xs tertiary">Batch</span><span class="fw-600">${esc(me.profile.batch||'—')}</span></div>`:''}
    </div>
    <div class="divider"></div>
    <div class="row between"><div class="col"><span class="fw-600">Appearance</span><span class="text-sm muted">Switch between light and dark themes</span></div>
    <div class="seg"><button class="${Store.theme==='light'?'active':''}" id="thLight">${icon('sun',15)} Light</button><button class="${Store.theme==='dark'?'active':''}" id="thDark">${icon('moon',15)} Dark</button></div></div>
  </div>`;
  el.querySelector('#thLight').onclick = () => { applyTheme('light'); renderProfile(); };
  el.querySelector('#thDark').onclick = () => { applyTheme('dark'); renderProfile(); };
}
