const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function getConfig() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters.');
  }

  const projectRoot = path.resolve(__dirname, '../..');
  const configuredDatabasePath = process.env.DATABASE_PATH || path.join('data', 'app.sqlite');
  const databasePath = configuredDatabasePath === ':memory:'
    ? configuredDatabasePath
    : path.isAbsolute(configuredDatabasePath)
      ? configuredDatabasePath
      : path.resolve(projectRoot, configuredDatabasePath);
  return {
    port: Number(process.env.PORT || 4000),
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    databasePath,
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

module.exports = { getConfig };
