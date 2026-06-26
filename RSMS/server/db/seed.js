const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const { db, init } = require('./index');
const { CATALOG } = require('./catalog');

function id() { return nanoid(12); }
const hash = (p) => bcrypt.hashSync(p, 10);

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

console.log('Initializing schema...');
init();

// Wipe (idempotent reseed)
const tables = ['notifications','meetings','activity','comments','files','project_modules','projects','knowledge','student_profiles','module_catalog','users'];
db.exec('PRAGMA foreign_keys = OFF;');
tables.forEach(t => db.exec(`DELETE FROM ${t};`));
db.exec('PRAGMA foreign_keys = ON;');

// ---------- Module Catalog ----------
const insCat = db.prepare(`INSERT INTO module_catalog (id,name,category,description,default_protocols,default_deliverables,est_days,icon,sort_order) VALUES (@id,@name,@category,@description,@protocols,@deliverables,@est_days,@icon,@sort_order)`);
const catIds = {};
CATALOG.forEach((m, i) => {
  const cid = id();
  catIds[m.name] = cid;
  insCat.run({
    id: cid, name: m.name, category: m.category, description: m.description,
    protocols: JSON.stringify(m.protocols || []),
    deliverables: JSON.stringify(m.deliverables || []),
    est_days: m.est_days || 14, icon: m.icon || 'flask', sort_order: i
  });
});
console.log(`Inserted ${CATALOG.length} catalog modules.`);

// ---------- Users ----------
const insUser = db.prepare(`INSERT INTO users (id,email,password,full_name,role,avatar_color,title,department,lab,phone,bio) VALUES (@id,@email,@password,@full_name,@role,@avatar_color,@title,@department,@lab,@phone,@bio)`);
const insStudent = db.prepare(`INSERT INTO student_profiles (user_id,reg_no,degree_level,batch,enrollment_year,supervisor_id) VALUES (@user_id,@reg_no,@degree_level,@batch,@enrollment_year,@supervisor_id)`);

const admin = { id: id(), email: 'admin@rsms.edu', password: hash('admin123'), full_name: 'System Administrator', role: 'admin', avatar_color: '#0ea5e9', title: 'Administrator', department: 'Faculty of Pharmacy', lab: '—', phone: '', bio: 'Platform administrator.' };
insUser.run(admin);

const supervisor = { id: id(), email: 'supervisor@rsms.edu', password: hash('super123'), full_name: 'Prof. Dr. Ayesha Rahman', role: 'supervisor', avatar_color: '#7c3aed', title: 'Professor', department: 'Department of Pharmacy', lab: 'Phytochemistry & Pharmacology Lab', phone: '+880 17xxxxxxxx', bio: 'Principal investigator specialising in natural product drug discovery, in vitro/in vivo pharmacology and computational drug design.' };
insUser.run(supervisor);

const sup2 = { id: id(), email: 'k.hossain@rsms.edu', password: hash('super123'), full_name: 'Dr. Kamrul Hossain', role: 'supervisor', avatar_color: '#0d9488', title: 'Associate Professor', department: 'Department of Pharmacy', lab: 'Molecular Modelling Lab', phone: '', bio: 'Computational pharmacology and medicinal chemistry.' };
insUser.run(sup2);

