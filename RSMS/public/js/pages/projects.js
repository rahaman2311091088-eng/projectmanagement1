let _projectsCache = [];
let _projFilters = { q: '', degree: 'All', status: 'All', stage: 'All', view: 'grid' };

async function renderProjects() {
  currentNav = 'projects';
  renderShell('projects', spinner());
  _projectsCache = await API.get('/projects');
  drawProjectsPage();
}

function drawProjectsPage() {
  const el = document.getElementById('pageContent');
  const isSup = Store.user.role !== 'student';
  const degrees = ['All', ...new Set(_projectsCache.map(p => p.degree_level).filter(Boolean))];
  const stages = ['All', 'initiation', 'experimentation', 'analysis', 'writing', 'defense'];

  el.innerHTML = `
  <div class="page-head">
    <div><h1 class="page-title">Research Projects</h1><p class="page-sub">${_projectsCache.length} project${_projectsCache.length!==1?'s':''} ${isSup ? 'under supervision' : 'assigned to you'}.</p></div>
  </div>
  <div class="card card-pad mb-2" style="padding:14px">
    <div class="row gap-sm wrap">
      <div class="search-box" style="flex:1;min-width:200px">${icon('search', 16)}<input id="pq" placeholder="Search by title, plant, disease, code…" value="${esc(_projFilters.q)}"></div>
      ${filterSelect('pDegree', 'Degree', degrees, _projFilters.degree)}
      ${filterSelect('pStatus', 'Status', ['All','active','on_hold','completed','archived'], _projFilters.status)}
      ${filterSelect('pStage', 'Stage', stages, _projFilters.stage)}
      <div class="seg">
        <button id="vGrid" class="${_projFilters.view==='grid'?'active':''}">${icon('grid', 15)}</button>
        <button id="vList" class="${_projFilters.view==='list'?'active':''}">${icon('list', 15)}</button>
      </div>
    </div>
  </div>
  <div id="projList"></div>`;

  document.getElementById('pq').oninput = (e) => { _projFilters.q = e.target.value; drawList(); };
  ['pDegree:degree','pStatus:status','pStage:stage'].forEach(s => { const [id, key] = s.split(':'); document.getElementById(id).onchange = (e) => { _projFilters[key] = e.target.value; drawList(); }; });
  document.getElementById('vGrid').onclick = () => { _projFilters.view = 'grid'; drawProjectsPage(); };
  document.getElementById('vList').onclick = () => { _projFilters.view = 'list'; drawProjectsPage(); };
  const np = document.getElementById('newProj'); if (np) np.onclick = openNewProjectModal;
  drawList();
}

function filterSelect(id, label, options, val) {
  return `<select class="select" id="${id}" style="width:auto;min-width:130px">${options.map(o => `<option ${o===val?'selected':''} value="${o}">${label}: ${o.charAt(0).toUpperCase()+o.slice(1)}</option>`).join('')}</select>`;
}

