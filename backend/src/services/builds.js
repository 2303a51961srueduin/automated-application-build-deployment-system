const path = require('node:path');
const { runProcess } = require('./process-runner');
const { recordActivity } = require('./activity');

const APP_ROOT = path.resolve(__dirname, '../../../apps/sample-web');

function createBuildService(db, runner = runProcess) {
  function log(buildId, stream, message) {
    const text = message.toString().slice(0, 4000);
    db.prepare('INSERT INTO build_logs (build_id, stream, message) VALUES (?, ?, ?)').run(buildId, stream, text);
  }

  async function execute(buildId, requesterId, applicationId) {
    const imageTag = `devops-app-${applicationId}:build-${buildId}`;
    db.prepare("UPDATE builds SET status = 'Running', started_at = CURRENT_TIMESTAMP, image_tag = ? WHERE id = ?")
      .run(imageTag, buildId);
    log(buildId, 'system', 'Running the reviewed sample-web build script with Node.js.');
    try {
      await runner(process.execPath, [path.join(APP_ROOT, 'scripts', 'build.js')], {
        cwd: APP_ROOT,
        timeoutMs: 120000,
        onOutput: (stream, message) => log(buildId, stream, message),
      });
      db.prepare("UPDATE builds SET status = 'Success', finished_at = CURRENT_TIMESTAMP WHERE id = ?").run(buildId);
      log(buildId, 'system', 'Build completed successfully; the application build script exited with code 0.');
      recordActivity(db, requesterId, 'build.succeeded', { buildId, applicationId });
    } catch (error) {
      db.prepare("UPDATE builds SET status = 'Failed', finished_at = CURRENT_TIMESTAMP WHERE id = ?").run(buildId);
      log(buildId, 'system', `Build failed: ${error.message}`);
      recordActivity(db, requesterId, 'build.failed', { buildId, applicationId, reason: error.message });
    }
  }

  function request(applicationId, userId) {
    const result = db.prepare(
      'INSERT INTO builds (application_id, requested_by, status) VALUES (?, ?, ?)',
    ).run(applicationId, userId, 'Pending');
    const buildId = Number(result.lastInsertRowid);
    setImmediate(() => execute(buildId, userId, applicationId));
    recordActivity(db, userId, 'build.requested', { buildId, applicationId });
    return db.prepare('SELECT * FROM builds WHERE id = ?').get(buildId);
  }

  return { request, execute };
}