const studentsData = [
  { name: 'Tahmina Akter', email: 'tahmina@student.rsms.edu', reg: 'PH-PhD-21-007', degree: 'PhD', batch: '2021', year: 2021, color: '#ef4444' },
  { name: 'Rafiqul Islam', email: 'rafiq@student.rsms.edu', reg: 'PH-MPhil-22-014', degree: 'MPhil', batch: '2022', year: 2022, color: '#f59e0b' },
  { name: 'Sumaiya Nasrin', email: 'sumaiya@student.rsms.edu', reg: 'PH-MPharm-23-031', degree: 'MPharm', batch: '2023', year: 2023, color: '#10b981' },
  { name: 'Imran Chowdhury', email: 'imran@student.rsms.edu', reg: 'PH-PhD-20-003', degree: 'PhD', batch: '2020', year: 2020, color: '#3b82f6' },
  { name: 'Nusrat Jahan', email: 'nusrat@student.rsms.edu', reg: 'PH-MPharm-23-019', degree: 'MPharm', batch: '2023', year: 2023, color: '#ec4899' },
];
const students = {};
studentsData.forEach(s => {
  const uid = id();
  students[s.name] = uid;
  insUser.run({ id: uid, email: s.email, password: hash('student123'), full_name: s.name, role: 'student', avatar_color: s.color, title: `${s.degree} Researcher`, department: 'Department of Pharmacy', lab: 'Phytochemistry & Pharmacology Lab', phone: '', bio: '' });
  insStudent.run({ user_id: uid, reg_no: s.reg, degree_level: s.degree, batch: s.batch, enrollment_year: s.year, supervisor_id: supervisor.id });
});
console.log('Inserted users.');

// ---------- Projects with modules ----------
const insProj = db.prepare(`INSERT INTO projects (id,title,code,degree_level,student_id,supervisor_id,co_supervisor,plant_name,plant_family,disease_area,objectives,lab,batch,start_date,expected_end,status,stage) VALUES (@id,@title,@code,@degree_level,@student_id,@supervisor_id,@co_supervisor,@plant_name,@plant_family,@disease_area,@objectives,@lab,@batch,@start_date,@expected_end,@status,@stage)`);
const insMod = db.prepare(`INSERT INTO project_modules (id,project_id,catalog_id,name,category,description,protocols,deliverables,references_md,instructions,status,progress,deadline,position) VALUES (@id,@project_id,@catalog_id,@name,@category,@description,@protocols,@deliverables,@references_md,@instructions,@status,@progress,@deadline,@position)`);
const insAct = db.prepare(`INSERT INTO activity (id,project_id,module_id,actor_id,action,detail) VALUES (@id,@project_id,@module_id,@actor_id,@action,@detail)`);
const insComment = db.prepare(`INSERT INTO comments (id,project_id,module_id,author_id,body,type,resolved) VALUES (@id,@project_id,@module_id,@author_id,@body,@type,@resolved)`);
const insMeeting = db.prepare(`INSERT INTO meetings (id,project_id,title,scheduled_at,duration_min,location,agenda,status,created_by) VALUES (@id,@project_id,@title,@scheduled_at,@duration_min,@location,@agenda,@status,@created_by)`);
const insNotif = db.prepare(`INSERT INTO notifications (id,user_id,title,body,link,icon,is_read) VALUES (@id,@user_id,@title,@body,@link,@icon,@is_read)`);

function addModule(projectId, catName, status, progress, deadlineOffset, pos, instructions) {
  const cat = CATALOG.find(c => c.name === catName);
  const mid = id();
  insMod.run({
    id: mid, project_id: projectId, catalog_id: catIds[catName], name: catName,
    category: cat.category, description: cat.description,
    protocols: JSON.stringify(cat.protocols || []),
    deliverables: JSON.stringify(cat.deliverables || []),
    references_md: '', instructions: instructions || '',
    status, progress, deadline: daysFromNow(deadlineOffset), position: pos
  });
  return mid;
}

