let _proj = null, _projTab = 'overview', _selectedModule = null;

async function renderProject(params) {
  currentNav = 'projects';
  renderShell('projects', spinner());
  try {
    _proj = await API.get('/projects/' + params.id);
  } catch (e) { document.getElementById('pageContent').innerHTML = `<div class="empty">${icon('alert',40)}<h3>Project not found</h3></div>`; return; }
  drawProject();
}

function drawProject() {
  const p = _proj;
  const isSup = Store.user.role !== 'student';
  const el = document.getElementById('pageContent');
  el.innerHTML = `
  <div class="row gap-sm mb-2"><a class="btn btn-ghost btn-sm" data-link="/app/projects">${icon('arrowLeft',15)} Projects</a></div>
  <div class="card card-pad mb-2">
    <div class="row between wrap" style="gap:14px">
      <div style="flex:1;min-width:280px">
        <div class="row gap-sm mb-1 wrap">
          <span class="badge badge-primary">${p.degree_level || 'Research'}</span>
          <span class="mono text-xs tertiary">${p.code}</span>
          <span class="badge ${p.status==='active'?'badge-success':'badge-neutral'}" style="text-transform:capitalize">${p.status}</span>
          <span class="badge badge-neutral" style="text-transform:capitalize">${icon('flag',12)} ${p.stage}</span>
        </div>
        <h1 style="font-size:21px;font-weight:700;letter-spacing:-.01em;line-height:1.35">${esc(p.title)}</h1>
        <div class="row gap-sm mt-2 wrap text-sm">
          ${p.plant_name ? `<span class="chip" style="color:var(--success)">${icon('leaf',13)} ${esc(p.plant_name)}${p.plant_family?` · ${esc(p.plant_family)}`:''}</span>` : ''}
          ${p.disease_area ? `<span class="chip">${icon('target',13)} ${esc(p.disease_area)}</span>` : ''}
          ${p.lab ? `<span class="chip">${icon('beaker',13)} ${esc(p.lab)}</span>` : ''}
        </div>
      </div>
      <div class="col" style="align-items:center;gap:8px">
        ${ringProgress(p.progress, 76)}
        <span class="text-xs tertiary">${p.completed_modules}/${p.module_count} modules complete</span>
        ${isSup ? `<button class="btn btn-sm" id="editProj">${icon('edit',14)} Edit</button>` : ''}
      </div>
    </div>
    <div class="divider"></div>
    <div class="row gap-lg wrap text-sm">
      <div class="row gap-sm">${p.student ? avatar(p.student.full_name, p.student.avatar_color, 'sm') : ''}<div class="col"><span class="text-xs tertiary">Student</span><span class="fw-600">${esc(p.studentFull?.full_name||'—')}</span></div></div>
      <div class="row gap-sm">${p.supervisor ? avatar(p.supervisor.full_name, p.supervisor.avatar_color, 'sm') : ''}<div class="col"><span class="text-xs tertiary">Supervisor</span><span class="fw-600">${esc(p.supervisorFull?.full_name||'—')}</span></div></div>
      <div class="col"><span class="text-xs tertiary">Timeline</span><span class="fw-600">${fmtDate(p.start_date)} → ${fmtDate(p.expected_end)}</span></div>
      ${p.co_supervisor ? `<div class="col"><span class="text-xs tertiary">Co-supervisor</span><span class="fw-600">${esc(p.co_supervisor)}</span></div>` : ''}
    </div>
  </div>
  <div class="tabs">
    ${[['overview','Overview'],['modules','Research Modules'],['files','Files'],['discussion','Discussion'],['meetings','Meetings'],['activity','Activity']].map(([id,l]) => `<div class="tab ${_projTab===id?'active':''}" data-tab="${id}">${l}${id==='modules'?` <span class="badge badge-neutral" style="margin-left:4px">${p.modules.length}</span>`:''}</div>`).join('')}
  </div>
  <div id="tabContent"></div>`;

  el.querySelectorAll('[data-tab]').forEach(t => t.onclick = () => { _projTab = t.dataset.tab; drawProject(); });
  const ep = document.getElementById('editProj'); if (ep) ep.onclick = openEditProject;
  drawTab();
}

