const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const { recordActivity } = require('../services/activity');

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
});
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

function authRouter(config) {
  const router = express.Router();
  const cookieOptions = {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/',
  };

  router.post('/register', validate(registerSchema), (req, res, next) => {
    const { name, email, password } = req.body;
    try {
      const passwordHash = bcrypt.hashSync(password, 12);
      const result = req.db.prepare(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      ).run(name, email, passwordHash);
      recordActivity(req.db, Number(result.lastInsertRowid), 'user.registered');
      return res.status(201).json({ user: req.db.prepare(
        'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      ).get(result.lastInsertRowid) });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
      return next(error);
    }
  });

  router.post('/login', validate(loginSchema), (req, res) => {
    const { email, password } = req.body;
    const user = req.db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
    if (!user || !user.active || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    res.cookie('access_token', token, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });
    recordActivity(req.db, user.id, 'user.login');
    return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie('access_token', cookieOptions);
    return res.status(204).end();
  });

  return router;
}

module.exports = { authRouter };