// --- Project 1: PhD, comprehensive ---
const p1 = id();
insProj.run({
  id: p1, title: 'Antidiabetic & Antioxidant Potential of Azadirachta indica Leaf Extract: Bioassay-Guided Isolation and Computational Validation',
  code: 'RSMS-2021-001', degree_level: 'PhD', student_id: students['Tahmina Akter'], supervisor_id: supervisor.id,
  co_supervisor: 'Dr. Kamrul Hossain', plant_name: 'Azadirachta indica', plant_family: 'Meliaceae',
  disease_area: 'Type 2 Diabetes Mellitus',
  objectives: '1. Extract and fractionate A. indica leaves.\n2. Evaluate antioxidant and antidiabetic activity in vitro.\n3. Isolate active phytoconstituents.\n4. Validate via molecular docking & MD simulation.\n5. Confirm efficacy in an in vivo diabetic model.',
  lab: 'Phytochemistry & Pharmacology Lab', batch: '2021', start_date: '2021-09-01', expected_end: '2025-08-31',
  status: 'active', stage: 'experimentation'
});
let pos = 0;
addModule(p1, 'Plant Collection', 'completed', 100, -300, pos++);
addModule(p1, 'Botanical Authentication', 'completed', 100, -290, pos++);
addModule(p1, 'Drying and Powder Preparation', 'completed', 100, -280, pos++);
addModule(p1, 'Extraction', 'completed', 100, -250, pos++);
addModule(p1, 'Phytochemical Screening', 'completed', 100, -240, pos++);
addModule(p1, 'Total Phenolic Content', 'approved', 100, -200, pos++);
addModule(p1, 'Total Flavonoid Content', 'approved', 100, -200, pos++);
addModule(p1, 'Antioxidant Assay (DPPH)', 'approved', 100, -180, pos++);
addModule(p1, 'Antioxidant Assay (ABTS)', 'completed', 100, -170, pos++);
const m_amyl = addModule(p1, 'Antidiabetic Assay (α-Amylase)', 'submitted', 90, -5, pos++, 'Re-run the highest concentration in triplicate. Submit the IC50 with the calibration curve.');
addModule(p1, 'Antidiabetic Assay (α-Glucosidase)', 'in_progress', 55, 12, pos++, 'Use acarbose as positive control across all plates.');
addModule(p1, 'Fractionation', 'in_progress', 40, 20, pos++);
const m_dock = addModule(p1, 'Molecular Docking', 'revision', 60, 3, pos++, 'Redock against α-glucosidase (PDB 3W37). Report binding energies for the top 3 isolated compounds.');
addModule(p1, 'ADMET Prediction', 'not_started', 0, 35, pos++);
addModule(p1, 'Molecular Dynamics Simulation', 'not_started', 0, 60, pos++);
addModule(p1, 'In Vivo Pharmacological Study', 'not_started', 0, 90, pos++, 'Submit ethical clearance before commencing.');
addModule(p1, 'Histopathology', 'not_started', 0, 130, pos++);
addModule(p1, 'Statistical Analysis', 'not_started', 0, 150, pos++);
addModule(p1, 'Manuscript Writing', 'not_started', 0, 200, pos++);
addModule(p1, 'Thesis Writing', 'not_started', 0, 320, pos++);

// --- Project 2: MPhil ---
const p2 = id();
insProj.run({
  id: p2, title: 'Anti-inflammatory and Analgesic Evaluation of Centella asiatica Whole Plant Extract',
  code: 'RSMS-2022-014', degree_level: 'MPhil', student_id: students['Rafiqul Islam'], supervisor_id: supervisor.id,
  co_supervisor: '', plant_name: 'Centella asiatica', plant_family: 'Apiaceae', disease_area: 'Inflammation / Pain',
  objectives: 'Evaluate the anti-inflammatory and analgesic activity of C. asiatica extract through in vitro and in vivo models, supported by phytochemical profiling.',
  lab: 'Phytochemistry & Pharmacology Lab', batch: '2022', start_date: '2022-10-01', expected_end: '2024-09-30',
  status: 'active', stage: 'analysis'
});
pos = 0;
addModule(p2, 'Plant Collection', 'completed', 100, -200, pos++);
addModule(p2, 'Extraction', 'completed', 100, -180, pos++);
addModule(p2, 'Phytochemical Screening', 'completed', 100, -170, pos++);
addModule(p2, 'HPLC', 'approved', 100, -120, pos++);
addModule(p2, 'Anti-inflammatory Assay', 'approved', 100, -90, pos++);
addModule(p2, 'Analgesic Study', 'submitted', 95, -2, pos++, 'Include the writhing count table for all groups.');
addModule(p2, 'Statistical Analysis', 'in_progress', 60, 10, pos++);
addModule(p2, 'Graph Generation', 'in_progress', 45, 15, pos++);
addModule(p2, 'Manuscript Writing', 'not_started', 0, 40, pos++);
addModule(p2, 'Final Defense Preparation', 'not_started', 0, 80, pos++);

