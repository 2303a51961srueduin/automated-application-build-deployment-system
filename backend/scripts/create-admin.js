const bcrypt = require('bcryptjs');
const { getConfig } = require('../src/config');
const { createDatabase } = require('../src/db/database');

const [, , name, email, password] = process.argv;
if (!name || !email || !password || password.length < 10) {
  console.error('Usage: npm run create-admin -- "Admin Name" admin@example.com "password-at-least-10-chars"');
  process.exit(1);
}
const config = getConfig();
const db = createDatabase(config.databasePath);
try {
  db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
  ).run(name, email, bcrypt.hashSync(password, 12));
  console.log(`Administrator account created for ${email}.`);
} catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    console.error('An account with that email already exists.');
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  db.close();
}