function drawTab() {
  const box = document.getElementById('tabContent');
  if (_projTab === 'overview') drawOverviewTab(box);
  else if (_projTab === 'modules') drawModulesTab(box);
  else if (_projTab === 'files') drawFilesTab(box);
  else if (_projTab === 'discussion') drawDiscussionTab(box);
  else if (_projTab === 'meetings') drawMeetingsTab(box);
  else if (_projTab === 'activity') drawActivityTab(box);
}

function drawOverviewTab(box) {
  const p = _proj;
  const byCat = {};
  p.modules.forEach(m => { (byCat[m.category] = byCat[m.category] || []).push(m); });
  const today = new Date().toISOString().slice(0,10);
  box.innerHTML = `
  <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:18px;align-items:start">
    <div class="col gap-lg">
      ${p.objectives ? `<div class="card card-pad"><h3 class="fw-700 mb-1">Research objectives</h3><div class="muted" style="white-space:pre-wrap;line-height:1.6">${esc(p.objectives)}</div></div>` : ''}
      <div class="card card-pad">
        <h3 class="fw-700 mb-2">Workflow progress by stage</h3>
        ${Object.entries(byCat).map(([cat, mods]) => {
          const done = mods.filter(m => ['approved','completed'].includes(m.status)).length;
          const pct = Math.round(mods.reduce((a,m)=>a+m.progress,0)/mods.length);
          return `<div class="mb-2"><div class="row between mb-1"><span class="row gap-sm text-sm fw-600"><span class="dot" style="width:8px;height:8px;border-radius:50%;background:${catColor(cat)};display:inline-block"></span>${cat}</span><span class="text-xs tertiary">${done}/${mods.length} · ${pct}%</span></div><div class="progress"><div class="progress-bar" style="width:${pct}%;background:${catColor(cat)}"></div></div></div>`;
        }).join('')}
      </div>
    </div>
    <div class="col gap-lg">
      <div class="card card-pad"><h3 class="fw-700 mb-2">Quick stats</h3>
        ${[['Total modules', p.modules.length],['In progress', p.modules.filter(m=>m.status==='in_progress').length],['Awaiting review', p.modules.filter(m=>m.status==='submitted').length],['Needs revision', p.modules.filter(m=>m.status==='revision').length],['Overdue', p.modules.filter(m=>m.deadline&&m.deadline<today&&!['approved','completed'].includes(m.status)).length],['Completed', p.completed_modules]].map(([l,v]) => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--border)"><span class="text-sm muted">${l}</span><span class="fw-700">${v}</span></div>`).join('')}
      </div>
      <div class="card card-pad"><h3 class="fw-700 mb-2">Next deadlines</h3>
        ${p.modules.filter(m=>m.deadline&&!['approved','completed'].includes(m.status)).sort((a,b)=>a.deadline.localeCompare(b.deadline)).slice(0,5).map(m=>{const d=daysUntil(m.deadline);return `<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="openModuleDetail('${m.id}')"><span class="text-sm truncate" style="max-width:160px">${esc(m.name)}</span><span class="badge ${d<=3?'badge-danger':d<=7?'badge-warning':'badge-neutral'}">${d<=0?'Due':d+'d'}</span></div>`;}).join('') || '<p class="muted text-sm">No upcoming deadlines.</p>'}
      </div>
    </div>
  </div>`;
}

function drawModulesTab(box) {
  const p = _proj;
  const isSup = Store.user.role !== 'student';
  const cats = {};
  p.modules.forEach(m => { (cats[m.category] = cats[m.category] || []).push(m); });
  box.innerHTML = `
  <div class="row between mb-2">
    <p class="muted text-sm">Each module is an independent milestone with its own data, documents, deadline and approval history.</p>
    ${isSup ? `<button class="btn btn-primary btn-sm" id="addModBtn">${icon('plus',15)} Add Modules</button>` : ''}
  </div>
  ${p.modules.length ? Object.entries(cats).map(([cat, mods]) => `
    <div class="mb-2">
      <div class="row gap-sm mb-1"><span class="cat-pill" style="background:${catColor(cat)}1a;color:${catColor(cat)}">${cat}</span><span class="text-xs tertiary">${mods.length} module${mods.length>1?'s':''}</span></div>
      ${mods.map(m => moduleRow(m)).join('')}
    </div>`).join('') : `<div class="empty card card-pad">${icon('layers',40)}<h3>No modules yet</h3><p class="text-sm">${isSup?'Add research modules to build the workflow.':'Your supervisor will add research modules soon.'}</p></div>`}`;
  const amb = document.getElementById('addModBtn'); if (amb) amb.onclick = openAddModules;
}

function moduleRow(m) {
  const d = daysUntil(m.deadline);
  const overdue = m.deadline && d < 0 && !['approved','completed'].includes(m.status);
  return `<div class="module-row" onclick="openModuleDetail('${m.id}')">
    <div class="module-icon" style="color:${catColor(m.category)};background:${catColor(m.category)}1a">${icon('flask',18)}</div>
    <div class="col" style="flex:1;min-width:0">
      <span class="fw-600 text-sm">${esc(m.name)}</span>
      <div class="row gap-sm text-xs tertiary mt-1">
        ${m.deadline ? `<span class="${overdue?'':''}" style="${overdue?'color:var(--danger)':''}">${icon('clock',11)} ${overdue?'Overdue':fmtDate(m.deadline)}</span>` : ''}
        ${m.instructions ? `<span>${icon('message',11)} has instructions</span>` : ''}
      </div>
    </div>
    <div class="progress" style="width:80px"><div class="progress-bar ${m.progress>=100?'success':''}" style="width:${m.progress}%"></div></div>
    <span class="text-xs fw-600 tertiary" style="width:34px;text-align:right">${m.progress}%</span>
    ${statusBadge(m.status)}
    ${icon('chevronRight',16,'tertiary')}
  </div>`;
}

// ---------- Module detail drawer ----------
async function openModuleDetail(mid) {
  const m = _proj.modules.find(x => x.id === mid);
  if (!m) return;
  const isSup = Store.user.role !== 'student';
  const isStudent = Store.user.role === 'student';
  const files = (await API.get('/projects/' + _proj.id + '/files').catch(()=>[])).filter(f => f.module_id === mid);
  const comments = await API.get('/projects/' + _proj.id + '/comments?module_id=' + mid).catch(()=>[]);

  const dlg = modal({
    title: esc(m.name),
    wide: true,
    body: `
      <div class="row gap-sm mb-2 wrap">
        <span class="cat-pill" style="background:${catColor(m.category)}1a;color:${catColor(m.category)}">${m.category}</span>
        ${statusBadge(m.status)}
        ${m.deadline ? `<span class="badge badge-neutral">${icon('clock',12)} Due ${fmtDate(m.deadline)}</span>` : ''}
        <span class="spacer" style="flex:1"></span>
        <div class="row gap-sm" style="width:160px"><div class="progress" style="flex:1"><div class="progress-bar" style="width:${m.progress}%"></div></div><span class="text-xs fw-600">${m.progress}%</span></div>
      </div>
      ${m.description ? `<p class="muted text-sm mb-2">${esc(m.description)}</p>` : ''}
      ${m.instructions ? `<div class="card" style="padding:12px 14px;background:var(--primary-soft);border-color:transparent;margin-bottom:14px"><div class="row gap-sm text-xs fw-700" style="color:var(--primary-text);margin-bottom:4px">${icon('message',13)} SUPERVISOR INSTRUCTIONS</div><div class="text-sm">${esc(m.instructions)}</div></div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        ${m.protocols?.length ? `<div><div class="text-xs fw-700 tertiary mb-1" style="text-transform:uppercase">Protocols</div>${m.protocols.map(x=>`<div class="text-sm row gap-sm" style="padding:3px 0">${icon('check',13,'tertiary')} ${esc(x)}</div>`).join('')}</div>`:''}
        ${m.deliverables?.length ? `<div><div class="text-xs fw-700 tertiary mb-1" style="text-transform:uppercase">Expected deliverables</div>${m.deliverables.map(x=>`<div class="text-sm row gap-sm" style="padding:3px 0">${icon('flag',13,'tertiary')} ${esc(x)}</div>`).join('')}</div>`:''}
      </div>

      ${isStudent ? `<div class="card" style="padding:14px;margin-bottom:14px">
        <div class="row between mb-1"><span class="fw-600 text-sm">Update progress</span><span class="fw-700" id="mdPct">${m.progress}%</span></div>
        <input type="range" min="0" max="100" value="${m.progress}" id="mdRange" style="width:100%;accent-color:var(--primary)">
        <div class="row gap-sm mt-2">
          <button class="btn btn-sm" id="mdSaveProg">Save progress</button>
          ${['not_started','in_progress','revision'].includes(m.status) ? `<button class="btn btn-primary btn-sm" id="mdSubmit">${icon('send',14)} Submit for review</button>` : ''}
        </div>
      </div>` : ''}

      ${isSup ? `<div class="card" style="padding:14px;margin-bottom:14px">
        <div class="text-xs fw-700 tertiary mb-1" style="text-transform:uppercase">Supervisor actions</div>
        <div class="row gap-sm wrap">
          ${m.status==='submitted' ? `<button class="btn btn-primary btn-sm" data-act="approve">${icon('check',14)} Approve</button><button class="btn btn-danger btn-sm" data-act="revision">${icon('refresh',14)} Request revision</button>`:''}
          ${m.status!=='submitted' ? `<button class="btn btn-sm" data-act="approve">${icon('check',14)} Mark approved</button>`:''}
          <button class="btn btn-sm" data-act="instructions">${icon('edit',14)} Edit instructions</button>
          <button class="btn btn-sm" data-act="deadline">${icon('clock',14)} Set deadline</button>
          <button class="btn btn-danger btn-sm" data-act="delete" style="margin-left:auto">${icon('trash',14)} Remove</button>
        </div>
      </div>` : ''}

      <div class="tabs" style="margin-bottom:14px">
        <div class="tab active" data-md="files">Files (${files.length})</div>
        <div class="tab" data-md="comments">Comments (${comments.length})</div>
      </div>
      <div id="mdPanel"></div>
    `,
    footer: null
  });

  const panel = dlg.el.querySelector('#mdPanel');
  function drawFiles() {
    panel.innerHTML = `
      <div class="row gap-sm mb-2">
        <button class="btn btn-sm" id="mdUpload">${icon('upload',14)} Upload file</button>
        <select class="select" id="mdKind" style="width:auto"><option value="document">Document</option><option value="dataset">Dataset</option><option value="docking_file">Docking file</option><option value="manuscript">Manuscript</option><option value="image">Image</option></select>
        <input type="file" id="mdFileInput" style="display:none">
      </div>
      ${files.length ? files.map(f => `<div class="module-row" style="cursor:default;padding:10px 14px">
        <div class="module-icon" style="width:32px;height:32px">${icon('doc',16)}</div>
        <div class="col" style="flex:1"><span class="text-sm fw-600">${esc(f.original_name)} ${f.version>1?`<span class="badge badge-neutral">v${f.version}</span>`:''}</span><span class="text-xs tertiary">${esc(f.uploader||'')} · ${fileSize(f.size)} · ${relTime(f.created_at)}${f.kind!=='document'?` · ${f.kind}`:''}</span></div>
        <a class="btn btn-ghost btn-icon btn-sm" href="/api/files/${f.id}/download">${icon('download',15)}</a>
        ${(Store.user.role!=='student'||f.uploaded_by===Store.user.id)?`<button class="btn btn-ghost btn-icon btn-sm" data-del="${f.id}" style="color:var(--danger)">${icon('trash',15)}</button>`:''}
      </div>`).join('') : `<div class="empty" style="padding:30px">${icon('upload',34)}<p class="text-sm">No files uploaded yet</p></div>`}`;
    const input = panel.querySelector('#mdFileInput');
    panel.querySelector('#mdUpload').onclick = () => input.click();
    input.onchange = async () => {
      if (!input.files[0]) return;
      const fd = new FormData(); fd.append('file', input.files[0]); fd.append('project_id', _proj.id); fd.append('module_id', mid); fd.append('kind', panel.querySelector('#mdKind').value);
      try { const nf = await API.upload('/upload', fd); files.unshift(nf); toast('File uploaded'); drawFiles(); } catch(e){ toast(e.message,'error'); }
    };
    panel.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { await API.del('/files/'+b.dataset.del); const i = files.findIndex(f=>f.id===b.dataset.del); files.splice(i,1); drawFiles(); toast('File deleted'); });
  }
  function drawComments() {
    panel.innerHTML = `
      <div style="max-height:240px;overflow-y:auto;margin-bottom:12px">
      ${comments.length ? comments.map(c => `<div class="comment ${c.type}">${avatar(c.author, c.avatar_color, 'sm')}
        <div class="col" style="flex:1"><div class="row gap-sm"><span class="text-sm fw-600">${esc(c.author)}</span>${c.role==='supervisor'?'<span class="badge badge-primary">Supervisor</span>':''}${c.type==='revision_request'?'<span class="badge badge-danger">Revision</span>':c.type==='question'?'<span class="badge badge-info">Question</span>':''}<span class="text-xs tertiary">${relTime(c.created_at)}</span></div><div class="comment-bubble text-sm">${esc(c.body)}</div></div>
      </div>`).join('') : `<div class="empty" style="padding:24px">${icon('message',32)}<p class="text-sm">No comments yet</p></div>`}
      </div>
      <div class="row gap-sm">
        <select class="select" id="cType" style="width:auto"><option value="comment">Comment</option>${Store.user.role==='student'?'<option value="question">Question</option>':'<option value="revision_request">Revision request</option>'}</select>
        <input class="input" id="cBody" placeholder="Write a message…" style="flex:1">
        <button class="btn btn-primary" id="cSend">${icon('send',15)}</button>
      </div>`;
    const send = async () => {
      const body = panel.querySelector('#cBody').value.trim(); if (!body) return;
      const c = await API.post('/projects/'+_proj.id+'/comments', { body, module_id: mid, type: panel.querySelector('#cType').value });
      comments.push(c); toast('Sent'); drawComments();
    };
    panel.querySelector('#cSend').onclick = send;
    panel.querySelector('#cBody').onkeydown = (e) => { if (e.key === 'Enter') send(); };
  }
  drawFiles();
  dlg.el.querySelectorAll('[data-md]').forEach(t => t.onclick = () => { dlg.el.querySelectorAll('[data-md]').forEach(x=>x.classList.remove('active')); t.classList.add('active'); t.dataset.md==='files'?drawFiles():drawComments(); });

  // Student actions
  if (isStudent) {
    const range = dlg.el.querySelector('#mdRange');
    if (range) range.oninput = () => dlg.el.querySelector('#mdPct').textContent = range.value + '%';
    const sp = dlg.el.querySelector('#mdSaveProg');
    if (sp) sp.onclick = async () => { await updateModule(mid, { progress: +range.value, status: m.status==='not_started'?'in_progress':m.status }); dlg.close(); openModuleDetail(mid); };
    const sb = dlg.el.querySelector('#mdSubmit');
    if (sb) sb.onclick = async () => { await updateModule(mid, { status: 'submitted', progress: Math.max(m.progress, 90) }); toast('Submitted for review'); dlg.close(); refreshProject(); };
  }
  // Supervisor actions
  dlg.el.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => {
    const act = b.dataset.act;
    if (act === 'approve') { await updateModule(mid, { status: 'approved' }); toast('Module approved'); dlg.close(); refreshProject(); }
    else if (act === 'revision') {
      const reason = prompt('What needs to be revised?'); if (reason===null) return;
      await updateModule(mid, { status: 'revision' });
      if (reason) await API.post('/projects/'+_proj.id+'/comments', { body: reason, module_id: mid, type: 'revision_request' });
      toast('Revision requested'); dlg.close(); refreshProject();
    }
    else if (act === 'instructions') {
      const v = prompt('Supervisor instructions:', m.instructions || ''); if (v===null) return;
      await updateModule(mid, { instructions: v }); toast('Instructions updated'); dlg.close(); refreshProject();
    }
    else if (act === 'deadline') {
      const v = prompt('Deadline (YYYY-MM-DD):', m.deadline || ''); if (v===null) return;
      await updateModule(mid, { deadline: v }); toast('Deadline set'); dlg.close(); refreshProject();
    }
    else if (act === 'delete') {
      if (!confirm('Remove this module from the project?')) return;
      await API.del('/modules/'+mid); toast('Module removed'); dlg.close(); refreshProject();
    }
  });
}