// --- Project 3: MPharm ---
const p3 = id();
insProj.run({
  id: p3, title: 'Cytotoxic Screening of Andrographis paniculata Fractions against MCF-7 and HepG2 Cell Lines',
  code: 'RSMS-2023-031', degree_level: 'MPharm', student_id: students['Sumaiya Nasrin'], supervisor_id: supervisor.id,
  co_supervisor: 'Dr. Kamrul Hossain', plant_name: 'Andrographis paniculata', plant_family: 'Acanthaceae', disease_area: 'Cancer (Breast / Liver)',
  objectives: 'Screen solvent fractions of A. paniculata for cytotoxicity against MCF-7 and HepG2 cell lines and identify the most active fraction.',
  lab: 'Phytochemistry & Pharmacology Lab', batch: '2023', start_date: '2023-11-01', expected_end: '2024-12-31',
  status: 'active', stage: 'experimentation'
});
pos = 0;
addModule(p3, 'Plant Collection', 'completed', 100, -120, pos++);
addModule(p3, 'Extraction', 'completed', 100, -100, pos++);
addModule(p3, 'Fractionation', 'approved', 100, -60, pos++);
const m_cyto = addModule(p3, 'Anticancer / Cytotoxicity Assay', 'in_progress', 50, 8, pos++, 'Maintain MCF-7 and HepG2 separately. Run MTT in triplicate at 6 concentrations.');
addModule(p3, 'Molecular Docking', 'not_started', 0, 30, pos++);
addModule(p3, 'Statistical Analysis', 'not_started', 0, 45, pos++);
addModule(p3, 'Manuscript Writing', 'not_started', 0, 70, pos++);

// --- Project 4: PhD nearly done ---
const p4 = id();
insProj.run({
  id: p4, title: 'Hepatoprotective Mechanism of Phyllanthus niruri: Integrated In Vivo and Network Pharmacology Approach',
  code: 'RSMS-2020-003', degree_level: 'PhD', student_id: students['Imran Chowdhury'], supervisor_id: supervisor.id,
  co_supervisor: 'Dr. Kamrul Hossain', plant_name: 'Phyllanthus niruri', plant_family: 'Phyllanthaceae', disease_area: 'Hepatotoxicity / Liver disease',
  objectives: 'Establish the hepatoprotective mechanism of P. niruri using a CCl4 model integrated with network pharmacology and molecular docking.',
  lab: 'Phytochemistry & Pharmacology Lab', batch: '2020', start_date: '2020-09-01', expected_end: '2024-08-31',
  status: 'active', stage: 'writing'
});
pos = 0;
['Plant Collection','Botanical Authentication','Extraction','Phytochemical Screening','HPLC','Antioxidant Assay (DPPH)','Hepatoprotective Study','Histopathology','Biochemical Analysis','Network Pharmacology','Molecular Docking','Statistical Analysis'].forEach(n => addModule(p4, n, 'approved', 100, -30, pos++));
addModule(p4, 'Manuscript Writing', 'submitted', 85, 5, pos++, 'Address reviewer comments on the discussion section.');
addModule(p4, 'Thesis Writing', 'in_progress', 70, 30, pos++);
addModule(p4, 'Final Defense Preparation', 'not_started', 0, 60, pos++);