function createDeploymentService(db, runner = runProcess) {
  const activeByApplication = new Set();
  async function execute(deploymentId, build) {
    const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
    const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(deployment.application_id);
    const imageTag = build.image_tag;
    db.prepare("UPDATE deployments SET status = 'Running', started_at = CURRENT_TIMESTAMP WHERE id = ?").run(deploymentId);
    db.prepare('INSERT INTO build_logs (build_id, stream, message) VALUES (?, ?, ?)')
      .run(build.id, 'system', `Building Docker image ${imageTag} for deployment.`);
    let containerStarted = false;
    const log = (stream, message) => db.prepare(
      'INSERT INTO build_logs (build_id, stream, message) VALUES (?, ?, ?)',
    ).run(build.id, stream, message.toString().slice(0, 4000));

    try {
      await runner('docker', ['build', '--tag', imageTag, APP_ROOT], {
        timeoutMs: 600000,
        onOutput: log,
      });
      const containerName = deployment.container_name;
      const containerOutput = [];
      await runner('docker', [
        'run', '--detach', '--rm', '--name', containerName, '--publish',
        `127.0.0.1::80`, '--label', 'managed-by=devops-build-system', imageTag,
      ], { timeoutMs: 60000, onOutput: (stream, message) => {
        containerOutput.push(message);
        log(stream, message);
      } });
      containerStarted = true;
      const containerId = containerOutput.join('').trim().split(/\s+/)[0];
      if (!/^[a-f0-9]{12,64}$/i.test(containerId || '')) {
        throw new Error('Docker did not return a valid container ID.');
      }
      let healthStatus = '';
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const healthOutput = [];
        await runner('docker', ['inspect', '--format', '{{.State.Health.Status}}', containerName], {
          timeoutMs: 15000,
          onOutput: (_stream, message) => healthOutput.push(message),
        });
        healthStatus = healthOutput.join('').trim();
        if (healthStatus === 'healthy') break;
        if (healthStatus === 'unhealthy') throw new Error('The deployed container failed its Docker health check.');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (healthStatus !== 'healthy') throw new Error('The deployed container did not become healthy in time.');
      const portOutput = [];
      await runner('docker', ['port', containerName, '80/tcp'], {
        timeoutMs: 15000,
        onOutput: (_stream, message) => portOutput.push(message),
      });
      const portMatch = portOutput.join('').match(/127\.0\.0\.1:(\d+)/);
      if (!portMatch) throw new Error('Docker did not return a loopback host port for the container.');
      db.prepare(
        "UPDATE deployments SET status = 'Success', container_id = ?, url = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(containerId, `http://localhost:${portMatch[1]}`, deploymentId);
      log('system', `Deployment for ${application.name} is running at http://localhost:${portMatch[1]}.`);
    } catch (error) {
      if (containerStarted) {
        try {
          await runner('docker', ['rm', '--force', deployment.container_name], { timeoutMs: 30000 });
        } catch (cleanupError) {
          log('system', `Container cleanup failed: ${cleanupError.message}`);
        }
      }
      db.prepare("UPDATE deployments SET status = 'Failed', finished_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(deploymentId);
      log('system', `Deployment failed: ${error.message}`);
    } finally {
      activeByApplication.delete(deployment.application_id);
    }
  }

  function request(applicationId, userId) {
    if (activeByApplication.has(applicationId)) {
      const error = new Error('A deployment for this application is already running.');
      error.status = 409;
      throw error;
    }
    const activeDeployment = db.prepare(
      "SELECT id FROM deployments WHERE application_id = ? AND status IN ('Pending', 'Running', 'Success') ORDER BY id DESC LIMIT 1",
    ).get(applicationId);
    if (activeDeployment) {
      const error = new Error('Stop the current deployment before starting another one.');
      error.status = 409;
      throw error;
    }
    const build = db.prepare(
      "SELECT * FROM builds WHERE application_id = ? AND status = 'Success' ORDER BY id DESC LIMIT 1",
    ).get(applicationId);
    if (!build) {
      const error = new Error('A successful build is required before deployment.');
      error.status = 409;
      throw error;
    }
    const result = db.prepare(
      'INSERT INTO deployments (application_id, build_id, requested_by, container_name) VALUES (?, ?, ?, ?)',
    ).run(applicationId, build.id, userId, `devops-app-${applicationId}-deployment`);
    const deploymentId = Number(result.lastInsertRowid);
    activeByApplication.add(applicationId);
    setImmediate(() => execute(deploymentId, build));
    recordActivity(db, userId, 'deployment.requested', { deploymentId, applicationId });
    return db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
  }

  async function stop(deploymentId, operatorId) {
    const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
    if (!deployment || deployment.status !== 'Success') {
      const error = new Error('Only a running deployment can be stopped.');
      error.status = 409;
      throw error;
    }
    try {
      await runner('docker', ['stop', deployment.container_name], { timeoutMs: 30000 });
      db.prepare("UPDATE deployments SET status = 'Stopped', finished_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(deploymentId);
      db.prepare('INSERT INTO build_logs (build_id, stream, message) VALUES (?, ?, ?)')
        .run(deployment.build_id, 'system', `Container ${deployment.container_name} was stopped.`);
      recordActivity(db, operatorId, 'deployment.stopped', { deploymentId });
      return db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
    } catch (error) {
      db.prepare('INSERT INTO build_logs (build_id, stream, message) VALUES (?, ?, ?)')
        .run(deployment.build_id, 'system', `Could not stop container: ${error.message}`.slice(0, 4000));
      throw error;
    }
  }

  return { request, execute, stop };
}

module.exports = { createBuildService, createDeploymentService };
