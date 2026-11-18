# GitHub Actions CI/CD

## Continuous integration

`.github/workflows/ci.yml` runs for pull requests and pushes to `main`/`master`. It checks out the source, configures Node.js 22 with npm caching, runs `npm ci`, lint, Jest/Supertest, the Vite production build, and `docker build`.

The test job uses a test-only JWT secret and in-memory database. It does not need application credentials or a Docker daemon. The image-build step validates the Dockerfile; it does not deploy the image.

## Deployment handoff

`.github/workflows/deploy.yml` is manually triggered from the commit/branch selected in GitHub. It builds an image tagged with that immutable commit SHA, streams it to the Docker host over SSH, replaces the managed app container, then polls the container health check. Configure `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and the verified `DEPLOY_KNOWN_HOSTS` entry as `production` environment secrets and require reviewers for the environment.

Prepare `/etc/devops-build-system.env` on the host with a unique `JWT_SECRET`, `NODE_ENV=production`, `PORT=4000`, `COOKIE_SECURE=true` when TLS is terminated in front, `DATABASE_PATH=/app/data/app.sqlite`, and `DOCKER_HOST=unix:///var/run/docker.sock`. The deployment workflow uses pinned host keys; populate `DEPLOY_KNOWN_HOSTS` from a trusted source rather than running `ssh-keyscan` in the workflow. Restrict the SSH key to this deployment host and require protected environment approval.

## Suggested extension

For larger installations, publish a versioned image to a private registry and use a deployment agent, orchestration platform, or a Compose-based rollout with explicit rollback. Restrict key scope and verify health before marking rollout complete.