async function updateModule(mid, patch) {
  await API.patch('/modules/'+mid, patch);
}
async function refreshProject() { _proj = await API.get('/projects/'+_proj.id); drawProject(); }

async function openAddModules() {
  if (!Store.catalog.length) Store.catalog = await API.get('/catalog');
  const existing = new Set(_proj.modules.map(m => m.name));
  const cats = {};
  Store.catalog.forEach(c => { (cats[c.category]=cats[c.category]||[]).push(c); });
  let selected = [];
  const dlg = modal({
    title: 'Add Research Modules', wide: true,
    body: `<div class="search-box mb-2">${icon('search',16)}<input id="amSearch" placeholder="Filter modules…"></div>
      <div style="max-height:50vh;overflow-y:auto">
      ${Object.entries(cats).map(([cat,items]) => `<div class="mb-2"><div class="cat-pill mb-1" style="display:inline-block;background:${catColor(cat)}1a;color:${catColor(cat)}">${cat}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${items.map(c => `<label class="card am-pick" data-name="${esc(c.name.toLowerCase())}" style="padding:10px 12px;display:flex;gap:10px;cursor:pointer;${existing.has(c.name)?'opacity:.45':''}">
          <input type="checkbox" value="${c.id}" ${existing.has(c.name)?'disabled':''} style="margin-top:2px;accent-color:var(--primary)">
          <div class="col"><span class="text-sm fw-600">${esc(c.name)} ${existing.has(c.name)?'<span class="badge badge-neutral">Added</span>':''}</span><span class="text-xs tertiary">${esc(c.description||'')}</span></div>
        </label>`).join('')}</div></div>`).join('')}
      </div>`,
    footer: `<button class="btn" data-close-add>Cancel</button><button class="btn btn-primary" id="amAdd">Add <span id="amCount">0</span> module(s)</button>`
  });
  dlg.el.querySelectorAll('.am-pick input').forEach(cb => cb.onchange = () => {
    if (cb.checked) selected.push(cb.value); else selected = selected.filter(x=>x!==cb.value);
    dlg.el.querySelector('#amCount').textContent = selected.length;
    cb.closest('.am-pick').style.borderColor = cb.checked ? 'var(--primary)' : '';
  });
  dlg.el.querySelector('#amSearch').oninput = (e) => { const q=e.target.value.toLowerCase(); dlg.el.querySelectorAll('.am-pick').forEach(el=>el.style.display=el.dataset.name.includes(q)?'':'none'); };
  dlg.el.querySelector('[data-close-add]').onclick = dlg.close;
  dlg.el.querySelector('#amAdd').onclick = async () => {
    if (!selected.length) return dlg.close();
    await API.post('/projects/'+_proj.id+'/modules', { catalog_ids: selected });
    toast(`${selected.length} module(s) added`); dlg.close(); refreshProject();
  };
}

