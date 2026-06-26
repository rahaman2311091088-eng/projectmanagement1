function renderLogin() {
  document.getElementById('app').innerHTML = `
  <div style="min-height:100vh;display:grid;grid-template-columns:1fr 1fr">
    <div style="background:linear-gradient(150deg,#5b4ce0,#8b5cf6 55%,#a78bfa);color:#fff;padding:56px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;opacity:.12;background-image:radial-gradient(circle at 20% 30%,#fff 1px,transparent 1px),radial-gradient(circle at 70% 70%,#fff 1px,transparent 1px);background-size:40px 40px"></div>
      <div class="row" style="gap:12px;position:relative">
        <div style="width:40px;height:40px;border-radius:11px;background:rgba(255,255,255,.18);display:grid;place-items:center;backdrop-filter:blur(8px)">${icon('flask', 22)}</div>
        <div><div style="font-weight:800;font-size:18px">RSMS</div><div style="font-size:12px;opacity:.85">Research Supervision Management</div></div>
      </div>
      <div style="position:relative;max-width:440px">
        <h1 style="font-size:34px;font-weight:800;letter-spacing:-.03em;line-height:1.15;margin-bottom:18px">A complete research operating system for pharmaceutical labs.</h1>
        <p style="opacity:.9;font-size:15px;line-height:1.6">Manage multidisciplinary projects — from medicinal plant extraction and in vitro bioassays to in vivo studies, molecular docking and thesis submission — in one structured workspace.</p>
        <div style="display:flex;gap:10px;margin-top:28px;flex-wrap:wrap">
          ${['Modular workflows','In vitro · In vivo · In silico','Knowledge repository','Progress tracking'].map(t => `<span style="padding:6px 12px;border-radius:100px;background:rgba(255,255,255,.15);font-size:12.5px;font-weight:600;backdrop-filter:blur(8px)">${t}</span>`).join('')}
        </div>
      </div>
      <div style="position:relative;font-size:12.5px;opacity:.8">Standardized supervision · Methodological consistency · Complete records</div>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;padding:32px;background:var(--bg)">
      <div style="width:100%;max-width:380px">
        <h2 style="font-size:24px;font-weight:700;letter-spacing:-.02em">Welcome back</h2>
        <p class="muted" style="margin:6px 0 28px">Sign in to your research workspace.</p>
        <form id="loginForm">
          <div class="field"><label class="label">Email</label><input class="input" type="email" name="email" placeholder="you@rsms.edu" required></div>
          <div class="field"><label class="label">Password</label><input class="input" type="password" name="password" placeholder="••••••••" required></div>
          <div id="loginErr" class="text-sm" style="color:var(--danger);margin-bottom:12px;display:none"></div>
          <button class="btn btn-primary" type="submit" style="width:100%;padding:11px" id="loginBtn">Sign in</button>
        </form>
        <div class="divider"></div>
        <div class="text-xs tertiary mb-1 fw-600" style="text-transform:uppercase;letter-spacing:.04em">Demo accounts — click to fill</div>
        <div class="col gap-sm">
          ${[['Supervisor','supervisor@rsms.edu','super123','#7c3aed'],['PhD Student','tahmina@student.rsms.edu','student123','#ef4444'],['Administrator','admin@rsms.edu','admin123','#0ea5e9']].map(([r,e,p,c]) => `
          <div class="card card-hover" style="padding:10px 12px;display:flex;align-items:center;gap:10px" data-demo="${e}|${p}">
            ${avatar(r, c, 'sm')}<div class="col"><span class="text-sm fw-600">${r}</span><span class="text-xs tertiary mono">${e}</span></div>
            <span class="spacer"></span>${icon('chevronRight', 16, 'tertiary')}
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;

  document.querySelectorAll('[data-demo]').forEach(el => el.onclick = () => {
    const [e, p] = el.dataset.demo.split('|');
    document.querySelector('[name=email]').value = e;
    document.querySelector('[name=password]').value = p;
  });

  document.getElementById('loginForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = document.getElementById('loginBtn'); const err = document.getElementById('loginErr');
    btn.disabled = true; btn.textContent = 'Signing in…'; err.style.display = 'none';
    try {
      const fd = new FormData(ev.target);
      const data = await API.post('/auth/login', { email: fd.get('email'), password: fd.get('password') });
      Store.user = data.user;
      Router.go('/app');
    } catch (e) {
      err.textContent = e.message; err.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  };
}
