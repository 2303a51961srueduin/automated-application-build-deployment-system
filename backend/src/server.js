const { getConfig } = require('./config');
const { createApp } = require('./app');
const { createInitialAdmin } = require('./services/initial-admin');

const config = getConfig();
const { app, db } = createApp({ config });
try {
  const adminStatus = createInitialAdmin(db);
  if (adminStatus === 'created') {
    console.log('Initial administrator account created.');
  } else if (adminStatus === 'existing') {
    console.log('Initial administrator email already exists; the account was left unchanged.');
  }
} catch (error) {
  db.close();
  throw error;
}
const server = app.listen(config.port, () => {
  console.log(`DevOps Build System listening on port ${config.port}.`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