// ---------- Files tab ----------
async function drawFilesTab(box) {
  box.innerHTML = spinner();
  const files = await API.get('/projects/'+_proj.id+'/files').catch(()=>[]);
  box.innerHTML = `
  <div class="row between mb-2"><p class="muted text-sm">All documents, datasets, docking files and manuscripts for this project.</p>
    <button class="btn btn-primary btn-sm" id="ftUpload">${icon('upload',15)} Upload</button>
    <input type="file" id="ftInput" style="display:none"></div>
  ${files.length ? `<div class="card"><table class="table"><thead><tr><th>File</th><th>Type</th><th>Module</th><th>Uploaded by</th><th>Size</th><th>Date</th><th></th></tr></thead><tbody>
    ${files.map(f => { const mod = _proj.modules.find(m=>m.id===f.module_id); return `<tr style="cursor:default">
      <td><div class="row gap-sm">${icon('doc',16,'tertiary')}<span class="fw-600 text-sm">${esc(f.original_name)}</span>${f.version>1?`<span class="badge badge-neutral">v${f.version}</span>`:''}</div></td>
      <td><span class="badge badge-neutral" style="text-transform:capitalize">${f.kind.replace('_',' ')}</span></td>
      <td class="text-sm muted">${mod?esc(mod.name):'—'}</td>
      <td>${avatarInline({full_name:f.uploader,avatar_color:f.avatar_color})}</td>
      <td class="text-sm">${fileSize(f.size)}</td><td class="text-sm muted">${relTime(f.created_at)}</td>
      <td><a class="btn btn-ghost btn-icon btn-sm" href="/api/files/${f.id}/download">${icon('download',15)}</a></td>
    </tr>`; }).join('')}</tbody></table></div>` : `<div class="empty card card-pad">${icon('doc',40)}<h3>No files yet</h3><p class="text-sm">Upload documents from any module or here directly.</p></div>`}`;
  const input = box.querySelector('#ftInput');
  box.querySelector('#ftUpload').onclick = () => input.click();
  input.onchange = async () => { if(!input.files[0])return; const fd=new FormData(); fd.append('file',input.files[0]); fd.append('project_id',_proj.id); fd.append('kind','document'); try{await API.upload('/upload',fd); toast('Uploaded'); drawFilesTab(box);}catch(e){toast(e.message,'error');} };
}

