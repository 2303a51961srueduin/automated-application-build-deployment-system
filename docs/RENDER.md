# Render deployment and initial administrator

The application currently uses SQLite (`better-sqlite3`), not Render Postgres. Its schema is initialized by `createApp()` before the startup admin bootstrap runs and before the HTTP server begins listening.

## Render filesystem and SQLite persistence

Render Free web services cannot use persistent disks. Their local filesystem is ephemeral, so SQLite data—including student accounts, admin accounts, and application records—can be lost when the service is replaced, redeployed, or its filesystem is reset. The startup bootstrap can recreate the configured initial admin, but it cannot restore other lost data.

Persistent disks are available only on eligible paid Render services. Before changing settings:

1. In the Render service's **Environment** settings, check the current `DATABASE_PATH`.
2. On a paid service with a persistent disk, ensure the SQLite file containing the existing student accounts is on that disk. On Free, assume local SQLite data is temporary.
3. If you attach a disk, mount it at a persistent path (for example `/var/data`) and set `DATABASE_PATH` to the existing SQLite file on that disk. Back up and migrate the current database before changing its path; pointing `DATABASE_PATH` at a new file creates a separate, empty database and makes existing accounts appear missing.
4. Ensure the service user can read and write the mounted SQLite file and its directory.

Do not configure `DATABASE_PATH` as a Postgres URL: this application expects a SQLite filesystem path.

## Bootstrap the initial administrator

The startup bootstrap is optional and idempotent:

- If all three `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` variables are absent, startup proceeds without creating an account.
- If any are set, all three must be valid. `ADMIN_NAME` is 2-80 characters, `ADMIN_EMAIL` must be a valid email address, and `ADMIN_PASSWORD` must be 10-128 characters.
- The password is hashed using the same `bcryptjs` mechanism and cost as student registration.
- The account is inserted with the database's `admin` role only when that email does not already exist. Existing accounts, roles, and passwords are never changed.
- A prior student registration using `ADMIN_EMAIL` remains a student. To bootstrap a separate initial admin, use an email not already registered. After signing in as that admin, an administrator can manage other user roles through the dashboard if needed.
- The server logs only whether an account was created, already existed, or configuration was invalid. It never logs the variable values or password.

### Render steps

1. Deploy the application version containing the bootstrap code.
2. Open **Render Dashboard → your Web Service → Environment**.
3. Add `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` as secret environment variables. Use an email not already present in the users table and a unique password of 10-128 characters.
4. Save the changes and trigger a deploy/restart. The server initializes the SQLite schema, then creates the admin if absent, then starts listening.
5. Check Render logs for the generic `Initial administrator account created.` message. Do not paste the password into logs or build commands. If startup reports incomplete or invalid configuration, correct the three values; the error does not include them.
6. Sign in with the configured email and password and open `/admin`.
7. **Render Free with SQLite:** Keep all three bootstrap variables configured. If the ephemeral database is lost, the next startup recreates the initial admin. This does not restore student accounts or other data. Keeping `ADMIN_PASSWORD` in the service environment is a security trade-off: anyone with sufficient access to the Render service settings may be able to view or change it. Use a unique strong password, restrict Render dashboard access, and never put it in source code or logs.
8. **Persistent storage:** Removing the bootstrap variables is suitable only when the SQLite database is stored on a persistent disk attached to an eligible paid Render service, or when using another persistent database setup. After confirming the admin account exists in that persistent database, you may remove the variables and redeploy; the account and password remain unchanged. If the variables remain set, later restarts are idempotent and do not reset the password.

If Render currently uses a native Node service rather than the Dockerfile, ensure its start command runs `npm run start --workspace backend` so this startup bootstrap executes. For the Dockerfile deployment, the existing `CMD` starts `backend/src/server.js`.
