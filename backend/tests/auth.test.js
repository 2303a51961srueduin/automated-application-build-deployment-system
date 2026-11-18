const { createTestContext } = require('./helpers');

describe('authentication', () => {
  let context;
  beforeEach(() => { context = createTestContext(); });
  afterEach(() => context.db.close());

  test('registers a user without allowing role assignment', async () => {
    const response = await context.client.post('/api/auth/register').send({
      name: 'Taylor User',
      email: 'taylor@example.com',
      password: 'a-strong-password',
      role: 'admin',
    });
    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('user');
    expect(context.db.prepare('SELECT password_hash FROM users WHERE email = ?').get('taylor@example.com').password_hash).not.toBe('a-strong-password');
  });

  test('rejects invalid registration and duplicate email', async () => {
    expect((await context.client.post('/api/auth/register').send({ name: 'T', email: 'bad', password: 'short' })).status).toBe(400);
    const details = { name: 'Taylor User', email: 'admin@example.com', password: 'a-strong-password' };
    expect((await context.client.post('/api/auth/register').send(details)).status).toBe(409);
  });

  test('logs in, authenticates the session, and logs out', async () => {
    const login = await context.client.post('/api/auth/login').send({ email: 'admin@example.com', password: 'admin-password-123' });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
    expect((await context.client.get('/api/me')).body.user.role).toBe('admin');
    expect((await context.client.post('/api/auth/logout')).status).toBe(204);
    expect((await context.client.get('/api/me')).status).toBe(401);
  });

  test('requires a valid authenticated session and enforces admin authorization', async () => {
    expect((await context.client.get('/api/applications')).status).toBe(401);
    await context.client.post('/api/auth/register').send({
      name: 'Taylor User', email: 'taylor@example.com', password: 'a-strong-password',
    });
    await context.client.post('/api/auth/login').send({ email: 'taylor@example.com', password: 'a-strong-password' });
    expect((await context.client.get('/api/admin/stats')).status).toBe(403);
  });

  test('rejects login for a bad password', async () => {
    expect((await context.client.post('/api/auth/login').send({ email: 'admin@example.com', password: 'wrong-password' })).status).toBe(401);
  });
});