// ---------- Discussion tab ----------
async function drawDiscussionTab(box) {
  box.innerHTML = spinner();
  const comments = (await API.get('/projects/'+_proj.id+'/comments').catch(()=>[])).filter(c=>!c.module_id);
  box.innerHTML = `<div class="card card-pad" style="max-width:760px">
    <h3 class="fw-700 mb-2">Project discussion</h3>
    <div id="discList" style="margin-bottom:16px">${comments.length?comments.map(c=>`<div class="comment ${c.type}">${avatar(c.author,c.avatar_color,'sm')}<div class="col" style="flex:1"><div class="row gap-sm"><span class="text-sm fw-600">${esc(c.author)}</span>${c.role==='supervisor'?'<span class="badge badge-primary">Supervisor</span>':''}<span class="text-xs tertiary">${relTime(c.created_at)}</span></div><div class="comment-bubble text-sm">${esc(c.body)}</div></div></div>`).join(''):`<div class="empty" style="padding:30px">${icon('message',36)}<p class="text-sm">No messages yet. Start the conversation.</p></div>`}</div>
    <div class="row gap-sm"><input class="input" id="discInput" placeholder="Write a message…" style="flex:1"><button class="btn btn-primary" id="discSend">${icon('send',15)} Send</button></div>
  </div>`;
  const send = async () => { const body=box.querySelector('#discInput').value.trim(); if(!body)return; await API.post('/projects/'+_proj.id+'/comments',{body,type:'comment'}); toast('Sent'); drawDiscussionTab(box); };
  box.querySelector('#discSend').onclick = send;
  box.querySelector('#discInput').onkeydown = (e) => { if(e.key==='Enter')send(); };
}

