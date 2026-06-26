const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { nanoid } = require('nanoid');
const { db } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
const id = () => nanoid(12);

// ---------- File upload setup ----------
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${id()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.use(authRequired);

// ---------- Helpers ----------
function logActivity(projectId, moduleId, actorId, action, detail) {
  db.prepare(`INSERT INTO activity (id,project_id,module_id,actor_id,action,detail) VALUES (?,?,?,?,?,?)`)
    .run(id(), projectId, moduleId, actorId, action, detail || null);
}
function notify(userId, title, body, link, icon) {
  if (!userId) return;
  db.prepare(`INSERT INTO notifications (id,user_id,title,body,link,icon) VALUES (?,?,?,?,?,?)`)
    .run(id(), userId, title, body || null, link || null, icon || 'bell');
}
function canAccessProject(user, project) {
  if (!project) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'supervisor') return project.supervisor_id === user.id;
  if (user.role === 'student') return project.student_id === user.id;
  return false;
}
function projectProgress(projectId) {
  const rows = db.prepare('SELECT progress FROM project_modules WHERE project_id = ?').all(projectId);
  if (!rows.length) return 0;
  return Math.round(rows.reduce((a, r) => a + r.progress, 0) / rows.length);
}
function enrich(p) {
  const student = db.prepare('SELECT id,full_name,avatar_color FROM users WHERE id = ?').get(p.student_id);
  const supervisor = db.prepare('SELECT id,full_name,avatar_color FROM users WHERE id = ?').get(p.supervisor_id);
  const mods = db.prepare('SELECT status,progress,deadline FROM project_modules WHERE project_id = ?').all(p.id);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = mods.filter(m => m.deadline && m.deadline < today && !['approved','completed'].includes(m.status)).length;
  const pending = mods.filter(m => m.status === 'submitted').length;
  return {
    ...p, student, supervisor,
    progress: projectProgress(p.id),
    module_count: mods.length,
    completed_modules: mods.filter(m => ['approved','completed'].includes(m.status)).length,
    overdue, pending
  };
}

// ============================================================
// CATALOG
// ============================================================
router.get('/catalog', (req, res) => {
  const rows = db.prepare('SELECT * FROM module_catalog ORDER BY sort_order').all();
  res.json(rows.map(r => ({ ...r, default_protocols: JSON.parse(r.default_protocols || '[]'), default_deliverables: JSON.parse(r.default_deliverables || '[]') })));
});

// ============================================================
// PROJECTS
// ============================================================
router.get('/projects', (req, res) => {
  let rows;
  if (req.user.role === 'admin') {
    rows = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
  } else if (req.user.role === 'supervisor') {
    rows = db.prepare('SELECT * FROM projects WHERE supervisor_id = ? ORDER BY updated_at DESC').all(req.user.id);
  } else {
    rows = db.prepare('SELECT * FROM projects WHERE student_id = ? ORDER BY updated_at DESC').all(req.user.id);
  }
  res.json(rows.map(enrich));
});

router.get('/projects/:pid', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.pid);
  if (!canAccessProject(req.user, p)) return res.status(404).json({ error: 'Not found' });
  const enriched = enrich(p);
  const student = db.prepare('SELECT u.*, sp.reg_no, sp.degree_level, sp.batch FROM users u LEFT JOIN student_profiles sp ON sp.user_id=u.id WHERE u.id = ?').get(p.student_id);
  if (student) delete student.password;
  const supervisor = db.prepare('SELECT id,full_name,email,avatar_color,title FROM users WHERE id = ?').get(p.supervisor_id);
  const modules = db.prepare('SELECT * FROM project_modules WHERE project_id = ? ORDER BY position').all(p.id)
    .map(m => ({ ...m, protocols: JSON.parse(m.protocols || '[]'), deliverables: JSON.parse(m.deliverables || '[]') }));
  res.json({ ...enriched, studentFull: student, supervisorFull: supervisor, modules });
});

