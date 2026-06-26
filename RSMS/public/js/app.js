// ============================================================
// App bootstrap & routing
// ============================================================

async function boot() {
  try {
    const me = await API.get('/auth/me');
    Store.user = me.user;
    Store.profile = me.profile;
  } catch (e) { Store.user = null; }

  // load notifications + catalog in background for logged in users
  if (Store.user) {
    API.get('/notifications').then(n => Store.notifications = n).catch(()=>{});
    API.get('/catalog').then(c => Store.catalog = c).catch(()=>{});
  }

  // Routes
  Router.on('/login', () => { if (Store.user) return Router.replace('/app'); renderLogin(); });
  Router.on('/', () => Router.replace(Store.user ? '/app' : '/login'));
  Router.on('/app', guard(renderDashboard));
  Router.on('/app/projects', guard(renderProjects));
  Router.on('/app/projects/:id', guard(renderProject));
  Router.on('/app/knowledge', guard(renderKnowledge));
  Router.on('/app/students', guard(renderStudents, ['supervisor','admin']));
  Router.on('/app/meetings', guard(renderMeetings));
  Router.on('/app/profile', guard(renderProfile));

  Router.start();
}

function guard(handler, roles) {
  return (params) => {
    if (!Store.user) return Router.replace('/login');
    if (roles && !roles.includes(Store.user.role)) return Router.replace('/app');
    return handler(params);
  };
}

boot();