// --- Project 5: MPharm early ---
const p5 = id();
insProj.run({
  id: p5, title: 'Antimicrobial and Antioxidant Profiling of Ocimum sanctum Essential Oil',
  code: 'RSMS-2023-019', degree_level: 'MPharm', student_id: students['Nusrat Jahan'], supervisor_id: supervisor.id,
  co_supervisor: '', plant_name: 'Ocimum sanctum', plant_family: 'Lamiaceae', disease_area: 'Infectious disease',
  objectives: 'Extract O. sanctum essential oil, characterise via GC-MS and evaluate antimicrobial and antioxidant activity.',
  lab: 'Phytochemistry & Pharmacology Lab', batch: '2023', start_date: '2024-01-15', expected_end: '2025-01-31',
  status: 'active', stage: 'experimentation'
});
pos = 0;
addModule(p5, 'Plant Collection', 'completed', 100, -60, pos++);
addModule(p5, 'Extraction', 'in_progress', 70, 5, pos++);
addModule(p5, 'GC-MS', 'not_started', 0, 25, pos++);
addModule(p5, 'Antimicrobial Assay', 'not_started', 0, 45, pos++);
addModule(p5, 'Antioxidant Assay (DPPH)', 'not_started', 0, 50, pos++);
addModule(p5, 'Statistical Analysis', 'not_started', 0, 70, pos++);

console.log('Inserted projects & modules.');

// ---------- Activity, comments, meetings, notifications ----------
insAct.run({ id: id(), project_id: p1, module_id: m_dock, actor_id: supervisor.id, action: 'revision_requested', detail: 'Docking results require re-run against α-glucosidase (3W37).' });
insAct.run({ id: id(), project_id: p1, module_id: m_amyl, actor_id: students['Tahmina Akter'], action: 'submitted', detail: 'α-Amylase IC50 data submitted for review.' });
insAct.run({ id: id(), project_id: p1, module_id: null, actor_id: supervisor.id, action: 'milestone_approved', detail: 'DPPH antioxidant assay approved.' });
insAct.run({ id: id(), project_id: p3, module_id: m_cyto, actor_id: students['Sumaiya Nasrin'], action: 'progress_updated', detail: 'MCF-7 plates completed; HepG2 in progress.' });
insAct.run({ id: id(), project_id: p4, module_id: null, actor_id: students['Imran Chowdhury'], action: 'submitted', detail: 'Manuscript draft v3 uploaded.' });

insComment.run({ id: id(), project_id: p1, module_id: m_dock, author_id: supervisor.id, body: 'The current docking uses an outdated receptor structure. Please redock against α-glucosidase (PDB 3W37) and report binding energies for the top three isolated compounds. Attach the pose images.', type: 'revision_request', resolved: 0 });
insComment.run({ id: id(), project_id: p1, module_id: m_dock, author_id: students['Tahmina Akter'], body: 'Understood. Re-running with 3W37 now — should the grid box be centred on the catalytic residues?', type: 'question', resolved: 0 });
insComment.run({ id: id(), project_id: p1, module_id: m_amyl, author_id: students['Tahmina Akter'], body: 'Submitted the α-amylase inhibition data with acarbose standard. IC50 = 142.6 µg/mL.', type: 'comment', resolved: 0 });
insComment.run({ id: id(), project_id: p3, module_id: m_cyto, author_id: supervisor.id, body: 'Good progress on MCF-7. Remember to include a vehicle control and run each concentration in triplicate.', type: 'comment', resolved: 0 });

