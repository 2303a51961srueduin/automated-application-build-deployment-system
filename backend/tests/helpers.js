process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
process.env.DATABASE_PATH = ':memory:';

const bcrypt = require('bcryptjs');
const request = require('supertest');
const { createDatabase } = require('../src/db/database');
const { createApp } = require('../src/app');

const config = {
  port: 4000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: '1h',
  cookieSecure: false,
  databasePath: ':memory:',
  nodeEnv: 'test',
};

function createTestContext() {
  const db = createDatabase(':memory:');
  const { app } = createApp({ config, db });
  const admin = db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
  ).run('Admin User', 'admin@example.com', bcrypt.hashSync('admin-password-123', 4));
  return { db, app, adminId: Number(admin.lastInsertRowid), client: request.agent(app) };
}

module.exports = { createTestContext };
