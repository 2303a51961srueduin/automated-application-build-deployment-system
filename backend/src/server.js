const { getConfig } = require('./config');
const { createApp } = require('./app');

const config = getConfig();
const { app, db } = createApp({ config });
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
