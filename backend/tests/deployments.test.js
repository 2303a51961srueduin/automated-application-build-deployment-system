const { createDeploymentService } = require('../src/services/builds');
const { createTestContext } = require('./helpers');

describe('deployment service', () => {
  let context;
  beforeEach(() => { context = createTestContext(); });
  afterEach(() => context.db.close());

  test('requires a successful build before it can queue deployment', () => {
    const application = context.db.prepare(
      'INSERT INTO applications (owner_id, name, template) VALUES (?, ?, ?)',
    ).run(context.adminId, 'Demo', 'sample-web');
    const service = createDeploymentService(context.db, async () => {});
    expect(() => service.request(Number(application.lastInsertRowid), context.adminId))
      .toThrow('A successful build is required before deployment.');
    expect(context.db.prepare('SELECT COUNT(*) AS count FROM deployments').get().count).toBe(0);
  });

  test('stops only the generated managed container and records its status', async () => {
    const application = context.db.prepare(
      'INSERT INTO applications (owner_id, name, template) VALUES (?, ?, ?)',
    ).run(context.adminId, 'Demo', 'sample-web');
    const build = context.db.prepare(
      "INSERT INTO builds (application_id, requested_by, status, image_tag) VALUES (?, ?, 'Success', ?)",
    ).run(application.lastInsertRowid, context.adminId, 'devops-app-1:build-1');
    const deployment = context.db.prepare(
      "INSERT INTO deployments (application_id, build_id, requested_by, status, container_name) VALUES (?, ?, ?, 'Success', ?)",
    ).run(application.lastInsertRowid, build.lastInsertRowid, context.adminId, 'devops-app-1-deployment');
    const commands = [];
    const service = createDeploymentService(context.db, async (command, args) => commands.push([command, args]));

    const stopped = await service.stop(Number(deployment.lastInsertRowid), context.adminId);

    expect(commands).toEqual([['docker', ['stop', 'devops-app-1-deployment']]]);
    expect(stopped.status).toBe('Stopped');
    expect(context.db.prepare('SELECT action FROM activity_logs ORDER BY id DESC LIMIT 1').get().action)
      .toBe('deployment.stopped');
  });
});
