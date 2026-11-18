const bcrypt = require('bcryptjs');
const { createDatabase } = require('../src/db/database');
const { createInitialAdmin } = require('../src/services/initial-admin');

describe('initial admin bootstrap', () => {
  let db;

  beforeEach(() => {
    db = createDatabase(':memory:');
  });

  afterEach(() => db.close());

  const adminEnv = {
    ADMIN_NAME: 'Initial Admin',
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD: 'a-strong-admin-password',
  };

  test('does nothing when no bootstrap environment variables are configured', () => {
    expect(createInitialAdmin(db, {})).toBe('skipped');
    expect(db.prepare('SELECT COUNT(*) AS count FROM users').get().count).toBe(0);
  });

  test('rejects partial or invalid configuration without including values in the error', () => {
    expect(() => createInitialAdmin(db, {
      ADMIN_EMAIL: adminEnv.ADMIN_EMAIL,
      ADMIN_PASSWORD: adminEnv.ADMIN_PASSWORD,
    })).toThrow(/ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD/);

    expect(() => createInitialAdmin(db, {
      ...adminEnv,
      ADMIN_PASSWORD: 'short',
    })).toThrow(/10-128 character password/);
    expect(db.prepare('SELECT COUNT(*) AS count FROM users').get().count).toBe(0);
  });

  test('creates an admin after schema initialization with the existing bcrypt hash settings', () => {
    expect(createInitialAdmin(db, adminEnv)).toBe('created');

    const user = db.prepare('SELECT name, email, password_hash, role FROM users WHERE email = ?')
      .get(adminEnv.ADMIN_EMAIL);
    expect(user.name).toBe(adminEnv.ADMIN_NAME);
    expect(user.role).toBe('admin');
    expect(user.password_hash).not.toBe(adminEnv.ADMIN_PASSWORD);
    expect(bcrypt.compareSync(adminEnv.ADMIN_PASSWORD, user.password_hash)).toBe(true);
  });

  test('is idempotent and never changes an existing account or password', () => {
    const originalHash = bcrypt.hashSync('existing-student-password', 4);
    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run('Existing Student', 'ADMIN@example.com', originalHash, 'user');

    expect(createInitialAdmin(db, adminEnv)).toBe('existing');

    const existing = db.prepare('SELECT name, email, password_hash, role FROM users WHERE email = ?')
      .get(adminEnv.ADMIN_EMAIL);
    expect(existing).toEqual({
      name: 'Existing Student',
      email: 'ADMIN@example.com',
      password_hash: originalHash,
      role: 'user',
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM users').get().count).toBe(1);
  });
});