insMeeting.run({ id: id(), project_id: p1, title: 'Monthly progress review — docking & in vivo planning', scheduled_at: daysFromNow(3) + 'T11:00', duration_min: 45, location: 'PI Office / Zoom', agenda: 'Review docking revision, plan ethical clearance for in vivo study.', status: 'scheduled', created_by: supervisor.id });
insMeeting.run({ id: id(), project_id: p2, title: 'Manuscript planning meeting', scheduled_at: daysFromNow(6) + 'T14:30', duration_min: 30, location: 'Lab Seminar Room', agenda: 'Outline manuscript and target journal.', status: 'scheduled', created_by: supervisor.id });
insMeeting.run({ id: id(), project_id: p3, title: 'Cytotoxicity data check-in', scheduled_at: daysFromNow(2) + 'T10:00', duration_min: 30, location: 'Cell Culture Lab', agenda: 'Review MTT results.', status: 'scheduled', created_by: supervisor.id });

insNotif.run({ id: id(), user_id: students['Tahmina Akter'], title: 'Revision requested', body: 'Prof. Rahman requested revisions on Molecular Docking.', link: `/app/projects/${p1}`, icon: 'alert', is_read: 0 });
insNotif.run({ id: id(), user_id: students['Tahmina Akter'], title: 'Upcoming meeting', body: 'Monthly progress review in 3 days.', link: `/app/projects/${p1}`, icon: 'calendar', is_read: 0 });
insNotif.run({ id: id(), user_id: supervisor.id, title: 'New submission', body: 'Tahmina Akter submitted α-Amylase assay for review.', link: `/app/projects/${p1}`, icon: 'inbox', is_read: 0 });
insNotif.run({ id: id(), user_id: supervisor.id, title: 'New submission', body: 'Rafiqul Islam submitted Analgesic Study for review.', link: `/app/projects/${p2}`, icon: 'inbox', is_read: 0 });
insNotif.run({ id: id(), user_id: supervisor.id, title: 'Manuscript draft uploaded', body: 'Imran Chowdhury uploaded manuscript draft v3.', link: `/app/projects/${p4}`, icon: 'doc', is_read: 1 });

