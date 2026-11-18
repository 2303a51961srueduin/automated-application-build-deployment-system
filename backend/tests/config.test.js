const { getConfig } = require('../src/config');

describe('runtime configuration', () => {
  test('preserves SQLite in-memory paths for isolated runtime checks', () => {
    const original = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = ':memory:';
    try {
      expect(getConfig().databasePath).toBe(':memory:');
    } finally {
      if (original === undefined) delete process.env.DATABASE_PATH;
      else process.env.DATABASE_PATH = original;
    }
  });
});
