const { spawn } = require('node:child_process');

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let settled = false;
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      if (!settled) {
        settled = true;
        reject(new Error(`Process timed out after ${options.timeoutMs || 300000}ms.`));
      }
    }, options.timeoutMs || 300000);
    timer.unref();
    child.stdout.on('data', (chunk) => options.onOutput?.('stdout', chunk.toString()));
    child.stderr.on('data', (chunk) => options.onOutput?.('stderr', chunk.toString()));
    child.once('error', (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code === 0) resolve();
      else reject(new Error(`Process exited with ${signal ? `signal ${signal}` : `code ${code}`}.`));
    });
  });
}

module.exports = { runProcess };
