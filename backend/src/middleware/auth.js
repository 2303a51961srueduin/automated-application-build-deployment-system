const jwt = require('jsonwebtoken');

function createAuth(config) {
  function requireAuth(req, res, next) {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const user = req.db.prepare('SELECT id, name, email, role, active FROM users WHERE id = ?').get(payload.sub);
      if (!user || !user.active) return res.status(401).json({ error: 'Account is unavailable.' });
      req.user = user;
      return next();
    } catch (error) {
      if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') return next(error);
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }
  }

  function requireRole(role) {
    return (req, res, next) => {
      if (req.user?.role !== role) return res.status(403).json({ error: 'Administrator access required.' });
      return next();
    };
  }

  return { requireAuth, requireRole };
}

module.exports = { createAuth };