router.post('/projects', requireRole('supervisor', 'admin'), (req, res) => {
  const b = req.body;
  if (!b.title || !b.student_id) return res.status(400).json({ error: 'Title and student are required' });
  const pid = id();
  const code = b.code || `RSMS-${new Date().getFullYear()}-${Math.floor(Math.random()*900+100)}`;
  db.prepare(`INSERT INTO projects (id,title,code,degree_level,student_id,supervisor_id,co_supervisor,plant_name,plant_family,disease_area,objectives,lab,batch,start_date,expected_end,status,stage)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    pid, b.title, code, b.degree_level || null, b.student_id, req.user.id, b.co_supervisor || null,
    b.plant_name || null, b.plant_family || null, b.disease_area || null, b.objectives || null,
    b.lab || null, b.batch || null, b.start_date || null, b.expected_end || null, 'active', 'initiation'
  );
  // Optional initial modules
  if (Array.isArray(b.modules)) {
    b.modules.forEach((catId, i) => addModuleFromCatalog(pid, catId, i));
  }
  logActivity(pid, null, req.user.id, 'project_created', b.title);
  notify(b.student_id, 'New project assigned', b.title, `/app/projects/${pid}`, 'folder');
  res.json(enrich(db.prepare('SELECT * FROM projects WHERE id = ?').get(pid)));
});

router.patch('/projects/:pid', requireRole('supervisor', 'admin'), (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.pid);
  if (!canAccessProject(req.user, p)) return res.status(404).json({ error: 'Not found' });
  const fields = ['title','degree_level','co_supervisor','plant_name','plant_family','disease_area','objectives','lab','batch','start_date','expected_end','status','stage'];
  const updates = [], vals = [];
  fields.forEach(f => { if (f in req.body) { updates.push(`${f} = ?`); vals.push(req.body[f]); } });
  if (updates.length) {
    updates.push("updated_at = datetime('now')");
    db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...vals, p.id);
    logActivity(p.id, null, req.user.id, 'project_updated', null);
  }
  res.json(enrich(db.prepare('SELECT * FROM projects WHERE id = ?').get(p.id)));
});

// ============================================================
// MODULES
// ============================================================
function addModuleFromCatalog(projectId, catalogId, position, custom = {}) {
  const cat = db.prepare('SELECT * FROM module_catalog WHERE id = ?').get(catalogId);
  if (!cat) return null;
  const mid = id();
  db.prepare(`INSERT INTO project_modules (id,project_id,catalog_id,name,category,description,protocols,deliverables,instructions,deadline,position)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    mid, projectId, catalogId, custom.name || cat.name, cat.category, cat.description,
    cat.default_protocols, cat.default_deliverables, custom.instructions || null, custom.deadline || null, position
  );
  return mid;
}

router.post('/projects/:pid/modules', requireRole('supervisor', 'admin'), (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.pid);
  if (!canAccessProject(req.user, p)) return res.status(404).json({ error: 'Not found' });
  const maxPos = db.prepare('SELECT COALESCE(MAX(position),-1) m FROM project_modules WHERE project_id = ?').get(p.id).m;
  const added = [];
  const list = Array.isArray(req.body.catalog_ids) ? req.body.catalog_ids : [req.body.catalog_id];
  list.forEach((cid, i) => {
    const mid = addModuleFromCatalog(p.id, cid, maxPos + 1 + i, { instructions: req.body.instructions, deadline: req.body.deadline, name: req.body.name });
    if (mid) added.push(mid);
  });
  logActivity(p.id, null, req.user.id, 'modules_added', `${added.length} module(s) added`);
  notify(p.student_id, 'New research module added', 'Your supervisor added a module to your project.', `/app/projects/${p.id}`, 'plus');
  db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(p.id);
  res.json({ added });
});

