const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { createDatabase } = require('./db/database');
const { authRouter } = require('./routes/auth');
const { apiRouter } = require('./routes/api');

function createApp(options = {}) {
  const config = options.config;
  const db = options.db || createDatabase(config.databasePath);
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use((req, _res, next) => {
    req.db = db;
    next();
  });
  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      return res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    } catch (error) {
      return res.status(503).json({ status: 'error', database: 'unavailable', error: error.message });
    }
  });
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }), authRouter(config));
  const api = apiRouter(config, db);
  app.use('/api', api);
  app.use(express.static(path.resolve(__dirname, '../../frontend/dist')));
  app.get('*path', (_req, res) => {
    res.sendFile(path.resolve(__dirname, '../../frontend/dist/index.html'), (error) => {
      if (error) res.status(404).json({ error: 'Frontend assets are not built. Run npm run build.' });
    });
  });
  app.use((error, _req, res, _next) => {
    if (res.headersSent) return;
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error(error);
    return res.status(status).json({ error: status >= 500 ? 'An unexpected server error occurred.' : error.message });
  });
  return { app, db };
}

module.exports = { createApp };