// ---------- Meetings tab ----------
async function drawMeetingsTab(box) {
  box.innerHTML = spinner();
  const meetings = await API.get('/projects/'+_proj.id+'/meetings').catch(()=>[]);
  const isSup = Store.user.role !== 'student';
  box.innerHTML = `<div class="row between mb-2"><p class="muted text-sm">Scheduled supervisory meetings for this project.</p>${isSup?`<button class="btn btn-primary btn-sm" id="schedMeet">${icon('plus',15)} Schedule meeting</button>`:''}</div>
    ${meetings.length?`<div style="display:grid;gap:12px">${meetings.map(m=>`<div class="card card-pad row gap-lg">
      <div class="col" style="align-items:center;min-width:60px"><span class="fw-700" style="font-size:22px">${new Date(m.scheduled_at).getDate()}</span><span class="text-xs tertiary" style="text-transform:uppercase">${new Date(m.scheduled_at).toLocaleDateString('en',{month:'short',year:'numeric'})}</span></div>
      <div style="width:1px;background:var(--border);align-self:stretch"></div>
      <div class="col" style="flex:1"><span class="fw-700">${esc(m.title)}</span><div class="row gap-sm text-sm tertiary mt-1">${icon('clock',13)} ${fmtDateTime(m.scheduled_at)} · ${m.duration_min}min ${m.location?`· ${icon('target',13)} ${esc(m.location)}`:''}</div>${m.agenda?`<p class="text-sm muted mt-1">${esc(m.agenda)}</p>`:''}</div>
      <span class="badge ${m.status==='scheduled'?'badge-info':m.status==='completed'?'badge-success':'badge-neutral'}" style="text-transform:capitalize">${m.status}</span>
    </div>`).join('')}</div>`:`<div class="empty card card-pad">${icon('calendar',40)}<h3>No meetings scheduled</h3></div>`}`;
  const sm = box.querySelector('#schedMeet');
  if (sm) sm.onclick = () => {
    const dlg = modal({ title:'Schedule Meeting', body:`
      <div class="field"><label class="label">Title</label><input class="input" id="mtTitle" placeholder="e.g. Monthly progress review"></div>
      <div class="row gap-sm"><div class="field" style="flex:1"><label class="label">Date & time</label><input class="input" type="datetime-local" id="mtWhen"></div><div class="field" style="width:120px"><label class="label">Duration (min)</label><input class="input" type="number" id="mtDur" value="30"></div></div>
      <div class="field"><label class="label">Location</label><input class="input" id="mtLoc" placeholder="e.g. PI Office / Zoom"></div>
      <div class="field"><label class="label">Agenda</label><textarea class="textarea" id="mtAgenda" placeholder="Meeting agenda…"></textarea></div>`,
      footer:`<button class="btn" data-close-m>Cancel</button><button class="btn btn-primary" id="mtSave">Schedule</button>` });
    dlg.el.querySelector('[data-close-m]').onclick = dlg.close;
    dlg.el.querySelector('#mtSave').onclick = async () => {
      const title=dlg.el.querySelector('#mtTitle').value.trim(); const when=dlg.el.querySelector('#mtWhen').value;
      if(!title||!when)return toast('Title and time required','error');
      await API.post('/projects/'+_proj.id+'/meetings',{title,scheduled_at:when,duration_min:+dlg.el.querySelector('#mtDur').value,location:dlg.el.querySelector('#mtLoc').value,agenda:dlg.el.querySelector('#mtAgenda').value});
      toast('Meeting scheduled'); dlg.close(); drawMeetingsTab(box);
    };
  };
}

