# Installation

## Local development

1. Install Node.js 22 or newer and npm.
2. Copy `.env.example` to `.env`; set a random `JWT_SECRET` of at least 32 characters.
3. Run `npm ci`.
4. Run `npm run lint`, `npm test`, and `npm run build`.
5. Start with `npm run dev`. The Vite frontend is at <http://localhost:5173>; Express is at <http://localhost:4000>.
6. Register a user, create an application, then run a build. The build executes the bundled sample's Node.js build script; it is not a fabricated success.
7. To bootstrap an administrator, initialize the database by starting the backend, stop it, then use:

   ```powershell
   npm run create-admin --workspace backend -- "Platform Admin" admin@example.com "use-a-unique-password"
   ```

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `NODE_ENV` | Runtime mode | `development` |
| `PORT` | Backend HTTP port | `4000` |
| `JWT_SECRET` | JWT signing secret; required, minimum 32 chars | none |
| `JWT_EXPIRES_IN` | JWT lifetime | `8h` |
| `COOKIE_SECURE` | Set secure cookie attribute behind HTTPS | `false` |
| `DATABASE_PATH` | SQLite file path | `./data/app.sqlite` |
| `DOCKER_GID` | Linux supplementary group ID granting access to the mounted Docker socket | `999` |

Never put production credentials in tracked files.

## Docker Compose

Install Docker Desktop/Engine and ensure the daemon is running. Copy `.env.example` to `.env`, set a unique `JWT_SECRET`, and run:

```powershell
docker compose up --build
```

The service exposes port 4000, checks `/api/health`, persists SQLite in the `app-data` volume, and uses the private Docker socket to start managed sample containers. On Linux, set `DOCKER_GID` to the group ID that owns `/var/run/docker.sock`. Visit <http://localhost:4000>. Use `docker compose down` to stop the stack; the named database volume remains. Add `-v` only if you intend to permanently delete the database.