router.patch('/modules/:mid', (req, res) => {
  const m = db.prepare('SELECT * FROM project_modules WHERE id = ?').get(req.params.mid);
  if (!m) return res.status(404).json({ error: 'Not found' });
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(m.project_id);
  if (!canAccessProject(req.user, p)) return res.status(404).json({ error: 'Not found' });

  const isStudent = req.user.role === 'student';
  const b = req.body;
  const updates = [], vals = [];
  const allowStudent = ['progress','status'];
  const allowSup = ['name','description','instructions','deadline','status','progress','references_md','protocols','deliverables'];
  const allowed = isStudent ? allowStudent : allowSup;

  // Status transition rules
  if ('status' in b) {
    if (isStudent && !['in_progress','submitted'].includes(b.status)) {
      return res.status(403).json({ error: 'Students can only mark modules in progress or submitted' });
    }
  }

  Object.keys(b).forEach(k => {
    if (!allowed.includes(k)) return;
    let v = b[k];
    if (k === 'protocols' || k === 'deliverables') v = JSON.stringify(v);
    updates.push(`${k} = ?`); vals.push(v);
  });
  if (b.status === 'completed' || b.status === 'approved') { updates.push('progress = 100'); updates.push("completed_at = datetime('now')"); }
  if (updates.length) {
    updates.push("updated_at = datetime('now')");
    db.prepare(`UPDATE project_modules SET ${updates.join(', ')} WHERE id = ?`).run(...vals, m.id);
  }
  db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(p.id);

  // Notifications & activity on status change
  if ('status' in b && b.status !== m.status) {
    logActivity(p.id, m.id, req.user.id, b.status, `${m.name}: ${m.status} → ${b.status}`);
    if (b.status === 'submitted') notify(p.supervisor_id, 'Module submitted for review', `${m.name} — ${p.code}`, `/app/projects/${p.id}`, 'inbox');
    if (b.status === 'revision') notify(p.student_id, 'Revision requested', `${m.name} needs revision.`, `/app/projects/${p.id}`, 'alert');
    if (b.status === 'approved') notify(p.student_id, 'Module approved', `${m.name} was approved. 🎉`, `/app/projects/${p.id}`, 'check');
  }
  res.json(db.prepare('SELECT * FROM project_modules WHERE id = ?').get(m.id));
});

router.delete('/modules/:mid', requireRole('supervisor', 'admin'), (req, res) => {
  const m = db.prepare('SELECT * FROM project_modules WHERE id = ?').get(req.params.mid);
  if (!m) return res.status(404).json({ error: 'Not found' });
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(m.project_id);
  if (!canAccessProject(req.user, p)) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM project_modules WHERE id = ?').run(m.id);
  logActivity(p.id, null, req.user.id, 'module_removed', m.name);
  res.json({ ok: true });
});

router.post('/projects/:pid/modules/reorder', requireRole('supervisor', 'admin'), (req, res) => {
  const order = req.body.order || [];
  const stmt = db.prepare('UPDATE project_modules SET position = ? WHERE id = ? AND project_id = ?');
  const tx = db.transaction(() => order.forEach((mid, i) => stmt.run(i, mid, req.params.pid)));
  tx();
  res.json({ ok: true });
});

