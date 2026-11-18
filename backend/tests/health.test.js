const { createTestContext } = require('./helpers');

describe('health endpoint', () => {
  let context;
  beforeEach(() => { context = createTestContext(); });
  afterEach(() => context.db.close());

  test('reports the API and SQLite connection as healthy', async () => {
    const response = await context.client.get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('connected');
  });
});
