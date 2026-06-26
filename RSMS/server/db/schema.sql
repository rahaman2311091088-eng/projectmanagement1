-- ============================================================
-- RSMS Database Schema
-- Research Supervision Management System
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- Users & Auth ----------
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  password     TEXT NOT NULL,
  full_name    TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('admin','supervisor','student')),
  avatar_color TEXT DEFAULT '#6366f1',
  title        TEXT,            -- e.g. "Professor", "PhD Candidate"
  department   TEXT,
  lab          TEXT,
  phone        TEXT,
  bio          TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  last_login   TEXT
);

-- Student-specific profile attributes
CREATE TABLE IF NOT EXISTS student_profiles (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reg_no       TEXT,
  degree_level TEXT,            -- BPharm, MPharm, MPhil, PhD, PostDoc
  batch        TEXT,
  enrollment_year INTEGER,
  supervisor_id TEXT REFERENCES users(id)
);

-- ---------- Module Library (catalog of research module types) ----------
CREATE TABLE IF NOT EXISTS module_catalog (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,  -- e.g. "Sample Preparation","In Vitro","In Vivo","Computational"...
  description   TEXT,
  default_protocols TEXT,       -- JSON array of protocol titles
  default_deliverables TEXT,    -- JSON array
  est_days      INTEGER DEFAULT 14,
  icon          TEXT DEFAULT 'flask',
  sort_order    INTEGER DEFAULT 0
);

-- ---------- Projects ----------
CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  code          TEXT,
  degree_level  TEXT,
  student_id    TEXT REFERENCES users(id),
  supervisor_id TEXT REFERENCES users(id),
  co_supervisor TEXT,
  plant_name    TEXT,           -- medicinal plant / natural product
  plant_family  TEXT,
  disease_area  TEXT,           -- therapeutic / disease area
  objectives    TEXT,
  lab           TEXT,
  batch         TEXT,
  start_date    TEXT,
  expected_end  TEXT,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','on_hold','completed','archived')),
  stage         TEXT DEFAULT 'initiation', -- initiation, experimentation, analysis, writing, defense
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- ---------- Project Modules (instances / milestones) ----------
CREATE TABLE IF NOT EXISTS project_modules (
  id            TEXT PRIMARY KEY,
  project_id    TEXT REFERENCES projects(id) ON DELETE CASCADE,
  catalog_id    TEXT REFERENCES module_catalog(id),
  name          TEXT NOT NULL,  -- can be customized (e.g. "DPPH Assay - Leaf Extract")
  category      TEXT,
  description   TEXT,
  protocols     TEXT,           -- JSON array
  deliverables  TEXT,           -- JSON array
  references_md TEXT,           -- recommended references (markdown/text)
  instructions  TEXT,           -- supervisor instructions
  status        TEXT DEFAULT 'not_started'
                CHECK (status IN ('not_started','in_progress','submitted','revision','approved','completed')),
  progress      INTEGER DEFAULT 0,
  deadline      TEXT,
  position      INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  completed_at  TEXT
);

-- ---------- Files / Documents (with versioning) ----------
CREATE TABLE IF NOT EXISTS files (
  id            TEXT PRIMARY KEY,
  project_id    TEXT REFERENCES projects(id) ON DELETE CASCADE,
  module_id     TEXT REFERENCES project_modules(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_name   TEXT,
  mime          TEXT,
  size          INTEGER,
  kind          TEXT DEFAULT 'document', -- document, dataset, docking_file, manuscript, image
  version       INTEGER DEFAULT 1,
  parent_file   TEXT,           -- previous version id
  uploaded_by   TEXT REFERENCES users(id),
  note          TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ---------- Comments / Messages (project & module scoped) ----------
CREATE TABLE IF NOT EXISTS comments (
  id            TEXT PRIMARY KEY,
  project_id    TEXT REFERENCES projects(id) ON DELETE CASCADE,
  module_id     TEXT REFERENCES project_modules(id) ON DELETE CASCADE,
  author_id     TEXT REFERENCES users(id),
  body          TEXT NOT NULL,
  type          TEXT DEFAULT 'comment', -- comment, question, revision_request, approval, annotation
  file_id       TEXT REFERENCES files(id),
  resolved      INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ---------- Activity / Approval history ----------
CREATE TABLE IF NOT EXISTS activity (
  id            TEXT PRIMARY KEY,
  project_id    TEXT REFERENCES projects(id) ON DELETE CASCADE,
  module_id     TEXT,
  actor_id      TEXT REFERENCES users(id),
  action        TEXT NOT NULL,
  detail        TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ---------- Meetings ----------
CREATE TABLE IF NOT EXISTS meetings (
  id            TEXT PRIMARY KEY,
  project_id    TEXT REFERENCES projects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  scheduled_at  TEXT,
  duration_min  INTEGER DEFAULT 30,
  location      TEXT,
  agenda        TEXT,
  status        TEXT DEFAULT 'scheduled', -- scheduled, completed, cancelled
  created_by    TEXT REFERENCES users(id),
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ---------- Notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT,
  link          TEXT,
  icon          TEXT DEFAULT 'bell',
  is_read       INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ---------- Knowledge Repository ----------
CREATE TABLE IF NOT EXISTS knowledge (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  category      TEXT,           -- Protocol, SOP, Thesis, Article, Template, Database, Tutorial, FAQ, Troubleshooting
  tags          TEXT,           -- comma separated
  body          TEXT,           -- markdown content
  source_q      TEXT,           -- original question (for FAQ-derived entries)
  author_id     TEXT REFERENCES users(id),
  pinned        INTEGER DEFAULT 0,
  views         INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS idx_pm_project ON project_modules(project_id);
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_project ON comments(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_project ON activity(project_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_proj_student ON projects(student_id);
CREATE INDEX IF NOT EXISTS idx_proj_sup ON projects(supervisor_id);