// ---------- Activity tab ----------
async function drawActivityTab(box) {
  box.innerHTML = spinner();
  const acts = await API.get('/projects/'+_proj.id+'/activity').catch(()=>[]);
  const iconFor = { project_created:'plus', modules_added:'layers', file_uploaded:'upload', submitted:'send', approved:'check', revision:'refresh', revision_requested:'alert', comment:'message', meeting_scheduled:'calendar', milestone_approved:'check', progress_updated:'chart' };
  box.innerHTML = `<div class="card card-pad" style="max-width:760px"><h3 class="fw-700 mb-2">Activity history</h3>
    ${acts.length?`<div class="timeline">${acts.map(a=>`<div class="tl-item"><div class="tl-dot" style="color:var(--primary)">${icon(iconFor[a.action]||'flag',11)}</div>
      <div class="row gap-sm"><span class="text-sm"><span class="fw-600">${esc(a.actor||'System')}</span> ${esc((a.action||'').replace(/_/g,' '))}</span></div>
      ${a.detail?`<div class="text-sm muted">${esc(a.detail)}</div>`:''}<div class="text-xs tertiary mt-1">${relTime(a.created_at)}</div></div>`).join('')}</div>`:`<div class="empty" style="padding:30px">${icon('clock',36)}<p class="text-sm">No activity yet</p></div>`}</div>`;
}