// ---------- Knowledge Repository ----------
const insK = db.prepare(`INSERT INTO knowledge (id,title,category,tags,body,source_q,author_id,pinned) VALUES (@id,@title,@category,@tags,@body,@source_q,@author_id,@pinned)`);
const kb = [
  { title: 'SOP: DPPH Radical Scavenging Assay', category: 'SOP', tags: 'antioxidant,dpph,in vitro,assay', pinned: 1,
    body: '## Purpose\nDetermine the free-radical scavenging capacity of plant extracts.\n\n## Reagents\n- DPPH (0.1 mM in methanol)\n- Ascorbic acid (standard)\n\n## Procedure\n1. Prepare extract dilutions (e.g. 10–500 µg/mL).\n2. Mix 1 mL extract + 1 mL DPPH solution.\n3. Incubate 30 min in the dark at room temperature.\n4. Measure absorbance at 517 nm.\n5. % inhibition = [(A_control − A_sample)/A_control] × 100.\n6. Determine IC50 from the dose–response curve.\n\n## Notes\nAlways run in triplicate. Use methanol as blank.' },
  { title: 'SOP: α-Amylase Inhibition Assay (DNSA Method)', category: 'SOP', tags: 'antidiabetic,enzyme,in vitro', pinned: 0,
    body: '## Principle\nInhibition of α-amylase reduces starch hydrolysis, measured via reducing sugar with DNSA.\n\n## Procedure\n1. Pre-incubate extract with α-amylase (5 min, 37°C).\n2. Add 1% starch, incubate 10 min.\n3. Add DNSA reagent, boil 5 min.\n4. Read absorbance at 540 nm.\n5. Use acarbose as the positive control.' },
  { title: 'Molecular Docking Workflow (AutoDock Vina)', category: 'Tutorial', tags: 'computational,docking,vina,workflow', pinned: 1,
    body: '## Steps\n1. **Target preparation** — download PDB, remove water/heteroatoms, add polar H, assign charges (use AutoDockTools).\n2. **Ligand preparation** — optimise geometry, convert to PDBQT.\n3. **Grid box** — centre on the active site; note centre & size.\n4. **Docking** — run Vina; exhaustiveness ≥ 8.\n5. **Analysis** — record binding affinity (kcal/mol), visualise interactions in Discovery Studio / LigPlot+.\n\n## Reporting\nReport binding energy, key residues, H-bonds and π-interactions.' },
  { title: 'Thesis Structure & University Formatting Guide', category: 'Template', tags: 'thesis,writing,formatting', pinned: 0,
    body: '## Standard Structure\n1. Title page & declaration\n2. Abstract\n3. Introduction & literature review\n4. Aims & objectives\n5. Materials & methods\n6. Results\n7. Discussion\n8. Conclusion & future work\n9. References (Vancouver)\n10. Appendices\n\nLine spacing 1.5, Times New Roman 12pt, margins 1.5" left / 1" others.' },
  { title: 'Ethical Approval Checklist for In Vivo Studies', category: 'SOP', tags: 'in vivo,ethics,animal,iacuc', pinned: 0,
    body: '## Before any animal experiment\n- [ ] IACUC / ethical committee proposal submitted\n- [ ] Sample size justified (power analysis)\n- [ ] Humane endpoints defined\n- [ ] Acclimatisation period (≥7 days)\n- [ ] Approval number obtained and recorded\n\nNo in vivo module may move to *in_progress* without a recorded approval number.' },
  { title: 'FAQ: How do I calculate IC50 from inhibition data?', category: 'FAQ', tags: 'statistics,ic50,faq', pinned: 0,
    source_q: 'How do I calculate IC50 from my assay data?',
    body: 'Plot % inhibition (y) against log concentration (x) and fit a non-linear regression (sigmoidal dose–response, variable slope) in GraphPad Prism. IC50 is the concentration giving 50% inhibition. Ensure at least 5–6 concentrations bracketing 50% inhibition and run in triplicate.' },
  { title: 'Troubleshooting: Inconsistent DPPH readings', category: 'Troubleshooting', tags: 'antioxidant,dpph,troubleshooting', pinned: 0,
    source_q: 'My DPPH readings are inconsistent between replicates — why?',
    body: '**Common causes & fixes:**\n- DPPH degrades in light → prepare fresh, keep in amber bottle.\n- Temperature drift → keep incubation constant (RT, dark, 30 min).\n- Pipetting error at low volumes → use calibrated micropipettes.\n- Extract turbidity/colour interference → include a sample colour blank.\n- Methanol quality → use spectroscopic grade.' },
  { title: 'GC-MS Sample Preparation & Library Matching', category: 'Protocol', tags: 'gc-ms,analytical,volatile', pinned: 0,
    body: '## Preparation\n1. Dissolve essential oil/extract in n-hexane (HPLC grade).\n2. Filter through 0.22 µm.\n## Acquisition\nUse a standard temperature programme; split ratio per instrument SOP.\n## Identification\nMatch spectra against NIST library (match ≥ 85%). Confirm with retention index where possible.' },
  { title: 'Recommended Journals for Natural Product Pharmacology', category: 'Article', tags: 'publication,journals,manuscript', pinned: 0,
    body: '- Journal of Ethnopharmacology\n- Phytomedicine\n- Journal of Natural Products\n- BMC Complementary Medicine and Therapies\n- Frontiers in Pharmacology\n- Molecules\n\nMatch your scope and check the latest impact factor and APC before submission.' },
];
kb.forEach(k => insK.run({ id: id(), title: k.title, category: k.category, tags: k.tags, body: k.body, source_q: k.source_q || null, author_id: supervisor.id, pinned: k.pinned || 0 }));
console.log(`Inserted ${kb.length} knowledge entries.`);

console.log('\n✅ Seed complete.');
console.log('Logins:');
console.log('  Admin       admin@rsms.edu / admin123');
console.log('  Supervisor  supervisor@rsms.edu / super123');
console.log('  Student     tahmina@student.rsms.edu / student123');