// ============================================================
// FILES
// ============================================================
router.post('/upload', upload.single('file'), (req, res) => {
  const { project_id, module_id, kind, note } = req.body;
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id);
  if (!canAccessProject(req.user, p)) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  // versioning: same original name in same module => increment
  let version = 1, parent = null;
  if (module_id) {
    const prev = db.prepare('SELECT * FROM files WHERE module_id = ? AND original_name = ? ORDER BY version DESC LIMIT 1').get(module_id, req.file.originalname);
    if (prev) { version = prev.version + 1; parent = prev.id; }
  }
  const fid = id();
  db.prepare(`INSERT INTO files (id,project_id,module_id,original_name,stored_name,mime,size,kind,version,parent_file,uploaded_by,note)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    fid, project_id, module_id || null, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size,
    kind || 'document', version, parent, req.user.id, note || null
  );
  logActivity(project_id, module_id || null, req.user.id, 'file_uploaded', `${req.file.originalname} (v${version})`);
  if (req.user.role === 'student') notify(p.supervisor_id, 'New file uploaded', `${req.file.originalname} — ${p.code}`, `/app/projects/${project_id}`, 'doc');
  res.json(db.prepare('SELECT * FROM files WHERE id = ?').get(fid));
});

router.get('/projects/:pid/files', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.pid);
  if (!canAccessProject(req.user, p)) return res.status(404).json({ error: 'Not found' });
  const rows = db.prepare(`SELECT f.*, u.full_name uploader, u.avatar_color FROM files f LEFT JOIN users u ON u.id=f.uploaded_by WHERE f.project_id = ? ORDER BY f.created_at DESC`).all(p.id);
  res.json(rows);
});

router.get('/files/:fid/download', (req, res) => {
  const f = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.fid);
  if (!f) return res.status(404).json({ error: 'Not found' });
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(f.project_id);
  if (!canAccessProject(req.user, p)) return res.status(404).json({ error: 'Not found' });
  const fp = path.join(UPLOAD_DIR, f.stored_name);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File missing' });
  res.download(fp, f.original_name);
});

router.delete('/files/:fid', (req, res) => {
  const f = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.fid);
  if (!f) return res.status(404).json({ error: 'Not found' });
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(f.project_id);
  if (!canAccessProject(req.user, p)) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'student' && f.uploaded_by !== req.user.id) return res.status(403).json({ error: 'Cannot delete' });
  db.prepare('DELETE FROM files WHERE id = ?').run(f.id);
  res.json({ ok: true });
});

// ============================================================
// COMMENTS
// ============================================================
router.get('/projects/:pid/comments', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.pid);
  if (!canAccessProject(req.user, p)) return res.status(404).json({ error: 'Not found' });
  const where = req.query.module_id ? 'AND c.module_id = ?' : '';
  const args = req.query.module_id ? [p.id, req.query.module_id] : [p.id];
  const rows = db.prepare(`SELECT c.*, u.full_name author, u.avatar_color, u.role FROM comments c LEFT JOIN users u ON u.id=c.author_id WHERE c.project_id = ? ${where} ORDER BY c.created_at ASC`).all(...args);
  res.json(rows);
});

router.post('/projects/:pid/comments', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.pid);
  if (!canAccessProject(req.user, p)) return res.status(404).json({ error: 'Not found' });
  const { body, module_id, type, file_id } = req.body;
  if (!body) return res.status(400).json({ error: 'Empty comment' });
  const cid = id();
  db.prepare(`INSERT INTO comments (id,project_id,module_id,author_id,body,type,file_id) VALUES (?,?,?,?,?,?,?)`)
    .run(cid, p.id, module_id || null, req.user.id, body, type || 'comment', file_id || null);
  logActivity(p.id, module_id || null, req.user.id, (type === 'revision_request' ? 'revision_requested' : 'comment'), body.slice(0, 80));
  // notify the other party
  const target = req.user.id === p.supervisor_id ? p.student_id : p.supervisor_id;
  notify(target, type === 'question' ? 'New question' : type === 'revision_request' ? 'Revision requested' : 'New comment', body.slice(0, 100), `/app/projects/${p.id}`, 'message');
  res.json(db.prepare(`SELECT c.*, u.full_name author, u.avatar_color, u.role FROM comments c LEFT JOIN users u ON u.id=c.author_id WHERE c.id = ?`).get(cid));
});

router.patch('/comments/:cid/resolve', (req, res) => {
  const c = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.cid);
  if (!c) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE comments SET resolved = ? WHERE id = ?').run(req.body.resolved ? 1 : 0, c.id);
  res.json({ ok: true });
});

// ============================================================
// ACTIVITY
// ============================================================
router.get('/projects/:pid/activity', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.pid);
  if (!canAccessProject(req.user, p)) return res.status(404).json({ error: 'Not found' });
  const rows = db.prepare(`SELECT a.*, u.full_name actor, u.avatar_color FROM activity a LEFT JOIN users u ON u.id=a.actor_id WHERE a.project_id = ? ORDER BY a.created_at DESC LIMIT 100`).all(p.id);
  res.json(rows);
});

// ============================================================
// MEETINGS
// ============================================================
router.get('/projects/:pid/meetings', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.pid);
  if (!canAccessProject(req.user, p)) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT * FROM meetings WHERE project_id = ? ORDER BY scheduled_at').all(p.id));
});

router.post('/projects/:pid/meetings', requireRole('supervisor', 'admin'), (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.pid);
  if (!canAccessProject(req.user, p)) return res.status(404).json({ error: 'Not found' });
  const { title, scheduled_at, duration_min, location, agenda } = req.body;
  const mid = id();
  db.prepare(`INSERT INTO meetings (id,project_id,title,scheduled_at,duration_min,location,agenda,created_by) VALUES (?,?,?,?,?,?,?,?)`)
    .run(mid, p.id, title, scheduled_at, duration_min || 30, location || null, agenda || null, req.user.id);
  notify(p.student_id, 'Meeting scheduled', `${title} — ${scheduled_at}`, `/app/projects/${p.id}`, 'calendar');
  logActivity(p.id, null, req.user.id, 'meeting_scheduled', title);
  res.json(db.prepare('SELECT * FROM meetings WHERE id = ?').get(mid));
});

router.get('/meetings/upcoming', (req, res) => {
  let rows;
  const today = new Date().toISOString().slice(0, 10);
  if (req.user.role === 'student') {
    rows = db.prepare(`SELECT m.*, p.code, p.title ptitle FROM meetings m JOIN projects p ON p.id=m.project_id WHERE p.student_id=? AND m.scheduled_at >= ? AND m.status='scheduled' ORDER BY m.scheduled_at LIMIT 20`).all(req.user.id, today);
  } else if (req.user.role === 'supervisor') {
    rows = db.prepare(`SELECT m.*, p.code, p.title ptitle FROM meetings m JOIN projects p ON p.id=m.project_id WHERE p.supervisor_id=? AND m.scheduled_at >= ? AND m.status='scheduled' ORDER BY m.scheduled_at LIMIT 20`).all(req.user.id, today);
  } else {
    rows = db.prepare(`SELECT m.*, p.code, p.title ptitle FROM meetings m JOIN projects p ON p.id=m.project_id WHERE m.scheduled_at >= ? ORDER BY m.scheduled_at LIMIT 20`).all(today);
  }
  res.json(rows);
});

// ============================================================
// NOTIFICATIONS
// ============================================================
router.get('/notifications', (req, res) => {
  res.json(db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id));
});
router.post('/notifications/read', (req, res) => {
  if (req.body.id) db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(req.body.id, req.user.id);
  else db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id);
  res.json({ ok: true });
});

// ============================================================
// KNOWLEDGE REPOSITORY
// ============================================================
router.get('/knowledge', (req, res) => {
  const { q, category } = req.query;
  let sql = 'SELECT k.*, u.full_name author FROM knowledge k LEFT JOIN users u ON u.id=k.author_id WHERE 1=1';
  const args = [];
  if (category && category !== 'All') { sql += ' AND k.category = ?'; args.push(category); }
  if (q) { sql += ' AND (k.title LIKE ? OR k.body LIKE ? OR k.tags LIKE ?)'; args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ' ORDER BY k.pinned DESC, k.updated_at DESC';
  res.json(db.prepare(sql).all(...args));
});

router.get('/knowledge/:kid', (req, res) => {
  const k = db.prepare('SELECT k.*, u.full_name author FROM knowledge k LEFT JOIN users u ON u.id=k.author_id WHERE k.id = ?').get(req.params.kid);
  if (!k) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE knowledge SET views = views + 1 WHERE id = ?').run(k.id);
  res.json(k);
});

router.post('/knowledge', requireRole('supervisor', 'admin'), (req, res) => {
  const { title, category, tags, body, source_q, pinned } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'Title and content required' });
  const kid = id();
  db.prepare(`INSERT INTO knowledge (id,title,category,tags,body,source_q,author_id,pinned) VALUES (?,?,?,?,?,?,?,?)`)
    .run(kid, title, category || 'Protocol', tags || '', body, source_q || null, req.user.id, pinned ? 1 : 0);
  res.json(db.prepare('SELECT * FROM knowledge WHERE id = ?').get(kid));
});

router.patch('/knowledge/:kid', requireRole('supervisor', 'admin'), (req, res) => {
  const k = db.prepare('SELECT * FROM knowledge WHERE id = ?').get(req.params.kid);
  if (!k) return res.status(404).json({ error: 'Not found' });
  const fields = ['title','category','tags','body','pinned'];
  const updates = [], vals = [];
  fields.forEach(f => { if (f in req.body) { updates.push(`${f}=?`); vals.push(f==='pinned'?(req.body[f]?1:0):req.body[f]); } });
  if (updates.length) { updates.push("updated_at=datetime('now')"); db.prepare(`UPDATE knowledge SET ${updates.join(',')} WHERE id=?`).run(...vals, k.id); }
  res.json(db.prepare('SELECT * FROM knowledge WHERE id = ?').get(k.id));
});

router.delete('/knowledge/:kid', requireRole('supervisor', 'admin'), (req, res) => {
  db.prepare('DELETE FROM knowledge WHERE id = ?').run(req.params.kid);
  res.json({ ok: true });
});

// ============================================================
// USERS / STUDENTS
// ============================================================
router.get('/students', requireRole('supervisor', 'admin'), (req, res) => {
  const rows = db.prepare(`SELECT u.id,u.full_name,u.email,u.avatar_color,u.title,sp.reg_no,sp.degree_level,sp.batch FROM users u LEFT JOIN student_profiles sp ON sp.user_id=u.id WHERE u.role='student' ORDER BY u.full_name`).all();
  res.json(rows);
});

router.post('/students', requireRole('supervisor', 'admin'), (req, res) => {
  const bcrypt = require('bcryptjs');
  const { full_name, email, reg_no, degree_level, batch } = req.body;
  if (!full_name || !email) return res.status(400).json({ error: 'Name and email required' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(400).json({ error: 'Email already exists' });
  const uid = id();
  const colors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#ec4899','#8b5cf6','#06b6d4'];
  db.prepare(`INSERT INTO users (id,email,password,full_name,role,avatar_color,title,department) VALUES (?,?,?,?,?,?,?,?)`)
    .run(uid, email.toLowerCase(), bcrypt.hashSync('student123', 10), full_name, 'student', colors[Math.floor(Math.random()*colors.length)], `${degree_level||''} Researcher`, 'Department of Pharmacy');
  db.prepare(`INSERT INTO student_profiles (user_id,reg_no,degree_level,batch,enrollment_year,supervisor_id) VALUES (?,?,?,?,?,?)`)
    .run(uid, reg_no || null, degree_level || null, batch || null, new Date().getFullYear(), req.user.id);
  res.json({ id: uid, full_name, email, default_password: 'student123' });
});

// ============================================================
// DASHBOARD STATS
// ============================================================
router.get('/dashboard', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  if (req.user.role === 'student') {
    const projects = db.prepare('SELECT * FROM projects WHERE student_id = ?').all(req.user.id).map(enrich);
    const mods = db.prepare('SELECT pm.*, p.code FROM project_modules pm JOIN projects p ON p.id=pm.project_id WHERE p.student_id = ?').all(req.user.id);
    return res.json({
      projects,
      stats: {
        active_modules: mods.filter(m => m.status === 'in_progress').length,
        pending_review: mods.filter(m => m.status === 'submitted').length,
        needs_revision: mods.filter(m => m.status === 'revision').length,
        overdue: mods.filter(m => m.deadline && m.deadline < today && !['approved','completed'].includes(m.status)).length,
        completed: mods.filter(m => ['approved','completed'].includes(m.status)).length,
        total: mods.length,
      },
      upcoming: mods.filter(m => m.deadline && m.deadline >= today && !['approved','completed'].includes(m.status)).sort((a,b)=>a.deadline.localeCompare(b.deadline)).slice(0,6),
    });
  }
  // supervisor / admin
  const projWhere = req.user.role === 'supervisor' ? 'WHERE supervisor_id = ?' : '';
  const projArgs = req.user.role === 'supervisor' ? [req.user.id] : [];
  const projects = db.prepare(`SELECT * FROM projects ${projWhere}`).all(...projArgs).map(enrich);
  const modWhere = req.user.role === 'supervisor' ? 'WHERE p.supervisor_id = ?' : '';
  const allMods = db.prepare(`SELECT pm.* FROM project_modules pm JOIN projects p ON p.id=pm.project_id ${modWhere}`).all(...projArgs);
  res.json({
    projects,
    stats: {
      total_projects: projects.length,
      active_projects: projects.filter(p => p.status === 'active').length,
      pending_review: allMods.filter(m => m.status === 'submitted').length,
      overdue: allMods.filter(m => m.deadline && m.deadline < today && !['approved','completed'].includes(m.status)).length,
      in_writing: projects.filter(p => p.stage === 'writing').length,
      avg_progress: projects.length ? Math.round(projects.reduce((a,p)=>a+p.progress,0)/projects.length) : 0,
      completed: projects.filter(p => p.status === 'completed').length,
      students: new Set(projects.map(p=>p.student_id)).size,
    },
    category_breakdown: (() => {
      const map = {};
      allMods.forEach(m => { map[m.category] = (map[m.category]||0)+1; });
      return map;
    })(),
  });
});

module.exports = router;