function openEditProject() {
  const p = _proj;
  const dlg = modal({ title:'Edit Project', wide:true, body:`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field" style="grid-column:1/-1"><label class="label">Title</label><input class="input" id="e_title" value="${esc(p.title)}"></div>
      <div class="field"><label class="label">Stage</label><select class="select" id="e_stage">${['initiation','experimentation','analysis','writing','defense'].map(s=>`<option ${p.stage===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label class="label">Status</label><select class="select" id="e_status">${['active','on_hold','completed','archived'].map(s=>`<option ${p.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label class="label">Plant</label><input class="input" id="e_plant" value="${esc(p.plant_name||'')}"></div>
      <div class="field"><label class="label">Disease area</label><input class="input" id="e_disease" value="${esc(p.disease_area||'')}"></div>
      <div class="field"><label class="label">Expected completion</label><input class="input" type="date" id="e_end" value="${p.expected_end||''}"></div>
      <div class="field"><label class="label">Lab</label><input class="input" id="e_lab" value="${esc(p.lab||'')}"></div>
      <div class="field" style="grid-column:1/-1"><label class="label">Objectives</label><textarea class="textarea" id="e_obj">${esc(p.objectives||'')}</textarea></div>
    </div>`,
    footer:`<button class="btn" data-close-e>Cancel</button><button class="btn btn-primary" id="e_save">Save changes</button>` });
  dlg.el.querySelector('[data-close-e]').onclick = dlg.close;
  dlg.el.querySelector('#e_save').onclick = async () => {
    await API.patch('/projects/'+p.id, { title:dlg.el.querySelector('#e_title').value, stage:dlg.el.querySelector('#e_stage').value, status:dlg.el.querySelector('#e_status').value, plant_name:dlg.el.querySelector('#e_plant').value, disease_area:dlg.el.querySelector('#e_disease').value, expected_end:dlg.el.querySelector('#e_end').value, lab:dlg.el.querySelector('#e_lab').value, objectives:dlg.el.querySelector('#e_obj').value });
    toast('Project updated'); dlg.close(); refreshProject();
  };
}
