const bcrypt = require('bcryptjs');
const { z } = require('zod');

const adminConfigSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
});

const adminEnvironmentKeys = ['ADMIN_NAME', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];

function getAdminConfig(env) {
  if (adminEnvironmentKeys.every((key) => env[key] === undefined)) return null;

  const result = adminConfigSchema.safeParse({
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  });
  if (!result.success) {
    throw new Error(
      'Initial admin configuration is incomplete or invalid. Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD; use a 2-80 character name, valid email and 10-128 character password.',
    );
  }
  return result.data;
}

function createInitialAdmin(db, env = process.env) {
  const config = getAdminConfig(env);
  if (!config) return 'skipped';

  const createIfMissing = db.transaction(() => {
    const existing = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE')
      .get(config.email);
    if (existing) return 'existing';

    const passwordHash = bcrypt.hashSync(config.password, 12);
    db.prepare(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
    ).run(config.name, config.email, passwordHash);
    return 'created';
  });

  return createIfMissing.immediate();
}

module.exports = { createInitialAdmin };
