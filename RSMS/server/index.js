const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { init } = require('./db');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

init();

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Static frontend
const PUBLIC = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC));

// SPA fallback (non-API routes -> index.html)
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🧪 RSMS server running at http://localhost:${PORT}`);
});
