# Automated Application Build and Deployment System

A course-ready, full-stack DevOps project demonstrating secure user access, SQLite persistence, real application builds, Docker deployment, monitoring, and GitHub Actions CI.

## What is implemented

- React dashboard with separate sign-in, registration, user, and admin experiences.
- Express API with password hashing, signed JWT sessions in HTTP-only cookies, input validation, rate limiting, and role-based authorization.
- SQLite tables for users, applications, builds, deployments, build logs, and activity logs.
- A fixed, reviewed `sample-web` template. A build runs its actual Node.js build script; a deployment builds its Docker image and starts a loopback-only container. No user-supplied shell commands or repository URLs are accepted.
- Periodic dashboard refresh, build output, status history, platform metrics, and account management.
- Docker Compose, persistent database volume, health check, and GitHub Actions CI.
- Optional idempotent initial administrator bootstrap from startup environment variables.

## Quick start (local development)

Requirements: Node.js 22+, npm, and Docker Engine/Desktop for actual deployment operations.

```powershell
Copy-Item .env.example .env
# Generate a secret, then set JWT_SECRET in .env to the output.
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm ci
npm run lint
npm test
npm run dev
```

The React dev server is at <http://localhost:5173> and the API is at <http://localhost:4000>. Register a user, then create an application and start a build. Build status is based on the real build process exit code. The local process runs the fixed sample build script. Deploying a container requires the Docker CLI and access to a Docker daemon.

Create an initial administrator securely after starting the backend once (so SQLite initializes):

```powershell
npm run create-admin --workspace backend -- "Platform Admin" admin@example.com "use-a-unique-password"
```

The command takes the password as a process argument; use a private terminal, and avoid shell history on shared systems. It does not create default credentials. Sign in as the admin to grant additional users the admin role.

## Docker Compose

Copy `.env.example` to `.env`, set `JWT_SECRET` to the output of the secure generation command above, then run:

```powershell
docker compose up --build
```

Open <http://localhost:4000>. To create an admin in the Compose container, run `docker compose exec app node backend/scripts/create-admin.js "Platform Admin" admin@example.com "use-a-unique-password"` using a private terminal and a unique password. SQLite is persisted in the `app-data` named volume. The backend mounts the host Docker socket to perform the restricted container operations; access to that socket is effectively host-administrator access. Do not expose this service or socket to untrusted users. On Linux, configure `DOCKER_GID` to match the socket's group. On Windows, use Docker Desktop with Linux containers enabled.

## Tests and checks

```powershell
npm ci
npm run lint
npm test
npm run build
docker build -t devops-build-system:local .
```

Tests use an in-memory SQLite database. They cover registration, login/logout, session protection, admin authorization, application/template validation, build success/failure status recording, and health. Docker image builds and container start/stop require a reachable Docker daemon and are not represented as successful by the tests.

## CI/CD and deployment

- `.github/workflows/ci.yml` runs on pushes to `main`/`master` and pull requests. It installs dependencies, lints, tests, builds the frontend, then builds the Docker image.
- `.github/workflows/deploy.yml` manually builds the selected commit, transfers the image over SSH, starts it on a Docker host, and waits for its health check. It requires protected `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS` secrets, plus a prepared `/etc/devops-build-system.env` on the host.
- For production, terminate TLS at a reverse proxy, set `COOKIE_SECURE=true`, use a secret manager, restrict Docker-socket access, back up the SQLite volume, and deploy on an isolated host. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Project documentation

- [Architecture and implementation plan](docs/ARCHITECTURE.md)
- [Installation and Docker setup](docs/INSTALLATION.md)
- [CI/CD workflow](docs/CI-CD.md)
- [Database schema](docs/DATABASE.md)
- [API reference](docs/API.md)
- [Testing guide](docs/TESTING.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Render setup and initial administrator](docs/RENDER.md)

## Git workflow

```powershell
git init
git add .
git commit -m "Build automated application deployment system"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

Never commit `.env`, database files, credentials, or deployment keys. GitHub Actions uses repository/environment secrets for deployment-specific values.

## Limitations

This demonstrator deliberately builds and deploys a single bundled sample application, not arbitrary uploaded projects. User-supplied build commands, image names, and Docker arguments are not accepted. The Docker socket grants powerful host access and must remain private. SQLite is appropriate for a course/demo single-host deployment; production multi-instance workloads should use a managed database and a dedicated deployment worker.