function drawList() {
  const f = _projFilters;
  let list = _projectsCache.filter(p => {
    if (f.degree !== 'All' && p.degree_level !== f.degree) return false;
    if (f.status !== 'All' && p.status !== f.status) return false;
    if (f.stage !== 'All' && p.stage !== f.stage) return false;
    if (f.q) { const q = f.q.toLowerCase(); const hay = [p.title, p.code, p.plant_name, p.disease_area, p.student?.full_name].join(' ').toLowerCase(); if (!hay.includes(q)) return false; }
    return true;
  });
  const box = document.getElementById('projList');
  if (!list.length) { box.innerHTML = `<div class="empty card card-pad">${icon('search', 40)}<h3>No projects found</h3><p class="text-sm">Try adjusting your filters.</p></div>`; return; }

  if (f.view === 'list') {
    box.innerHTML = `<div class="card"><table class="table">
      <thead><tr><th>Project</th><th>Student</th><th>Plant</th><th>Stage</th><th>Modules</th><th>Progress</th><th>Status</th></tr></thead>
      <tbody>${list.map(p => `<tr data-link="/app/projects/${p.id}">
        <td><div class="fw-600 truncate" style="max-width:280px">${esc(p.title)}</div><div class="mono text-xs tertiary">${p.code}</div></td>
        <td>${p.student ? avatarInline(p.student) : '—'}</td>
        <td>${p.plant_name ? `<span class="text-sm">${esc(p.plant_name)}</span>` : '—'}</td>
        <td><span class="badge badge-neutral" style="text-transform:capitalize">${p.stage}</span></td>
        <td><span class="text-sm">${p.completed_modules}/${p.module_count}</span></td>
        <td><div class="row gap-sm"><div class="progress" style="width:60px"><div class="progress-bar ${p.progress>=80?'success':''}" style="width:${p.progress}%"></div></div><span class="text-xs fw-600">${p.progress}%</span></div></td>
        <td><span class="badge ${p.status==='active'?'badge-success':p.status==='completed'?'badge-info':'badge-neutral'}" style="text-transform:capitalize">${p.status}</span></td>
      </tr>`).join('')}</tbody></table></div>`;
    return;
  }

  box.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">
    ${list.map(p => projectCard(p)).join('')}</div>`;
}

function projectCard(p) {
  const flags = [];
  if (p.pending) flags.push(`<span class="badge badge-warning">${p.pending} to review</span>`);
  if (p.overdue) flags.push(`<span class="badge badge-danger">${p.overdue} overdue</span>`);
  return `<div class="card card-hover" style="padding:18px;display:flex;flex-direction:column;gap:12px" data-link="/app/projects/${p.id}">
    <div class="row between">
      <span class="badge badge-primary">${p.degree_level || 'Research'}</span>
      <span class="mono text-xs tertiary">${p.code}</span>
    </div>
    <div class="fw-700" style="font-size:14.5px;line-height:1.45;min-height:42px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(p.title)}</div>
    <div class="row gap-sm wrap">
      ${p.plant_name ? `<span class="chip" style="color:var(--success)">${icon('leaf', 12)} ${esc(p.plant_name)}</span>` : ''}
      ${p.disease_area ? `<span class="chip text-xs">${esc(p.disease_area)}</span>` : ''}
    </div>
    <div><div class="row between text-xs mb-1"><span class="muted">${p.completed_modules}/${p.module_count} modules</span><span class="fw-600">${p.progress}%</span></div>
    <div class="progress"><div class="progress-bar ${p.progress>=80?'success':''}" style="width:${p.progress}%"></div></div></div>
    <div class="divider" style="margin:4px 0"></div>
    <div class="row between">
      ${p.student ? `<div class="row gap-sm">${avatar(p.student.full_name, p.student.avatar_color, 'sm')}<span class="text-xs muted truncate" style="max-width:120px">${esc(p.student.full_name)}</span></div>` : '<span></span>'}
      <div class="row gap-sm">${flags.join('') || `<span class="badge badge-neutral" style="text-transform:capitalize">${p.stage}</span>`}</div>
    </div>
  </div>`;
}

// ---------- New Project Modal (multi-step wizard) ----------
async function openNewProjectModal() {
  if (Store.user.role === 'student') return;
  if (!Store.catalog.length) Store.catalog = await API.get('/catalog');
  const students = await API.get('/students').catch(() => []);
  let step = 1;
  const formData = { modules: [] };

  const m = modal({
    title: 'Create Research Project',
    wide: true,
    body: `<div id="wizardBody"></div>`,
    footer: `<button class="btn" id="wizBack" style="display:none">${icon('arrowLeft',15)} Back</button><span class="spacer" style="flex:1"></span><button class="btn btn-primary" id="wizNext">Continue ${icon('chevronRight',15)}</button>`
  });
  const body = m.el.querySelector('#wizardBody');
  const backBtn = m.el.querySelector('#wizBack');
  const nextBtn = m.el.querySelector('#wizNext');

  function drawStep() {
    backBtn.style.display = step > 1 ? 'inline-flex' : 'none';
    nextBtn.innerHTML = step === 2 ? `Create Project ${icon('check',15)}` : `Continue ${icon('chevronRight',15)}`;
    if (step === 1) drawDetailsStep();
    else drawModulesStep();
  }

  function drawDetailsStep() {
    body.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:20px">
        ${['Project details','Research modules'].map((s, i) => `<div class="row gap-sm" style="flex:1">
          <div style="width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;background:${i+1<=step?'var(--primary)':'var(--bg-subtle)'};color:${i+1<=step?'#fff':'var(--text-tertiary)'}">${i+1}</div>
          <span class="text-sm fw-600 ${i+1===step?'':'tertiary'}">${s}</span></div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="field" style="grid-column:1/-1"><label class="label">Project title <span class="req">*</span></label>
          <input class="input" id="f_title" placeholder="e.g. Antidiabetic potential of Azadirachta indica leaf extract" value="${esc(formData.title||'')}"></div>
        <div class="field"><label class="label">Student <span class="req">*</span></label>
          <select class="select" id="f_student"><option value="">Select student…</option>${students.map(s => `<option value="${s.id}" ${formData.student_id===s.id?'selected':''}>${esc(s.full_name)} ${s.reg_no?`(${s.reg_no})`:''}</option>`).join('')}</select></div>
        <div class="field"><label class="label">Degree level</label>
          <select class="select" id="f_degree">${['','BPharm','MPharm','MPhil','PhD','PostDoc'].map(d => `<option ${formData.degree_level===d?'selected':''}>${d}</option>`).join('')}</select></div>
        <div class="field"><label class="label">Medicinal plant / natural product</label><input class="input" id="f_plant" placeholder="e.g. Azadirachta indica" value="${esc(formData.plant_name||'')}"></div>
        <div class="field"><label class="label">Plant family</label><input class="input" id="f_family" placeholder="e.g. Meliaceae" value="${esc(formData.plant_family||'')}"></div>
        <div class="field"><label class="label">Disease / therapeutic area</label><input class="input" id="f_disease" placeholder="e.g. Type 2 Diabetes" value="${esc(formData.disease_area||'')}"></div>
        <div class="field"><label class="label">Laboratory</label><input class="input" id="f_lab" placeholder="e.g. Phytochemistry Lab" value="${esc(formData.lab||'')}"></div>
        <div class="field"><label class="label">Start date</label><input class="input" type="date" id="f_start" value="${formData.start_date||''}"></div>
        <div class="field"><label class="label">Expected completion</label><input class="input" type="date" id="f_end" value="${formData.expected_end||''}"></div>
        <div class="field" style="grid-column:1/-1"><label class="label">Research objectives</label><textarea class="textarea" id="f_obj" placeholder="List the main objectives of this research project…">${esc(formData.objectives||'')}</textarea></div>
      </div>`;
  }

  function saveDetails() {
    formData.title = body.querySelector('#f_title').value.trim();
    formData.student_id = body.querySelector('#f_student').value;
    formData.degree_level = body.querySelector('#f_degree').value;
    formData.plant_name = body.querySelector('#f_plant').value.trim();
    formData.plant_family = body.querySelector('#f_family').value.trim();
    formData.disease_area = body.querySelector('#f_disease').value.trim();
    formData.lab = body.querySelector('#f_lab').value.trim();
    formData.start_date = body.querySelector('#f_start').value;
    formData.expected_end = body.querySelector('#f_end').value;
    formData.objectives = body.querySelector('#f_obj').value.trim();
  }

  function drawModulesStep() {
    const cats = {};
    Store.catalog.forEach(c => { (cats[c.category] = cats[c.category] || []).push(c); });
    body.innerHTML = `
      <div class="row between mb-2">
        <p class="muted text-sm" style="max-width:480px">Build a custom research workflow. Select the modules this project requires — each becomes an independent milestone. You can add or remove modules later.</p>
        <span class="badge badge-primary" id="modCount">${formData.modules.length} selected</span>
      </div>
      <div class="search-box mb-2">${icon('search',16)}<input id="modSearch" placeholder="Filter modules…"></div>
      <div id="catalogList" style="max-height:46vh;overflow-y:auto;padding-right:4px">
        ${Object.entries(cats).map(([cat, items]) => `
          <div class="mb-2">
            <div class="row gap-sm mb-1"><span class="cat-pill" style="background:${catColor(cat)}1a;color:${catColor(cat)}">${cat}</span><span class="text-xs tertiary">${items.length}</span></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              ${items.map(c => `<label class="card mod-pick" data-name="${esc(c.name.toLowerCase())}" style="padding:10px 12px;display:flex;gap:10px;align-items:flex-start;cursor:pointer;transition:var(--transition)">
                <input type="checkbox" value="${c.id}" ${formData.modules.includes(c.id)?'checked':''} style="margin-top:3px;accent-color:var(--primary)">
                <div class="col"><span class="text-sm fw-600">${esc(c.name)}</span><span class="text-xs tertiary" style="line-height:1.3">${esc(c.description||'')}</span><span class="text-xs tertiary mt-1">${icon('clock',11)} ~${c.est_days}d</span></div>
              </label>`).join('')}
            </div>
          </div>`).join('')}
      </div>`;
    body.querySelectorAll('.mod-pick input').forEach(cb => cb.onchange = () => {
      const id = cb.value;
      if (cb.checked) { if (!formData.modules.includes(id)) formData.modules.push(id); cb.closest('.mod-pick').style.borderColor = 'var(--primary)'; }
      else { formData.modules = formData.modules.filter(x => x !== id); cb.closest('.mod-pick').style.borderColor = ''; }
      body.querySelector('#modCount').textContent = `${formData.modules.length} selected`;
    });
    body.querySelectorAll('.mod-pick input:checked').forEach(cb => cb.closest('.mod-pick').style.borderColor = 'var(--primary)');
    body.querySelector('#modSearch').oninput = (e) => {
      const q = e.target.value.toLowerCase();
      body.querySelectorAll('.mod-pick').forEach(el => el.style.display = el.dataset.name.includes(q) ? '' : 'none');
    };
  }

  nextBtn.onclick = async () => {
    if (step === 1) {
      saveDetails();
      if (!formData.title || !formData.student_id) { toast('Title and student are required', 'error'); return; }
      step = 2; drawStep();
    } else {
      nextBtn.disabled = true; nextBtn.textContent = 'Creating…';
      try {
        const proj = await API.post('/projects', formData);
        toast('Project created successfully');
        m.close();
        Router.go('/app/projects/' + proj.id);
      } catch (e) { toast(e.message, 'error'); nextBtn.disabled = false; nextBtn.innerHTML = `Create Project ${icon('check',15)}`; }
    }
  };
  backBtn.onclick = () => { step = 1; drawStep(); };
  drawStep();
}
