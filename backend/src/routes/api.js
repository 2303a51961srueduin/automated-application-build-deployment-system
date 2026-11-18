const express = require('express');
const { z } = require('zod');
const { createAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { recordActivity } = require('../services/activity');
const { createBuildService, createDeploymentService } = require('../services/builds');

const appSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(''),
  template: z.literal('sample-web').default('sample-web'),
});
const userUpdateSchema = z.object({
  role: z.enum(['admin', 'user']),
  active: z.boolean(),
});

function apiRouter(config, db) {
  const router = express.Router();
  router.db = db;
  const { requireAuth, requireRole } = createAuth(config);
  router.use(requireAuth);
  const buildService = createBuildService(router.db);
  const deploymentService = createDeploymentService(router.db);

  const appQuery = `SELECT a.*, u.name AS owner_name,
    (SELECT COUNT(*) FROM builds b WHERE b.application_id = a.id) AS build_count,
    (SELECT status FROM builds b WHERE b.application_id = a.id ORDER BY b.id DESC LIMIT 1) AS latest_build_status,
    (SELECT status FROM deployments d WHERE d.application_id = a.id ORDER BY d.id DESC LIMIT 1) AS latest_deployment_status
    FROM applications a JOIN users u ON u.id = a.owner_id`;
  function visibleApplication(req, res, next) {
    const app = router.db.prepare(`${appQuery} WHERE a.id = ?`).get(req.params.id);
    if (!app || (req.user.role !== 'admin' && app.owner_id !== req.user.id)) {
      return res.status(404).json({ error: 'Application not found.' });
    }
    req.application = app;
    return next();
  }

  router.get('/me', (req, res) => res.json({ user: req.user }));
  router.get('/applications', (req, res) => {
    const rows = req.user.role === 'admin'
      ? router.db.prepare(`${appQuery} ORDER BY a.created_at DESC`).all()
      : router.db.prepare(`${appQuery} WHERE a.owner_id = ? ORDER BY a.created_at DESC`).all(req.user.id);
    return res.json({ applications: rows });
  });
  router.post('/applications', validate(appSchema), (req, res) => {
    const { name, description, template } = req.body;
    const result = router.db.prepare(
      'INSERT INTO applications (owner_id, name, description, template) VALUES (?, ?, ?, ?)',
    ).run(req.user.id, name, description, template);
    recordActivity(router.db, req.user.id, 'application.created', { applicationId: result.lastInsertRowid });
    return res.status(201).json({ application: router.db.prepare(
      `${appQuery} WHERE a.id = ?`,
    ).get(result.lastInsertRowid) });
  });
  router.get('/applications/:id', visibleApplication, (req, res) => res.json({ application: req.application }));
  router.post('/applications/:id/builds', visibleApplication, (req, res) => {
    const build = buildService.request(req.application.id, req.user.id);
    return res.status(202).json({ build });
  });
  router.post('/applications/:id/deployments', visibleApplication, (req, res, next) => {
    try {
      const deployment = deploymentService.request(req.application.id, req.user.id);
      return res.status(202).json({ deployment });
    } catch (error) {
      return next(error);
    }
  });
  router.get('/builds', (req, res) => {
    const query = `SELECT b.*, a.name AS application_name, u.name AS requested_by_name
      FROM builds b JOIN applications a ON a.id = b.application_id JOIN users u ON u.id = b.requested_by`;
    const builds = req.user.role === 'admin'
      ? router.db.prepare(`${query} ORDER BY b.created_at DESC LIMIT 200`).all()
      : router.db.prepare(`${query} WHERE a.owner_id = ? ORDER BY b.created_at DESC LIMIT 200`).all(req.user.id);
    return res.json({ builds });
  });
  router.get('/builds/:id/logs', (req, res) => {
    const build = router.db.prepare(
      'SELECT b.id, a.owner_id FROM builds b JOIN applications a ON a.id = b.application_id WHERE b.id = ?',
    ).get(req.params.id);
    if (!build || (req.user.role !== 'admin' && build.owner_id !== req.user.id)) {
      return res.status(404).json({ error: 'Build not found.' });
    }
    const logs = router.db.prepare('SELECT * FROM build_logs WHERE build_id = ? ORDER BY id').all(build.id);
    return res.json({ logs });
  });
  router.get('/deployments', (req, res) => {
    const query = `SELECT d.*, a.name AS application_name, u.name AS requested_by_name
      FROM deployments d JOIN applications a ON a.id = d.application_id JOIN users u ON u.id = d.requested_by`;
    const deployments = req.user.role === 'admin'
      ? router.db.prepare(`${query} ORDER BY d.created_at DESC LIMIT 200`).all()
      : router.db.prepare(`${query} WHERE a.owner_id = ? ORDER BY d.created_at DESC LIMIT 200`).all(req.user.id);
    return res.json({ deployments });
  });
  router.post('/deployments/:id/stop', (req, res, next) => {
    const deployment = router.db.prepare(
      'SELECT d.id, a.owner_id FROM deployments d JOIN applications a ON a.id = d.application_id WHERE d.id = ?',
    ).get(req.params.id);
    if (!deployment || (req.user.role !== 'admin' && deployment.owner_id !== req.user.id)) {
      return res.status(404).json({ error: 'Deployment not found.' });
    }
    deploymentService.stop(deployment.id, req.user.id)
      .then((stopped) => res.json({ deployment: stopped }))
      .catch(next);
  });

  router.get('/admin/stats', requireRole('admin'), (_req, res) => {
    const total = (sql) => router.db.prepare(sql).get().count;
    return res.json({
      stats: {
        users: total('SELECT COUNT(*) AS count FROM users'),
        applications: total('SELECT COUNT(*) AS count FROM applications'),
        builds: total('SELECT COUNT(*) AS count FROM builds'),
        successfulBuilds: total("SELECT COUNT(*) AS count FROM builds WHERE status = 'Success'"),
        failedBuilds: total("SELECT COUNT(*) AS count FROM builds WHERE status = 'Failed'"),
        deployments: total('SELECT COUNT(*) AS count FROM deployments'),
        successfulDeployments: total("SELECT COUNT(*) AS count FROM deployments WHERE status = 'Success'"),
      },
    });
  });
  router.get('/admin/users', requireRole('admin'), (_req, res) => {
    const users = router.db.prepare(
      `SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
      (SELECT COUNT(*) FROM applications a WHERE a.owner_id = u.id) AS application_count
      FROM users u ORDER BY u.created_at DESC`,
    ).all();
    return res.json({ users });
  });
  router.patch('/admin/users/:id', requireRole('admin'), validate(userUpdateSchema), (req, res) => {
    const target = router.db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.id === req.user.id && (!req.body.active || req.body.role !== 'admin')) {
      return res.status(400).json({ error: 'You cannot deactivate or demote your own account.' });
    }
    router.db.prepare('UPDATE users SET role = ?, active = ? WHERE id = ?')
      .run(req.body.role, Number(req.body.active), target.id);
    recordActivity(router.db, req.user.id, 'admin.user.updated', { userId: target.id, ...req.body });
    return res.json({ message: 'User updated.' });
  });
  router.get('/admin/activity', requireRole('admin'), (_req, res) => {
    const activities = router.db.prepare(
      `SELECT l.*, u.name AS user_name FROM activity_logs l
      LEFT JOIN users u ON u.id = l.user_id ORDER BY l.id DESC LIMIT 100`,
    ).all();
    return res.json({ activities });
  });

  return router;
}

module.exports = { apiRouter };
