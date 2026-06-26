let _kbCache = [], _kbCat = 'All', _kbQuery = '';
const KB_CATEGORIES = ['All','Protocol','SOP','Tutorial','Template','Database','Article','FAQ','Troubleshooting'];

async function renderKnowledge() {
  currentNav = 'knowledge';
  renderShell('knowledge', spinner());
  _kbCache = await API.get('/knowledge').catch(()=>[]);
  drawKnowledge();
}

async function drawKnowledge() {
  const el = document.getElementById('pageContent');
  const isSup = Store.user.role !== 'student';
  const items = await API.get('/knowledge?' + new URLSearchParams({ q: _kbQuery, category: _kbCat })).catch(()=>[]);
  el.innerHTML = `
  <div class="page-head">
    <div><h1 class="page-title">Research Knowledge Repository</h1><p class="page-sub">Institutional protocols, SOPs, tutorials, FAQs and supervisor-approved documentation.</p></div>
    ${isSup?`<button class="btn btn-primary" id="kbNew">${icon('plus',16)} New Entry</button>`:''}
  </div>
  <div class="row gap-sm mb-2 wrap">
    <div class="search-box" style="flex:1;min-width:240px">${icon('search',16)}<input id="kbq" placeholder="Search protocols, methods, troubleshooting…" value="${esc(_kbQuery)}"></div>
  </div>
  <div class="row gap-sm mb-2 wrap">
    ${KB_CATEGORIES.map(c => `<button class="btn btn-sm ${c===_kbCat?'btn-primary':''}" data-cat="${c}">${c}</button>`).join('')}
  </div>
  <div id="kbList">
    ${items.length?`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">${items.map(k=>kbCard(k)).join('')}</div>`:`<div class="empty card card-pad">${icon('book',40)}<h3>No entries found</h3><p class="text-sm">${_kbQuery?'Try a different search.':'Knowledge entries will appear here.'}</p></div>`}
  </div>`;
  el.querySelector('#kbq').oninput = (e) => { _kbQuery = e.target.value; clearTimeout(window._kbT); window._kbT = setTimeout(drawKnowledge, 250); };
  el.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { _kbCat = b.dataset.cat; drawKnowledge(); });
  el.querySelectorAll('[data-kb]').forEach(c => c.onclick = () => openKbEntry(c.dataset.kb));
  const nb = el.querySelector('#kbNew'); if (nb) nb.onclick = () => openKbEditor();
}

const KB_CAT_COLOR = { Protocol:'#0ea5e9', SOP:'#8b5cf6', Tutorial:'#16a34a', Template:'#f59e0b', Database:'#06b6d4', Article:'#6366f1', FAQ:'#ec4899', Troubleshooting:'#dc2626' };
function kbCard(k) {
  const col = KB_CAT_COLOR[k.category] || '#6b7280';
  const tags = (k.tags||'').split(',').filter(Boolean).slice(0,3);
  return `<div class="card card-hover" style="padding:18px;display:flex;flex-direction:column;gap:10px" data-kb="${k.id}">
    <div class="row between"><span class="cat-pill" style="background:${col}1a;color:${col}">${k.category}</span>${k.pinned?`<span style="color:var(--warning)">${icon('pin',15)}</span>`:''}</div>
    <div class="fw-700" style="font-size:14.5px;line-height:1.4;min-height:40px">${esc(k.title)}</div>
    <p class="text-sm muted" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc((k.body||'').replace(/[#*`>-]/g,'').slice(0,120))}</p>
    <div class="row gap-sm wrap">${tags.map(t=>`<span class="chip text-xs">${icon('tag',11)} ${esc(t.trim())}</span>`).join('')}</div>
    <div class="row between text-xs tertiary mt-1"><span>${esc(k.author||'')}</span><span>${k.views||0} views</span></div>
  </div>`;
}

async function openKbEntry(kid) {
  const k = await API.get('/knowledge/'+kid);
  const isSup = Store.user.role !== 'student';
  const col = KB_CAT_COLOR[k.category] || '#6b7280';
  const dlg = modal({ title:'', wide:true, body:`
    <div class="row between mb-2"><span class="cat-pill" style="background:${col}1a;color:${col}">${k.category}</span>
    ${isSup?`<div class="row gap-sm"><button class="btn btn-sm" id="kbEdit">${icon('edit',14)} Edit</button><button class="btn btn-danger btn-sm" id="kbDel">${icon('trash',14)}</button></div>`:''}</div>
    <h2 style="font-size:20px;font-weight:700;margin-bottom:6px">${esc(k.title)}</h2>
    ${k.source_q?`<div class="card" style="padding:10px 14px;background:var(--info-soft);border-color:transparent;margin-bottom:14px"><span class="text-xs fw-700" style="color:var(--info)">ORIGINAL QUESTION</span><div class="text-sm mt-1">${esc(k.source_q)}</div></div>`:''}
    <div class="text-xs tertiary mb-2">By ${esc(k.author||'')} · ${fmtDate(k.created_at)} · ${k.views} views</div>
    ${md(k.body)}
    <div class="row gap-sm mt-3 wrap">${(k.tags||'').split(',').filter(Boolean).map(t=>`<span class="chip text-xs">${esc(t.trim())}</span>`).join('')}</div>` });
  const e = dlg.el.querySelector('#kbEdit'); if (e) e.onclick = () => { dlg.close(); openKbEditor(k); };
  const d = dlg.el.querySelector('#kbDel'); if (d) d.onclick = async () => { if(!confirm('Delete this entry?'))return; await API.del('/knowledge/'+kid); toast('Deleted'); dlg.close(); renderKnowledge(); };
}

function openKbEditor(existing) {
  const k = existing || {};
  const dlg = modal({ title: existing?'Edit Knowledge Entry':'New Knowledge Entry', wide:true, body:`
    <div class="field"><label class="label">Title <span class="req">*</span></label><input class="input" id="kt" value="${esc(k.title||'')}" placeholder="e.g. SOP: DPPH Radical Scavenging Assay"></div>
    <div class="row gap-sm"><div class="field" style="flex:1"><label class="label">Category</label><select class="select" id="kc">${KB_CATEGORIES.slice(1).map(c=>`<option ${k.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="field" style="flex:1"><label class="label">Tags (comma separated)</label><input class="input" id="ktags" value="${esc(k.tags||'')}" placeholder="antioxidant, in vitro, assay"></div></div>
    <div class="field"><label class="label">Content (Markdown supported)</label><textarea class="textarea" id="kb" style="min-height:240px;font-family:var(--mono);font-size:13px">${esc(k.body||'')}</textarea><div class="hint">Use ## headings, **bold**, - lists, \`code\`. Turn frequently-asked questions into permanent searchable entries.</div></div>
    <label class="row gap-sm text-sm"><input type="checkbox" id="kpin" ${k.pinned?'checked':''} style="accent-color:var(--primary)"> Pin to top</label>`,
    footer:`<button class="btn" data-close-k>Cancel</button><button class="btn btn-primary" id="ksave">${existing?'Save changes':'Publish entry'}</button>` });
  dlg.el.querySelector('[data-close-k]').onclick = dlg.close;
  dlg.el.querySelector('#ksave').onclick = async () => {
    const payload = { title:dlg.el.querySelector('#kt').value.trim(), category:dlg.el.querySelector('#kc').value, tags:dlg.el.querySelector('#ktags').value, body:dlg.el.querySelector('#kb').value, pinned:dlg.el.querySelector('#kpin').checked };
    if (!payload.title || !payload.body) return toast('Title and content required','error');
    try { if (existing) await API.patch('/knowledge/'+k.id, payload); else await API.post('/knowledge', payload); toast('Saved'); dlg.close(); renderKnowledge(); } catch(e){ toast(e.message,'error'); }
  };
}
