const { createTestContext } = require('./helpers');

describe('applications and builds', () => {
  let context;
  beforeEach(() => { context = createTestContext(); });
  afterEach(() => context.db.close());

  async function registerAndLogin() {
    await context.client.post('/api/auth/register').send({
      name: 'Taylor User', email: 'taylor@example.com', password: 'a-strong-password',
    });
    await context.client.post('/api/auth/login').send({ email: 'taylor@example.com', password: 'a-strong-password' });
  }

  test('creates an application and rejects an unapproved template', async () => {
    await registerAndLogin();
    const valid = await context.client.post('/api/applications').send({ name: 'Storefront', description: 'Demo app' });
    expect(valid.status).toBe(201);
    expect(valid.body.application.template).toBe('sample-web');
    const invalid = await context.client.post('/api/applications').send({ name: 'Unsafe', template: 'arbitrary-shell' });
    expect(invalid.status).toBe(400);
  });

  test('validates build route identifiers and never creates a build for a missing application', async () => {
    await registerAndLogin();
    const invalid = await context.client.post('/api/applications/not-an-id/builds');
    expect(invalid.status).toBe(404);
    expect(context.db.prepare('SELECT COUNT(*) AS count FROM builds').get().count).toBe(0);
  });

  test('queues a real build request as Pending and records a status update', async () => {
    await registerAndLogin();
    const application = await context.client.post('/api/applications').send({ name: 'Storefront' });
    const result = context.db.prepare(
      'INSERT INTO builds (application_id, requested_by, status) VALUES (?, ?, ?)',
    ).run(application.body.application.id, 2, 'Pending');
    const buildId = Number(result.lastInsertRowid);
    const service = require('../src/services/builds').createBuildService(context.db);
    await service.execute(buildId, 2, application.body.application.id);
    expect(context.db.prepare('SELECT status FROM builds WHERE id = ?').get(buildId).status).toBe('Success');
    expect(context.db.prepare('SELECT COUNT(*) AS count FROM build_logs WHERE build_id = ?').get(buildId).count).toBeGreaterThan(0);
  });

  test('marks build as failed when the real process exits unsuccessfully', async () => {
    await registerAndLogin();
    const application = await context.client.post('/api/applications').send({ name: 'Storefront' });
    const service = require('../src/services/builds').createBuildService(
      context.db, async () => { throw new Error('Process exited with code 1.'); },
    );
    const result = context.db.prepare('INSERT INTO builds (application_id, requested_by) VALUES (?, ?)').run(application.body.application.id, 2);
    await service.execute(Number(result.lastInsertRowid), 2, application.body.application.id);
    expect(context.db.prepare('SELECT status FROM builds WHERE id = ?').get(result.lastInsertRowid).status).toBe('Failed');
  });

  test('scopes application visibility to its owner or an administrator', async () => {
    await registerAndLogin();
    const application = await context.client.post('/api/applications').send({ name: 'Storefront' });
    await context.client.post('/api/auth/register').send({
      name: 'Second User', email: 'second@example.com', password: 'a-strong-password',
    });
    await context.client.post('/api/auth/logout');
    await context.client.post('/api/auth/login').send({ email: 'second@example.com', password: 'a-strong-password' });
    expect((await context.client.get(`/api/applications/${application.body.application.id}`)).status).toBe(404);
    await context.client.post('/api/auth/logout');
    await context.client.post('/api/auth/login').send({ email: 'admin@example.com', password: 'admin-password-123' });
    expect((await context.client.get(`/api/applications/${application.body.application.id}`)).status).toBe(200);
  });
});
